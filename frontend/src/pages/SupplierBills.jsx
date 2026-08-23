import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah, num, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Receipt, CheckCircle2, Clock, ChevronDown, ChevronRight, Undo2 } from "lucide-react";
import { toast } from "sonner";

function BillCard({ bill, onToggle, expanded, onExpand }) {
  const paid = bill.status === "paid";
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="bill-card">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50" onClick={onExpand}>
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          <div>
            <div className="font-medium text-slate-800">{formatDate(bill.tanggal)}</div>
            <div className="text-xs text-slate-500">{bill.items?.length || 0} barang{paid && bill.paid_at ? ` · lunas ${formatDate(bill.paid_at)}` : ""}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-slate-400">Total Modal</div>
            <div className="font-heading font-bold tabular-nums text-slate-900" data-testid="bill-amount">{rupiah(bill.amount)}</div>
          </div>
          {paid ? (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onToggle(bill.id, "unpaid"); }} data-testid={`unpay-bill-${bill.id}`}>
              <Undo2 className="h-4 w-4 mr-1" /> Batalkan
            </Button>
          ) : (
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onToggle(bill.id, "paid"); }} data-testid={`pay-bill-${bill.id}`}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Tandai Lunas
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-2 font-semibold">Nama Barang</th>
                <th className="px-4 py-2 font-semibold text-right">QTY</th>
                <th className="px-4 py-2 font-semibold text-right">Modal/QTY</th>
                <th className="px-4 py-2 font-semibold text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {bill.items?.map((it, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-800">{it.nama_barang}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{num(it.qty)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{rupiah(it.modal_per_qty)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">{rupiah(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function SupplierBills() {
  const [bills, setBills] = useState([]);
  const [expanded, setExpanded] = useState({});

  const load = () => api.get("/supplier-bills").then((res) => setBills(res.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const toggle = async (id, status) => {
    try {
      await api.patch(`/supplier-bills/${id}/status`, { status });
      toast.success(status === "paid" ? "Tagihan ditandai lunas" : "Status dibatalkan");
      load();
    } catch {
      toast.error("Gagal memperbarui status");
    }
  };

  const unpaid = bills.filter((b) => b.status === "unpaid");
  const paid = bills.filter((b) => b.status === "paid");
  const unpaidTotal = unpaid.reduce((s, b) => s + (b.amount || 0), 0);
  const paidTotal = paid.reduce((s, b) => s + (b.amount || 0), 0);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Tagihan Supplier</h1>
        <p className="text-sm text-slate-500 mt-1">Tagihan otomatis dari harga modal barang yang terjual.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-500" /> Belum Dibayar
            </h2>
            <div className="text-right">
              <div className="text-xs text-slate-400">Total</div>
              <div className="font-heading font-bold text-red-600 tabular-nums" data-testid="unpaid-total">{rupiah(unpaidTotal)}</div>
            </div>
          </div>
          <div className="space-y-3" data-testid="unpaid-list">
            {unpaid.map((b) => (
              <BillCard key={b.id} bill={b} onToggle={toggle} expanded={expanded[b.id]}
                onExpand={() => setExpanded({ ...expanded, [b.id]: !expanded[b.id] })} />
            ))}
            {unpaid.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-12 text-center text-slate-400">
                <Receipt className="h-7 w-7 mx-auto mb-2 opacity-40" /> Tidak ada tagihan belum dibayar.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Sudah Dibayar
            </h2>
            <div className="text-right">
              <div className="text-xs text-slate-400">Total</div>
              <div className="font-heading font-bold text-green-600 tabular-nums" data-testid="paid-total">{rupiah(paidTotal)}</div>
            </div>
          </div>
          <div className="space-y-3" data-testid="paid-list">
            {paid.map((b) => (
              <BillCard key={b.id} bill={b} onToggle={toggle} expanded={expanded[b.id]}
                onExpand={() => setExpanded({ ...expanded, [b.id]: !expanded[b.id] })} />
            ))}
            {paid.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-12 text-center text-slate-400">
                <CheckCircle2 className="h-7 w-7 mx-auto mb-2 opacity-40" /> Belum ada tagihan yang dilunasi.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
