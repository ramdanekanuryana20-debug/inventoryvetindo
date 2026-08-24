"""Regression tests for BUG: UNPAID supplier bill nominal must ALWAYS equal
the linked sale's grand_total (no rounding drift). Paid/partial bills keep
their original nominal even when the sale is edited.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"email": "ramdanekanuryana20@gmail.com", "password": "admin123"}


@pytest.fixture(scope="module")
def client():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["token"]
    s = requests.Session()
    s.headers.update({"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    return s


def _get_bill_by_sale(client, sale_id):
    bills = client.get(f"{BASE_URL}/api/supplier-bills").json()
    return next((b for b in bills if b.get("sale_id") == sale_id), None)


# ---------------- 1) All existing UNPAID bills match linked sale grand_total ----------------
class TestExistingUnpaidBillsMatchGrandTotal:
    def test_all_unpaid_bill_amount_equals_sale_grand_total(self, client):
        sales = client.get(f"{BASE_URL}/api/sales").json()
        bills = client.get(f"{BASE_URL}/api/supplier-bills").json()
        sales_by_id = {s["id"]: s for s in sales}
        mismatches = []
        checked = 0
        for b in bills:
            if b.get("status") != "unpaid":
                continue
            sale = sales_by_id.get(b.get("sale_id"))
            if not sale:
                continue
            checked += 1
            if round(b["amount"], 2) != round(sale.get("grand_total", 0), 2):
                mismatches.append({
                    "bill_id": b["id"], "sale_id": b["sale_id"],
                    "bill_amount": b["amount"], "grand_total": sale["grand_total"],
                    "tanggal": b.get("tanggal"),
                })
        assert not mismatches, f"UNPAID bill amount != sale grand_total for {mismatches}"
        # sanity: at least one checked (env has existing unpaid bills per context)
        assert checked >= 1, "No unpaid bills present to verify - unexpected in this env"


# ---------------- 2) NEW sale with fractional/odd prices ----------------
class TestNewSaleFractionalPrices:
    def test_odd_prices_bill_equals_grand_total_no_drift(self, client):
        # Create product; use odd fractional harga to exercise rounding paths
        p = client.post(f"{BASE_URL}/api/products", json={
            "nama_produk": "TEST_ODDPROD", "qty": 7, "harga_modal": 100000,
            "stock": 1000, "keterangan": ""
        }).json()
        prod_id = p["id"]
        # Odd unit prices designed to expose rounding differences
        items = [
            {"product_id": prod_id, "nama_barang": "TEST_ODDPROD", "qty": 3, "harga": 12345.67, "total": 0},
            {"product_id": prod_id, "nama_barang": "TEST_ODDPROD", "qty": 5, "harga": 999.99, "total": 0},
            {"product_id": None, "nama_barang": "TEST_MISC", "qty": 2, "harga": 3333.33, "total": 0},
        ]
        payload = {"tanggal": "2026-06-10", "items": items, "catatan": "TEST_ODD"}
        try:
            sale = client.post(f"{BASE_URL}/api/sales", json=payload).json()
            sale_id = sale["id"]
            expected = round(3 * 12345.67 + 5 * 999.99 + 2 * 3333.33, 2)
            assert round(sale["grand_total"], 2) == expected

            bill = _get_bill_by_sale(client, sale_id)
            assert bill is not None
            # THE KEY ASSERTION: bill amount == sale grand_total exactly
            assert round(bill["amount"], 2) == round(sale["grand_total"], 2), \
                f"bill {bill['amount']} != grand_total {sale['grand_total']}"
            assert bill["status"] == "unpaid"

            # And sum of item.total in sale equals grand_total (no drift)
            item_sum = round(sum(i["total"] for i in sale["items"]), 2)
            assert item_sum == round(sale["grand_total"], 2)
        finally:
            client.delete(f"{BASE_URL}/api/sales/{sale_id}")
            client.delete(f"{BASE_URL}/api/products/{prod_id}")


# ---------------- 3) Editing UNPAID sale updates the linked bill ----------------
class TestEditUnpaidSaleUpdatesBill:
    def test_edit_unpaid_sale_bill_amount_follows_new_grand_total(self, client):
        p = client.post(f"{BASE_URL}/api/products", json={
            "nama_produk": "TEST_EDITPROD", "qty": 10, "harga_modal": 250000,
            "stock": 500, "keterangan": ""
        }).json()
        prod_id = p["id"]
        sale = client.post(f"{BASE_URL}/api/sales", json={
            "tanggal": "2026-06-11",
            "items": [{"product_id": prod_id, "nama_barang": "TEST_EDITPROD",
                       "qty": 2, "harga": 7777.77, "total": 0}],
        }).json()
        sale_id = sale["id"]
        try:
            b1 = _get_bill_by_sale(client, sale_id)
            assert b1 and b1["status"] == "unpaid"
            assert round(b1["amount"], 2) == round(sale["grand_total"], 2)

            # Edit: change qty & price, add another line
            new_payload = {
                "tanggal": "2026-06-12",
                "items": [
                    {"product_id": prod_id, "nama_barang": "TEST_EDITPROD",
                     "qty": 4, "harga": 8888.88, "total": 0},
                    {"product_id": None, "nama_barang": "TEST_EXTRA",
                     "qty": 3, "harga": 1111.11, "total": 0},
                ],
            }
            edited = client.put(f"{BASE_URL}/api/sales/{sale_id}", json=new_payload).json()
            expected_gt = round(4 * 8888.88 + 3 * 1111.11, 2)
            assert round(edited["grand_total"], 2) == expected_gt

            b2 = _get_bill_by_sale(client, sale_id)
            assert b2["status"] == "unpaid"
            assert round(b2["amount"], 2) == expected_gt
            assert b2["tanggal"] == "2026-06-12"
        finally:
            client.delete(f"{BASE_URL}/api/sales/{sale_id}")
            client.delete(f"{BASE_URL}/api/products/{prod_id}")


# ---------------- 4) PAID / PARTIAL bill keeps original amount when sale edited ----------------
class TestPaidPartialBillFrozenOnSaleEdit:
    def test_partial_paid_bill_amount_frozen_on_sale_edit(self, client):
        p = client.post(f"{BASE_URL}/api/products", json={
            "nama_produk": "TEST_FROZENPROD", "qty": 10, "harga_modal": 100000,
            "stock": 100, "keterangan": ""
        }).json()
        prod_id = p["id"]
        sale = client.post(f"{BASE_URL}/api/sales", json={
            "tanggal": "2026-06-15",
            "items": [{"product_id": prod_id, "nama_barang": "TEST_FROZENPROD",
                       "qty": 4, "harga": 25000, "total": 0}],
        }).json()
        sale_id = sale["id"]
        try:
            bill = _get_bill_by_sale(client, sale_id)
            assert bill["amount"] == 100000
            bill_id = bill["id"]

            # Pay partial 30k -> status partial, original amount preserved
            r = client.post(f"{BASE_URL}/api/supplier-bills/{bill_id}/payment",
                            json={"jumlah": 30000})
            assert r.status_code == 200

            # Now EDIT the sale to a different total
            r2 = client.put(f"{BASE_URL}/api/sales/{sale_id}", json={
                "tanggal": "2026-06-16",
                "items": [{"product_id": prod_id, "nama_barang": "TEST_FROZENPROD",
                           "qty": 10, "harga": 99999, "total": 0}],
            })
            assert r2.status_code == 200

            b_after = _get_bill_by_sale(client, sale_id)
            # Amount MUST remain 100000 (frozen) even though new grand_total differs
            assert b_after["amount"] == 100000, \
                f"Partial-paid bill amount changed to {b_after['amount']} (should stay 100000)"
            assert b_after["status"] == "partial"
            assert b_after["paid_amount"] == 30000
            assert b_after["outstanding"] == 70000
            # tanggal is allowed to sync
            assert b_after["tanggal"] == "2026-06-16"
        finally:
            client.delete(f"{BASE_URL}/api/sales/{sale_id}")
            client.delete(f"{BASE_URL}/api/products/{prod_id}")

    def test_fully_paid_bill_amount_frozen_on_sale_edit(self, client):
        p = client.post(f"{BASE_URL}/api/products", json={
            "nama_produk": "TEST_PAIDPROD", "qty": 10, "harga_modal": 100000,
            "stock": 100, "keterangan": ""
        }).json()
        prod_id = p["id"]
        sale = client.post(f"{BASE_URL}/api/sales", json={
            "tanggal": "2026-06-17",
            "items": [{"product_id": prod_id, "nama_barang": "TEST_PAIDPROD",
                       "qty": 2, "harga": 40000, "total": 0}],
        }).json()
        sale_id = sale["id"]
        try:
            bill = _get_bill_by_sale(client, sale_id)
            assert bill["amount"] == 80000
            bill_id = bill["id"]

            # Mark PAID via status toggle
            r = client.patch(f"{BASE_URL}/api/supplier-bills/{bill_id}/status",
                             json={"status": "paid"})
            assert r.status_code == 200

            # Edit sale to a very different total
            client.put(f"{BASE_URL}/api/sales/{sale_id}", json={
                "tanggal": "2026-06-18",
                "items": [{"product_id": prod_id, "nama_barang": "TEST_PAIDPROD",
                           "qty": 5, "harga": 12345, "total": 0}],
            })
            b_after = _get_bill_by_sale(client, sale_id)
            assert b_after["amount"] == 80000, \
                f"PAID bill amount changed to {b_after['amount']} (should stay 80000)"
            assert b_after["status"] == "paid"
        finally:
            # unpay first so cascade delete doesn't matter
            client.delete(f"{BASE_URL}/api/sales/{sale_id}")
            client.delete(f"{BASE_URL}/api/products/{prod_id}")
