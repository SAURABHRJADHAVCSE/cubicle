"""Drives `claude setup-token`'s interactive OAuth flow from the API, so the
UI can offer a "Connect Claude Code" button instead of a terminal command.

`claude` is an Ink-based TUI: it renders nothing at all without a real
pseudo-terminal (confirmed — piping it non-interactively just hangs with no
output). So this spawns it with a PTY, scrapes the OAuth URL out of the
raw ANSI stream once it prints one, then later writes the user-supplied
authorization code back to the PTY as if they'd typed it.

A background thread drains the PTY continuously for the whole session
lifetime (not just while hunting for the URL). Without that, once nobody's
reading, the kernel's pty buffer fills up as the CLI prints further
output (progress spinners, a success message, etc.) — its own write()
call then blocks, so it never reaches exit(), and `proc.wait()` on our
side just times out no matter how long we wait. Confirmed as the actual
cause of a real timeout, not a hypothetical.

Single global session (module-level state, no per-user scoping) — this is
a self-hosted, single-operator admin action, not a multi-tenant flow.
"""

import asyncio
import json
import os
import pty
import re
import select
import subprocess
import threading
import time

_URL_START_RE = re.compile(r"https://claude\.com/cai/oauth/authorize\?")
_lock = threading.Lock()
_session: "_AuthSession | None" = None

# Module-level so tests can substitute a fake command instead of the real
# `claude` CLI.
_SETUP_TOKEN_CMD = ["claude", "setup-token"]
_AUTH_STATUS_CMD = ["claude", "auth", "status"]


class _AuthSession:
    """One `claude setup-token` child process plus its continuously-drained
    PTY output buffer."""

    def __init__(self, proc: subprocess.Popen, master_fd: int) -> None:
        self.proc = proc
        self.master_fd = master_fd
        self._buffer = b""
        self._buffer_lock = threading.Lock()
        self._reader = threading.Thread(target=self._drain, daemon=True)
        self._reader.start()

    def _drain(self) -> None:
        """Keep reading master_fd until the child exits and its output is
        exhausted — this is what prevents the child from blocking on a
        full pty buffer."""
        while True:
            try:
                ready, _, _ = select.select([self.master_fd], [], [], 0.5)
            except (OSError, ValueError):
                return
            if self.master_fd in ready:
                try:
                    chunk = os.read(self.master_fd, 4096)
                except OSError:
                    return
                if not chunk:
                    return
                with self._buffer_lock:
                    self._buffer += chunk
            elif self.proc.poll() is not None:
                # Process has exited and there's nothing left to read.
                return

    def text(self) -> str:
        with self._buffer_lock:
            return self._buffer.decode(errors="ignore")

    def close(self) -> None:
        try:
            os.close(self.master_fd)
        except OSError:
            pass  # already closed


def _strip_api_key(env: dict[str, str]) -> dict[str, str]:
    return {k: v for k, v in env.items() if k != "ANTHROPIC_API_KEY"}


def _extract_auth_url(buffer: str) -> str | None:
    """Pull the OAuth URL out of the raw PTY stream.

    The TUI redraws the hyperlink escape sequence on every spinner frame,
    which (in the raw byte stream, before a real terminal's cursor-motion
    codes would collapse the redraws) looks like the URL concatenated with
    itself. There's only ever one real URL, so truncate at wherever a
    second "https://" shows up.
    """
    match = _URL_START_RE.search(buffer)
    if not match:
        return None
    start = match.start()
    rest = buffer[start:]
    next_https = rest.find("https://", len("https://"))
    url_text = rest if next_https == -1 else rest[:next_https]
    # Trim any trailing control/escape bytes picked up past the URL itself.
    return re.split(r"[\s\x07\x1b]", url_text)[0]


def start_claude_auth(timeout: float = 20.0) -> str:
    """Spawn `claude setup-token` and return the OAuth URL it prints."""
    global _session

    with _lock:
        if _session is not None and _session.proc.poll() is None:
            raise RuntimeError("A Claude Code connection attempt is already in progress")

        master_fd, slave_fd = pty.openpty()
        proc = subprocess.Popen(
            _SETUP_TOKEN_CMD,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            env=_strip_api_key(dict(os.environ)),
            close_fds=True,
        )
        os.close(slave_fd)
        session = _AuthSession(proc, master_fd)
        _session = session

    deadline = time.time() + timeout
    while time.time() < deadline:
        url = _extract_auth_url(session.text())
        if url:
            return url
        time.sleep(0.2)

    session.proc.kill()
    session.close()
    with _lock:
        if _session is session:
            _session = None
    raise TimeoutError("claude setup-token did not print an auth URL in time")


def submit_claude_auth_code(code: str, timeout: float = 90.0) -> None:
    """Send the pasted authorization code to the waiting `claude setup-token`.

    90s, not a snappier default: exchanging the code for a token is a real
    network round-trip to Anthropic's servers on the CLI's side, observed
    to occasionally take noticeably longer than 30s.
    """
    global _session

    with _lock:
        session = _session

    if session is None:
        raise RuntimeError("No Claude Code connection attempt in progress — start one first")

    try:
        os.write(session.master_fd, (code.strip() + "\n").encode())
    except OSError as exc:
        with _lock:
            if _session is session:
                _session = None
        session.close()
        raise RuntimeError(
            "The connection attempt is no longer active — it may have expired. "
            "Try Connect again."
        ) from exc

    deadline = time.time() + timeout
    returncode: int | None = None
    while time.time() < deadline:
        returncode = session.proc.poll()
        if returncode is not None:
            break
        time.sleep(0.3)

    with _lock:
        if _session is session:
            _session = None
    session.close()

    if returncode is None:
        session.proc.kill()
        raise RuntimeError(
            "Timed out waiting for Claude to confirm the code — it may have expired. "
            "Try Connect again."
        )

    if returncode != 0:
        raise RuntimeError(f"claude setup-token exited with code {returncode} — check the code and try again")


def cancel_claude_auth() -> None:
    """Kill a pending `claude setup-token` the user backed out of, so a
    future start() isn't blocked by a session nobody will ever complete."""
    global _session

    with _lock:
        session = _session
        _session = None

    if session is None:
        return
    if session.proc.poll() is None:
        session.proc.kill()
        session.proc.wait(timeout=5)
    session.close()


def get_claude_auth_status() -> dict:
    """Report whether the CLI has a stored subscription session.

    Runs with ANTHROPIC_API_KEY stripped, same as ClaudeCodeEngine's actual
    subprocess calls — otherwise this would report "connected" via the API
    key even with no subscription session stored.
    """
    try:
        result = subprocess.run(
            _AUTH_STATUS_CMD,
            env=_strip_api_key(dict(os.environ)),
            capture_output=True,
            text=True,
            timeout=10,
        )
        return json.loads(result.stdout)
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError) as exc:
        return {"loggedIn": False, "authMethod": "none", "error": str(exc)}


async def astart_claude_auth() -> str:
    return await asyncio.to_thread(start_claude_auth)


async def asubmit_claude_auth_code(code: str) -> None:
    await asyncio.to_thread(submit_claude_auth_code, code)


async def acancel_claude_auth() -> None:
    await asyncio.to_thread(cancel_claude_auth)


async def aget_claude_auth_status() -> dict:
    return await asyncio.to_thread(get_claude_auth_status)
