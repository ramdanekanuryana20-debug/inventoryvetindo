import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { Package, Wallet, ShoppingCart, TrendingUp, AlertTriangle, CalendarDays, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function StatCard({ icon: Icon, label, value, sub, testid, accent }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-sm transition-shadow" data-testid={testid}>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500 font-medium">{label}</span>
        <div className={`h-9 w-9 rounded-md flex items-center justify-center ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="font-heading text-2xl font-extrabold tracking-tight text-slate-900 mt-3 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    api.get("/dashboard/stats").then((res) => setStats(res.data)).catch(() => {});
    api.get("/dashboard/monthly-sales").then((res) => setMonthly(res.data)).catch(() => {});
    api.get("/dashboard/top-products").then((res) => setTopProducts(res.data)).catch(() => {});
  }, []);

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
          value={stats ? stats.low_stock : "—"} sub="Produk dengan stock 0" />
        <StatCard testid="stat-total-sales" icon={TrendingUp} label="Total Penjualan" accent="bg-emerald-100 text-emerald-700"
          value={stats ? rupiah(stats.total_sales_amount) : "—"} sub="Akumulasi semua transaksi" />
        <StatCard testid="stat-transactions" icon={ShoppingCart} label="Jumlah Transaksi" accent="bg-purple-100 text-purple-700"
          value={stats ? stats.total_transactions : "—"} sub="Total transaksi tercatat" />
        <StatCard testid="stat-today-sales" icon={CalendarDays} label="Penjualan Hari Ini" accent="bg-teal-100 text-teal-700"
          value={stats ? rupiah(stats.today_sales) : "—"} sub="Transaksi hari ini" />
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
              <Bar dataKey="total" fill="#166534" radius={[4, 4, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-5" data-testid="top-products">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-lg font-bold tracking-tight text-slate-900">Produk Terlaris</h2>
            <p className="text-xs text-slate-500">Berdasarkan jumlah terjual</p>
          </div>
          <Trophy className="h-5 w-5 text-amber-500" />
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
      </div>
      </div>
    </div>
  );
}
