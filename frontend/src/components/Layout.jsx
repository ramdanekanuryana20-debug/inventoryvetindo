import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LayoutDashboard, Package, ShoppingCart, LogOut, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/inventory", label: "Stock Barang", icon: Package, testid: "nav-inventory" },
  { to: "/sales", label: "Penjualan", icon: ShoppingCart, testid: "nav-sales" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <aside className="w-64 shrink-0 bg-primary text-primary-foreground flex flex-col fixed h-full z-20">
        <div className="px-5 py-6 border-b border-white/10 flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-white/15 flex items-center justify-center">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <div className="font-heading font-extrabold tracking-tight text-lg leading-none">VetStock</div>
            <div className="text-[11px] text-white/60 mt-0.5">Inventory & Sales</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {links.map((l) => (
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
            onClick={handleLogout}
            data-testid="logout-button"
            className="w-full justify-start text-white/80 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>
      <main className="flex-1 ml-64 min-h-screen">{children}</main>
    </div>
  );
}
