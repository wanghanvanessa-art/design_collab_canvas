import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut, Gift, LayoutGrid, Sparkles, ArrowRight, Loader2,
  Mic2, Lightbulb, Users, BookOpen, Layers, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/meetings",    label: "会议转待办",   icon: Mic2,      accent: "text-violet-600", hover: "hover:text-violet-600 hover:bg-violet-50" },
  { href: "/ideas",       label: "想法落地页",   icon: Lightbulb, accent: "text-amber-600",  hover: "hover:text-amber-600 hover:bg-amber-50" },
  { href: "/interviews",  label: "用户访谈",     icon: Users,     accent: "text-emerald-600",hover: "hover:text-emerald-600 hover:bg-emerald-50" },
  { href: "/knowledge",   label: "设计知识库",   icon: BookOpen,  accent: "text-blue-600",   hover: "hover:text-blue-600 hover:bg-blue-50" },
  { href: "/inspiration", label: "灵感碰撞墙",   icon: Layers,    accent: "text-pink-600",   hover: "hover:text-pink-600 hover:bg-pink-50" },
  { href: "/reviews",     label: "方案评审",     icon: Search,    accent: "text-indigo-600", hover: "hover:text-indigo-600 hover:bg-indigo-50" },
];

const QUICK_SUGGESTIONS = [
  { label: "上传会议录音", href: "/meetings",    icon: "🎙️" },
  { label: "发布新想法",   href: "/ideas",       icon: "💡" },
  { label: "添加访谈记录", href: "/interviews",  icon: "👥" },
  { label: "查找设计规范", href: "/knowledge",   icon: "📚" },
  { label: "灵感碰撞墙",   href: "/inspiration", icon: "✨" },
  { label: "发起设计评审", href: "/reviews",     icon: "🔍" },
];

function AISearchBar() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
        setAiResult(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setAiResult(null);
    try {
      const q = query.toLowerCase();
      if (q.includes("会议") || q.includes("录音") || q.includes("待办")) {
        setAiResult("🎙️ 建议前往「会议转待办」，上传录音即可自动生成待办清单。");
      } else if (q.includes("想法") || q.includes("创意") || q.includes("方案")) {
        setAiResult("💡 建议前往「想法落地页」，发布你的创意并与团队实时讨论。");
      } else if (q.includes("访谈") || q.includes("用户") || q.includes("痛点")) {
        setAiResult("👥 建议前往「用户访谈」，记录访谈内容并自动分析用户痛点。");
      } else if (q.includes("知识") || q.includes("规范") || q.includes("文档")) {
        setAiResult("📚 建议前往「设计知识库」，搜索或沉淀设计规范与调研成果。");
      } else if (q.includes("灵感") || q.includes("情绪板") || q.includes("竞品")) {
        setAiResult("✨ 建议前往「灵感碰撞墙」，拖拽素材并获取 AI 风格标签推荐。");
      } else if (q.includes("评审") || q.includes("设计稿") || q.includes("检查")) {
        setAiResult("🔍 建议前往「方案智能评审」，上传设计稿获取多维度 AI 评分。");
      } else {
        setAiResult(`🤖 已搜索「${query}」，暂未找到精确匹配，试试点击下方快捷入口？`);
      }
    } finally {
      setLoading(false);
    }
  };

  const filtered = query
    ? QUICK_SUGGESTIONS.filter(s => s.label.includes(query))
    : QUICK_SUGGESTIONS;

  return (
    <div ref={containerRef} className="relative w-[260px] shrink-0">
      <form onSubmit={handleSearch}>
        <div className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all duration-200",
          focused
            ? "border-violet-300 bg-white shadow-[0_0_0_3px_rgba(124,58,237,0.08)]"
            : "border-gray-200 bg-gray-50 hover:border-gray-300"
        )}>
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin shrink-0" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="AI 搜索..."
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none min-w-0"
          />
          {query && (
            <button
              type="submit"
              className="shrink-0 w-5 h-5 rounded-md bg-violet-500 flex items-center justify-center hover:bg-violet-600 transition-colors"
            >
              <ArrowRight className="w-3 h-3 text-white" />
            </button>
          )}
        </div>
      </form>

      {focused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-gray-100 shadow-xl shadow-gray-200/60 z-50 overflow-hidden">
          {aiResult && (
            <div className="px-4 py-3 bg-violet-50 border-b border-violet-100">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                <p className="text-sm text-violet-700 leading-relaxed">{aiResult}</p>
              </div>
            </div>
          )}
          <div className="p-2">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1.5">
              {query ? "匹配功能" : "快速跳转"}
            </p>
            {filtered.map(s => (
              <button
                key={s.href}
                onClick={() => { navigate(s.href); setFocused(false); setQuery(""); setAiResult(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-base">{s.icon}</span>
                <span className="text-sm text-gray-700 font-medium">{s.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TopNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => { window.location.href = "/"; },
  });

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-xl border-b border-gray-100">
      <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <LayoutGrid className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-base text-foreground tracking-tight hidden md:block">Design Canvas</span>
        </Link>

        {/* Six main nav items */}
        <nav className="hidden lg:flex items-center gap-0.5 flex-1">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-150",
                    active
                      ? cn("bg-gray-100", item.accent)
                      : cn("text-gray-500", item.hover)
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              </Link>
            );
          })}
        </nav>

        {/* Right side: AI search + Blindbox + Avatar */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {/* AI Search Bar */}
          <AISearchBar />

          {/* Blindbox */}
          <Link href="/blindbox">
            <Button variant="ghost" size="sm" className="rounded-xl gap-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 px-3">
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">盲盒</span>
            </Button>
          </Link>

          {/* Auth */}
          {isAuthenticated ? (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-gray-50 transition-colors">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-semibold">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium text-foreground max-w-[80px] truncate">
                    {user?.name || "用户"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl w-40">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive cursor-pointer rounded-lg"
                  onClick={() => logoutMutation.mutate()}
                >
                  <LogOut className="w-4 h-4 mr-2" />退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <a href={getLoginUrl()}>
              <Button size="sm" className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
                登录
              </Button>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
