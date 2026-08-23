import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah, num, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Receipt, CheckCircle2, Clock, ChevronDown, ChevronRight, Undo2, Wallet, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUS = {
  unpaid: { t: "Belum Dibayar", c: "bg-red-100 text-red-700" },
  partial: { t: "Dibayar Sebagian", c: "bg-amber-100 text-amber-800" },
  paid: { t: "Lunas", c: "bg-green-100 text-green-700" },
};

function BillCard({ bill, onToggle, onOpenPay, onDeletePayment, expanded, onExpand }) {
  const paid = bill.status === "paid";
  const badge = STATUS[bill.status] || STATUS.unpaid;
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="bill-card">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 gap-3" onClick={onExpand}>
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />}
          <div className="min-w-0">
            <div className="font-medium text-slate-800">{formatDate(bill.tanggal)}</div>
            <div className="text-xs text-slate-500">{bill.items?.length || 0} barang</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mb-1 ${badge.c}`} data-testid={`bill-status-${bill.id}`}>{badge.t}</span>
            <div className="font-heading font-bold tabular-nums text-slate-900" data-testid="bill-amount">{rupiah(bill.amount)}</div>
            {bill.paid_amount > 0 && !paid && (
              <div className="text-[11px] text-slate-500">Dibayar {rupiah(bill.paid_amount)} · Sisa <span className="text-red-600 font-medium">{rupiah(bill.outstanding)}</span></div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!paid && (
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onOpenPay(bill); }} data-testid={`pay-partial-${bill.id}`}>
                <Wallet className="h-4 w-4 mr-1" /> Bayar
              </Button>
            )}
            {!paid ? (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); onToggle(bill.id, "paid"); }} data-testid={`pay-bill-${bill.id}`}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Lunas
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onToggle(bill.id, "unpaid"); }} data-testid={`unpay-bill-${bill.id}`}>
                <Undo2 className="h-4 w-4 mr-1" /> Batalkan
              </Button>
            )}
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100">
          <div className="overflow-x-auto">
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
          {bill.payments?.length > 0 && (
            <div className="px-4 py-3 bg-slate-50/60 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-500 mb-2">Riwayat Pembayaran</div>
              <div className="space-y-1">
                {bill.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{formatDate(p.tanggal)}{p.note ? ` · ${p.note}` : ""}</span>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums font-medium">{rupiah(p.jumlah)}</span>
                      <button onClick={() => onDeletePayment(bill.id, p.id)} className="text-slate-400 hover:text-red-600" data-testid={`delete-payment-${p.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SupplierBills() {
  const [bills, setBills] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [payBill, setPayBill] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [loading, setLoading] = useState(true);

  const load = () => api.get("/supplier-bills").then((res) => setBills(res.data)).catch(() => {}).finally(() => setLoading(false));
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

  const openPay = (bill) => { setPayBill(bill); setPayAmount(String(bill.outstanding || "")); };

  const submitPay = async () => {
    const jumlah = Number(payAmount);
    if (!jumlah || jumlah <= 0) { toast.error("Isi nominal pembayaran"); return; }
    try {
      await api.post(`/supplier-bills/${payBill.id}/payment`, { jumlah });
      toast.success("Pembayaran dicatat");
      setPayBill(null);
      setPayAmount("");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal mencatat pembayaran");
    }
  };

  const deletePayment = async (billId, pid) => {
    try {
      await api.delete(`/supplier-bills/${billId}/payment/${pid}`);
      toast.success("Pembayaran dihapus");
      load();
    } catch {
      toast.error("Gagal menghapus pembayaran");
    }
  };

  const belumLunas = bills.filter((b) => b.status !== "paid");
  const lunas = bills.filter((b) => b.status === "paid");
  const outstandingTotal = belumLunas.reduce((s, b) => s + (b.outstanding || 0), 0);
  const lunasTotal = lunas.reduce((s, b) => s + (b.amount || 0), 0);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Tagihan Supplier</h1>
        <p className="text-sm text-slate-500 mt-1">Tagihan otomatis dari harga modal barang terjual. Bisa dibayar penuh atau sebagian (cicilan).</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-500" /> Belum Dibayar
            </h2>
            <div className="text-right">
              <div className="text-xs text-slate-400">Sisa Total</div>
              <div className="font-heading font-bold text-red-600 tabular-nums" data-testid="unpaid-total">{loading ? "…" : rupiah(outstandingTotal)}</div>
            </div>
          </div>
          <div className="space-y-3" data-testid="unpaid-list">
            {belumLunas.map((b) => (
              <BillCard key={b.id} bill={b} onToggle={toggle} onOpenPay={openPay} onDeletePayment={deletePayment}
                expanded={expanded[b.id]} onExpand={() => setExpanded({ ...expanded, [b.id]: !expanded[b.id] })} />
            ))}
            {belumLunas.length === 0 && (
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
              <div className="font-heading font-bold text-green-600 tabular-nums" data-testid="paid-total">{loading ? "…" : rupiah(lunasTotal)}</div>
            </div>
          </div>
          <div className="space-y-3" data-testid="paid-list">
            {lunas.map((b) => (
              <BillCard key={b.id} bill={b} onToggle={toggle} onOpenPay={openPay} onDeletePayment={deletePayment}
                expanded={expanded[b.id]} onExpand={() => setExpanded({ ...expanded, [b.id]: !expanded[b.id] })} />
            ))}
            {lunas.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-lg px-4 py-12 text-center text-slate-400">
                <CheckCircle2 className="h-7 w-7 mx-auto mb-2 opacity-40" /> Belum ada tagihan yang dilunasi.
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!payBill} onOpenChange={(o) => !o && setPayBill(null)}>
        <DialogContent className="bg-white max-w-sm" data-testid="payment-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Bayar Sebagian</DialogTitle>
            <DialogDescription>Masukkan nominal yang dibayarkan ke supplier untuk tagihan {payBill ? formatDate(payBill.tanggal) : ""}.</DialogDescription>
          </DialogHeader>
          {payBill && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-slate-50 rounded-md p-2"><div className="text-slate-400 text-xs">Total Tagihan</div><div className="font-semibold tabular-nums">{rupiah(payBill.amount)}</div></div>
                <div className="bg-slate-50 rounded-md p-2"><div className="text-slate-400 text-xs">Sisa</div><div className="font-semibold tabular-nums text-red-600">{rupiah(payBill.outstanding)}</div></div>
              </div>
              <div>
                <Label>Nominal Pembayaran</Label>
                <Input type="number" step="any" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                  data-testid="payment-amount-input" className="mt-1.5" autoFocus />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayBill(null)}>Batal</Button>
            <Button onClick={submitPay} data-testid="submit-payment-button">Simpan Pembayaran</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
