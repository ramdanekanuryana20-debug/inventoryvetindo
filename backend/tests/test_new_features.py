"""Backend tests for new features: Supplier Bills, Stores, Saldo Online."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_EMAIL = "ramdanekanuryana20@gmail.com"
ADMIN_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def client():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    return s


# ---------- Supplier Bills auto-create/update/delete ----------
class TestSupplierBillsFromSales:
    prod_id = None
    sale_id = None
    bill_id = None
    expected_amount = None

    def test_create_sale_creates_supplier_bill(self, client):
        # product: modal_per_qty = 302640/100 = 3026.4
        p = client.post(f"{BASE_URL}/api/products",
                        json={"nama_produk": "TEST_BILLPROD", "qty": 100, "harga_modal": 302640,
                              "stock": 50, "keterangan": ""}).json()
        TestSupplierBillsFromSales.prod_id = p["id"]

        # Also test an item without product_id (should contribute 0)
        payload = {
            "tanggal": "2026-01-10",
            "items": [
                {"product_id": p["id"], "nama_barang": "TEST_BILLPROD", "qty": 4, "harga": 5000, "total": 0},
                {"product_id": None, "nama_barang": "Misc", "qty": 3, "harga": 1000, "total": 0},
            ],
            "catatan": "TEST_BILL",
        }
        r = client.post(f"{BASE_URL}/api/sales", json=payload)
        assert r.status_code == 200, r.text
        sale = r.json()
        TestSupplierBillsFromSales.sale_id = sale["id"]

        # Bill amount == sale grand_total (sum of qty*harga for ALL line items)
        expected = round(4 * 5000 + 3 * 1000, 2)
        TestSupplierBillsFromSales.expected_amount = expected

        # GET supplier-bills and locate this bill
        bills = client.get(f"{BASE_URL}/api/supplier-bills").json()
        bill = next((b for b in bills if b.get("sale_id") == sale["id"]), None)
        assert bill is not None, "Supplier bill was not created for sale"
        assert bill["amount"] == expected, f"expected {expected} got {bill['amount']}"
        assert bill["status"] == "unpaid"
        assert bill["tanggal"] == "2026-01-10"
        assert len(bill["items"]) == 2
        TestSupplierBillsFromSales.bill_id = bill["id"]

    def test_update_sale_updates_bill(self, client):
        payload = {
            "tanggal": "2026-01-12",
            "items": [
                {"product_id": TestSupplierBillsFromSales.prod_id, "nama_barang": "TEST_BILLPROD",
                 "qty": 10, "harga": 5000, "total": 0},
            ],
            "catatan": "TEST_BILL_UPDATED",
        }
        r = client.put(f"{BASE_URL}/api/sales/{TestSupplierBillsFromSales.sale_id}", json=payload)
        assert r.status_code == 200, r.text

        bills = client.get(f"{BASE_URL}/api/supplier-bills").json()
        bill = next((b for b in bills if b.get("sale_id") == TestSupplierBillsFromSales.sale_id), None)
        assert bill is not None
        assert bill["amount"] == round(10 * 5000, 2)
        assert bill["tanggal"] == "2026-01-12"

    def test_toggle_bill_status(self, client):
        # Mark paid
        r = client.patch(f"{BASE_URL}/api/supplier-bills/{TestSupplierBillsFromSales.bill_id}/status",
                         json={"status": "paid"})
        assert r.status_code == 200
        bills = client.get(f"{BASE_URL}/api/supplier-bills?status=paid").json()
        assert any(b["id"] == TestSupplierBillsFromSales.bill_id for b in bills)

        # Unpay
        r = client.patch(f"{BASE_URL}/api/supplier-bills/{TestSupplierBillsFromSales.bill_id}/status",
                         json={"status": "unpaid"})
        assert r.status_code == 200
        bills = client.get(f"{BASE_URL}/api/supplier-bills?status=unpaid").json()
        assert any(b["id"] == TestSupplierBillsFromSales.bill_id for b in bills)

    def test_invalid_status_rejected(self, client):
        r = client.patch(f"{BASE_URL}/api/supplier-bills/{TestSupplierBillsFromSales.bill_id}/status",
                         json={"status": "bogus"})
        assert r.status_code == 400

    def test_summary(self, client):
        r = client.get(f"{BASE_URL}/api/supplier-bills/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ["unpaid_total", "paid_total", "unpaid_count", "paid_count"]:
            assert k in d
        assert isinstance(d["unpaid_total"], (int, float))

    def test_delete_sale_removes_bill(self, client):
        r = client.delete(f"{BASE_URL}/api/sales/{TestSupplierBillsFromSales.sale_id}")
        assert r.status_code == 200
        bills = client.get(f"{BASE_URL}/api/supplier-bills").json()
        assert not any(b.get("sale_id") == TestSupplierBillsFromSales.sale_id for b in bills)


# ---------- Stores ----------
class TestStores:
    store_id = None

    def test_create_store(self, client):
        r = client.post(f"{BASE_URL}/api/stores", json={"nama": "TEST_Store_A"})
        assert r.status_code == 200
        d = r.json()
        assert d["nama"] == "TEST_Store_A"
        assert "id" in d
        TestStores.store_id = d["id"]

    def test_list_stores_contains(self, client):
        r = client.get(f"{BASE_URL}/api/stores")
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert TestStores.store_id in ids

    def test_delete_store(self, client):
        r = client.delete(f"{BASE_URL}/api/stores/{TestStores.store_id}")
        assert r.status_code == 200
        r2 = client.delete(f"{BASE_URL}/api/stores/{TestStores.store_id}")
        assert r2.status_code == 404


# ---------- Saldo Online ----------
class TestSaldoOnline:
    bulan = "2026-03"
    store_id = None
    sale_id = None
    prod_id = None

    def test_setup_store_and_sale(self, client):
        # store
        s = client.post(f"{BASE_URL}/api/stores", json={"nama": "TEST_Store_Saldo"}).json()
        TestSaldoOnline.store_id = s["id"]
        # product & sale in bulan
        p = client.post(f"{BASE_URL}/api/products",
                        json={"nama_produk": "TEST_SALDOPROD", "qty": 10, "harga_modal": 100000,
                              "stock": 50}).json()
        TestSaldoOnline.prod_id = p["id"]
        sale = client.post(f"{BASE_URL}/api/sales", json={
            "tanggal": f"{TestSaldoOnline.bulan}-05",
            "items": [{"product_id": p["id"], "nama_barang": "TEST_SALDOPROD",
                       "qty": 2, "harga": 10000, "total": 0}],
        }).json()
        TestSaldoOnline.sale_id = sale["id"]
        # bill amount == grand_total = 2*10000 = 20000
        # ensure unpaid
        bills = client.get(f"{BASE_URL}/api/supplier-bills").json()
        bill = next(b for b in bills if b["sale_id"] == sale["id"])
        assert bill["amount"] == 20000
        assert bill["status"] == "unpaid"

    def test_save_saldo_and_compute(self, client):
        payload = [{"store_id": TestSaldoOnline.store_id, "saldo_tersedia": 500000, "saldo_pending": 100000}]
        r = client.put(f"{BASE_URL}/api/saldo-online/{TestSaldoOnline.bulan}/stores", json=payload)
        assert r.status_code == 200
        d = r.json()
        row = next(r for r in d["stores"] if r["store_id"] == TestSaldoOnline.store_id)
        assert row["total_per_toko"] == 600000
        assert d["total_saldo_online"] >= 600000
        # invoice: unpaid supplier bills starting with bulan; should include our 20000
        assert d["invoice"] >= 20000
        assert d["sisa_profit"] == round(d["total_saldo_online"] - d["invoice"], 2)

    def test_get_saldo(self, client):
        r = client.get(f"{BASE_URL}/api/saldo-online", params={"bulan": TestSaldoOnline.bulan})
        assert r.status_code == 200
        d = r.json()
        assert d["bulan"] == TestSaldoOnline.bulan
        assert any(row["store_id"] == TestSaldoOnline.store_id for row in d["stores"])

    def test_add_and_delete_withdrawal(self, client):
        r = client.post(f"{BASE_URL}/api/saldo-online/{TestSaldoOnline.bulan}/withdrawals",
                        json={"tanggal": f"{TestSaldoOnline.bulan}-10", "jumlah": 50000, "sumber": "TEST"})
        assert r.status_code == 200
        d = r.json()
        assert d["total_penarikan"] >= 50000
        wid = d["withdrawals"][-1]["id"]
        expected_laba = round(d["total_saldo_online"] - d["invoice"] + d["total_penarikan"], 2)
        assert d["laba_bersih"] == expected_laba

        r2 = client.delete(f"{BASE_URL}/api/saldo-online/{TestSaldoOnline.bulan}/withdrawals/{wid}")
        assert r2.status_code == 200
        d2 = r2.json()
        assert not any(w["id"] == wid for w in d2["withdrawals"])

    def test_months_history(self, client):
        r = client.get(f"{BASE_URL}/api/saldo-online/months")
        assert r.status_code == 200
        months = r.json()
        assert TestSaldoOnline.bulan in months

    def test_cleanup(self, client):
        client.delete(f"{BASE_URL}/api/sales/{TestSaldoOnline.sale_id}")
        client.delete(f"{BASE_URL}/api/stores/{TestSaldoOnline.store_id}")
        client.delete(f"{BASE_URL}/api/products/{TestSaldoOnline.prod_id}")


# ---------- Dashboard stat presence ----------
class TestDashboardSupplierUnpaid:
    def test_summary_endpoint_works(self, client):
        r = client.get(f"{BASE_URL}/api/supplier-bills/summary")
        assert r.status_code == 200
        d = r.json()
        assert d["unpaid_total"] >= 0
