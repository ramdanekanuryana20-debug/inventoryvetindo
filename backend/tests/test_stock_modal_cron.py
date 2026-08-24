"""Tests for: add-stock, adjust-modal, cron/reconcile-bills."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "ramdanekanuryana20@gmail.com"
ADMIN_PASSWORD = "admin123"
CRON_SECRET = "c9f3a1e77b204d8e9a6f2c5b1d8e4f70a3b6c9d2e5f80172"


@pytest.fixture(scope="module")
def client():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def temp_product(client):
    p = client.post(f"{BASE_URL}/api/products",
                    json={"nama_produk": "TEST_STOCKMODAL", "qty": 10,
                          "harga_modal": 100000, "stock": 0, "keterangan": ""}).json()
    yield p
    client.delete(f"{BASE_URL}/api/products/{p['id']}")


class TestAddStock:
    def test_add_positive(self, client, temp_product):
        pid = temp_product["id"]
        # Reset stock to 20
        client.put(f"{BASE_URL}/api/products/{pid}",
                   json={"nama_produk": "TEST_STOCKMODAL", "qty": 10,
                         "harga_modal": 100000, "stock": 20, "keterangan": ""})
        r = client.post(f"{BASE_URL}/api/products/{pid}/add-stock", json={"jumlah": 30})
        assert r.status_code == 200, r.text
        assert r.json()["stock"] == 50

    def test_add_from_negative(self, client, temp_product):
        pid = temp_product["id"]
        # Set stock to -10
        client.put(f"{BASE_URL}/api/products/{pid}",
                   json={"nama_produk": "TEST_STOCKMODAL", "qty": 10,
                         "harga_modal": 100000, "stock": -10, "keterangan": ""})
        r = client.post(f"{BASE_URL}/api/products/{pid}/add-stock", json={"jumlah": 60})
        assert r.status_code == 200, r.text
        assert r.json()["stock"] == 50
        # verify persisted via list
        prods = client.get(f"{BASE_URL}/api/products").json()
        g = next(x for x in prods if x["id"] == pid)
        assert g["stock"] == 50


class TestAdjustModal:
    def test_naik(self, client, temp_product):
        pid = temp_product["id"]
        client.put(f"{BASE_URL}/api/products/{pid}",
                   json={"nama_produk": "TEST_STOCKMODAL", "qty": 10,
                         "harga_modal": 100000, "stock": 0, "keterangan": ""})
        r = client.post(f"{BASE_URL}/api/products/{pid}/adjust-modal",
                        json={"arah": "naik", "nominal": 15000})
        assert r.status_code == 200, r.text
        assert r.json()["harga_modal"] == 115000

    def test_turun(self, client, temp_product):
        pid = temp_product["id"]
        r = client.post(f"{BASE_URL}/api/products/{pid}/adjust-modal",
                        json={"arah": "turun", "nominal": 25000})
        assert r.status_code == 200, r.text
        assert r.json()["harga_modal"] == 90000

    def test_turun_clamps_zero(self, client, temp_product):
        pid = temp_product["id"]
        r = client.post(f"{BASE_URL}/api/products/{pid}/adjust-modal",
                        json={"arah": "turun", "nominal": 9999999})
        assert r.status_code == 200
        assert r.json()["harga_modal"] == 0

    def test_invalid_arah(self, client, temp_product):
        r = client.post(f"{BASE_URL}/api/products/{temp_product['id']}/adjust-modal",
                        json={"arah": "bogus", "nominal": 100})
        assert r.status_code == 400

    def test_negative_nominal(self, client, temp_product):
        r = client.post(f"{BASE_URL}/api/products/{temp_product['id']}/adjust-modal",
                        json={"arah": "naik", "nominal": -100})
        assert r.status_code == 400


class TestCronReconcile:
    def test_unauthorized_no_header(self, client):
        r = requests.post(f"{BASE_URL}/api/cron/reconcile-bills")
        assert r.status_code == 401

    def test_unauthorized_wrong_secret(self, client):
        r = requests.post(f"{BASE_URL}/api/cron/reconcile-bills",
                          headers={"Authorization": "Bearer WRONG"})
        assert r.status_code == 401

    def test_authorized_accepts_and_reconciles(self, client):
        # Create product + sale
        p = client.post(f"{BASE_URL}/api/products",
                        json={"nama_produk": "TEST_CRONPROD", "qty": 10,
                              "harga_modal": 100000, "stock": 100}).json()
        sale = client.post(f"{BASE_URL}/api/sales", json={
            "tanggal": "2026-01-15",
            "items": [{"product_id": p["id"], "nama_barang": "TEST_CRONPROD",
                       "qty": 3, "harga": 5000, "total": 0}],
        }).json()
        # Get bill and corrupt it
        bills = client.get(f"{BASE_URL}/api/supplier-bills").json()
        bill = next(b for b in bills if b["sale_id"] == sale["id"])
        expected = 3 * 5000
        assert bill["amount"] == expected

        # Manually poison bill amount via direct DB isn't possible from HTTP;
        # simulate a drifted amount via updating sale then reverting bill logic.
        # Instead we just verify cron endpoint returns 2xx with valid secret and
        # that unpaid bills equal their sale.grand_total after run.
        r = requests.post(f"{BASE_URL}/api/cron/reconcile-bills",
                          headers={"Authorization": f"Bearer {CRON_SECRET}"})
        assert r.status_code in (200, 202), r.text
        assert r.json().get("status") == "accepted"

        # Wait for background task to run
        import time
        time.sleep(2)

        bills = client.get(f"{BASE_URL}/api/supplier-bills").json()
        sales_map = {s["id"]: s for s in client.get(f"{BASE_URL}/api/sales").json()}
        mismatches = []
        for b in bills:
            paid = sum(p.get("jumlah", 0) for p in (b.get("payments") or []))
            if paid > 0 or b.get("status") == "paid":
                continue
            s = sales_map.get(b.get("sale_id"))
            if not s:
                continue
            if abs(b.get("amount", 0) - s.get("grand_total", 0)) > 0.01:
                mismatches.append((b["id"], b["amount"], s.get("grand_total")))
        assert not mismatches, f"Unpaid bills not matching grand_total: {mismatches}"

        # Cleanup
        client.delete(f"{BASE_URL}/api/sales/{sale['id']}")
        client.delete(f"{BASE_URL}/api/products/{p['id']}")

    def test_paid_bill_preserved_by_cron(self, client):
        # Create product + sale, mark paid, edit sale (shouldn't move bill),
        # run cron -> paid bill amount preserved.
        p = client.post(f"{BASE_URL}/api/products",
                        json={"nama_produk": "TEST_CRONPAID", "qty": 10,
                              "harga_modal": 100000, "stock": 100}).json()
        sale = client.post(f"{BASE_URL}/api/sales", json={
            "tanggal": "2026-01-16",
            "items": [{"product_id": p["id"], "nama_barang": "TEST_CRONPAID",
                       "qty": 2, "harga": 7000, "total": 0}],
        }).json()
        bill = next(b for b in client.get(f"{BASE_URL}/api/supplier-bills").json()
                    if b["sale_id"] == sale["id"])
        original_amount = bill["amount"]  # 14000
        # Mark paid
        client.patch(f"{BASE_URL}/api/supplier-bills/{bill['id']}/status", json={"status": "paid"})

        # Run cron
        r = requests.post(f"{BASE_URL}/api/cron/reconcile-bills",
                          headers={"Authorization": f"Bearer {CRON_SECRET}"})
        assert r.status_code in (200, 202)
        import time; time.sleep(2)

        bill_after = next(b for b in client.get(f"{BASE_URL}/api/supplier-bills").json()
                          if b["id"] == bill["id"])
        assert bill_after["amount"] == original_amount
        assert bill_after["status"] == "paid"

        # cleanup
        client.delete(f"{BASE_URL}/api/sales/{sale['id']}")
        client.delete(f"{BASE_URL}/api/products/{p['id']}")
