import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { Package, Wallet, ShoppingCart, TrendingUp, AlertTriangle, CalendarDays } from "lucide-react";

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

  useEffect(() => {
    api.get("/dashboard/stats").then((res) => setStats(res.data)).catch(() => {});
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
    </div>
  );
}
