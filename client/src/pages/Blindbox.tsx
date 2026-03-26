import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BookOpen, Lightbulb, Star, Zap, RefreshCw, Loader2, Sparkles } from "lucide-react";
import { BackButton } from "@/components/BackButton";

// ─── Type config ──────────────────────────────────────────────────────────────
const typeConfig: Record<string, { label: string; icon: any; color: string; bg: string; accent: string }> = {
  case:      { label: "优秀案例",   icon: Star,      color: "text-amber-600",  bg: "bg-amber-50",   accent: "#f59e0b" },
  knowledge: { label: "设计冷知识", icon: BookOpen,  color: "text-sky-600",    bg: "bg-sky-50",     accent: "#0ea5e9" },
  tip:       { label: "设计小贴士", icon: Lightbulb, color: "text-violet-600", bg: "bg-violet-50",  accent: "#7c3aed" },
  trend:     { label: "行业趋势",   icon: Zap,       color: "text-emerald-600",bg: "bg-emerald-50", accent: "#10b981" },
};

// ─── Particle component ───────────────────────────────────────────────────────
function Particles({ active }: { active: boolean }) {
  const particles = [
    { color: "#a78bfa", angle: 0,   dist: 90 },
    { color: "#f472b6", angle: 45,  dist: 110 },
    { color: "#fb923c", angle: 90,  dist: 95 },
    { color: "#34d399", angle: 135, dist: 105 },
    { color: "#38bdf8", angle: 180, dist: 88 },
    { color: "#f472b6", angle: 225, dist: 115 },
    { color: "#a78bfa", angle: 270, dist: 100 },
    { color: "#fb923c", angle: 315, dist: 92 },
    { color: "#fbbf24", angle: 22,  dist: 80 },
    { color: "#34d399", angle: 67,  dist: 120 },
    { color: "#38bdf8", angle: 112, dist: 85 },
    { color: "#f472b6", angle: 157, dist: 108 },
  ];

  if (!active) return null;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {particles.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        const tx = Math.cos(rad) * p.dist;
        const ty = Math.sin(rad) * p.dist;
        return (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: i % 3 === 0 ? 10 : i % 3 === 1 ? 7 : 5,
              height: i % 3 === 0 ? 10 : i % 3 === 1 ? 7 : 5,
              backgroundColor: p.color,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              animation: `particle-fly-${i} 0.8s ease-out forwards`,
              animationDelay: `${i * 30}ms`,
            }}
          />
        );
      })}
      <style>{`
        ${particles.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          const tx = Math.cos(rad) * p.dist;
          const ty = Math.sin(rad) * p.dist;
          return `
            @keyframes particle-fly-${i} {
              0%   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
              60%  { transform: translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1.2); opacity: 0.9; }
              100% { transform: translate(calc(-50% + ${tx * 1.4}px), calc(-50% + ${ty * 1.4}px)) scale(0); opacity: 0; }
            }
          `;
        }).join("")}
      `}</style>
    </div>
  );
}

// ─── Box states: idle → shaking → opening → opened ───────────────────────────
type BoxState = "idle" | "shaking" | "opening" | "opened";

export default function Blindbox() {
  const { isAuthenticated } = useAuth();
  const [boxState, setBoxState] = useState<BoxState>("idle");
  const [showParticles, setShowParticles] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);
  // 按条目 ID 独立记录收藏状态，避免新盲盒继承已收藏状态
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const saveToKnowledge = trpc.blindbox.saveToKnowledge.useMutation({
    onSuccess: (_, variables) => {
      toast.success("已成功收藏到知识库！");
      // 将当前条目 ID 加入已收藏集合
      if (currentItem?.id) setSavedIds(prev => new Set(Array.from(prev).concat(currentItem.id)));
    },
    onError: () => toast.error("收藏失败，请重试"),
  });

  const draw = trpc.blindbox.draw.useMutation({
    onSuccess: (data) => {
      setCurrentItem(data);
      // Phase 3: box "opens" (lid flies up)
      setBoxState("opening");
      setTimeout(() => {
        // Phase 4: particles burst + result appears
        setBoxState("opened");
        setShowParticles(true);
        setTimeout(() => setShowParticles(false), 900);
        setTimeout(() => setShowResult(true), 300);
      }, 400);
    },
    onError: () => {
      setBoxState("idle");
      toast.error("抽取失败，请重试");
    },
  });

  const handleOpen = () => {
    if (boxState !== "idle") return;
    setShowResult(false);
    setCurrentItem(null);
    // Phase 1: shake
    setBoxState("shaking");
    // Phase 2: fetch data after shake
    setTimeout(() => draw.mutate(undefined), 700);
  };

  const handleReset = () => {
    setBoxState("idle");
    setShowResult(false);
    setCurrentItem(null);
    // 重置 mutation 状态，确保下次抽取时按钮恢复正常
    saveToKnowledge.reset();
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="text-5xl">🎁</div>
        <h2 className="font-display text-xl font-600">请先登录</h2>
        <a href={getLoginUrl()}><Button>登录使用</Button></a>
      </div>
    );
  }

  const typeInfo = currentItem ? (typeConfig[currentItem.type] || typeConfig.tip) : null;

  return (
    <div className="pb-8">
      <BackButton />
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-xl">🎁</div>
          <h1 className="font-display text-2xl font-700">灵感盲盒</h1>
          <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">彩蛋功能</Badge>
        </div>
        <p className="text-muted-foreground text-sm ml-11">随机推送优秀案例、设计冷知识、行业趋势，激发无限创意</p>
      </div>

      {/* Main stage */}
      <div className="flex flex-col items-center justify-center py-6 gap-10">

        {/* ── Gift Box ── */}
        <div className="relative flex flex-col items-center" style={{ minHeight: 200 }}>
          <Particles active={showParticles} />

          {/* Box body */}
          <div
            className={cn(
              "relative cursor-pointer select-none transition-all duration-300",
              boxState === "idle" && "hover:scale-105 hover:-rotate-2",
              boxState === "shaking" && "animate-[wiggle_0.15s_ease-in-out_4]",
              boxState === "opening" && "scale-110",
              boxState === "opened" && "scale-100 opacity-90",
            )}
            onClick={boxState === "idle" ? handleOpen : undefined}
            style={{ width: 160, height: 160 }}
          >
            {/* Box bottom */}
            <div
              className="absolute bottom-0 left-0 right-0 rounded-2xl shadow-2xl overflow-hidden"
              style={{
                height: boxState === "opening" || boxState === "opened" ? "75%" : "100%",
                background: "linear-gradient(145deg, #f59e0b, #d97706)",
                transition: "height 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {/* Ribbon vertical */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-8 bg-red-500/70" />
              {/* Shine */}
              <div className="absolute top-2 left-3 w-6 h-10 rounded-full bg-white/20 rotate-12" />
            </div>

            {/* Box lid */}
            <div
              className="absolute left-0 right-0 rounded-2xl shadow-xl overflow-hidden"
              style={{
                height: "32%",
                background: "linear-gradient(145deg, #fbbf24, #f59e0b)",
                top: boxState === "opening" || boxState === "opened" ? "-60%" : 0,
                transition: "top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                zIndex: 2,
              }}
            >
              {/* Ribbon horizontal on lid */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-5 bg-red-500/70" />
              {/* Bow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xl z-10">🎀</div>
            </div>

            {/* Sparkle inside when opened */}
            {(boxState === "opened") && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 3 }}>
                <span className="text-5xl animate-[pop_0.4s_cubic-bezier(0.34,1.56,0.64,1)]">✨</span>
              </div>
            )}

            {/* Loading spinner */}
            {boxState === "shaking" && draw.isPending && (
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* ── CTA / Status text ── */}
        {boxState === "idle" && (
          <div className="text-center animate-slide-up">
            <h2 className="font-display text-2xl font-700 mb-2">点击盲盒，获取今日灵感</h2>
            <p className="text-muted-foreground text-sm mb-6">每次抽取都是惊喜，可能是优秀案例、设计冷知识或行业趋势</p>
            <Button size="lg" className="rounded-2xl gap-2 px-8" onClick={handleOpen}>
              <Sparkles className="w-5 h-5" />
              开启灵感盲盒
            </Button>
          </div>
        )}

        {boxState === "shaking" && (
          <p className="text-muted-foreground text-sm animate-pulse">正在为你寻找灵感...</p>
        )}

        {/* ── Result Card ── */}
        {showResult && currentItem && typeInfo && (
          <div className="w-full max-w-lg animate-slide-up">
            <div className={cn("p-6 rounded-2xl border-2", typeInfo.bg, "border-current/10")}>
              {/* Type badge */}
              <div className="flex items-center gap-2 mb-4">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", typeInfo.bg)}>
                  <typeInfo.icon className={cn("w-4 h-4", typeInfo.color)} />
                </div>
                <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full bg-white/80 border", typeInfo.color)}>
                  {typeInfo.label}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">今日灵感 ✨</span>
              </div>

              {/* Content */}
              <h3 className="font-display text-lg font-700 text-foreground mb-3 leading-tight">{currentItem.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{currentItem.content}</p>

              {/* Tags */}
              {currentItem.tags && currentItem.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {currentItem.tags.map((tag: string) => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-white/80 text-gray-600 border border-gray-200">{tag}</span>
                  ))}
                </div>
              )}

              {/* Source */}
              {currentItem.source && (
                <p className="text-xs text-muted-foreground/70">来源：{currentItem.source}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1 rounded-xl gap-2" onClick={handleReset}>
                <RefreshCw className="w-4 h-4" />
                再抽一次
              </Button>
              <Button
                className="flex-1 rounded-xl gap-2"
                disabled={saveToKnowledge.isPending || (currentItem?.id && savedIds.has(currentItem.id))}
                onClick={() => {
                  if (!currentItem) return;
                  if (currentItem?.id && savedIds.has(currentItem.id)) return;
                  saveToKnowledge.mutate({
                    title: currentItem.title,
                    content: currentItem.content || currentItem.title,
                    tags: currentItem.tags || [],
                    category: "灵感盲盒",
                  });
                }}
              >
                {saveToKnowledge.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (currentItem?.id && savedIds.has(currentItem.id)) ? (
                  <span>✓ 已收藏</span>
                ) : (
                  <><BookOpen className="w-4 h-4" />收藏到知识库</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Hint */}
        {boxState === "idle" && (
          <p className="text-xs text-muted-foreground/60 text-center max-w-xs">
            💡 每次开启都会随机推送不同内容，包含团队沉淀的优秀案例和精选设计知识
          </p>
        )}
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(0deg); }
          25%       { transform: rotate(-8deg) scale(1.05); }
          75%       { transform: rotate(8deg) scale(1.05); }
        }
        @keyframes pop {
          0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
          60%  { transform: scale(1.3) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
