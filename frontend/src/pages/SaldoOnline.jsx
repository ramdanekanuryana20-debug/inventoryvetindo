import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { rupiah } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Store, Wallet, History, Download } from "lucide-react";
import { toast } from "sonner";

const currentMonth = () => new Date().toISOString().slice(0, 7);
const monthLabel = (m) => {
  if (!m) return "";
  const [y, mo] = m.split("-");
  const names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return `${names[parseInt(mo, 10) - 1]} ${y}`;
};

export default function SaldoOnline() {
  const [bulan, setBulan] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [months, setMonths] = useState([]);
  const [newStore, setNewStore] = useState("");
  const [wd, setWd] = useState({ tanggal: new Date().toISOString().slice(0, 10), jumlah: "", sumber: "" });

  const load = useCallback((b) => {
    api.get("/saldo-online", { params: { bulan: b } }).then((res) => {
      setData(res.data);
      setRows(res.data.stores.map((s) => ({ ...s })));
    }).catch(() => {});
    api.get("/saldo-online/months").then((res) => setMonths(res.data)).catch(() => {});
  }, []);

  useEffect(() => { load(bulan); }, [bulan, load]);

  const setRow = (id, patch) => setRows(rows.map((r) => (r.store_id === id ? { ...r, ...patch } : r)));

  const totalSaldo = rows.reduce((s, r) => s + (Number(r.saldo_tersedia) || 0) + (Number(r.saldo_pending) || 0), 0);
  const invoice = data?.invoice || 0;
  const totalPenarikan = data?.total_penarikan || 0;
  const sisaProfit = totalSaldo - invoice;
  const labaBersih = totalSaldo - invoice + totalPenarikan;

  const addStore = async () => {
    if (!newStore.trim()) return;
    try {
      await api.post("/stores", { nama: newStore.trim() });
      setNewStore("");
      toast.success("Toko ditambahkan");
      load(bulan);
    } catch { toast.error("Gagal menambah toko"); }
  };

  const deleteStore = async (id) => {
    try {
      await api.delete(`/stores/${id}`);
      toast.success("Toko dihapus");
      load(bulan);
    } catch { toast.error("Gagal menghapus toko"); }
  };

  const saveSaldo = async () => {
    try {
      const payload = rows.map((r) => ({
        store_id: r.store_id,
        saldo_tersedia: Number(r.saldo_tersedia) || 0,
        saldo_pending: Number(r.saldo_pending) || 0,
      }));
      const res = await api.put(`/saldo-online/${bulan}/stores`, payload);
      setData(res.data);
      toast.success("Saldo bulan ini disimpan");
      load(bulan);
    } catch { toast.error("Gagal menyimpan saldo"); }
  };

  const addWithdrawal = async () => {
    if (!wd.jumlah || Number(wd.jumlah) <= 0) { toast.error("Isi jumlah penarikan"); return; }
    try {
      const res = await api.post(`/saldo-online/${bulan}/withdrawals`, {
        tanggal: wd.tanggal, jumlah: Number(wd.jumlah), sumber: wd.sumber,
      });
      setData(res.data);
      setWd({ tanggal: new Date().toISOString().slice(0, 10), jumlah: "", sumber: "" });
      toast.success("Penarikan ditambahkan");
    } catch { toast.error("Gagal menambah penarikan"); }
  };

  const deleteWithdrawal = async (wid) => {
    try {
      const res = await api.delete(`/saldo-online/${bulan}/withdrawals/${wid}`);
      setData(res.data);
      toast.success("Penarikan dihapus");
    } catch { toast.error("Gagal menghapus"); }
  };

  const exportSaldo = async () => {
    try {
      const res = await api.get(`/saldo-online/${bulan}/export`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `saldo_online_${bulan}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { toast.error("Gagal export"); }
  };

  let running = 0;
  const withdrawals = data?.withdrawals || [];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Saldo Online</h1>
          <p className="text-sm text-slate-500 mt-1">Rekap saldo toko online & penarikan pribadi per bulan.</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <Label className="text-xs text-slate-500">Bulan</Label>
            <Input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)} data-testid="saldo-month-input" className="mt-1 h-9 w-44" />
          </div>
          {months.length > 0 && (
            <div>
              <Label className="text-xs text-slate-500 flex items-center gap-1"><History className="h-3 w-3" /> Riwayat</Label>
              <Select value="" onValueChange={(v) => setBulan(v)}>
                <SelectTrigger data-testid="saldo-history-select" className="h-9 w-48 mt-1"><SelectValue placeholder="Pilih bulan lalu" /></SelectTrigger>
                <SelectContent className="bg-white">
                  {months.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button variant="outline" onClick={exportSaldo} data-testid="export-saldo-button" className="h-9">
            <Download className="h-4 w-4 mr-2" /> Export Excel
          </Button>
        </div>
      </div>

      <div className="text-sm font-medium text-primary mb-4">Periode: {monthLabel(bulan)}</div>

      {/* Add store */}
      <div className="flex items-center gap-2 mb-4 max-w-md">
        <Store className="h-4 w-4 text-slate-400" />
        <Input placeholder="Nama toko baru (mis. Shopee)" value={newStore} onChange={(e) => setNewStore(e.target.value)}
          data-testid="new-store-input" className="h-9" onKeyDown={(e) => e.key === "Enter" && addStore()} />
        <Button size="sm" onClick={addStore} data-testid="add-store-button"><Plus className="h-4 w-4 mr-1" /> Toko</Button>
      </div>

      {/* Main saldo table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 text-left">
              <tr>
                <th className="px-3 py-3 font-semibold">Nama Toko</th>
                <th className="px-3 py-3 font-semibold text-right">Saldo Tersedia</th>
                <th className="px-3 py-3 font-semibold text-right">Saldo Pending</th>
                <th className="px-3 py-3 font-semibold text-right">Total Saldo Per Toko</th>
                <th className="px-3 py-3 font-semibold w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const totalToko = (Number(r.saldo_tersedia) || 0) + (Number(r.saldo_pending) || 0);
                return (
                  <tr key={r.store_id} className="odd:bg-white even:bg-slate-50 border-t border-slate-100" data-testid="saldo-store-row">
                    <td className="px-3 py-2 font-medium text-slate-800">{r.nama_toko}</td>
                    <td className="px-3 py-2">
                      <Input type="number" step="any" value={r.saldo_tersedia} onChange={(e) => setRow(r.store_id, { saldo_tersedia: e.target.value })}
                        data-testid={`saldo-tersedia-${r.store_id}`} className="h-8 text-right tabular-nums" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" step="any" value={r.saldo_pending} onChange={(e) => setRow(r.store_id, { saldo_pending: e.target.value })}
                        data-testid={`saldo-pending-${r.store_id}`} className="h-8 text-right tabular-nums" />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{rupiah(totalToko)}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => deleteStore(r.store_id)} className="p-1 text-slate-400 hover:text-red-600" data-testid={`delete-store-${r.store_id}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Belum ada toko. Tambahkan toko dulu di atas.</td></tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="bg-primary/5 border-t-2 border-primary/20 font-semibold text-slate-800">
                  <td colSpan={3} className="px-3 py-3 text-right">Total Saldo Online</td>
                  <td className="px-3 py-3 text-right tabular-nums text-primary" data-testid="total-saldo-online">{rupiah(totalSaldo)}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <Button onClick={saveSaldo} data-testid="save-saldo-button"><Save className="h-4 w-4 mr-2" /> Simpan Saldo Bulan Ini</Button>
        <div className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-md px-3 py-2">
          <span className="text-slate-500">Invoice (tagihan belum dibayar):</span>
          <span className="font-semibold text-red-600 tabular-nums" data-testid="saldo-invoice">{rupiah(invoice)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-md px-3 py-2">
          <span className="text-slate-500">Sisa Profit:</span>
          <span className="font-semibold text-primary tabular-nums" data-testid="saldo-sisa-profit">{rupiah(sisaProfit)}</span>
        </div>
      </div>

      {/* Penarikan Pribadi */}
      <h2 className="font-heading text-lg font-bold tracking-tight text-slate-900 mb-3 flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" /> Penarikan Pribadi
      </h2>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 text-left">
              <tr>
                <th className="px-3 py-3 font-semibold">Tanggal</th>
                <th className="px-3 py-3 font-semibold text-right">Jumlah</th>
                <th className="px-3 py-3 font-semibold">Sumber</th>
                <th className="px-3 py-3 font-semibold text-right">Total (kumulatif)</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((w) => {
                running += Number(w.jumlah) || 0;
                return (
                  <tr key={w.id} className="odd:bg-white even:bg-slate-50 border-t border-slate-100" data-testid="withdrawal-row">
                    <td className="px-3 py-2">{w.tanggal}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{rupiah(w.jumlah)}</td>
                    <td className="px-3 py-2 text-slate-600">{w.sumber || "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{rupiah(running)}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => deleteWithdrawal(w.id)} className="p-1 text-slate-400 hover:text-red-600" data-testid={`delete-withdrawal-${w.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-slate-100 bg-slate-50/50">
                <td className="px-3 py-2">
                  <Input type="date" value={wd.tanggal} onChange={(e) => setWd({ ...wd, tanggal: e.target.value })} data-testid="wd-tanggal-input" className="h-8" />
                </td>
                <td className="px-3 py-2">
                  <Input type="number" step="any" placeholder="Jumlah" value={wd.jumlah} onChange={(e) => setWd({ ...wd, jumlah: e.target.value })} data-testid="wd-jumlah-input" className="h-8 text-right" />
                </td>
                <td className="px-3 py-2">
                  <Input placeholder="Sumber (mis. Shopee)" value={wd.sumber} onChange={(e) => setWd({ ...wd, sumber: e.target.value })} data-testid="wd-sumber-input" className="h-8" />
                </td>
                <td className="px-3 py-2"></td>
                <td className="px-3 py-2">
                  <button onClick={addWithdrawal} className="p-1 text-primary hover:text-green-700" data-testid="add-withdrawal-button">
                    <Plus className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            </tbody>
            {withdrawals.length > 0 && (
              <tfoot>
                <tr className="bg-primary/5 border-t-2 border-primary/20 font-semibold text-slate-800">
                  <td className="px-3 py-3">Total Penarikan</td>
                  <td colSpan={2} className="px-3 py-3 text-right tabular-nums text-primary" data-testid="total-penarikan">{rupiah(totalPenarikan)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="summary-total-saldo">
          <div className="text-sm text-slate-500">Total Saldo</div>
          <div className="font-heading text-xl font-extrabold tabular-nums text-slate-900 mt-1">{rupiah(totalSaldo)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="summary-invoice">
          <div className="text-sm text-slate-500">Invoice Belum Dibayar</div>
          <div className="font-heading text-xl font-extrabold tabular-nums text-red-600 mt-1">{rupiah(invoice)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4" data-testid="summary-penarikan">
          <div className="text-sm text-slate-500">Total Penarikan Pribadi</div>
          <div className="font-heading text-xl font-extrabold tabular-nums text-amber-600 mt-1">{rupiah(totalPenarikan)}</div>
        </div>
        <div className="bg-primary text-white rounded-lg p-4" data-testid="summary-laba-bersih">
          <div className="text-sm text-white/80">Laba Bersih Bulan Ini</div>
          <div className="font-heading text-xl font-extrabold tabular-nums mt-1">{rupiah(labaBersih)}</div>
        </div>
      </div>
    </div>
  );
}
