import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { rupiah, num } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2, Download, Search, Package, Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";

const empty = { nama_produk: "", qty: 1, harga_modal: 0, stock: 0, keterangan: "" };

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [stockFilter, setStockFilter] = useState("all");

  const load = () => api.get("/products").then((res) => setProducts(res.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => products.filter((p) => {
      if (!p.nama_produk.toLowerCase().includes(q.toLowerCase())) return false;
      if (stockFilter === "empty") return (p.stock || 0) === 0;
      if (stockFilter === "negative") return (p.stock || 0) < 0;
      if (stockFilter === "modal_negative") return (p.modal_fisik || 0) < 0;
      return true;
    }),
    [products, q, stockFilter]
  );

  const totalModal = useMemo(() => filtered.reduce((s, p) => s + (p.modal_fisik || 0), 0), [filtered]);

  const openAdd = () => { setForm(empty); setEditing(null); setOpen(true); };
  const openEdit = (p) => {
    setForm({ nama_produk: p.nama_produk, qty: p.qty, harga_modal: p.harga_modal, stock: p.stock, keterangan: p.keterangan || "" });
    setEditing(p.id);
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      nama_produk: form.nama_produk,
      qty: Number(form.qty) || 0,
      harga_modal: Number(form.harga_modal) || 0,
      stock: Number(form.stock) || 0,
      keterangan: form.keterangan,
    };
    try {
      if (editing) {
        await api.put(`/products/${editing}`, payload);
        toast.success("Produk diperbarui");
      } else {
        await api.post("/products", payload);
        toast.success("Produk ditambahkan");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error("Gagal menyimpan produk");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try {
      await api.delete(`/products/${deleteId}`);
      toast.success("Produk dihapus");
      setDeleteId(null);
      load();
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/products/template", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "template_stock.xlsx";
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
      const res = await api.post("/products/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setImportResult(res.data);
      toast.success(`Berhasil: ${res.data.created} baru, ${res.data.updated} diperbarui`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal import file");
    } finally {
      setImporting(false);
    }
  };

  const exportExcel = async () => {
    try {
      const res = await api.get("/export/inventory", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "stock_barang.xlsx";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal export");
    }
  };

  const modalPerQty = (Number(form.harga_modal) || 0) / (Number(form.qty) || 1);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Stock Barang</h1>
          <p className="text-sm text-slate-500 mt-1">{products.length} produk terdaftar</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openImport} data-testid="import-inventory-button">
            <Upload className="h-4 w-4 mr-2" /> Import Excel
          </Button>
          <Button variant="outline" onClick={exportExcel} data-testid="export-inventory-button">
            <Download className="h-4 w-4 mr-2" /> Export Excel
          </Button>
          <Button onClick={openAdd} data-testid="add-product-button">
            <Plus className="h-4 w-4 mr-2" /> Tambah Produk
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Cari nama produk..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="inventory-search-input"
            className="pl-9"
          />
        </div>
        <Select value={stockFilter} onValueChange={setStockFilter}>
          <SelectTrigger className="w-56" data-testid="stock-filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white">
            <SelectItem value="all">Semua Produk</SelectItem>
            <SelectItem value="empty">Stock Kosong (0)</SelectItem>
            <SelectItem value="negative">Stock Minus (&lt; 0)</SelectItem>
            <SelectItem value="modal_negative">Modal/Fisik Minus</SelectItem>
          </SelectContent>
        </Select>
        {stockFilter !== "all" && (
          <span className="text-sm text-slate-500" data-testid="filter-count">{filtered.length} produk cocok</span>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 sticky top-0">
              <tr className="text-slate-600 text-left">
                <th className="px-3 py-3 font-semibold w-10">No</th>
                <th className="px-3 py-3 font-semibold">Nama Produk</th>
                <th className="px-3 py-3 font-semibold text-right">QTY</th>
                <th className="px-3 py-3 font-semibold text-right">Harga Modal</th>
                <th className="px-3 py-3 font-semibold text-right">Modal/QTY</th>
                <th className="px-3 py-3 font-semibold text-right">Stock</th>
                <th className="px-3 py-3 font-semibold text-right">Modal/Fisik</th>
                <th className="px-3 py-3 font-semibold">Keterangan</th>
                <th className="px-3 py-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, i) => (
                <tr key={p.id} className="odd:bg-white even:bg-slate-50 border-t border-slate-100 hover:bg-green-50/40" data-testid="inventory-table-row">
                  <td className="px-3 py-2.5 text-slate-400 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-800">{p.nama_produk}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{num(p.qty)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{rupiah(p.harga_modal)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{rupiah(p.modal_per_qty)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className={p.stock <= 0 ? "text-red-600 font-semibold" : ""}>{num(p.stock)}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">{rupiah(p.modal_fisik)}</td>
                  <td className="px-3 py-2.5">
                    {p.keterangan ? (
                      <span className="inline-flex text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">{p.keterangan}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(p)} data-testid={`edit-product-${p.id}`}
                        className="p-1.5 rounded hover:bg-slate-200 text-slate-600 transition-colors">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteId(p.id)} data-testid={`delete-product-${p.id}`}
                        className="p-1.5 rounded hover:bg-red-100 text-red-600 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-16 text-center text-slate-400">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Belum ada produk. Klik "Tambah Produk".
                  </td>
                </tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-primary/5 border-t-2 border-primary/20 font-semibold text-slate-800">
                  <td colSpan={6} className="px-3 py-3 text-right">Total Modal</td>
                  <td className="px-3 py-3 text-right tabular-nums text-primary" data-testid="inventory-total-modal">{rupiah(totalModal)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="bg-white w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-heading">{editing ? "Edit Produk" : "Tambah Produk"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={save} className="space-y-4 mt-6">
            <div>
              <Label>Nama Produk</Label>
              <Input value={form.nama_produk} onChange={(e) => setForm({ ...form, nama_produk: e.target.value })}
                required data-testid="product-name-input" className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>QTY (per kemasan)</Label>
                <Input type="number" step="any" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })}
                  data-testid="product-qty-input" className="mt-1.5" />
              </div>
              <div>
                <Label>Harga Modal</Label>
                <Input type="number" step="any" value={form.harga_modal} onChange={(e) => setForm({ ...form, harga_modal: e.target.value })}
                  data-testid="product-harga-modal-input" className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label>Stock Fisik</Label>
              <Input type="number" step="any" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                data-testid="product-stock-input" className="mt-1.5" />
            </div>
            <div>
              <Label>Keterangan (opsional, mis. EXP 02/26)</Label>
              <Input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                data-testid="product-keterangan-input" className="mt-1.5" />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-slate-500">Modal/QTY</span><span className="tabular-nums font-medium">{rupiah(modalPerQty)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Modal/Fisik</span><span className="tabular-nums font-medium">{rupiah(modalPerQty * (Number(form.stock) || 0))}</span></div>
            </div>
            <SheetFooter>
              <Button type="submit" disabled={saving} data-testid="save-product-button" className="w-full">
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus produk?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} data-testid="confirm-delete-product" className="bg-red-600 hover:bg-red-700">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="bg-white max-w-lg" data-testid="import-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" /> Import Stock dari Excel
            </DialogTitle>
            <DialogDescription>
              Upload file Excel untuk menambah/memperbarui banyak produk sekaligus. Barang dengan nama sama akan diperbarui.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm">
              <p className="text-slate-600 mb-2">Kolom yang didukung: <span className="font-medium">Nama Produk, QTY, Harga Modal, Stock, Keterangan</span>.</p>
              <button onClick={downloadTemplate} data-testid="download-template-button"
                className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                <Download className="h-3.5 w-3.5" /> Unduh template contoh
              </button>
            </div>

            <label className="block border-2 border-dashed border-slate-300 rounded-md p-6 text-center cursor-pointer hover:border-primary transition-colors">
              <input
                type="file"
                accept=".xlsx,.xlsm"
                className="hidden"
                data-testid="import-file-input"
                onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }}
              />
              <Upload className="h-6 w-6 mx-auto text-slate-400 mb-2" />
              <div className="text-sm text-slate-600">
                {importFile ? <span className="font-medium text-slate-800">{importFile.name}</span> : "Klik untuk pilih file .xlsx"}
              </div>
            </label>

            {importResult && (
              <div className="text-sm bg-green-50 border border-green-200 rounded-md p-3" data-testid="import-result">
                <div className="text-green-800 font-medium">Import selesai:</div>
                <ul className="text-slate-600 mt-1 space-y-0.5">
                  <li>• {importResult.created} produk baru ditambahkan</li>
                  <li>• {importResult.updated} produk diperbarui</li>
                  <li>• {importResult.skipped} baris dilewati (kosong)</li>
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
            <Button onClick={handleImport} disabled={importing || !importFile} data-testid="submit-import-button">
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Mengimport...</> : "Import Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
