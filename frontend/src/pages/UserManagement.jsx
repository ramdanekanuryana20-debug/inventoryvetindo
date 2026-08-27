import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { UserPlus, Trash2, ShieldCheck, Eye } from "lucide-react";
import { toast } from "sonner";

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "" });

  const load = () => api.get("/users").then((res) => setUsers(res.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.email || form.password.length < 6) { toast.error("Email wajib & password minimal 6 karakter"); return; }
    try {
      await api.post("/users", form);
      toast.success("Akun viewer ditambahkan");
      setOpen(false);
      setForm({ email: "", name: "", password: "" });
      load();
    } catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Gagal menambah user"); }
  };

  const del = async (id) => {
    try { await api.delete(`/users/${id}`); toast.success("User dihapus"); load(); }
    catch (err) { toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Gagal menghapus"); }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Manajemen User</h1>
          <p className="text-sm text-slate-500 mt-1">Tambah/hapus akun Viewer (hanya bisa melihat, tidak bisa mengubah data).</p>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="add-user-button"><UserPlus className="h-4 w-4 mr-2" /> Tambah Viewer</Button>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600 text-left">
            <tr>
              <th className="px-3 py-3 font-semibold">Email</th>
              <th className="px-3 py-3 font-semibold">Nama</th>
              <th className="px-3 py-3 font-semibold">Role</th>
              <th className="px-3 py-3 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="odd:bg-white even:bg-slate-50 border-t border-slate-100" data-testid="user-row">
                <td className="px-3 py-2.5 font-medium text-slate-800">{u.email}</td>
                <td className="px-3 py-2.5 text-slate-600">{u.name}</td>
                <td className="px-3 py-2.5">
                  {u.role === "admin"
                    ? <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"><ShieldCheck className="h-3 w-3" /> Admin</span>
                    : <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"><Eye className="h-3 w-3" /> Viewer</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  {u.role !== "admin" && (
                    <button onClick={() => del(u.id)} data-testid={`delete-user-${u.id}`} className="p-1.5 rounded hover:bg-red-100 text-red-600"><Trash2 className="h-4 w-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-white max-w-sm" data-testid="add-user-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Tambah Akun Viewer</DialogTitle>
            <DialogDescription>Viewer hanya bisa melihat semua halaman & laporan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email-input" className="mt-1.5" /></div>
            <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="user-name-input" className="mt-1.5" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} data-testid="user-password-input" className="mt-1.5" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={create} data-testid="submit-user">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
