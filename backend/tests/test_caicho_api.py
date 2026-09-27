"""Backend regression tests for Caicho de Banana (FastAPI proxy -> Express)."""
import os
import requests

BASE_URL = "https://pf-senha-flow.preview.emergentagent.com"


class TestHealth:
    def test_healthz(self):
        r = requests.get(f"{BASE_URL}/api/healthz", timeout=15)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


class TestAdminAuth:
    def test_admin_login_success(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"username": "donas", "password": "Seinao10@@"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # token may be under different keys - accept any JWT-like field
        token = data.get("token") or data.get("accessToken") or data.get("access_token")
        assert token, f"no token in response: {data}"
        assert isinstance(token, str) and token.count(".") == 2

    def test_admin_login_wrong_password(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"username": "donas", "password": "wrong"},
            timeout=15,
        )
        assert r.status_code == 401

    def test_admin_me_with_token(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/login",
            json={"username": "donas", "password": "Seinao10@@"},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        token = data.get("token") or data.get("accessToken") or data.get("access_token")
        assert token
        r2 = requests.get(
            f"{BASE_URL}/api/admin/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r2.status_code == 200, r2.text
        me = r2.json()
        assert me.get("username") == "donas"
        assert me.get("role") == "admin"

    def test_admin_me_no_token(self):
        r = requests.get(f"{BASE_URL}/api/admin/me", timeout=15)
        assert r.status_code == 401


class TestPFSenha:
    def test_pf_senha_consultar(self):
        r = requests.post(
            f"{BASE_URL}/api/pf/senha/consultar",
            json={"agency": "00019", "account": "987654"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, dict)



# Access tracking endpoints
class TestAccessTracking:
    def _login(self):
        r = requests.post(f"{BASE_URL}/api/admin/login",
                          json={"username": "donas", "password": "Seinao10@@"}, timeout=15)
        assert r.status_code == 200
        return r.json().get("token") or r.json().get("accessToken")

    def test_track_public(self):
        r = requests.post(f"{BASE_URL}/api/access/track", json={
            "route": "/TEST_backend", "language": "pt-BR", "timezone": "America/Sao_Paulo",
            "screen": "1920x1080", "referrer": "", "userAgent": "pytest-agent/1.0"
        }, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_stats_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/access/stats", timeout=15)
        assert r.status_code == 401

    def test_list_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/access/list", timeout=15)
        assert r.status_code == 401

    def test_export_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/access/export", timeout=15)
        assert r.status_code == 401

    def test_stats_with_token(self):
        # Ensure at least one access exists
        requests.post(f"{BASE_URL}/api/access/track", json={"route": "/TEST_stats"}, timeout=15)
        token = self._login()
        r = requests.get(f"{BASE_URL}/api/access/stats",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("total", "today", "lastHour", "last7days", "byHour", "topRoutes", "recent"):
            assert k in d, f"missing key {k}"
        assert d["total"] >= 1
        assert isinstance(d["byHour"], list) and len(d["byHour"]) == 24
        assert isinstance(d["recent"], list)

    def test_list_with_token_and_search(self):
        requests.post(f"{BASE_URL}/api/access/track", json={"route": "/TEST_list_unique"}, timeout=15)
        token = self._login()
        r = requests.get(f"{BASE_URL}/api/access/list",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert isinstance(items, list) and len(items) >= 1
        item = items[0]
        for k in ("id", "route", "ip", "browser", "createdAt"):
            assert k in item

        r2 = requests.get(f"{BASE_URL}/api/access/list?q=TEST_list_unique",
                          headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r2.status_code == 200
        assert any("TEST_list_unique" in it["route"] for it in r2.json().get("items", []))

    def test_export_csv(self):
        token = self._login()
        r = requests.get(f"{BASE_URL}/api/access/export",
                         headers={"Authorization": f"Bearer {token}"}, timeout=15)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("Content-Type", "")
        body = r.text
        assert body.startswith('createdAt,route,ip,browser')
