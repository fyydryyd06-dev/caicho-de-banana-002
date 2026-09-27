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
