import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import TopNav from "@/components/TopNav";
import PixelCat from "@/components/PixelCat";
import {
  Mic2, Lightbulb, Users, BookOpen, Sparkles, Search,
  ArrowRight, Gift, CheckCircle2, Clock, TrendingUp,
  ChevronDown, ChevronUp,
  CheckCheck, PenLine, ShieldCheck, UserPlus, Library, Layers
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Feature definitions ─────────────────────────────────────────────────────
const FEATURES = [
  {
    id: "meetings", href: "/meetings", icon: Mic2,
    label: "会议转待办", tag: "AI 驱动",
    desc: "语音录音自动转文字，AI 提取核心思路，一键生成按优先级拆解的待办清单",
    accent: "#7C3AED",
    iconBg: "bg-violet-50", iconColor: "text-violet-600",
    tagBg: "bg-violet-50 text-violet-600",
    accentCls: "bg-violet-500",
    linkColor: "text-violet-600",
  },
  {
    id: "ideas", href: "/ideas", icon: Lightbulb,
    label: "想法落地页", tag: "协作互动",
    desc: "开放式想法发布与实时评论互动，支持导出 PDF / 博客 / Word 等多格式交付物",
    accent: "#D97706",
    iconBg: "bg-amber-50", iconColor: "text-amber-600",
    tagBg: "bg-amber-50 text-amber-600",
    accentCls: "bg-amber-500",
    linkColor: "text-amber-600",
  },
  {
    id: "interviews", href: "/interviews", icon: Users,
    label: "用户访谈", tag: "用户研究",
    desc: "全流程管理访谈记录，AI 自动分析人群标签、提炼痛点并生成设计解决方案",
    accent: "#059669",
    iconBg: "bg-emerald-50", iconColor: "text-emerald-600",
    tagBg: "bg-emerald-50 text-emerald-600",
    accentCls: "bg-emerald-500",
    linkColor: "text-emerald-600",
  },
  {
    id: "knowledge", href: "/knowledge", icon: BookOpen,
    label: "设计知识库", tag: "知识沉淀",
    desc: "调研成果沉淀与版本管理，支持标签检索、版本对比、多人协作编辑",
    accent: "#2563EB",
    iconBg: "bg-blue-50", iconColor: "text-blue-600",
    tagBg: "bg-blue-50 text-blue-600",
    accentCls: "bg-blue-500",
    linkColor: "text-blue-600",
  },
  {
    id: "inspiration", href: "/inspiration", icon: Sparkles,
    label: "灵感碰撞墙", tag: "创意画布",
    desc: "画布式拖拽零散灵感、竞品截图、情绪板素材，AI 自动生成风格标签和相似设计推荐",
    accent: "#DB2777",
    iconBg: "bg-pink-50", iconColor: "text-pink-600",
    tagBg: "bg-pink-50 text-pink-600",
    accentCls: "bg-pink-500",
    linkColor: "text-pink-600",
  },
  {
    id: "reviews", href: "/reviews", icon: Search,
    label: "方案智能评审", tag: "智能评审",
    desc: "上传设计稿后，AI 从 B 端业务逻辑、交互一致性、Accessibility 等维度自动打分",
    accent: "#4F46E5",
    iconBg: "bg-indigo-50", iconColor: "text-indigo-600",
    tagBg: "bg-indigo-50 text-indigo-600",
    accentCls: "bg-indigo-500",
    linkColor: "text-indigo-600",
  },
];

// ─── Large Feature Card (tall) — accent strip only on hover ──────────────────
function LargeFeatureCard({ f }: { f: typeof FEATURES[0] }) {
  const Icon = f.icon;
  return (
    <Link href={f.href} className="group block h-full">
      <div className="relative h-full min-h-[200px] rounded-[24px] bg-white overflow-hidden cursor-pointer border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
        {/* Accent top strip — solid color, only visible on hover */}
        <div
          className="h-1 w-full transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{ backgroundColor: f.accent }}
        />
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center", f.iconBg)}>
              <Icon className={cn("w-5 h-5", f.iconColor)} />
            </div>
            <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full", f.tagBg)}>
              {f.tag}
            </span>
          </div>
          <h3 className="font-display text-[20px] font-bold text-gray-900 mb-2 transition-opacity group-hover:opacity-75">
            {f.label}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed flex-1">{f.desc}</p>
          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-50">
            <span className={cn("text-sm font-semibold", f.linkColor)}>进入功能</span>
            <ArrowRight className={cn("w-3.5 h-3.5 transition-transform group-hover:translate-x-1", f.linkColor)} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Small Feature Card — accent left strip only on hover ────────────────────
function SmallFeatureCard({ f }: { f: typeof FEATURES[0] }) {
  const Icon = f.icon;
  return (
    <Link href={f.href} className="group block h-full">
      <div className="relative h-full min-h-[110px] rounded-[20px] bg-white overflow-hidden cursor-pointer border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
        {/* Accent left strip — solid color, only visible on hover */}
        <div
          className="absolute left-0 top-4 bottom-4 w-0.5 rounded-full transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{ backgroundColor: f.accent }}
        />
        <div className="p-5 pl-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-2.5">
            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", f.iconBg)}>
              <Icon className={cn("w-4 h-4", f.iconColor)} />
            </div>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", f.tagBg)}>
              {f.tag}
            </span>
          </div>
          <h3 className="font-display text-[14px] font-bold text-gray-900 mb-1 transition-opacity group-hover:opacity-75">
            {f.label}
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 flex-1">{f.desc}</p>
          <div className="flex items-center gap-1 mt-2.5">
            <span className={cn("text-xs font-semibold", f.linkColor)}>进入</span>
            <ArrowRight className={cn("w-3 h-3 transition-transform group-hover:translate-x-0.5", f.linkColor)} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Progress + Todos merged card ────────────────────────────────────────────
function ProgressTodosCard({
  stats,
  isAuthenticated,
}: {
  stats?: { total: number; pending: number; done: number };
  isAuthenticated: boolean;
}) {
  const { data: todos } = trpc.todos.list.useQuery(undefined, { enabled: isAuthenticated });
  const recent = (todos || []).filter(t => !t.completed).slice(0, 3);
  const pct = stats?.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const priorityColor: Record<string, string> = {
    high: "bg-red-400",
    medium: "bg-amber-400",
    low: "bg-emerald-400",
  };

  return (
    <div className="rounded-[20px] bg-white border border-gray-100 shadow-sm p-5">
      {/* Progress row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-400" />
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">本周进度</span>
        </div>
        <span className="text-xs font-semibold text-violet-600">{pct}%</span>
      </div>
      <div className="flex items-end gap-1.5 mb-2">
        <span className="font-display text-3xl font-bold text-gray-900 leading-none">{stats?.done ?? 0}</span>
        <span className="text-gray-400 text-sm mb-0.5">/ {stats?.total ?? 0} 完成</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
        <div
          className="rounded-full h-1.5 transition-all duration-700"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg, #7C3AED, #4F46E5)" }}
        />
      </div>

      {/* Divider */}
      <div className="border-t border-gray-50 mb-3" />

      {/* Todos */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">待处理</span>
        </div>
        <Link href="/meetings">
          <span className="text-[10px] font-semibold text-violet-500 hover:text-violet-700 transition-colors">全部 →</span>
        </Link>
      </div>
      {recent.length === 0 ? (
        <div className="flex items-center gap-2 py-2">
          <Clock className="w-4 h-4 text-gray-200" />
          <p className="text-xs text-gray-300">暂无待办</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recent.map(t => (
            <div key={t.id} className="flex items-center gap-2">
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", priorityColor[t.priority || "low"])} />
              <span className="text-xs text-gray-600 truncate">{t.title}</span>
            </div>
          ))}
        </div>
      )}
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
      className="rounded-[20px] bg-white border border-amber-100 shadow-sm p-5 cursor-pointer transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between min-h-[110px]"
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
          <p className="text-xs text-gray-500 line-clamp-2">{draw.data.content}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-1">
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

// ─── Inspiration Wall Canvas Card (custom, with sticky notes + dot grid) ────────
const STICKY_NOTES = [
  { text: "Flat Design",      color: "#FDE68A", rotate: "-3deg",  x: "55%", y: "12%" },
  { text: "Neumorphism",      color: "#FBCFE8", rotate: "2.5deg", x: "72%", y: "28%" },
  { text: "Glassmorphism",    color: "#BBF7D0", rotate: "-1.5deg",x: "58%", y: "46%" },
  { text: "Dark Mode First",  color: "#C7D2FE", rotate: "3deg",   x: "68%", y: "62%" },
  { text: "Motion Design",    color: "#FED7AA", rotate: "-2deg",  x: "56%", y: "68%" },
];

function InspirationWallCard() {
  const f = FEATURES[4]; // 灵感碰撞墙
  const Icon = f.icon;
  return (
    <Link href={f.href} className="group block h-full">
      <div
        className="relative h-full min-h-[200px] rounded-[24px] bg-white overflow-hidden cursor-pointer border border-gray-100 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      >
        {/* Accent top strip — solid color, only visible on hover */}
        <div
          className="h-1 w-full transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{ backgroundColor: f.accent }}
        />

        {/* Dot grid background — only on right canvas half */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
            backgroundSize: "20px 20px",
            opacity: 0.4,
          }}
        />

        {/* Left white gradient to keep text readable */}
        <div
          className="absolute inset-y-0 left-0 pointer-events-none"
          style={{ width: "52%", background: "linear-gradient(to right, rgba(255,255,255,0.97) 70%, transparent)" }}
        />

        {/* Sticky notes — right half canvas area only */}
        <div className="absolute inset-0 pointer-events-none">
          {STICKY_NOTES.map((note, i) => (
            <div
              key={i}
              className="absolute flex items-center justify-center px-2.5 py-1.5 rounded-md shadow-sm text-[11px] font-semibold text-gray-700 select-none"
              style={{
                background: note.color,
                transform: `rotate(${note.rotate})`,
                left: note.x,
                top: note.y,
                boxShadow: "0 2px 6px rgba(0,0,0,0.10)",
                whiteSpace: "nowrap",
              }}
            >
              {note.text}
            </div>
          ))}
        </div>

        {/* Card content — left half, z above dots */}
        <div className="relative z-10 p-6 h-full flex flex-col" style={{ maxWidth: "52%" }}>
          <div className="flex items-start justify-between mb-4">
            <div className={cn("w-11 h-11 rounded-2xl flex items-center justify-center", f.iconBg)}>
              <Icon className={cn("w-5 h-5", f.iconColor)} />
            </div>
            <span className={cn("text-[11px] font-semibold px-2.5 py-1 rounded-full", f.tagBg)}>
              {f.tag}
            </span>
          </div>
          <h3 className="font-display text-[20px] font-bold text-gray-900 mb-2 transition-opacity group-hover:opacity-75">
            {f.label}
          </h3>
          <p className="text-sm text-gray-500 leading-relaxed flex-1">{f.desc}</p>
          <div className="flex items-center gap-2 mt-5 pt-4 border-t border-gray-100">
            <span className={cn("text-sm font-semibold", f.linkColor)}>进入功能</span>
            <ArrowRight className={cn("w-3.5 h-3.5 transition-transform group-hover:translate-x-1", f.linkColor)} />
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Left Hero — no card background, just text on page bg ────────────────────
// ─── Team Timeline Card ──────────────────────────────────────────────────────
const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  todo_done:        { icon: CheckCheck,   color: "text-emerald-600", bg: "bg-emerald-50",  label: "完成待办" },
  idea_posted:      { icon: PenLine,      color: "text-amber-600",   bg: "bg-amber-50",    label: "发表想法" },
  review_passed:    { icon: ShieldCheck,  color: "text-violet-600",  bg: "bg-violet-50",   label: "评审通过" },
  interview_added:  { icon: UserPlus,     color: "text-blue-600",    bg: "bg-blue-50",     label: "新增访谈" },
  knowledge_added:  { icon: Library,      color: "text-indigo-600",  bg: "bg-indigo-50",   label: "知识沉淀" },
  inspiration_added:{ icon: Layers,       color: "text-pink-600",    bg: "bg-pink-50",     label: "灵感添加" },
};

// Mock data for when DB is empty
const MOCK_ACTIVITIES = [
  { id: 1, userName: "jinhui",   type: "todo_done",         title: "梗理访谈记录",         detail: "已完成本周第 3 项高优先级待办",   createdAt: new Date(Date.now() - 1000 * 60 * 15) },
  { id: 2, userName: "小 A",     type: "idea_posted",       title: "新组件方案",             detail: "提出了一种新的导航组件交互方式",   createdAt: new Date(Date.now() - 1000 * 60 * 42) },
  { id: 3, userName: "设计团队",  type: "review_passed",     title: "首页改版设计稿",         detail: "Accessibility 得分 92，交互一致性 88",  createdAt: new Date(Date.now() - 1000 * 60 * 90) },
  { id: 4, userName: "jinhui",   type: "interview_added",   title: "用户访谈 #12 记录",      detail: "访谈了 3 位中台运营同学",         createdAt: new Date(Date.now() - 1000 * 60 * 180) },
  { id: 5, userName: "小 B",     type: "knowledge_added",   title: "B 端表单设计规范 v2",   detail: "更新了表单验证规则和错误提示模式",  createdAt: new Date(Date.now() - 1000 * 60 * 240) },
];

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function TimelineItem({ item, isLast }: {
  item: { id: number; userName: string | null; type: string; title: string; detail?: string | null; createdAt: Date };
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTIVITY_ICONS[item.type] || ACTIVITY_ICONS.todo_done;
  const Icon = meta.icon;
  return (
    <div className="relative flex gap-3 group">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute left-[13px] top-7 bottom-0 w-px bg-gray-100" />
      )}
      {/* Icon dot */}
      <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 mt-0.5", meta.bg)}>
        <Icon className={cn("w-3.5 h-3.5", meta.color)} />
      </div>
      {/* Content */}
      <div
        className="flex-1 pb-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className="text-xs font-semibold text-gray-700">{item.userName}</span>
            <span className="text-xs text-gray-400 mx-1">·</span>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", meta.bg, meta.color)}>{meta.label}</span>
            <p className="text-xs text-gray-600 mt-0.5 truncate font-medium">{item.title}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-gray-300">{formatRelativeTime(item.createdAt)}</span>
            {item.detail && (
              expanded
                ? <ChevronUp className="w-3 h-3 text-gray-300 group-hover:text-gray-400" />
                : <ChevronDown className="w-3 h-3 text-gray-300 group-hover:text-gray-400" />
            )}
          </div>
        </div>
        {/* Expanded detail */}
        {expanded && item.detail && (
          <div className="mt-1.5 px-2.5 py-2 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs text-gray-500 leading-relaxed">{item.detail}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamTimeline() {
  const { isAuthenticated } = useAuth();
  const { data: liveActivities } = trpc.activities.list.useQuery(undefined, { enabled: isAuthenticated });
  const items = (liveActivities && liveActivities.length > 0)
    ? liveActivities.slice(0, 5).map(a => ({ ...a, createdAt: new Date(a.createdAt) }))
    : MOCK_ACTIVITIES;
  return (
    <div className="h-full rounded-[20px] bg-white border border-gray-100 shadow-sm p-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-violet-50 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
          </div>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">团队动态</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-gray-400">Live</span>
        </div>
      </div>
      {/* Timeline items */}
      <div className="flex-1 overflow-hidden">
        {items.map((item, i) => (
          <TimelineItem key={item.id} item={item} isLast={i === items.length - 1} />
        ))}
      </div>
    </div>
  );
}
// ─── Hero Panel ───────────────────────────────────────────────────────────────
function HeroPanel({ user, isAuthenticated }: {
  user: { name?: string | null } | null;
  isAuthenticated: boolean;
}) {
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 6) return "夜深了";
    if (h < 12) return "早上好";
    if (h < 14) return "中午好";
    if (h < 18) return "下午好";
    return "晚上好";
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Title — no white card, sits on page bg */}
      <div className="flex-1 flex flex-col justify-center px-1 pt-2">
        {isAuthenticated && (
          <p className="text-sm text-gray-400 mb-3 font-medium">
            {greeting()}，{user?.name?.split(" ")[0]} 👋
          </p>
        )}
        <h1
          className="font-display font-extrabold leading-[1.0] tracking-tighter"
          style={{ fontSize: "clamp(3rem, 4.5vw, 5rem)" }}
        >
          <span className="text-gray-900">设计</span><br />
          <span className="text-gray-900">协作</span><br />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #7C3AED 0%, #A855F7 50%, #4F46E5 100%)" }}
          >
            画布
          </span>
        </h1>
        <p className="mt-4 text-xs text-gray-400 leading-relaxed tracking-wide">
          为 B 端中台设计团队打造<br />从调研到交付的全流程协作平台
        </p>
        {!isAuthenticated && (
          <a
            href={getLoginUrl()}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-white text-sm font-semibold transition-all hover:opacity-90 hover:-translate-y-0.5 w-fit"
            style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
          >
            开始使用 <ArrowRight className="w-4 h-4" />
          </a>
        )}
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

      <main className="max-w-[1440px] mx-auto px-6 pt-4 pb-8">

        {/* ── Main Grid: 3 col left panel + 9 col right bento ── */}
        <div className="grid grid-cols-12 gap-4">

          {/* ── Left Column (col 1-3) ── */}
          <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
            {/* Hero title — no white bg */}
            <HeroPanel user={user} isAuthenticated={isAuthenticated} />

            {/* Merged progress + todos card */}
            <ProgressTodosCard stats={stats} isAuthenticated={isAuthenticated} />

            {/* Blindbox */}
            <BlindboxCard />
          </div>

          {/* ── Right Bento (col 4-12) ── */}
          <div className="col-span-12 lg:col-span-9 flex flex-col gap-4">

            {/* Row 1: Large meetings (left) + 2×2 small grid (right) */}
            <div className="grid grid-cols-3 gap-4">
              {/* Large: meetings — tall card */}
              <div className="col-span-1">
                <LargeFeatureCard f={FEATURES[0]} />
              </div>
              {/* Right 2×2 small cards: ideas, interviews, knowledge, reviews */}
              <div className="col-span-2 grid grid-cols-2 gap-4">
                <SmallFeatureCard f={FEATURES[1]} />{/* 想法落地页 */}
                <SmallFeatureCard f={FEATURES[2]} />{/* 用户访谈 */}
                <SmallFeatureCard f={FEATURES[3]} />{/* 设计知识库 */}
                <SmallFeatureCard f={FEATURES[5]} />{/* 方案智能评审 */}
              </div>
            </div>

            {/* Row 2: Large inspiration (wide, 2/3) + Timeline (1/3) */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <InspirationWallCard />{/* 灵感碰撞墙 */}
              </div>
              {/* Right col: Team Timeline */}
              <div className="col-span-1">
                <TeamTimeline />
              </div>
            </div>

          </div>
        </div>

      </main>

      <PixelCat activityLevel={activityCount} />
    </div>
  );
}
