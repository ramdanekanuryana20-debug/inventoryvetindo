import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah, num, formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { History, Search } from "lucide-react";

export default function ChangeHistory() {
  const [logs, setLogs] = useState([]);
  const [q, setQ] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const load = () => api.get("/change-logs", { params: { start: start || undefined, end: end || undefined } })
    .then((res) => setLogs(res.data)).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);

  const filtered = logs.filter((l) => (l.nama_produk || "").toLowerCase().includes(q.toLowerCase()));
  const fmtVal = (jenis, v) => (jenis === "harga_modal" ? rupiah(v) : num(v));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Riwayat Perubahan</h1>
        <p className="text-sm text-slate-500 mt-1">Catatan perubahan stok & harga modal produk.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Cari produk..." value={q} onChange={(e) => setQ(e.target.value)} data-testid="history-search" className="pl-9" />
        </div>
        <div><Label className="text-xs text-slate-500">Dari</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} data-testid="history-start" className="mt-1 h-9 w-40" /></div>
        <div><Label className="text-xs text-slate-500">Sampai</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} data-testid="history-end" className="mt-1 h-9 w-40" /></div>
        {(start || end) && <Button variant="outline" className="h-9" onClick={() => { setStart(""); setEnd(""); }}>Reset</Button>}
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-3 font-semibold">Waktu</th>
              <th className="px-3 py-3 font-semibold">Produk</th>
              <th className="px-3 py-3 font-semibold">Jenis</th>
              <th className="px-3 py-3 font-semibold text-right">Sebelum</th>
              <th className="px-3 py-3 font-semibold text-right">Sesudah</th>
              <th className="px-3 py-3 font-semibold">Oleh</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="odd:bg-white even:bg-slate-50 border-t border-slate-100" data-testid="history-row">
                <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{new Date(l.tanggal).toLocaleString("id-ID")}</td>
                <td className="px-3 py-2.5 font-medium text-slate-800">{l.nama_produk}</td>
                <td className="px-3 py-2.5"><span className={`text-xs px-2 py-0.5 rounded-full ${l.jenis === "harga_modal" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{l.jenis === "harga_modal" ? "Harga Modal" : "Stok"}</span></td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{fmtVal(l.jenis, l.sebelum)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtVal(l.jenis, l.sesudah)}</td>
                <td className="px-3 py-2.5 text-slate-600">{l.user}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-16 text-center text-slate-400"><History className="h-8 w-8 mx-auto mb-2 opacity-40" />Belum ada riwayat perubahan.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
