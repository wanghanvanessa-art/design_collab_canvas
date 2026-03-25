import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Mic2, Lightbulb, Users, BookOpen, Sparkles, ClipboardCheck,
  Gift, ArrowRight, Zap, CheckCircle2, Clock, TrendingUp
} from "lucide-react";

const features = [
  {
    id: "meetings",
    path: "/meetings",
    icon: Mic2,
    emoji: "🎙️",
    title: "会议转待办",
    desc: "语音录音自动转文字，AI 提取核心思路，一键生成按优先级拆解的待办清单",
    color: "from-violet-500 to-purple-600",
    lightBg: "bg-violet-50",
    lightText: "text-violet-600",
    tag: "AI 驱动",
    tagColor: "bg-violet-100 text-violet-700",
  },
  {
    id: "ideas",
    path: "/ideas",
    icon: Lightbulb,
    emoji: "💡",
    title: "想法落地页",
    desc: "开放式想法发布与实时评论互动，支持导出 PDF / 博客 / Word 等多格式交付物",
    color: "from-amber-500 to-orange-500",
    lightBg: "bg-amber-50",
    lightText: "text-amber-600",
    tag: "协作互动",
    tagColor: "bg-amber-100 text-amber-700",
  },
  {
    id: "interviews",
    path: "/interviews",
    icon: Users,
    emoji: "👥",
    title: "用户访谈",
    desc: "全流程管理访谈记录，AI 自动分析人群标签、提炼用户痛点并生成设计解决方案",
    color: "from-emerald-500 to-teal-600",
    lightBg: "bg-emerald-50",
    lightText: "text-emerald-600",
    tag: "用户研究",
    tagColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "knowledge",
    path: "/knowledge",
    icon: BookOpen,
    emoji: "📚",
    title: "设计知识库",
    desc: "调研成果沉淀与版本管理，支持标签检索、版本对比、多人协作编辑",
    color: "from-sky-500 to-blue-600",
    lightBg: "bg-sky-50",
    lightText: "text-sky-600",
    tag: "知识沉淀",
    tagColor: "bg-sky-100 text-sky-700",
  },
  {
    id: "inspiration",
    path: "/inspiration",
    icon: Sparkles,
    emoji: "✨",
    title: "灵感碰撞墙",
    desc: "画布式拖拽灵感素材，AI 自动生成风格标签和相似设计推荐，一键关联待办",
    color: "from-pink-500 to-rose-500",
    lightBg: "bg-pink-50",
    lightText: "text-pink-600",
    tag: "创意画布",
    tagColor: "bg-pink-100 text-pink-700",
  },
  {
    id: "reviews",
    path: "/reviews",
    icon: ClipboardCheck,
    emoji: "🔍",
    title: "方案智能评审",
    desc: "上传设计稿后，AI 从 B 端业务逻辑、交互一致性、Accessibility 等维度自动打分",
    color: "from-indigo-500 to-violet-600",
    lightBg: "bg-indigo-50",
    lightText: "text-indigo-600",
    tag: "智能评审",
    tagColor: "bg-indigo-100 text-indigo-700",
  },
];

const stats = [
  { icon: CheckCircle2, label: "待办完成率", value: "—", color: "text-emerald-500" },
  { icon: Clock, label: "本周活跃", value: "—", color: "text-amber-500" },
  { icon: TrendingUp, label: "知识沉淀", value: "—", color: "text-sky-500" },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [greeting, setGreeting] = useState("");

  const { data: todoStats } = trpc.todos.stats.useQuery(undefined, { enabled: isAuthenticated });

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting("早上好");
    else if (h < 18) setGreeting("下午好");
    else setGreeting("晚上好");
  }, []);

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-6xl">
      {/* Hero Section */}
      <div className="mb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">
              {greeting}，{isAuthenticated ? (user?.name || "设计师") : "欢迎来到"} 👋
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-800 text-foreground leading-tight tracking-tight">
              设计协作
              <span className="text-gradient"> 画布</span>
            </h1>
            <p className="mt-3 text-muted-foreground text-base max-w-lg leading-relaxed">
              为 B 端中台设计团队打造的全流程协作平台 — 从调研到交付，让每一个创意都有迹可循
            </p>
          </div>

          {!isAuthenticated && (
            <a href={getLoginUrl()}>
              <Button size="lg" className="rounded-2xl gap-2 hidden md:flex">
                <Zap className="w-4 h-4" />
                立即登录
              </Button>
            </a>
          )}
        </div>

        {/* Quick Stats */}
        {isAuthenticated && (
          <div className="flex gap-4 flex-wrap">
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-card border border-border">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">待办</span>
              <span className="text-sm font-semibold">{todoStats?.pending ?? "—"} 待处理</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-card border border-border">
              <CheckCircle2 className="w-4 h-4 text-sky-500" />
              <span className="text-sm text-muted-foreground">已完成</span>
              <span className="text-sm font-semibold">{todoStats?.done ?? "—"} 项</span>
            </div>
          </div>
        )}
      </div>

      {/* Feature Grid */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl font-700 text-foreground">功能模块</h2>
          <span className="text-xs text-muted-foreground">6 个核心工作流</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Link key={f.id} href={f.path}>
                <div
                  className={cn(
                    "group relative p-5 rounded-2xl border border-border bg-card",
                    "hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
                    "overflow-hidden"
                  )}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {/* Gradient accent top */}
                  <div className={cn("absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity", f.color)} />

                  <div className="flex items-start justify-between mb-3">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-lg", f.lightBg)}>
                      {f.emoji}
                    </div>
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", f.tagColor)}>
                      {f.tag}
                    </span>
                  </div>

                  <h3 className="font-display font-700 text-base text-foreground mb-1.5">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">{f.desc}</p>

                  <div className={cn("flex items-center gap-1 text-xs font-medium transition-colors", f.lightText, "group-hover:gap-2")}>
                    进入功能
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Blindbox Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-2xl">
              🎁
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-display font-700 text-base text-foreground">灵感盲盒</h3>
                <Badge className="bg-amber-200 text-amber-800 border-0 text-[10px]">彩蛋功能</Badge>
              </div>
              <p className="text-sm text-muted-foreground">随机推送团队优秀案例、行业趣味设计冷知识，激发无限创意</p>
            </div>
          </div>
          <Link href="/blindbox">
            <Button variant="outline" className="rounded-xl gap-2 border-amber-200 hover:bg-amber-100 hover:border-amber-300 bg-white">
              <Gift className="w-4 h-4 text-amber-500" />
              开启盲盒
            </Button>
          </Link>
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-amber-100/50 blur-2xl" />
        <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-orange-100/50 blur-3xl" />
      </div>

      {/* Tips */}
      <div className="mt-8 p-4 rounded-2xl bg-muted/40 border border-border/50">
        <p className="text-xs text-muted-foreground text-center">
          💡 提示：右下角的像素猫咪是你的专属团宠，点击它获取随机鼓励和设计冷知识
        </p>
      </div>
    </div>
  );
}
