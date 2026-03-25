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
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Design tokens for each feature ─────────────────────────────────────────
const FEATURES = [
  {
    id: "meetings", href: "/meetings", icon: Mic2,
    label: "会议转待办", tag: "AI 驱动",
    desc: "语音录音自动转文字，AI 提取核心思路，一键生成按优先级拆解的待办清单",
    gradient: "from-violet-500 to-indigo-600",
    softBg: "bg-violet-50", iconBg: "bg-violet-100", iconColor: "text-violet-600",
    tagBg: "bg-violet-100 text-violet-700", blobColor: "bg-violet-400",
  },
  {
    id: "ideas", href: "/ideas", icon: Lightbulb,
    label: "想法落地页", tag: "协作互动",
    desc: "开放式想法发布与实时评论互动，支持导出 PDF / 博客 / Word 等多格式交付物",
    gradient: "from-amber-400 to-orange-500",
    softBg: "bg-amber-50", iconBg: "bg-amber-100", iconColor: "text-amber-600",
    tagBg: "bg-amber-100 text-amber-700", blobColor: "bg-amber-400",
  },
  {
    id: "interviews", href: "/interviews", icon: Users,
    label: "用户访谈", tag: "用户研究",
    desc: "全流程管理访谈记录，AI 自动分析人群标签、提炼痛点并生成设计解决方案",
    gradient: "from-emerald-400 to-teal-500",
    softBg: "bg-emerald-50", iconBg: "bg-emerald-100", iconColor: "text-emerald-600",
    tagBg: "bg-emerald-100 text-emerald-700", blobColor: "bg-emerald-400",
  },
  {
    id: "knowledge", href: "/knowledge", icon: BookOpen,
    label: "设计知识库", tag: "知识沉淀",
    desc: "调研成果沉淀与版本管理，支持标签检索、版本对比、多人协作编辑",
    gradient: "from-blue-400 to-cyan-500",
    softBg: "bg-blue-50", iconBg: "bg-blue-100", iconColor: "text-blue-600",
    tagBg: "bg-blue-100 text-blue-700", blobColor: "bg-blue-400",
  },
  {
    id: "inspiration", href: "/inspiration", icon: Sparkles,
    label: "灵感碰撞墙", tag: "创意画布",
    desc: "画布式拖拽零散灵感、竞品截图、情绪板素材，AI 自动生成风格标签和相似设计推荐",
    gradient: "from-pink-500 to-rose-500",
    softBg: "bg-pink-50", iconBg: "bg-pink-100", iconColor: "text-pink-600",
    tagBg: "bg-pink-100 text-pink-700", blobColor: "bg-pink-400",
  },
  {
    id: "reviews", href: "/reviews", icon: Search,
    label: "方案智能评审", tag: "智能评审",
    desc: "上传设计稿后，AI 从 B 端业务逻辑、交互一致性、Accessibility 等维度自动打分",
    gradient: "from-indigo-500 to-purple-600",
    softBg: "bg-indigo-50", iconBg: "bg-indigo-100", iconColor: "text-indigo-600",
    tagBg: "bg-indigo-100 text-indigo-700", blobColor: "bg-indigo-400",
  },
];

const QUOTES = [
  "好的设计是尽可能少的设计。— Dieter Rams",
  "设计不只是外观，更是运作的方式。— Steve Jobs",
  "简单是终极的复杂。— Leonardo da Vinci",
  "用户不会阅读，他们只会扫描。— Jakob Nielsen",
  "设计是解决问题，艺术是提出问题。",
];

// ─── Bento Card: Hero Feature (tall, accent gradient bg) ─────────────────────
function HeroFeatureCard({ f }: { f: typeof FEATURES[0] }) {
  const Icon = f.icon;
  return (
    <Link href={f.href} className="group block h-full">
      <div className={cn(
        "relative h-full min-h-[240px] rounded-[28px] overflow-hidden cursor-pointer",
        "transition-all duration-300 hover:shadow-2xl hover:-translate-y-1",
        f.softBg, "border border-white/80"
      )}>
        {/* Decorative blobs */}
        <div className={cn("absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-20 blur-3xl bg-gradient-to-br", f.gradient)} />
        <div className={cn("absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-10 blur-2xl bg-gradient-to-br", f.gradient)} />

        <div className="relative p-7 h-full flex flex-col">
          <div className="flex items-start justify-between mb-5">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm", f.iconBg)}>
              <Icon className={cn("w-6 h-6", f.iconColor)} />
            </div>
            <span className={cn("text-xs font-600 px-2.5 py-1 rounded-full", f.tagBg)}>{f.tag}</span>
          </div>

          <h3 className="font-display text-[22px] font-700 text-foreground mb-2.5 group-hover:opacity-80 transition-opacity">
            {f.label}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed flex-1">{f.desc}</p>

          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-black/5">
            <span className="text-sm font-600 text-foreground/80">进入功能</span>
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-br transition-transform group-hover:translate-x-1",
              f.gradient
            )}>
              <ArrowRight className="w-3 h-3 text-white" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Bento Card: Compact Feature ─────────────────────────────────────────────
function CompactFeatureCard({ f }: { f: typeof FEATURES[0] }) {
  const Icon = f.icon;
  return (
    <Link href={f.href} className="group block h-full">
      <div className={cn(
        "relative h-full min-h-[130px] rounded-[24px] overflow-hidden cursor-pointer",
        "transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5",
        f.softBg, "border border-white/80"
      )}>
        <div className={cn("absolute -top-8 -right-8 w-28 h-28 rounded-full opacity-15 blur-2xl bg-gradient-to-br", f.gradient)} />

        <div className="relative p-5 h-full flex flex-col">
          <div className="flex items-start justify-between mb-3">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", f.iconBg)}>
              <Icon className={cn("w-4.5 h-4.5", f.iconColor)} />
            </div>
            <span className={cn("text-[10px] font-600 px-2 py-0.5 rounded-full", f.tagBg)}>{f.tag}</span>
          </div>
          <h3 className="font-display text-[15px] font-700 text-foreground mb-1.5 group-hover:opacity-80 transition-opacity">
            {f.label}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">{f.desc}</p>
          <div className="flex items-center gap-1 mt-3">
            <span className="text-xs font-600 text-foreground/60">进入</span>
            <ArrowRight className="w-3 h-3 text-foreground/40 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────
function StatsCard({ stats }: { stats?: { total: number; pending: number; done: number } }) {
  const pct = stats?.total ? Math.round((stats.done / stats.total) * 100) : 0;
  return (
    <div className="h-full min-h-[130px] rounded-[24px] bg-gradient-to-br from-violet-600 to-indigo-700 p-5 text-white border border-violet-500/20 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-600 text-violet-200 uppercase tracking-wider">本周进度</span>
        <TrendingUp className="w-4 h-4 text-violet-300" />
      </div>
      <div>
        <div className="flex items-end gap-1.5 mb-2">
          <span className="font-display text-4xl font-700 leading-none">{stats?.done ?? 0}</span>
          <span className="text-violet-300 text-sm mb-0.5">/ {stats?.total ?? 0}</span>
        </div>
        <div className="w-full bg-violet-500/40 rounded-full h-1.5 mb-1.5">
          <div className="bg-white rounded-full h-1.5 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-violet-200 text-xs">{stats?.pending ?? 0} 项待处理</p>
      </div>
    </div>
  );
}

// ─── Recent Todos Card ────────────────────────────────────────────────────────
function TodosCard({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { data: todos } = trpc.todos.list.useQuery(undefined, { enabled: isAuthenticated });
  const recent = (todos || []).filter(t => !t.completed).slice(0, 4);
  return (
    <div className="h-full min-h-[130px] rounded-[24px] bg-white border border-gray-100 p-5 flex flex-col shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-600 text-muted-foreground uppercase tracking-wider">待处理</span>
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      </div>
      {recent.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-1.5">
          <Clock className="w-5 h-5 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">暂无待办</p>
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          {recent.map(t => (
            <div key={t.id} className="flex items-center gap-2">
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", {
                "bg-red-400": t.priority === "high",
                "bg-amber-400": t.priority === "medium",
                "bg-emerald-400": t.priority === "low",
              })} />
              <span className="text-xs text-foreground truncate">{t.title}</span>
            </div>
          ))}
        </div>
      )}
      <Link href="/meetings">
        <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-50">
          <span className="text-xs font-600 text-violet-600">全部待办</span>
          <ArrowRight className="w-3 h-3 text-violet-600" />
        </div>
      </Link>
    </div>
  );
}

// ─── Blindbox Card ────────────────────────────────────────────────────────────
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
      className="h-full min-h-[130px] rounded-[24px] bg-gradient-to-br from-amber-400 to-orange-500 text-white cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 border border-amber-300/30 flex flex-col justify-between p-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-600 text-amber-100 uppercase tracking-wider">灵感盲盒</span>
        <Gift className="w-4 h-4 text-amber-100" />
      </div>
      {open && draw.data ? (
        <div className="flex-1 py-2">
          <p className="text-sm font-600 mb-1 line-clamp-1">{draw.data.title}</p>
          <p className="text-xs text-amber-100 line-clamp-3">{draw.data.content}</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-2">
          <div className="text-3xl mb-1.5 animate-bounce">🎁</div>
          <p className="text-sm font-600">点击开盒</p>
          <p className="text-[10px] text-amber-100 mt-0.5">随机设计灵感</p>
        </div>
      )}
      <Link href="/blindbox" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1 pt-2 border-t border-amber-300/30 mt-2">
          <span className="text-[10px] font-600 text-amber-100">更多盲盒</span>
          <ArrowRight className="w-3 h-3 text-amber-100" />
        </div>
      </Link>
    </div>
  );
}

// ─── Quote Card ───────────────────────────────────────────────────────────────
function QuoteCard() {
  const [idx] = useState(() => Math.floor(Math.random() * QUOTES.length));
  return (
    <div className="h-full min-h-[130px] rounded-[24px] bg-gray-950 p-5 text-white flex flex-col justify-between border border-gray-800">
      <Star className="w-4 h-4 text-amber-400" />
      <p className="text-sm font-medium leading-relaxed text-gray-200 flex-1 py-3">{QUOTES[idx]}</p>
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">设计语录</span>
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

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return "夜深了";
    if (h < 12) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  };

  return (
    <div className="min-h-screen bg-[#F5F5F3]">
      <TopNav />

      <main className="max-w-[1440px] mx-auto px-6 pt-6 pb-16">

        {/* ── Hero Row: Title + Feature Grid ── */}
        <div className="grid grid-cols-12 gap-4 mb-4">

          {/* Left: Hero Text (col 1-3) */}
          <div className="col-span-12 lg:col-span-3 flex flex-col justify-between py-2">
            <div>
              {isAuthenticated && (
                <p className="text-sm text-muted-foreground mb-3 font-medium">
                  {greeting()}，{user?.name?.split(" ")[0]} 👋
                </p>
              )}
              <h1 className="font-display font-800 text-foreground leading-[1.05] tracking-tight" style={{ fontSize: "clamp(2.5rem, 4vw, 3.5rem)" }}>
                设计<br />协作<br />
                <span className="bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
                  画布
                </span>
              </h1>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                为 B 端中台设计团队打造的全流程协作平台
              </p>
            </div>

            {/* Feature tags */}
            <div className="flex flex-wrap gap-1.5 mt-6">
              {["AI 驱动", "实时协作", "知识沉淀", "灵感激发"].map(tag => (
                <span key={tag} className="px-2.5 py-1 rounded-full text-[11px] font-600 bg-white border border-gray-200 text-muted-foreground shadow-sm">
                  {tag}
                </span>
              ))}
            </div>

            {!isAuthenticated && (
              <a href={getLoginUrl()} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-600 transition-colors">
                开始使用 <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </div>

          {/* Right: Bento Grid (col 4-12) */}
          <div className="col-span-12 lg:col-span-9">
            {/* Row 1: 3 columns */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              {/* Large hero card: meetings (spans 1 col but tall) */}
              <div className="col-span-1 row-span-2">
                <HeroFeatureCard f={FEATURES[0]} />
              </div>
              {/* Compact: ideas */}
              <div className="col-span-1">
                <CompactFeatureCard f={FEATURES[1]} />
              </div>
              {/* Compact: interviews */}
              <div className="col-span-1">
                <CompactFeatureCard f={FEATURES[2]} />
              </div>
              {/* Stats */}
              <div className="col-span-1">
                <StatsCard stats={stats} />
              </div>
              {/* Todos */}
              <div className="col-span-1">
                <TodosCard isAuthenticated={isAuthenticated} />
              </div>
            </div>

            {/* Row 2: 4 columns */}
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-1">
                <CompactFeatureCard f={FEATURES[3]} />
              </div>
              {/* Large: inspiration (spans 2 cols) */}
              <div className="col-span-2">
                <HeroFeatureCard f={FEATURES[4]} />
              </div>
              <div className="col-span-1">
                <CompactFeatureCard f={FEATURES[5]} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Row: Blindbox + Quote ── */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3">
            <BlindboxCard />
          </div>
          <div className="col-span-12 lg:col-span-3">
            <QuoteCard />
          </div>
          {/* Spacer / CTA */}
          <div className="col-span-12 lg:col-span-6 rounded-[24px] bg-white border border-gray-100 p-5 flex items-center justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Zap className="w-4 h-4 text-violet-500" />
                <span className="text-xs font-600 text-violet-600 uppercase tracking-wider">快速开始</span>
              </div>
              <p className="font-display text-lg font-700 text-foreground">从一次会议开始，让 AI 帮你整理思路</p>
              <p className="text-sm text-muted-foreground mt-1">上传会议录音，30 秒内生成结构化待办清单</p>
            </div>
            <Link href="/meetings">
              <div className="shrink-0 ml-6 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-600 flex items-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer">
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
