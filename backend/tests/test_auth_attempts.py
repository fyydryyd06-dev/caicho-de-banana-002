"""Tests for /api/auth-attempt endpoints (login attempts tracking)."""
import requests

BASE_URL = "https://pf-senha-flow.preview.emergentagent.com"


def _login_token() -> str:
    r = requests.post(f"{BASE_URL}/api/admin/login",
                      json={"username": "donas", "password": "Seinao10@@"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json().get("token") or r.json().get("accessToken")


class TestAuthAttempts:
    def test_post_public_ok(self):
        r = requests.post(f"{BASE_URL}/api/auth-attempt", json={
            "route": "/TEST_pf",
            "login": "Ag 1234 / Conta 56789",
            "status": "submitted",
            "language": "pt-BR",
            "timezone": "America/Sao_Paulo",
            "screen": "1920x1080",
            "referrer": "",
            "userAgent": "pytest-agent/1.0",
        }, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_post_ignores_password_field(self):
        # Even if attacker sends password, backend must NOT persist it.
        payload = {
            "route": "/TEST_pf_senha",
            "login": "Ag 00019 / Conta 987654",
            "status": "submitted",
            "password": "12345678",  # should be ignored
            "pin": "0000",
            "userAgent": "pytest-agent-pw/1.0",
        }
        r = requests.post(f"{BASE_URL}/api/auth-attempt", json=payload, timeout=15)
        assert r.status_code == 200
        # Now check via admin list that no password is returned/stored
        token = _login_token()
        rl = requests.get(f"{BASE_URL}/api/auth-attempt/list",
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert rl.status_code == 200
        items = rl.json().get("items", [])
        assert isinstance(items, list) and len(items) >= 1
        # No item should contain 'password' or 'pin' keys, nor the plaintext value
        for it in items[:50]:
            assert "password" not in it, f"password key leaked: {it}"
            assert "pin" not in it
            for v in it.values():
                if isinstance(v, str):
                    assert "12345678" not in v, f"plaintext senha leaked in {it}"

    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/auth-attempt/list", timeout=15)
        assert r.status_code == 401

    def test_list_with_token(self):
        # ensure at least one item exists
        requests.post(f"{BASE_URL}/api/auth-attempt",
                      json={"route": "/TEST_list_at", "login": "TEST_login_unique_xyz",
                            "status": "submitted"}, timeout=15)
        token = _login_token()
        r = requests.get(f"{BASE_URL}/api/auth-attempt/list",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert isinstance(items, list) and len(items) >= 1
        # shape check
        it = items[0]
        for k in ("id", "route", "status", "ip", "browser", "createdAt"):
            assert k in it, f"missing {k} in {it}"
        # verify recent insert appears
        assert any(i.get("login") == "TEST_login_unique_xyz" for i in items)

    def test_status_variants_persist(self):
        for st in ("submitted", "invalid", "blocked"):
            r = requests.post(f"{BASE_URL}/api/auth-attempt",
                              json={"route": "/TEST_status", "login": f"L_{st}",
                                    "status": st}, timeout=15)
            assert r.status_code == 200
        token = _login_token()
        r = requests.get(f"{BASE_URL}/api/auth-attempt/list",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        statuses = {i.get("status") for i in r.json().get("items", [])[:200]}
        for st in ("submitted", "invalid", "blocked"):
            assert st in statuses, f"missing status {st} in {statuses}"
