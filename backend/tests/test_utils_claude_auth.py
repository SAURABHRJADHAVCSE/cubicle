"""Tests for the claude_auth PTY-driven OAuth relay.

start_claude_auth/submit_claude_auth_code are tested against a real PTY
(pty.openpty is a real OS primitive, not worth mocking) but with a fake
shell command standing in for the actual `claude` CLI — a small script
that mimics its observed behavior: print garbled/doubled URL-ish output,
read one line, exit 0 or 1 depending on what was sent.
"""

import textwrap

import pytest

from app.utils import claude_auth as claude_auth_module
from app.utils.claude_auth import (
    _extract_auth_url,
    cancel_claude_auth,
    get_claude_auth_status,
    start_claude_auth,
    submit_claude_auth_code,
)

SAMPLE_DOUBLED_URL = (
    "Browser didn't open? Use the url below\n"
    "https://claude.com/cai/oauth/authorize?code=true&client_id=abc&state=XYZ"
    "https://claude.com/cai/oauth/authorize?code=true&client_id=ab\n"
    "Paste code here if prompted >"
)


def test_extract_auth_url_truncates_doubled_render() -> None:
    url = _extract_auth_url(SAMPLE_DOUBLED_URL)
    assert url == "https://claude.com/cai/oauth/authorize?code=true&client_id=abc&state=XYZ"


def test_extract_auth_url_returns_none_when_absent() -> None:
    assert _extract_auth_url("nothing here") is None


@pytest.fixture
def fake_setup_token_script(tmp_path, monkeypatch: pytest.MonkeyPatch):
    script = tmp_path / "fake_claude.sh"
    script.write_text(
        textwrap.dedent(
            """\
            #!/bin/sh
            echo "Use the url below to sign in"
            echo "https://claude.com/cai/oauth/authorize?code=true&client_id=test"
            read code
            if [ "$code" = "good-code" ]; then
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

    submit_claude_auth_code("good-code")  # should not raise


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


def test_get_claude_auth_status_parses_json(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    script = tmp_path / "fake_status.sh"
    script.write_text('#!/bin/sh\necho \'{"loggedIn": true, "authMethod": "oauth"}\'\n')
    script.chmod(0o755)
    monkeypatch.setattr(claude_auth_module, "_AUTH_STATUS_CMD", ["sh", str(script)])

    status = get_claude_auth_status()
    assert status == {"loggedIn": True, "authMethod": "oauth"}


def test_get_claude_auth_status_handles_failure(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    script = tmp_path / "broken_status.sh"
    script.write_text("#!/bin/sh\necho 'not json'\nexit 1\n")
    script.chmod(0o755)
    monkeypatch.setattr(claude_auth_module, "_AUTH_STATUS_CMD", ["sh", str(script)])

    status = get_claude_auth_status()
    assert status["loggedIn"] is False
