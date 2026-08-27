import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { api, formatApiErrorDetail } from "@/lib/api";
import { LayoutDashboard, Package, ShoppingCart, LogOut, Stethoscope, Receipt, Wallet, KeyRound, History, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/inventory", label: "Stock Barang", icon: Package, testid: "nav-inventory" },
  { to: "/sales", label: "Penjualan", icon: ShoppingCart, testid: "nav-sales" },
  { to: "/supplier-bills", label: "Tagihan Supplier", icon: Receipt, testid: "nav-supplier-bills" },
  { to: "/saldo-online", label: "Saldo Online", icon: Wallet, testid: "nav-saldo-online" },
  { to: "/riwayat", label: "Riwayat Perubahan", icon: History, testid: "nav-riwayat" },
  { to: "/users", label: "Manajemen User", icon: Users, testid: "nav-users", adminOnly: true },
];

export default function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [pwOpen, setPwOpen] = useState(false);
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const changePassword = async () => {
    if (form.new_password.length < 6) { toast.error("Password baru minimal 6 karakter"); return; }
    if (form.new_password !== form.confirm) { toast.error("Konfirmasi password tidak cocok"); return; }
    setSaving(true);
    try {
      await api.post("/auth/change-password", { current_password: form.current_password, new_password: form.new_password });
      toast.success("Password berhasil diubah");
      setPwOpen(false);
      setForm({ current_password: "", new_password: "", confirm: "" });
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Gagal mengubah password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <aside className="w-64 shrink-0 bg-primary text-primary-foreground flex flex-col fixed h-full z-20">
        <div className="px-5 py-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
            <img src="https://customer-assets-lxgj4vgw.emergentagent.net/job_inventory-pro-1095/artifacts/bwldxhir_logo%20vetindorev.jpg" alt="Vetindo" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="font-heading font-extrabold tracking-tight text-lg leading-none">Vetindo</div>
            <div className="text-[11px] text-white/60 mt-0.5">Inventory & Sales</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.filter((l) => !l.adminOnly || isAdmin).map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              data-testid={l.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive ? "bg-white text-primary" : "text-white/75 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 mb-1">
            <div className="text-xs text-white/50">Masuk sebagai</div>
            <div className="text-sm font-medium truncate" data-testid="current-user-email">{user?.email}</div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setPwOpen(true)}
            data-testid="open-change-password"
            className="w-full justify-start text-white/80 hover:bg-white/10 hover:text-white"
          >
            <KeyRound className="h-4 w-4 mr-2" /> Ganti Password
          </Button>
          <Button
            variant="ghost"
            onClick={handleLogout}
            data-testid="logout-button"
            className="w-full justify-start text-white/80 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>
      <main className="flex-1 ml-64 min-h-screen">{children}</main>

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="bg-white max-w-sm" data-testid="change-password-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Ganti Password
            </DialogTitle>
            <DialogDescription>Untuk keamanan, ganti password default sebelum aplikasi dipakai.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Password Saat Ini</Label>
              <Input type="password" value={form.current_password} onChange={(e) => setForm({ ...form, current_password: e.target.value })}
                data-testid="current-password-input" className="mt-1.5" />
            </div>
            <div>
              <Label>Password Baru</Label>
              <Input type="password" value={form.new_password} onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                data-testid="new-password-input" className="mt-1.5" />
            </div>
            <div>
              <Label>Konfirmasi Password Baru</Label>
              <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                data-testid="confirm-password-input" className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)}>Batal</Button>
            <Button onClick={changePassword} disabled={saving} data-testid="submit-change-password">
              {saving ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
