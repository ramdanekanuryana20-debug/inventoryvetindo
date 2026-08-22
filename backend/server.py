from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, Response
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import uuid
import io
import logging
import bcrypt
import jwt
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdfcanvas

# ---------------- DB ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"


# ---------------- Auth utils ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["id"] = str(user["_id"])
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------- Models ----------------
class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ProductInput(BaseModel):
    nama_produk: str
    qty: float = 1
    harga_modal: float = 0
    stock: float = 0
    keterangan: Optional[str] = ""


class Product(ProductInput):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class SaleItem(BaseModel):
    product_id: Optional[str] = None
    nama_barang: str
    qty: float
    harga: float
    total: float


class SaleInput(BaseModel):
    tanggal: str
    items: List[SaleItem]
    catatan: Optional[str] = ""


class Sale(SaleInput):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    grand_total: float = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def enrich_product(p: dict) -> dict:
    qty = p.get("qty") or 0
    harga_modal = p.get("harga_modal") or 0
    stock = p.get("stock") or 0
    modal_per_qty = (harga_modal / qty) if qty else 0
    modal_fisik = modal_per_qty * stock
    p["modal_per_qty"] = round(modal_per_qty, 2)
    p["modal_fisik"] = round(modal_fisik, 2)
    p.pop("_id", None)
    return p


# ---------------- Auth routes ----------------
@api_router.post("/auth/login")
async def login(data: LoginInput, response: Response):
    email = data.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email atau password salah")
    uid = str(user["_id"])
    token = create_access_token(uid, email)
    response.set_cookie(key="access_token", value=token, httponly=True,
                        secure=True, samesite="none", max_age=604800, path="/")
    return {"token": token, "user": {"id": uid, "email": email, "name": user.get("name", "Admin")}}


@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    response.delete_cookie("access_token", path="/")
    return {"message": "Logged out"}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------- Product routes ----------------
@api_router.get("/products")
async def list_products(user: dict = Depends(get_current_user)):
    docs = await db.products.find().sort("nama_produk", 1).to_list(5000)
    return [enrich_product(d) for d in docs]


@api_router.post("/products")
async def create_product(data: ProductInput, user: dict = Depends(get_current_user)):
    prod = Product(**data.model_dump())
    await db.products.insert_one(prod.model_dump())
    return enrich_product(prod.model_dump())


@api_router.put("/products/{product_id}")
async def update_product(product_id: str, data: ProductInput, user: dict = Depends(get_current_user)):
    res = await db.products.update_one({"id": product_id}, {"$set": data.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    doc = await db.products.find_one({"id": product_id})
    return enrich_product(doc)


@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(get_current_user)):
    res = await db.products.delete_one({"id": product_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Produk tidak ditemukan")
    return {"message": "Produk dihapus"}


# ---------------- Sales routes ----------------
@api_router.get("/sales")
async def list_sales(start: Optional[str] = None, end: Optional[str] = None,
                     user: dict = Depends(get_current_user)):
    query = {}
    if start or end:
        cond = {}
        if start:
            cond["$gte"] = start
        if end:
            cond["$lte"] = end + "\uffff"
        query["tanggal"] = cond
    docs = await db.sales.find(query).sort("tanggal", -1).to_list(5000)
    for d in docs:
        d.pop("_id", None)
    return docs


@api_router.post("/sales")
async def create_sale(data: SaleInput, user: dict = Depends(get_current_user)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Minimal 1 barang pada transaksi")
    grand_total = 0.0
    for item in data.items:
        item.total = round(item.qty * item.harga, 2)
        grand_total += item.total
    sale = Sale(**data.model_dump())
    sale.grand_total = round(grand_total, 2)
    await db.sales.insert_one(sale.model_dump())
    # reduce stock
    for item in data.items:
        if item.product_id:
            await db.products.update_one(
                {"id": item.product_id},
                {"$inc": {"stock": -abs(item.qty)}}
            )
    doc = sale.model_dump()
    doc.pop("_id", None)
    return doc


@api_router.delete("/sales/{sale_id}")
async def delete_sale(sale_id: str, user: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    for item in sale.get("items", []):
        if item.get("product_id"):
            await db.products.update_one(
                {"id": item["product_id"]},
                {"$inc": {"stock": abs(item.get("qty", 0))}}
            )
    await db.sales.delete_one({"id": sale_id})
    return {"message": "Transaksi dihapus, stock dikembalikan"}


@api_router.get("/sales/{sale_id}/receipt")
async def sale_receipt(sale_id: str, user: dict = Depends(get_current_user)):
    sale = await db.sales.find_one({"id": sale_id})
    if not sale:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")

    buf = io.BytesIO()
    width, height = A5
    c = pdfcanvas.Canvas(buf, pagesize=A5)
    y = height - 18 * mm

    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, y, "VetStock")
    y -= 6 * mm
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, y, "Struk Penjualan")
    y -= 8 * mm

    c.setFont("Helvetica", 9)
    c.drawString(15 * mm, y, f"Tanggal: {sale.get('tanggal', '')}")
    y -= 5 * mm
    c.drawString(15 * mm, y, f"No: {sale.get('id', '')[:8].upper()}")
    y -= 6 * mm

    c.line(15 * mm, y, width - 15 * mm, y)
    y -= 6 * mm

    c.setFont("Helvetica-Bold", 8)
    c.drawString(15 * mm, y, "Barang")
    c.drawRightString(width - 55 * mm, y, "Qty")
    c.drawRightString(width - 30 * mm, y, "Harga")
    c.drawRightString(width - 15 * mm, y, "Total")
    y -= 5 * mm

    c.setFont("Helvetica", 8)
    for item in sale.get("items", []):
        name = str(item.get("nama_barang", ""))[:28]
        c.drawString(15 * mm, y, name)
        c.drawRightString(width - 55 * mm, y, f"{item.get('qty', 0):g}")
        c.drawRightString(width - 30 * mm, y, rupiah(item.get("harga", 0)))
        c.drawRightString(width - 15 * mm, y, rupiah(item.get("total", 0)))
        y -= 5 * mm
        if y < 25 * mm:
            c.showPage()
            y = height - 18 * mm
            c.setFont("Helvetica", 8)

    y -= 2 * mm
    c.line(15 * mm, y, width - 15 * mm, y)
    y -= 7 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(15 * mm, y, "GRAND TOTAL")
    c.drawRightString(width - 15 * mm, y, rupiah(sale.get("grand_total", 0)))
    y -= 12 * mm
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(width / 2, y, "Terima kasih atas kunjungan Anda")

    c.showPage()
    c.save()
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=struk_{sale_id[:8]}.pdf"},
    )


# ---------------- Dashboard ----------------
@api_router.get("/dashboard/stats")
async def dashboard_stats(user: dict = Depends(get_current_user)):
    products = await db.products.find().to_list(5000)
    total_modal = 0.0
    low_stock = 0
    for p in products:
        e = enrich_product(p)
        total_modal += e["modal_fisik"]
        if (p.get("stock") or 0) <= 0:
            low_stock += 1
    total_products = len(products)

    sales = await db.sales.find().to_list(5000)
    total_sales_amount = sum(s.get("grand_total", 0) for s in sales)
    total_transactions = len(sales)

    today = datetime.now(timezone.utc).date().isoformat()
    today_sales = sum(s.get("grand_total", 0) for s in sales if str(s.get("tanggal", "")).startswith(today))

    return {
        "total_modal": round(total_modal, 2),
        "total_products": total_products,
        "low_stock": low_stock,
        "total_sales_amount": round(total_sales_amount, 2),
        "total_transactions": total_transactions,
        "today_sales": round(today_sales, 2),
    }


# ---------------- Export ----------------
def rupiah(n):
    try:
        return f"Rp {int(round(n)):,}".replace(",", ".")
    except Exception:
        return str(n)


def style_header(ws, ncols):
    fill = PatternFill(start_color="166534", end_color="166534", fill_type="solid")
    for col in range(1, ncols + 1):
        c = ws.cell(row=1, column=col)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = fill
        c.alignment = Alignment(horizontal="center")


@api_router.get("/export/inventory")
async def export_inventory(user: dict = Depends(get_current_user)):
    docs = await db.products.find().sort("nama_produk", 1).to_list(5000)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Stock Barang"
    headers = ["No", "Nama Produk", "QTY", "Harga Modal", "Modal/QTY", "Stock", "Modal/Fisik", "Keterangan"]
    ws.append(headers)
    style_header(ws, len(headers))
    for i, d in enumerate(docs, 1):
        e = enrich_product(d)
        ws.append([i, e["nama_produk"], e.get("qty", 0), e.get("harga_modal", 0),
                   e["modal_per_qty"], e.get("stock", 0), e["modal_fisik"], e.get("keterangan", "")])
    widths = [6, 32, 8, 16, 14, 10, 16, 14]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=stock_barang.xlsx"},
    )


@api_router.get("/export/sales")
async def export_sales(user: dict = Depends(get_current_user)):
    docs = await db.sales.find().sort("created_at", -1).to_list(5000)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Penjualan"
    headers = ["Tanggal", "Nama Barang", "QTY", "Harga", "Total", "Grand Total"]
    ws.append(headers)
    style_header(ws, len(headers))
    for s in docs:
        items = s.get("items", [])
        for idx, item in enumerate(items):
            ws.append([
                s.get("tanggal", ""),
                item.get("nama_barang", ""),
                item.get("qty", 0),
                item.get("harga", 0),
                item.get("total", 0),
                s.get("grand_total", 0) if idx == 0 else "",
            ])
    widths = [14, 32, 8, 16, 16, 16]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=penjualan.xlsx"},
    )


@api_router.get("/")
async def root():
    return {"message": "Stock & Sales API"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("id", unique=True)
    await db.sales.create_index("id", unique=True)
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Admin seeded: %s", admin_email)
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
