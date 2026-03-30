import { useState } from "react";
import { Mail, Lock, User, Eye, EyeOff, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoginModalProps {
  open: boolean;
  onClose?: () => void;
}

type Tab = "login" | "register";

export default function LoginModal({ open, onClose }: LoginModalProps) {
  const [tab, setTab] = useState<Tab>("login");

  // login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // register extra fields
  const [name, setName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!open) return null;

  function resetFeedback() {
    setError("");
    setSuccess("");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/email-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "登录失败，请检查邮箱和密码");
        return;
      }
      window.location.reload();
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    if (regPassword !== regPassword2) {
      setError("两次密码输入不一致");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/email-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail.trim(), password: regPassword, name: name.trim() }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "注册失败");
        return;
      }
      window.location.reload();
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="relative w-full max-w-[400px] mx-4 bg-white rounded-[28px] shadow-2xl overflow-hidden">

        {/* Top gradient strip */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #7C3AED, #4F46E5)" }} />

        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}

        <div className="px-8 pt-8 pb-7">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
            >
              <span className="text-white text-xl font-bold">D</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 font-display">设计协作画布</h2>
            <p className="text-sm text-gray-400 mt-1">内部设计团队协作平台</p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-5">
            {(["login", "register"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); resetFeedback(); }}
                className={cn(
                  "flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all",
                  tab === t
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                {t === "login" ? "登 录" : "注 册"}
              </button>
            ))}
          </div>

          {/* ── Login form ── */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">邮箱</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com" autoComplete="email" required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input
                    type={showPwd ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="请输入密码" autoComplete="current-password" required
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">⚠ {error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />登录中...</> : "登 录"}
              </button>
              <p className="text-center text-xs text-gray-400">
                没有账号？
                <button type="button" onClick={() => { setTab("register"); resetFeedback(); }}
                  className="text-violet-600 font-semibold hover:underline ml-1">
                  立即注册
                </button>
              </p>
            </form>
          )}

          {/* ── Register form ── */}
          {tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">姓名</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="请输入真实姓名" required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">邮箱</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input
                    type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                    placeholder="your@email.com" autoComplete="email" required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">密码（至少 6 位）</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input
                    type={showPwd ? "text" : "password"} value={regPassword} onChange={e => setRegPassword(e.target.value)}
                    placeholder="设置登录密码" required
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition"
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">确认密码</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input
                    type={showPwd ? "text" : "password"} value={regPassword2} onChange={e => setRegPassword2(e.target.value)}
                    placeholder="再次输入密码" required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-transparent transition"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">⚠ {error}</p>}
              {success && <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">✓ {success}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />注册中...</> : "注 册"}
              </button>
              <p className="text-center text-xs text-gray-400">
                已有账号？
                <button type="button" onClick={() => { setTab("login"); resetFeedback(); }}
                  className="text-violet-600 font-semibold hover:underline ml-1">
                  直接登录
                </button>
              </p>
            </form>
          )}

          <p className="text-center text-xs text-gray-300 mt-4">
            仅限内部设计团队使用
          </p>
        </div>
      </div>
    </div>
  );
}