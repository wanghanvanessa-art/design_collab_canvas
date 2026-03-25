import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import TopNav from "@/components/TopNav";
import PixelCat from "@/components/PixelCat";
import {
  Mic2, Lightbulb, Users, BookOpen, Sparkles, Search,
  ArrowRight, Gift, CheckCircle2, Clock, TrendingUp, Star,
  Zap, FileText, MessageSquare, Brain
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Feature definitions — white card + accent color accents ─────────────────
const FEATURES = [
  {
    id: "meetings", href: "/meetings", icon: Mic2,
    label: "会议转待办", tag: "AI 驱动",
    desc: "语音录音自动转文字，AI 提取核心思路，一键生成按优先级拆解的待办清单",
    accent: "#7C3AED",          // violet-700
    iconBg: "bg-violet-50",
    iconColor: "text-violet-600",
    tagBg: "bg-violet-50 text-violet-600",
    borderAccent: "border-violet-100",
    dot: "bg-violet-400",
  },
  {
    id: "ideas", href: "/ideas", icon: Lightbulb,
    label: "想法落地页", tag: "协作互动",
    desc: "开放式想法发布与实时评论互动，支持导出 PDF / 博客 / Word 等多格式交付物",
    accent: "#D97706",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    tagBg: "bg-amber-50 text-amber-600",
    borderAccent: "border-amber-100",
    dot: "bg-amber-400",
  },
  {
    id: "interviews", href: "/interviews", icon: Users,
    label: "用户访谈", tag: "用户研究",
    desc: "全流程管理访谈记录，AI 自动分析人群标签、提炼痛点并生成设计解决方案",
    accent: "#059669",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    tagBg: "bg-emerald-50 text-emerald-600",
    borderAccent: "border-emerald-100",
    dot: "bg-emerald-400",
  },
  {
    id: "knowledge", href: "/knowledge", icon: BookOpen,
    label: "设计知识库", tag: "知识沉淀",
    desc: "调研成果沉淀与版本管理，支持标签检索、版本对比、多人协作编辑",
    accent: "#2563EB",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    tagBg: "bg-blue-50 text-blue-600",
    borderAccent: "border-blue-100",
    dot: "bg-blue-400",
  },
  {
    id: "inspiration", href: "/inspiration", icon: Sparkles,
    label: "灵感碰撞墙", tag: "创意画布",
    desc: "画布式拖拽零散灵感、竞品截图、情绪板素材，AI 自动生成风格标签和相似设计推荐",
    accent: "#DB2777",
    iconBg: "bg-pink-50",
    iconColor: "text-pink-600",
    tagBg: "bg-pink-50 text-pink-600",
    borderAccent: "border-pink-100",
    dot: "bg-pink-400",
  },
  {
    id: "reviews", href: "/reviews", icon: Search,
    label: "方案智能评审", tag: "智能评审",
    desc: "上传设计稿后，AI 从 B 端业务逻辑、交互一致性、Accessibility 等维度自动打分",
    accent: "#4F46E5",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    tagBg: "bg-indigo-50 text-indigo-600",
    borderAccent: "border-indigo-100",
    dot: "bg-indigo-400",
  },
];

const QUOTES = [
  "好的设计是尽可能少的设计。— Dieter Rams",
  "设计不只是外观，更是运作的方式。— Steve Jobs",
  "简单是终极的复杂。— Leonardo da Vinci",
  "用户不会阅读，他们只会扫描。— Jakob Nielsen",
  "设计是解决问题，艺术是提出问题。",
];

// ─── Bento Card: Large Feature (tall, white bg + accent top bar) ─────────────
function LargeFeatureCard({ f }: { f: typeof FEATURES[0] }) {
  const Icon = f.icon;
  return (
    <Link href={f.href} className="group block h-full">
      <div className={cn(
        "relative h-full min-h-[200px] rounded-[24px] bg-white overflow-hidden cursor-pointer",
        "border border-gray-100 shadow-sm",
        "transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      )}>
        {/* Accent top strip */}
        <div className="h-1 w-full" style={{ background: f.accent }} />

        <div className="p-6 h-full flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center", f.iconBg)}>
              <Icon className={cn("w-5 h-5", f.iconColor)} />
            </div>
            <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full", f.tagBg)}>
              {f.tag}
            </span>
          </div>

          <h3 className="font-display text-[20px] font-bold text-gray-900 mb-2 group-hover:opacity-75 transition-opacity">
            {f.label}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed flex-1">{f.desc}</p>

          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-50">
            <span className="text-sm font-semibold" style={{ color: f.accent }}>进入功能</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" style={{ color: f.accent }} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Bento Card: Compact Feature ─────────────────────────────────────────────
function SmallFeatureCard({ f }: { f: typeof FEATURES[0] }) {
  const Icon = f.icon;
  return (
    <Link href={f.href} className="group block h-full">
      <div className={cn(
        "relative h-full min-h-[110px] rounded-[20px] bg-white overflow-hidden cursor-pointer",
        "border border-gray-100 shadow-sm",
        "transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
      )}>
        {/* Accent left strip */}
        <div className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full" style={{ background: f.accent }} />

        <div className="p-5 pl-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-2.5">
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", f.iconBg)}>
              <Icon className={cn("w-4 h-4", f.iconColor)} />
            </div>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", f.tagBg)}>
              {f.tag}
            </span>
          </div>
          <h3 className="font-display text-[14px] font-bold text-gray-900 mb-1 group-hover:opacity-75 transition-opacity">
            {f.label}
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 flex-1">{f.desc}</p>
          <div className="flex items-center gap-1 mt-2.5">
            <span className="text-xs font-semibold" style={{ color: f.accent }}>进入</span>
            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" style={{ color: f.accent }} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Stats Card (white + violet accent) ──────────────────────────────────────
function StatsCard({ stats }: { stats?: { total: number; pending: number; done: number } }) {
  const pct = stats?.total ? Math.round((stats.done / stats.total) * 100) : 0;
  return (
    <div className="h-full min-h-[110px] rounded-[20px] bg-white border border-gray-100 shadow-sm p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">本周进度</span>
        <TrendingUp className="w-4 h-4 text-violet-400" />
      </div>
      <div>
        <div className="flex items-end gap-1.5 mb-2">
          <span className="font-display text-4xl font-bold text-gray-900 leading-none">{stats?.done ?? 0}</span>
          <span className="text-gray-400 text-sm mb-0.5">/ {stats?.total ?? 0} 完成</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1.5">
          <div
            className="rounded-full h-1.5 transition-all duration-700"
            style={{ width: `${pct}%`, background: "linear-gradient(90deg, #7C3AED, #4F46E5)" }}
          />
        </div>
        <p className="text-gray-400 text-xs">{stats?.pending ?? 0} 项待处理</p>
      </div>
    </div>
  );
}

// ─── Recent Todos Card ────────────────────────────────────────────────────────
function TodosCard({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { data: todos } = trpc.todos.list.useQuery(undefined, { enabled: isAuthenticated });
  const recent = (todos || []).filter(t => !t.completed).slice(0, 4);
  const priorityColor: Record<string, string> = { high: "bg-red-400", medium: "bg-amber-400", low: "bg-emerald-400" };
  return (
    <div className="h-full min-h-[110px] rounded-[20px] bg-white border border-gray-100 shadow-sm p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">待处理</span>
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      </div>
      {recent.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5">
          <Clock className="w-5 h-5 text-gray-200" />
          <p className="text-xs text-gray-300">暂无待办</p>
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          {recent.map(t => (
            <div key={t.id} className="flex items-center gap-2">
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityColor[t.priority || "low"])} />
              <span className="text-xs text-gray-600 truncate">{t.title}</span>
            </div>
          ))}
        </div>
      )}
      <Link href="/meetings">
        <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-gray-50">
          <span className="text-xs font-semibold text-violet-600">全部待办</span>
          <ArrowRight className="w-3 h-3 text-violet-600" />
        </div>
      </Link>
    </div>
  );
}

// ─── Blindbox Card (white + amber accent) ────────────────────────────────────
function BlindboxCard() {
  const [open, setOpen] = useState(false);
  const draw = trpc.blindbox.draw.useMutation();

  const handleOpen = () => {
    if (!open) {
      draw.mutate(undefined, { onSuccess: () => setOpen(true) });
    } else {
      setOpen(false);
    }
  };

  return (
    <div
      onClick={handleOpen}
      className="h-full min-h-[110px] rounded-[20px] bg-white border border-amber-100 shadow-sm p-4 cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-50 flex items-center justify-center">
            <Gift className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">灵感盲盒</span>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      </div>
      {open && draw.data ? (
        <div className="flex-1 py-2">
          <p className="text-sm font-semibold text-gray-800 mb-1 line-clamp-1">{draw.data.title}</p>
          <p className="text-xs text-gray-500 line-clamp-3">{draw.data.content}</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-1">
          <div className="text-2xl mb-1 animate-bounce">🎁</div>
          <p className="text-sm font-semibold text-gray-700">点击开盒</p>
          <p className="text-[10px] text-gray-400 mt-0.5">随机设计灵感</p>
        </div>
      )}
      <Link href="/blindbox" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 pt-2.5 border-t border-amber-50 mt-2">
          <span className="text-[10px] font-semibold text-amber-600">更多盲盒</span>
          <ArrowRight className="w-3 h-3 text-amber-600" />
        </div>
      </Link>
    </div>
  );
}

// ─── Quote Card (near-black + white text) ─────────────────────────────────────
function QuoteCard() {
  const [idx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  return (
    <div className="h-full min-h-[110px] rounded-[20px] bg-gray-950 border border-gray-800 p-4 flex flex-col justify-between">
      <Star className="w-3.5 h-3.5 text-amber-400" />
      <p className="text-sm font-medium leading-relaxed text-gray-300 flex-1 py-3">{QUOTES[idx]}</p>
      <span className="text-[10px] text-gray-600 uppercase tracking-wider">设计语录</span>
    </div>
  );
}

// ─── Left Hero Panel ──────────────────────────────────────────────────────────
function HeroPanel({ user, isAuthenticated, stats }: {
  user: { name?: string | null } | null;
  isAuthenticated: boolean;
  stats?: { total: number; pending: number; done: number };
}) {
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return "夜深了";
    if (h < 12) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  };

  const quickStats = [
    { icon: CheckCircle2, label: "已完成待办", value: stats?.done ?? 0, color: "text-violet-600", bg: "bg-violet-50" },
    { icon: FileText, label: "本周想法", value: 0, color: "text-amber-600", bg: "bg-amber-50" },
    { icon: MessageSquare, label: "访谈记录", value: 0, color: "text-emerald-600", bg: "bg-emerald-50" },
    { icon: Brain, label: "知识条目", value: 0, color: "text-blue-600", bg: "bg-blue-50" },
  ];

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Title block */}
      <div className="rounded-[24px] bg-white border border-gray-100 shadow-sm p-6 flex-1">
        {isAuthenticated && (
          <p className="text-sm text-gray-400 mb-3 font-medium">
            {greeting()}，{user?.name?.split(" ")[0]} 👋
          </p>
        )}
        <h1
          className="font-display font-extrabold text-gray-900 leading-[1.05] tracking-tight"
          style={{ fontSize: "clamp(2.2rem, 3.5vw, 3.2rem)" }}
        >
          设计<br />协作<br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
          >
            画布
          </span>
        </h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          为 B 端中台设计团队打造<br />从调研到交付的全流程协作平台
        </p>

        {!isAuthenticated && (
          <a
            href={getLoginUrl()}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-sm font-semibold transition-all hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          >
            开始使用 <ArrowRight className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Quick stats 2×2 grid */}
      <div className="grid grid-cols-2 gap-3">
        {quickStats.map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-[16px] bg-white border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
              <div className={cn("w-7 h-7 rounded-xl flex items-center justify-center", s.bg)}>
                <Icon className={cn("w-3.5 h-3.5", s.color)} />
              </div>
              <div>
                <p className="font-display text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature tags */}
      <div className="flex flex-wrap gap-1.5">
        {["AI 驱动", "实时协作", "知识沉淀", "灵感激发", "智能评审"].map(tag => (
          <span
            key={tag}
            className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white border border-gray-200 text-gray-500 shadow-sm"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Home ────────────────────────────────────────────────────────────────
export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: stats } = trpc.todos.stats.useQuery(undefined, { enabled: isAuthenticated });
  const [activityCount, setActivityCount] = useState(0);

  useEffect(() => {
    const h = () => setActivityCount(c => c + 1);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F3]">
      <TopNav />

      <main className="max-w-[1440px] mx-auto px-6 pt-4 pb-6">

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-12 gap-4 mb-4">

          {/* Left Hero Panel (col 1-3) */}
          <div className="col-span-12 lg:col-span-3">
            <HeroPanel user={user} isAuthenticated={isAuthenticated} stats={stats} />
          </div>

          {/* Right Bento Grid (col 4-12) */}
          <div className="col-span-12 lg:col-span-9 flex flex-col gap-4">

            {/* Row 1: Large meetings + 2 small + stats + todos */}
            <div className="grid grid-cols-3 gap-4">
              {/* Large: meetings (spans full height of row) */}
              <div className="col-span-1 row-span-2">
                <LargeFeatureCard f={FEATURES[0]} />
              </div>
              <div className="col-span-1">
                <SmallFeatureCard f={FEATURES[1]} />
              </div>
              <div className="col-span-1">
                <SmallFeatureCard f={FEATURES[2]} />
              </div>
              <div className="col-span-1">
                <StatsCard stats={stats} />
              </div>
              <div className="col-span-1">
                <TodosCard isAuthenticated={isAuthenticated} />
              </div>
            </div>

            {/* Row 2: 4 columns */}
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <SmallFeatureCard f={FEATURES[3]} />
              </div>
              <div className="col-span-2">
                <LargeFeatureCard f={FEATURES[4]} />
              </div>
              <div className="col-span-1">
                <SmallFeatureCard f={FEATURES[5]} />
              </div>
            </div>

          </div>
        </div>

        {/* ── Bottom Row ── */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3">
            <BlindboxCard />
          </div>
          <div className="col-span-12 lg:col-span-3">
            <QuoteCard />
          </div>
          {/* CTA */}
          <div className="col-span-12 lg:col-span-6 rounded-[20px] bg-white border border-gray-100 shadow-sm p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-violet-600" />
                </div>
                <span className="text-xs font-semibold text-violet-600 uppercase tracking-wider">快速开始</span>
              </div>
              <p className="font-display text-base font-bold text-gray-900">从一次会议开始，让 AI 帮你整理思路</p>
              <p className="text-sm text-gray-400 mt-0.5">上传会议录音，30 秒内生成结构化待办清单</p>
            </div>
            <Link href="/meetings">
              <div
                className="shrink-0 ml-6 px-5 py-2.5 rounded-2xl text-white text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-90 hover:-translate-y-0.5 cursor-pointer shadow-sm"
                style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
              >
                立即体验 <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>

      </main>

      <PixelCat activityLevel={activityCount} />
    </div>
  );
}
