import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah, num } from "@/lib/format";
import { Package, Wallet, ShoppingCart, TrendingUp, AlertTriangle, CalendarDays, Trophy, ChevronRight, Receipt, ArrowLeftRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

function StatCard({ icon: Icon, label, value, sub, testid, accent, onClick }) {
  const clickable = typeof onClick === "function";
  return (
    <div
      className={`bg-white border border-slate-200 rounded-lg p-5 transition-shadow ${clickable ? "cursor-pointer hover:shadow-md hover:border-amber-300" : "hover:shadow-sm"}`}
      data-testid={testid}
      onClick={onClick}
      role={clickable ? "button" : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 font-medium">{label}</span>
        <div className={`h-9 w-9 rounded-md flex items-center justify-center ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="font-heading text-2xl font-extrabold tracking-tight text-slate-900 mt-3 tabular-nums flex items-center gap-2">
        {value}
        {clickable && <ChevronRight className="h-4 w-4 text-amber-500" />}
      </div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [emptyProducts, setEmptyProducts] = useState([]);
  const [supplier, setSupplier] = useState(null);
  const [topPeriod, setTopPeriod] = useState("all");
  const [cashflow, setCashflow] = useState([]);
  const [allOpen, setAllOpen] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard/stats").then((res) => setStats(res.data)).catch(() => {});
    api.get("/dashboard/monthly-sales").then((res) => setMonthly(res.data)).catch(() => {});
    api.get("/supplier-bills/summary").then((res) => setSupplier(res.data)).catch(() => {});
    api.get("/dashboard/cashflow").then((res) => setCashflow(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/dashboard/top-products", { params: { period: topPeriod } }).then((res) => setTopProducts(res.data)).catch(() => {});
  }, [topPeriod]);

  useEffect(() => {
    if (!allOpen) return;
    api.get("/dashboard/top-products", { params: { period: topPeriod, limit: 0 } }).then((res) => setAllProducts(res.data)).catch(() => {});
  }, [allOpen, topPeriod]);

  const periodLabel = { all: "Semua Waktu", month: "Bulan Ini", week: "Minggu Ini" };

  const openEmptyStock = () => {
    api.get("/products").then((res) => {
      setEmptyProducts(res.data.filter((p) => (p.stock || 0) <= 0));
      setEmptyOpen(true);
    }).catch(() => {});
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Ringkasan stock barang dan penjualan Anda.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="dashboard-stats">
        <StatCard testid="stat-total-modal" icon={Wallet} label="Total Modal (Fisik)" accent="bg-green-100 text-green-700"
          value={stats ? rupiah(stats.total_modal) : "—"} sub="Nilai stock saat ini" />
        <StatCard testid="stat-total-products" icon={Package} label="Total Produk" accent="bg-blue-100 text-blue-700"
          value={stats ? stats.total_products : "—"} sub="Jenis barang terdaftar" />
        <StatCard testid="stat-low-stock" icon={AlertTriangle} label="Stock Habis" accent="bg-amber-100 text-amber-700"
          value={stats ? stats.low_stock : "—"} sub="Klik untuk lihat barangnya" onClick={openEmptyStock} />
        <StatCard testid="stat-total-sales" icon={TrendingUp} label="Total Penjualan" accent="bg-emerald-100 text-emerald-700"
          value={stats ? rupiah(stats.total_sales_amount) : "—"} sub="Akumulasi semua transaksi" />
        <StatCard testid="stat-transactions" icon={ShoppingCart} label="Jumlah Transaksi" accent="bg-purple-100 text-purple-700"
          value={stats ? stats.total_transactions : "—"} sub="Total transaksi tercatat" />
        <StatCard testid="stat-today-sales" icon={CalendarDays} label="Penjualan Hari Ini" accent="bg-teal-100 text-teal-700"
          value={stats ? rupiah(stats.today_sales) : "—"} sub="Transaksi hari ini" />
        <StatCard testid="stat-supplier-unpaid" icon={Receipt} label="Tagihan Belum Dibayar" accent="bg-red-100 text-red-700"
          value={supplier ? rupiah(supplier.unpaid_total) : "—"}
          sub={supplier ? `${supplier.unpaid_count} tagihan ke supplier` : "Klik untuk lihat"}
          onClick={() => navigate("/supplier-bills")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5" data-testid="monthly-sales-chart">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-lg font-bold tracking-tight text-slate-900">Rekap Penjualan Bulanan</h2>
            <p className="text-xs text-slate-500">Total penjualan 12 bulan terakhir</p>
          </div>
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                width={70}
                tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : v)}
              />
              <Tooltip
                formatter={(v) => [rupiah(v), "Penjualan"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }}
                cursor={{ fill: "rgba(22,101,52,0.06)" }}
              />
              <Bar dataKey="total" fill="#1d4ed8" radius={[4, 4, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid="top-products">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-heading text-lg font-bold tracking-tight text-slate-900">Produk Terlaris</h2>
            <p className="text-xs text-slate-500">Berdasarkan jumlah terjual</p>
          </div>
          <Trophy className="h-5 w-5 text-amber-500" />
        </div>
        <div className="flex gap-1 mb-4" data-testid="top-period-toggle">
          {[["all", "Semua"], ["month", "Bulan Ini"], ["week", "Minggu Ini"]].map(([v, l]) => (
            <button key={v} onClick={() => setTopPeriod(v)} data-testid={`top-period-${v}`}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${topPeriod === v ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {topProducts.map((p, i) => (
            <div key={p.nama_barang} className="flex items-center gap-3" data-testid="top-product-row">
              <div className={`h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-xs font-bold ${
                i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
              }`}>{i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-800 truncate">{p.nama_barang}</div>
                <div className="text-xs text-slate-400">{p.qty} terjual · {rupiah(p.revenue)}</div>
              </div>
            </div>
          ))}
          {topProducts.length === 0 && (
            <div className="text-sm text-slate-400 py-8 text-center">Belum ada penjualan.</div>
          )}
        </div>
        <button onClick={() => setAllOpen(true)} data-testid="view-all-top-products"
          className="mt-4 w-full text-sm font-medium text-primary hover:underline">
          Lihat Semua →
        </button>
      </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5 mt-6" data-testid="cashflow-chart">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-lg font-bold tracking-tight text-slate-900">Arus Kas Bulanan</h2>
            <p className="text-xs text-slate-500">Penjualan vs Pembayaran ke Supplier (12 bulan)</p>
          </div>
          <ArrowLeftRight className="h-5 w-5 text-primary" />
        </div>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={cashflow} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94A3B8" }}
                axisLine={false}
                tickLine={false}
                width={70}
                tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : v)}
              />
              <Tooltip
                formatter={(v, n) => [rupiah(v), n === "penjualan" ? "Penjualan" : "Bayar Supplier"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 13 }}
                cursor={{ fill: "rgba(22,101,52,0.06)" }}
              />
              <Legend formatter={(val) => (val === "penjualan" ? "Penjualan" : "Bayar Supplier")} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="penjualan" fill="#1d4ed8" radius={[4, 4, 0, 0]} maxBarSize={22} />
              <Bar dataKey="pembayaran" fill="#dc2626" radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="bg-white max-w-lg" data-testid="all-products-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> Semua Produk Terlaris
            </DialogTitle>
            <DialogDescription>Semua produk yang pernah terjual, diurutkan dari yang paling banyak — periode: {periodLabel[topPeriod]}.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-1 mb-1" data-testid="all-period-toggle">
            {[["all", "Semua"], ["month", "Bulan Ini"], ["week", "Minggu Ini"]].map(([v, l]) => (
              <button key={v} onClick={() => setTopPeriod(v)} data-testid={`all-period-${v}`}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${topPeriod === v ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="max-h-[60vh] overflow-y-auto -mx-2 px-2">
            {allProducts.map((p, i) => (
              <div key={p.nama_barang} className="flex items-center gap-3 py-2.5 border-b border-slate-100" data-testid="all-product-row">
                <div className={`h-7 w-7 shrink-0 rounded-md flex items-center justify-center text-xs font-bold ${
                  i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-200 text-slate-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
                }`}>{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-800 truncate">{p.nama_barang}</div>
                  <div className="text-xs text-slate-400">{num(p.qty)} terjual</div>
                </div>
                <div className="text-sm font-semibold tabular-nums text-slate-700 shrink-0">{rupiah(p.revenue)}</div>
              </div>
            ))}
            {allProducts.length === 0 && (
              <div className="text-sm text-slate-400 py-10 text-center">Belum ada produk terjual untuk periode ini.</div>
            )}
          </div>
          <div className="text-xs text-slate-400 pt-1">Total {allProducts.length} produk</div>
        </DialogContent>
      </Dialog>

      <Dialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <DialogContent className="bg-white max-w-md" data-testid="empty-stock-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Barang Stock Habis
            </DialogTitle>
            <DialogDescription>Daftar barang dengan stock 0 atau kurang. Segera lakukan restock.</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto -mx-2 px-2">
            {emptyProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-slate-100" data-testid="empty-stock-row">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{p.nama_produk}</div>
                  {p.keterangan && <div className="text-xs text-amber-700">{p.keterangan}</div>}
                </div>
                <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full shrink-0 ml-3">
                  stok {num(p.stock)}
                </span>
              </div>
            ))}
            {emptyProducts.length === 0 && (
              <div className="text-sm text-slate-400 py-8 text-center">Tidak ada barang yang habis.</div>
            )}
          </div>
          <button
            onClick={() => { setEmptyOpen(false); navigate("/inventory"); }}
            data-testid="goto-inventory-button"
            className="mt-2 w-full text-sm font-medium text-primary hover:underline"
          >
            Kelola Stock Barang →
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
