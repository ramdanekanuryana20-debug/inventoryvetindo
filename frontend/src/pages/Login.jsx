import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Berhasil masuk");
      navigate("/");
    } catch (err) {
      const msg = formatApiErrorDetail(err.response?.data?.detail) || err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-11 w-11 rounded-lg bg-primary flex items-center justify-center">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-heading font-extrabold text-xl tracking-tight text-slate-900">VetStock</div>
              <div className="text-xs text-slate-500">Sistem Stock & Penjualan</div>
            </div>
          </div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900">Masuk</h1>
          <p className="text-sm text-slate-500 mt-1 mb-8">Kelola stock barang dan penjualan dengan mudah.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-slate-700">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
                className="mt-1.5 h-11"
                placeholder="admin@email.com"
              />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
                className="mt-1.5 h-11"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2" data-testid="login-error">
                {error}
              </div>
            )}
            <Button type="submit" disabled={loading} data-testid="login-submit-button" className="w-full h-11 text-base">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Masuk
            </Button>
          </form>
        </div>
      </div>
      <div className="hidden lg:block relative">
        <img
          src="https://images.pexels.com/photos/9628834/pexels-photo-9628834.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
          alt="Pharmacy shelf"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-primary/40" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="font-heading text-2xl font-bold tracking-tight leading-snug">
            Permudah pekerjaan admin Anda.
          </p>
          <p className="text-white/80 text-sm mt-2">Pantau modal, stock fisik, dan penjualan dalam satu tempat.</p>
        </div>
      </div>
    </div>
  );
}
