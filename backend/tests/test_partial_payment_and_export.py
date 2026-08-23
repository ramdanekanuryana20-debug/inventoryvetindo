"""Backend tests for partial-payment (cicilan), saldo-online outstanding invoice,
and saldo-online Excel export."""
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


@pytest.fixture(scope="module")
def seeded(client):
    """Create a product + sale that yields a supplier bill of Rp 200_000."""
    p = client.post(f"{BASE_URL}/api/products",
                    json={"nama_produk": "TEST_PAYPROD", "qty": 10, "harga_modal": 1000000,
                          "stock": 50, "keterangan": ""}).json()
    prod_id = p["id"]
    # modal_per_qty = 1_000_000 / 10 = 100_000 ; qty 2 -> bill 200_000
    bulan = "2026-04"
    sale = client.post(f"{BASE_URL}/api/sales", json={
        "tanggal": f"{bulan}-05",
        "items": [{"product_id": prod_id, "nama_barang": "TEST_PAYPROD",
                   "qty": 2, "harga": 15000, "total": 0}],
        "catatan": "TEST_PARTIAL",
    }).json()
    sale_id = sale["id"]
    bills = client.get(f"{BASE_URL}/api/supplier-bills").json()
    bill = next(b for b in bills if b.get("sale_id") == sale_id)
    assert bill["amount"] == 200000
    assert bill["status"] == "unpaid"
    assert bill["outstanding"] == 200000
    assert bill["paid_amount"] == 0

    yield {"prod_id": prod_id, "sale_id": sale_id, "bill_id": bill["id"], "bulan": bulan,
           "amount": 200000}

    # cleanup
    client.delete(f"{BASE_URL}/api/sales/{sale_id}")
    client.delete(f"{BASE_URL}/api/products/{prod_id}")


class TestPartialPayment:

    def test_partial_payment_sets_partial_status(self, client, seeded):
        r = client.post(f"{BASE_URL}/api/supplier-bills/{seeded['bill_id']}/payment",
                        json={"jumlah": 50000, "catatan": "TEST_CICIL1"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["paid_amount"] == 50000
        assert d["status"] == "partial"
        # Reload bill
        bill = next(b for b in client.get(f"{BASE_URL}/api/supplier-bills").json()
                    if b["id"] == seeded["bill_id"])
        assert bill["status"] == "partial"
        assert bill["paid_amount"] == 50000
        assert bill["outstanding"] == 150000
        assert len(bill["payments"]) == 1

    def test_second_partial_payment_increments(self, client, seeded):
        r = client.post(f"{BASE_URL}/api/supplier-bills/{seeded['bill_id']}/payment",
                        json={"jumlah": 30000, "catatan": "TEST_CICIL2"})
        assert r.status_code == 200
        d = r.json()
        assert d["paid_amount"] == 80000
        assert d["status"] == "partial"
        bill = next(b for b in client.get(f"{BASE_URL}/api/supplier-bills").json()
                    if b["id"] == seeded["bill_id"])
        assert bill["outstanding"] == 120000
        assert len(bill["payments"]) == 2

    def test_summary_uses_outstanding_and_partial_count(self, client, seeded):
        s = client.get(f"{BASE_URL}/api/supplier-bills/summary").json()
        assert "partial_count" in s
        assert s["partial_count"] >= 1
        # Sum of outstanding across all unpaid+partial bills; ours contributes 120000
        assert s["unpaid_total"] >= 120000
        # Should be less than sum-of-amounts (our bill contributes 200k full but only 120k outstanding)
        # We can't assert exact absolute; just sanity: unpaid_count includes our bill
        assert s["unpaid_count"] >= 1

    def test_delete_payment_recomputes(self, client, seeded):
        bill = next(b for b in client.get(f"{BASE_URL}/api/supplier-bills").json()
                    if b["id"] == seeded["bill_id"])
        pid_to_delete = bill["payments"][0]["id"]  # the 50000 one
        r = client.delete(f"{BASE_URL}/api/supplier-bills/{seeded['bill_id']}/payment/{pid_to_delete}")
        assert r.status_code == 200
        bill = next(b for b in client.get(f"{BASE_URL}/api/supplier-bills").json()
                    if b["id"] == seeded["bill_id"])
        assert bill["paid_amount"] == 30000
        assert bill["outstanding"] == 170000
        assert bill["status"] == "partial"
        assert len(bill["payments"]) == 1

    def test_pay_remaining_marks_paid(self, client, seeded):
        r = client.post(f"{BASE_URL}/api/supplier-bills/{seeded['bill_id']}/payment",
                        json={"jumlah": 170000, "catatan": "TEST_LUNAS"})
        assert r.status_code == 200
        d = r.json()
        assert d["paid_amount"] == 200000
        assert d["status"] == "paid"
        bill = next(b for b in client.get(f"{BASE_URL}/api/supplier-bills").json()
                    if b["id"] == seeded["bill_id"])
        assert bill["status"] == "paid"
        assert bill["outstanding"] == 0

    def test_batalkan_resets(self, client, seeded):
        r = client.patch(f"{BASE_URL}/api/supplier-bills/{seeded['bill_id']}/status",
                         json={"status": "unpaid"})
        assert r.status_code == 200
        bill = next(b for b in client.get(f"{BASE_URL}/api/supplier-bills").json()
                    if b["id"] == seeded["bill_id"])
        assert bill["status"] == "unpaid"
        assert bill["paid_amount"] == 0
        assert bill["outstanding"] == 200000
        assert bill["payments"] == []

    def test_lunas_marks_paid(self, client, seeded):
        r = client.patch(f"{BASE_URL}/api/supplier-bills/{seeded['bill_id']}/status",
                         json={"status": "paid"})
        assert r.status_code == 200
        bill = next(b for b in client.get(f"{BASE_URL}/api/supplier-bills").json()
                    if b["id"] == seeded["bill_id"])
        assert bill["status"] == "paid"
        assert bill["paid_amount"] == 200000
        assert bill["outstanding"] == 0


class TestSaldoInvoiceUsesOutstanding:
    """Standalone: creates its own product/sale/bill to be xdist-safe."""

    def test_partial_reduces_invoice(self, client):
        bulan = "2026-05"
        p = client.post(f"{BASE_URL}/api/products",
                        json={"nama_produk": "TEST_INVPROD", "qty": 10,
                              "harga_modal": 500000, "stock": 50}).json()
        prod_id = p["id"]
        sale = client.post(f"{BASE_URL}/api/sales", json={
            "tanggal": f"{bulan}-05",
            "items": [{"product_id": prod_id, "nama_barang": "TEST_INVPROD",
                       "qty": 2, "harga": 15000, "total": 0}],
        }).json()
        sale_id = sale["id"]
        try:
            bill_id = next(b["id"] for b in client.get(f"{BASE_URL}/api/supplier-bills").json()
                           if b.get("sale_id") == sale_id)

            d0 = client.get(f"{BASE_URL}/api/saldo-online", params={"bulan": bulan}).json()
            base_invoice = d0["invoice"]
            assert base_invoice >= 100000  # 500000/10 * 2 = 100000

            # partial 40000 -> invoice reduces by 40000
            client.post(f"{BASE_URL}/api/supplier-bills/{bill_id}/payment",
                        json={"jumlah": 40000})
            d1 = client.get(f"{BASE_URL}/api/saldo-online", params={"bulan": bulan}).json()
            assert round(base_invoice - d1["invoice"], 2) == 40000

            # mark paid -> reduces by full 100000
            client.patch(f"{BASE_URL}/api/supplier-bills/{bill_id}/status",
                         json={"status": "paid"})
            d2 = client.get(f"{BASE_URL}/api/saldo-online", params={"bulan": bulan}).json()
            assert round(base_invoice - d2["invoice"], 2) == 100000
        finally:
            client.delete(f"{BASE_URL}/api/sales/{sale_id}")
            client.delete(f"{BASE_URL}/api/products/{prod_id}")


class TestSaldoExport:
    def test_export_xlsx(self, client):
        # any existing month; use bulan from seed indirectly by scanning
        r = client.get(f"{BASE_URL}/api/saldo-online/2026-08/export", stream=True)
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "spreadsheet" in ct or "xlsx" in ct or "octet-stream" in ct, ct
        # xlsx magic bytes = PK\x03\x04
        content = r.content
        assert content[:2] == b"PK", "Not a valid xlsx (missing PK magic)"
        assert len(content) > 500

    def test_export_empty_month_still_returns_xlsx(self, client):
        r = client.get(f"{BASE_URL}/api/saldo-online/2020-01/export")
        assert r.status_code == 200
        assert r.content[:2] == b"PK"
