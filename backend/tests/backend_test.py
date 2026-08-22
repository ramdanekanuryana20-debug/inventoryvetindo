"""Backend tests for Indonesian Inventory & Sales system."""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://inventory-pro-1095.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "ramdanekanuryana20@gmail.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and data["user"]["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def client(token):
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ----- Auth -----
class TestAuth:
    def test_protected_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/products", timeout=30)
        assert r.status_code == 401

    def test_login_bad_creds(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_me(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ----- Products -----
class TestProducts:
    created_id = None

    def test_create_product_computed(self, client):
        payload = {"nama_produk": "TEST_ACIDURIN", "qty": 100, "harga_modal": 302640,
                   "stock": 73, "keterangan": "EXP 02/26"}
        r = client.post(f"{BASE_URL}/api/products", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["modal_per_qty"] == 3026.4
        assert d["modal_fisik"] == round(3026.4 * 73, 2)
        TestProducts.created_id = d["id"]

    def test_list_products_has_created(self, client):
        r = client.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert TestProducts.created_id in ids

    def test_update_product(self, client):
        r = client.put(f"{BASE_URL}/api/products/{TestProducts.created_id}",
                       json={"nama_produk": "TEST_ACIDURIN2", "qty": 50,
                             "harga_modal": 100000, "stock": 10, "keterangan": "x"})
        assert r.status_code == 200
        d = r.json()
        assert d["nama_produk"] == "TEST_ACIDURIN2"
        assert d["modal_per_qty"] == 2000.0
        assert d["modal_fisik"] == 20000.0

    def test_inventory_export(self, client):
        r = client.get(f"{BASE_URL}/api/export/inventory")
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")
        assert len(r.content) > 100


# ----- Sales -----
class TestSales:
    sale_id = None
    prod_id = None
    initial_stock = None

    def test_create_sale_decrements_stock(self, client):
        # Create a fresh product
        p = client.post(f"{BASE_URL}/api/products",
                        json={"nama_produk": "TEST_SALEPROD", "qty": 1,
                              "harga_modal": 5000, "stock": 20, "keterangan": ""}).json()
        TestSales.prod_id = p["id"]
        TestSales.initial_stock = p["stock"]

        payload = {
            "tanggal": "2026-01-15",
            "items": [
                {"product_id": p["id"], "nama_barang": "TEST_SALEPROD",
                 "qty": 3, "harga": 7000, "total": 0},
                {"product_id": None, "nama_barang": "Misc", "qty": 2, "harga": 1000, "total": 0},
            ],
            "catatan": "TEST",
        }
        r = client.post(f"{BASE_URL}/api/sales", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["grand_total"] == 3 * 7000 + 2 * 1000
        TestSales.sale_id = d["id"]

        # verify stock reduced
        prods = client.get(f"{BASE_URL}/api/products").json()
        prod = [x for x in prods if x["id"] == p["id"]][0]
        assert prod["stock"] == TestSales.initial_stock - 3

    def test_list_sales(self, client):
        r = client.get(f"{BASE_URL}/api/sales")
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert TestSales.sale_id in ids

    def test_export_sales(self, client):
        r = client.get(f"{BASE_URL}/api/export/sales")
        assert r.status_code == 200
        assert "spreadsheet" in r.headers.get("content-type", "")

    def test_delete_sale(self, client):
        r = client.delete(f"{BASE_URL}/api/sales/{TestSales.sale_id}")
        assert r.status_code == 200
        r2 = client.delete(f"{BASE_URL}/api/sales/{TestSales.sale_id}")
        assert r2.status_code == 404


# ----- Dashboard -----
class TestDashboard:
    def test_stats(self, client):
        r = client.get(f"{BASE_URL}/api/dashboard/stats")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_modal", "total_products", "low_stock",
                  "total_sales_amount", "total_transactions", "today_sales"]:
            assert k in d


# ----- Cleanup -----
class TestZCleanup:
    def test_delete_products(self, client):
        prods = client.get(f"{BASE_URL}/api/products").json()
        for p in prods:
            if p["nama_produk"].startswith("TEST_"):
                client.delete(f"{BASE_URL}/api/products/{p['id']}")
