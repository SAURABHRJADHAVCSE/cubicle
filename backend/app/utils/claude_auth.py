"""Drives `claude setup-token`'s interactive OAuth flow from the API, so the
UI can offer a "Connect Claude Code" button instead of a terminal command.

`claude` is an Ink-based TUI: it renders nothing at all without a real
pseudo-terminal. So this spawns it with a PTY, scrapes the OAuth URL out of
the raw ANSI stream once it prints one, and later writes the user-supplied
authorization code back to the PTY as if they'd typed it (as two separate
writes — code, then a lone \r a beat later — because a single "code\r"
write let the input handler swallow the \r as part of a pasted-text burst
instead of recognizing it as a distinct Enter keypress).

Important: `claude setup-token` does NOT persist anything to disk or a
keychain by itself — confirmed by inspecting the container filesystem
after a successful run found nothing new. It prints the OAuth token to
the terminal and tells the user to `export CLAUDE_CODE_OAUTH_TOKEN=...`
themselves. So this module extracts that printed token and the caller
(app/api/settings.py) is responsible for storing it (encrypted, in the
`settings` table) and for the engine injecting it as an env var later.

A background thread drains the PTY continuously for the whole session
lifetime (not just while hunting for the URL) — otherwise, once nobody's
reading, the kernel's pty buffer could fill up as the CLI prints further
output and its own write() call would block. Failures log the drained
buffer's tail so a real hang is actually diagnosable instead of guessed
at from a bare timeout.

Single global session (module-level state, no per-user scoping) — this is
a self-hosted, single-operator admin action, not a multi-tenant flow.
"""

import asyncio
import os
import pty
import re
import select
import subprocess
import threading
import time

import structlog

logger = structlog.get_logger()

_URL_START_RE = re.compile(r"https://claude\.com/cai/oauth/authorize\?")

# Matches ANSI OSC (hyperlinks), CSI (cursor movement/color), and charset-
# select escape sequences, so a long value the TUI wrapped across visual
# lines can be rejoined into one clean string.
_ANSI_RE = re.compile(
    r"\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)"
    r"|\x1b\[[0-9;?]*[a-zA-Z]"
    r"|\x1b[()][A-Za-z0-9]"
    r"|\x1b[=>]"
)

# \r + move-down-exactly-1-row (the move-right component is optional — a
# real captured failure showed the CLI sometimes wrapping with a bare
# `\r\x1b[1B`, no cursor-forward code at all, which the original stricter
# pattern didn't match): the TUI wrapping one long value across two visual
# lines. The two halves are really one continuous string, so this is
# dropped with no separator — including one trailing literal space, since
# the CLI pads every line in this block with a 1-space left indent and
# that indent lands right at the wrap point when a value splits there
# (confirmed against a real `sk-ant-oat01-...` token that got split into
# two lines with a bare " " between them in the raw stream). A move-down
# of 2+ rows, by contrast, is a real paragraph break (there's a blank line
# between them on screen) and gets a space instead — see
# _PARAGRAPH_BREAK_RE below. Distinguishing these is what makes token
# reassembly actually work; without it there's no way to tell "wrapped
# mid-value" from "next sentence" once escape codes are stripped and
# everything is flush against the last char.
_LINE_WRAP_RE = re.compile(r"\r(?:\x1b\[\d*C)?\x1b\[1B ?")
_PARAGRAPH_BREAK_RE = re.compile(r"\r\x1b\[\d*C\x1b\[\d*B")
# Same-row word positioning (`\x1b[<n>G` — "move to column n") separates
# two on-screen words with no literal space character; put one back.
_COLUMN_JUMP_RE = re.compile(r"\x1b\[\d+G")

# Anchored on the CLI's own literal wording (observed directly from a real
# successful run) rather than a bare token-shaped regex — a bare
# `sk-ant-oat\d+-[A-Za-z0-9_-]+` charset match has no way to tell where the
# token ends and the following sentence begins once escape codes/\r are
# stripped and everything is flush against itself. Brittle to CLI wording
# changes; the trade-off favors precision over that small robustness cost.
_TOKEN_SECTION_RE = re.compile(r"Your OAuth token.*?:(.*?)Store this token", re.DOTALL)
_TOKEN_SHAPE_RE = re.compile(r"sk-ant-oat\d+-[A-Za-z0-9_-]+")

_lock = threading.Lock()
_session: "_AuthSession | None" = None

# Module-level so tests can substitute a fake command instead of the real
# `claude` CLI.
_SETUP_TOKEN_CMD = ["claude", "setup-token"]


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


def _strip_ansi(text: str) -> str:
    # Order matters: resolve the two \r+cursor-motion cases (line-wrap vs.
    # paragraph-break) before the generic ANSI/control-char cleanup, or the
    # generic pass would eat the cursor-motion codes first and leave a
    # bare \r with no way to tell which case it was.
    text = _LINE_WRAP_RE.sub("", text)
    text = _PARAGRAPH_BREAK_RE.sub(" ", text)
    text = _COLUMN_JUMP_RE.sub(" ", text)
    text = _ANSI_RE.sub("", text)
    return text.replace("\r", " ").replace("\x0f", "")


def _extract_oauth_token(buffer: str) -> str | None:
    """Pull the printed OAuth token out of the raw PTY stream."""
    cleaned = _strip_ansi(buffer)
    section = _TOKEN_SECTION_RE.search(cleaned)
    if not section:
        return None
    candidate = section.group(1).strip()
    shape = _TOKEN_SHAPE_RE.fullmatch(candidate)
    return shape.group(0) if shape else None


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

    logger.error("claude_auth_start_timeout_buffer", buffer=session.text()[-2000:])
    session.proc.kill()
    session.close()
    with _lock:
        if _session is session:
            _session = None
    raise TimeoutError("claude setup-token did not print an auth URL in time")


def submit_claude_auth_code(code: str, timeout: float = 90.0) -> str:
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
        # Two separate writes, not one "code\r" blob: the logged buffer
        # showed the code arriving and being echoed back masked (as ****),
        # in both the \n and \r attempts — the *code* was received fine
        # both times, but submit never fired either way. If the input
        # handler treats a multi-byte burst as a single "paste" event, a
        # trailing \r bundled into that same write could be swallowed as
        # part of the pasted text instead of recognized as a distinct
        # Enter keypress — which is exactly how a real user's paste
        # (one burst) followed by pressing Enter (a separate keystroke,
        # a beat later) would actually arrive.
        os.write(session.master_fd, code.strip().encode())
        time.sleep(0.15)
        os.write(session.master_fd, b"\r")
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

    if returncode is None:
        logger.error("claude_auth_complete_timeout_buffer", buffer=session.text()[-2000:])
        session.proc.kill()
        session.close()
        raise RuntimeError(
            "Timed out waiting for Claude to confirm the code — it may have expired. "
            "Try Connect again."
        )

    buffer_tail = session.text()[-2000:]
    session.close()

    if returncode != 0:
        logger.error("claude_auth_complete_nonzero_exit_buffer", buffer=buffer_tail)
        raise RuntimeError(f"claude setup-token exited with code {returncode} — check the code and try again")

    token = _extract_oauth_token(buffer_tail)
    if not token:
        logger.error("claude_auth_token_extraction_failed_buffer", buffer=buffer_tail)
        raise RuntimeError(
            "Claude confirmed the code but the token couldn't be read from its "
            "output — this usually means the CLI changed its wording. Check the "
            "server logs for the raw output."
        )
    return token


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


async def astart_claude_auth() -> str:
    return await asyncio.to_thread(start_claude_auth)


async def asubmit_claude_auth_code(code: str) -> str:
    return await asyncio.to_thread(submit_claude_auth_code, code)


async def acancel_claude_auth() -> None:
    await asyncio.to_thread(cancel_claude_auth)
