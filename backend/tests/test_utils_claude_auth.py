"""Tests for the claude_auth PTY-driven OAuth relay.

start_claude_auth/submit_claude_auth_code are tested against a real PTY
(pty.openpty is a real OS primitive, not worth mocking) but with a fake
shell command standing in for the actual `claude` CLI.
"""

import textwrap

import pytest

from app.utils import claude_auth as claude_auth_module
from app.utils.claude_auth import (
    _extract_auth_url,
    _extract_oauth_token,
    cancel_claude_auth,
    start_claude_auth,
    submit_claude_auth_code,
)

SAMPLE_DOUBLED_URL = (
    "Browser didn't open? Use the url below\n"
    "https://claude.com/cai/oauth/authorize?code=true&client_id=abc&state=XYZ"
    "https://claude.com/cai/oauth/authorize?code=true&client_id=ab\n"
    "Paste code here if prompted >"
)

# Captured verbatim from a real successful `claude setup-token` run — the
# raw PTY bytes, including the ANSI cursor-motion codes that wrap the long
# token across two visual lines mid-token.
REAL_SUCCESS_BUFFER = (
    "✓[4GLong-lived[15Gauthentication[30Gtoken[36Gcreated"
    "[44Gsuccessfully!\r[1C[1B[K\r[1C[1BYour OAuth "
    "token (valid for 1 year):[K\r[1C[1B[K\r[1C[1B"
    "sk-ant-oat01-TJXcuK0YrlDMkV5V1nz_8yi64smMEQ23IXvLsyoe8Z9hfFYxa5QYT9es7vu-ksqU-h"
    "\r[1C[1Bt5jSbhmiXDLC9MG5TmKA-XrjT1gAA\r[1C[2BStore[8Gthis"
    "[13Gtoken[19Gsecurely.[29GYou[33Gwon't[39Gbe[42Gable"
    "[47Gto[50Gsee[54Git[57Gagain.\r[1C[1B[K"
    "\r[1C[1BUse[6Gthis[11Gtoken[17Gby[20Gsetting:"
    "[29Gexport CLAUDE_CODE_OAUTH_TOKEN=<token>[K\r\r\n"
)
REAL_SUCCESS_TOKEN = (
    "sk-ant-oat01-TJXcuK0YrlDMkV5V1nz_8yi64smMEQ23IXvLsyoe8Z9hfFYxa5QYT9es7vu-ksqU-h"
    "t5jSbhmiXDLC9MG5TmKA-XrjT1gAA"
)


def test_extract_auth_url_truncates_doubled_render() -> None:
    url = _extract_auth_url(SAMPLE_DOUBLED_URL)
    assert url == "https://claude.com/cai/oauth/authorize?code=true&client_id=abc&state=XYZ"


def test_extract_auth_url_returns_none_when_absent() -> None:
    assert _extract_auth_url("nothing here") is None


def test_extract_oauth_token_rejoins_line_wrapped_token() -> None:
    assert _extract_oauth_token(REAL_SUCCESS_BUFFER) == REAL_SUCCESS_TOKEN


# Captured from a real failed connection attempt: this CLI run wrapped the
# token with a bare `\r\x1b[1B` (no `\x1b[<n>C` cursor-forward component,
# unlike REAL_SUCCESS_BUFFER above) followed by a literal indent space —
# the original _LINE_WRAP_RE required the forward-cursor code, so this
# pattern fell through to generic stripping and left a stray space in the
# middle of the token, breaking _TOKEN_SHAPE_RE's match entirely. Written
# with explicit \x1b escapes (unlike REAL_SUCCESS_BUFFER's embedded raw
# bytes above) so the wrap sequence is unambiguous on the page — both
# produce an identical runtime string.
REAL_BARE_WRAP_BUFFER = (
    "✓\x1b[4GLong-lived\x1b[15Gauthentication\x1b[30Gtoken\x1b[36Gcreated"
    "\x1b[44Gsuccessfully!\r\x1b[1B\x1b[K\r\x1b[1B Your OAuth token (valid for 1 year):"
    "\x1b[K\r\x1b[1B\x1b[K\r\x1b[1B sk-ant-oat01-0GxdL1S6qu5Zg9-rV3tViWCEdWnIlCLmIQ_o636PusuJwMB9V5V08dB6lw6CtqXxn6"
    "\r\x1b[1B p4SHhjCho7MJ4OS6fAng-X2uZ7AAA\r\x1b[1C\x1b[2BStore\x1b[8Gthis"
    "\x1b[13Gtoken\x1b[19Gsecurely."
)
REAL_BARE_WRAP_TOKEN = (
    "sk-ant-oat01-0GxdL1S6qu5Zg9-rV3tViWCEdWnIlCLmIQ_o636PusuJwMB9V5V08dB6lw6CtqXxn6"
    "p4SHhjCho7MJ4OS6fAng-X2uZ7AAA"
)


def test_extract_oauth_token_rejoins_bare_wrap_token() -> None:
    assert _extract_oauth_token(REAL_BARE_WRAP_BUFFER) == REAL_BARE_WRAP_TOKEN


def test_extract_oauth_token_returns_none_when_absent() -> None:
    assert _extract_oauth_token("nothing here") is None


@pytest.fixture
def fake_setup_token_script(tmp_path, monkeypatch: pytest.MonkeyPatch):
    """A fake `claude setup-token` that prints a URL, reads a code, and on
    the accepted code prints output shaped like the real success message
    (so submit_claude_auth_code's token extraction has something to find).
    """
    script = tmp_path / "fake_claude.sh"
    script.write_text(
        textwrap.dedent(
            """\
            #!/bin/sh
            echo "Use the url below to sign in"
            echo "https://claude.com/cai/oauth/authorize?code=true&client_id=test"
            read code
            if [ "$code" = "good-code" ]; then
              echo "Your OAuth token (valid for 1 year):"
              echo "sk-ant-oat01-faketoken1234567890"
              echo "Store this token securely."
              exit 0
            else
              exit 1
            fi
            """
        )
    )
    script.chmod(0o755)
    monkeypatch.setattr(claude_auth_module, "_SETUP_TOKEN_CMD", ["sh", str(script)])
    yield
    cancel_claude_auth()


def test_start_and_complete_auth_flow_success(fake_setup_token_script) -> None:
    url = start_claude_auth(timeout=5)
    assert url == "https://claude.com/cai/oauth/authorize?code=true&client_id=test"

    token = submit_claude_auth_code("good-code")
    assert token == "sk-ant-oat01-faketoken1234567890"


def test_complete_auth_flow_failure_raises(fake_setup_token_script) -> None:
    start_claude_auth(timeout=5)

    with pytest.raises(RuntimeError, match="exited with code"):
        submit_claude_auth_code("wrong-code")


def test_submit_without_start_raises() -> None:
    with pytest.raises(RuntimeError, match="No Claude Code connection attempt"):
        submit_claude_auth_code("anything")


def test_submit_converts_wait_timeout_to_friendly_error(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Reads the code but never exits — simulates the CLI taking longer than
    # our wait timeout to exchange the code with Anthropic's servers.
    script = tmp_path / "slow_claude.sh"
    script.write_text(
        '#!/bin/sh\necho "https://claude.com/cai/oauth/authorize?code=true"\nread code\nsleep 5\n'
    )
    script.chmod(0o755)
    monkeypatch.setattr(claude_auth_module, "_SETUP_TOKEN_CMD", ["sh", str(script)])

    start_claude_auth(timeout=5)
    with pytest.raises(RuntimeError, match="Timed out waiting"):
        submit_claude_auth_code("any-code", timeout=0.5)

    # Session must still be cleared so the user can retry immediately.
    assert claude_auth_module._session is None


def test_submit_after_child_already_exited_reports_its_exit_code(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Exits immediately without reading stdin — simulates the CLI's own
    # internal timeout firing before the user pastes a code back. Writing
    # to a pty whose child already exited doesn't raise (it just buffers),
    # so this surfaces via the normal exit-code check, not the OSError path
    # — confirmed empirically, not assumed.
    script = tmp_path / "dead_claude.sh"
    script.write_text(
        '#!/bin/sh\necho "https://claude.com/cai/oauth/authorize?code=true"\nexit 1\n'
    )
    script.chmod(0o755)
    monkeypatch.setattr(claude_auth_module, "_SETUP_TOKEN_CMD", ["sh", str(script)])

    start_claude_auth(timeout=5)
    import time

    time.sleep(0.2)  # let the script actually exit before we write to it

    with pytest.raises(RuntimeError, match="exited with code 1"):
        submit_claude_auth_code("any-code")

    # Session must still be cleared so the user can retry immediately.
    assert claude_auth_module._session is None


def test_submit_raises_if_token_cannot_be_extracted(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Exits 0 (success) but with wording that doesn't match what we parse
    # for — simulates a future CLI wording change.
    script = tmp_path / "unparseable_claude.sh"
    script.write_text(
        '#!/bin/sh\necho "https://claude.com/cai/oauth/authorize?code=true"\n'
        'read code\necho "All done, nothing to see here"\nexit 0\n'
    )
    script.chmod(0o755)
    monkeypatch.setattr(claude_auth_module, "_SETUP_TOKEN_CMD", ["sh", str(script)])

    start_claude_auth(timeout=5)
    with pytest.raises(RuntimeError, match="token couldn't be read"):
        submit_claude_auth_code("any-code")


def test_start_twice_conflicts(fake_setup_token_script) -> None:
    start_claude_auth(timeout=5)
    with pytest.raises(RuntimeError, match="already in progress"):
        start_claude_auth(timeout=5)
    submit_claude_auth_code("good-code")


def test_cancel_lets_a_new_session_start(fake_setup_token_script) -> None:
    start_claude_auth(timeout=5)
    cancel_claude_auth()

    # Should not raise "already in progress" now that the prior session was killed.
    start_claude_auth(timeout=5)
    submit_claude_auth_code("good-code")


def test_cancel_without_active_session_is_a_noop() -> None:
    cancel_claude_auth()  # should not raise


def test_start_auth_timeout_raises(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    silent_script = tmp_path / "silent.sh"
    silent_script.write_text("#!/bin/sh\nsleep 5\n")
    silent_script.chmod(0o755)
    monkeypatch.setattr(claude_auth_module, "_SETUP_TOKEN_CMD", ["sh", str(silent_script)])

    with pytest.raises(TimeoutError):
        start_claude_auth(timeout=0.5)
