import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { rupiah, num, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ProductCombobox from "@/components/ProductCombobox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Download, ShoppingCart, X, ChevronDown, ChevronRight, Printer, Filter, Pencil, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
const emptyItem = () => ({ product_id: "", nama_barang: "", qty: 1, harga: 0 });

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [open, setOpen] = useState(false);
  const [tanggal, setTanggal] = useState(today());
  const [items, setItems] = useState([emptyItem()]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const loadSales = (start, end) => {
    const params = {};
    if (start) params.start = start;
    if (end) params.end = end;
    return api.get("/sales", { params }).then((res) => setSales(res.data)).catch(() => {});
  };
  const loadProducts = () => api.get("/products").then((res) => setProducts(res.data)).catch(() => {});
  useEffect(() => { loadSales(); loadProducts(); }, []);

  const applyFilter = () => loadSales(startDate, endDate);
  const resetFilter = () => { setStartDate(""); setEndDate(""); loadSales(); };

  const filteredTotal = sales.reduce((s, sale) => s + (sale.grand_total || 0), 0);

  const printReceipt = async (id) => {
    try {
      const res = await api.get(`/sales/${id}/receipt`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const w = window.open(url, "_blank");
      if (w) {
        w.addEventListener("load", () => w.print());
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `struk_${id.slice(0, 8)}.pdf`;
        a.click();
      }
    } catch {
      toast.error("Gagal membuat struk");
    }
  };

  const grandTotal = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.harga) || 0), 0);

  const setItem = (idx, patch) => setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () => setItems([...items, emptyItem()]);
  const removeItem = (idx) => setItems(items.length > 1 ? items.filter((_, i) => i !== idx) : items);

  const onSelectProduct = (idx, productId) => {
    const p = products.find((x) => x.id === productId);
    if (p) setItem(idx, { product_id: p.id, nama_barang: p.nama_produk, harga: Math.round(p.modal_per_qty) });
  };

  const openNew = () => { setEditingId(null); setTanggal(today()); setItems([emptyItem()]); setOpen(true); };

  const openEdit = (s) => {
    setEditingId(s.id);
    setTanggal((s.tanggal || today()).slice(0, 10));
    setItems((s.items || []).map((it) => ({
      product_id: it.product_id || "",
      nama_barang: it.nama_barang,
      qty: it.qty,
      harga: it.harga,
    })));
    setOpen(true);
  };

  const save = async () => {
    const valid = items.filter((it) => it.nama_barang && Number(it.qty) > 0);
    if (valid.length === 0) { toast.error("Tambahkan minimal 1 barang"); return; }
    setSaving(true);
    const payload = {
      tanggal,
      items: valid.map((it) => ({
        product_id: it.product_id || null,
        nama_barang: it.nama_barang,
        qty: Number(it.qty),
        harga: Number(it.harga) || 0,
        total: (Number(it.qty) || 0) * (Number(it.harga) || 0),
      })),
    };
    try {
      if (editingId) {
        await api.put(`/sales/${editingId}`, payload);
        toast.success("Transaksi diperbarui, stock disesuaikan");
      } else {
        await api.post("/sales", payload);
        toast.success("Transaksi disimpan, stock diperbarui");
      }
      setOpen(false);
      loadSales();
      loadProducts();
    } catch (err) {
      toast.error("Gagal menyimpan transaksi");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try {
      await api.delete(`/sales/${deleteId}`);
      toast.success("Transaksi dihapus");
      setDeleteId(null);
      loadSales();
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const exportExcel = async () => {
    try {
      const res = await api.get("/export/sales", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "penjualan.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal export");
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/sales/template", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "template_penjualan.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengunduh template");
    }
  };

  const openImport = () => { setImportFile(null); setImportResult(null); setImportOpen(true); };

  const handleImport = async () => {
    if (!importFile) { toast.error("Pilih file Excel dulu"); return; }
    setImporting(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", importFile);
    try {
      const res = await api.post("/sales/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImportResult(res.data);
      toast.success(`Berhasil: ${res.data.transactions_created} transaksi diimport`);
      loadSales();
      loadProducts();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal import file");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Penjualan</h1>
          <p className="text-sm text-slate-500 mt-1">{sales.length} transaksi tercatat</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openImport} data-testid="import-sales-button">
            <Upload className="h-4 w-4 mr-2" /> Import Excel
          </Button>
          <Button variant="outline" onClick={exportExcel} data-testid="export-sales-button">
            <Download className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button onClick={openNew} data-testid="add-sale-button">
            <Plus className="h-4 w-4 mr-2" /> Transaksi Baru
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 mb-4 flex flex-wrap items-end gap-3" data-testid="sales-filter-bar">
        <div>
          <Label className="text-xs text-slate-500">Dari Tanggal</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} data-testid="filter-start-date" className="mt-1 h-9 w-44" />
        </div>
        <div>
          <Label className="text-xs text-slate-500">Sampai Tanggal</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} data-testid="filter-end-date" className="mt-1 h-9 w-44" />
        </div>
        <Button variant="default" onClick={applyFilter} data-testid="apply-filter-button" className="h-9">
          <Filter className="h-4 w-4 mr-2" /> Terapkan
        </Button>
        <Button variant="outline" onClick={resetFilter} data-testid="reset-filter-button" className="h-9">Reset</Button>
        <div className="ml-auto text-right">
          <div className="text-xs text-slate-400">Total (tampilan ini)</div>
          <div className="font-heading font-bold text-primary tabular-nums" data-testid="filtered-total">{rupiah(filteredTotal)}</div>
        </div>
      </div>

      <div className="space-y-3" data-testid="sales-list">
        {sales.map((s) => {
          const isOpen = expanded[s.id];
          return (
            <div key={s.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden" data-testid="sale-card">
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50" onClick={() => setExpanded({ ...expanded, [s.id]: !isOpen })}>
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                  <div>
                    <div className="font-medium text-slate-800">{formatDate(s.tanggal)}</div>
                    <div className="text-xs text-slate-500">{s.items?.length || 0} barang</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Grand Total</div>
                    <div className="font-heading font-bold text-primary tabular-nums" data-testid="sale-grand-total">{rupiah(s.grand_total)}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} data-testid={`edit-sale-${s.id}`}
                    className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors" title="Edit transaksi">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); printReceipt(s.id); }} data-testid={`print-sale-${s.id}`}
                    className="p-1.5 rounded hover:bg-green-100 text-primary transition-colors" title="Cetak struk">
                    <Printer className="h-4 w-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteId(s.id); }} data-testid={`delete-sale-${s.id}`}
                    className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-slate-100 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-left">
                      <tr>
                        <th className="px-4 py-2 font-semibold">Nama Barang</th>
                        <th className="px-4 py-2 font-semibold text-right">QTY</th>
                        <th className="px-4 py-2 font-semibold text-right">Harga</th>
                        <th className="px-4 py-2 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.items?.map((it, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-800">{it.nama_barang}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{num(it.qty)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{rupiah(it.harga)}</td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium">{rupiah(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {sales.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-lg px-4 py-16 text-center text-slate-400">
            <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Belum ada transaksi. Klik "Transaksi Baru".
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">{editingId ? "Edit Transaksi Penjualan" : "Transaksi Penjualan Baru"}</DialogTitle>
            <DialogDescription>Pilih tanggal, tambahkan barang, dan simpan. Stock akan disesuaikan otomatis.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-w-xs">
              <Label>Tanggal</Label>
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} data-testid="sale-date-input" className="mt-1.5" />
            </div>

            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 text-left">
                  <tr>
                    <th className="px-2 py-2 font-semibold">Barang</th>
                    <th className="px-2 py-2 font-semibold w-20">QTY</th>
                    <th className="px-2 py-2 font-semibold w-32">Harga</th>
                    <th className="px-2 py-2 font-semibold w-32 text-right">Total</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-t border-slate-100" data-testid="sale-item-row">
                      <td className="px-2 py-2">
                        <ProductCombobox
                          products={products}
                          value={it.product_id}
                          onSelect={(pid) => onSelectProduct(idx, pid)}
                          testid={`sale-product-select-${idx}`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" step="any" value={it.qty} onChange={(e) => setItem(idx, { qty: e.target.value })}
                          data-testid={`sale-qty-input-${idx}`} className="h-9" />
                      </td>
                      <td className="px-2 py-2">
                        <Input type="number" step="any" value={it.harga} onChange={(e) => setItem(idx, { harga: e.target.value })}
                          data-testid={`sale-harga-input-${idx}`} className="h-9" />
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums font-medium">
                        {rupiah((Number(it.qty) || 0) * (Number(it.harga) || 0))}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => removeItem(idx)} className="p-1 text-slate-400 hover:text-red-600">
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button variant="outline" size="sm" onClick={addItem} data-testid="add-sale-item-button">
              <Plus className="h-4 w-4 mr-1" /> Tambah Baris
            </Button>

            <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-md px-4 py-3">
              <span className="font-medium text-slate-700">Grand Total</span>
              <span className="font-heading text-xl font-extrabold text-primary tabular-nums" data-testid="form-grand-total">{rupiah(grandTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving} data-testid="save-sale-button">
              {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Transaksi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus transaksi?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan. Stock barang akan dikembalikan otomatis.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} data-testid="confirm-delete-sale" className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="bg-white max-w-lg" data-testid="import-sales-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" /> Import Penjualan dari Excel
            </DialogTitle>
            <DialogDescription>
              Upload file Excel berisi transaksi penjualan. Baris dengan tanggal sama akan digabung menjadi satu transaksi. Stock berkurang otomatis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm">
              <p className="text-slate-600 mb-2">Kolom yang didukung: <span className="font-medium">Tanggal, Nama Barang, QTY, Harga</span>.</p>
              <button onClick={downloadTemplate} data-testid="download-sales-template-button"
                className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                <Download className="h-3.5 w-3.5" /> Unduh template contoh
              </button>
            </div>

            <label className="block border-2 border-dashed border-slate-300 rounded-md p-6 text-center cursor-pointer hover:border-primary transition-colors">
              <input
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                data-testid="import-sales-file-input"
                onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
              />
              <Upload className="h-6 w-6 mx-auto text-slate-400 mb-2" />
              <div className="text-sm text-slate-600">
                {importFile ? <span className="font-medium text-slate-800">{importFile.name}</span> : "Klik untuk pilih file .xlsx"}
              </div>
            </label>

            {importResult && (
              <div className="text-sm bg-green-50 border border-green-200 rounded-md p-3" data-testid="import-sales-result">
                <div className="text-green-800 font-medium">Import selesai:</div>
                <ul className="text-slate-600 mt-1 space-y-0.5">
                  <li>• {importResult.transactions_created} transaksi dibuat</li>
                  <li>• {importResult.items_imported} baris barang diimport</li>
                  <li>• {importResult.skipped} baris dilewati (kosong/tidak valid)</li>
                </ul>
                {importResult.errors?.length > 0 && (
                  <div className="text-red-600 mt-2 text-xs">
                    {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Tutup</Button>
            <Button onClick={handleImport} disabled={importing || !importFile} data-testid="submit-sales-import-button">
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mengimport...</> : "Import Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
