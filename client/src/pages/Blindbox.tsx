import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Gift, Sparkles, Loader2, RefreshCw, BookOpen, Lightbulb, Star, Zap } from "lucide-react";

const boxColors = [
  "from-violet-400 to-purple-500",
  "from-pink-400 to-rose-500",
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-blue-500",
];

const typeConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  case: { label: "优秀案例", icon: Star, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
  knowledge: { label: "设计冷知识", icon: BookOpen, color: "text-sky-600", bg: "bg-sky-50 border-sky-100" },
  tip: { label: "设计小贴士", icon: Lightbulb, color: "text-violet-600", bg: "bg-violet-50 border-violet-100" },
  trend: { label: "行业趋势", icon: Zap, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
};

export default function Blindbox() {
  const { isAuthenticated } = useAuth();
  const [isOpening, setIsOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [currentItem, setCurrentItem] = useState<any>(null);
  const [colorIdx, setColorIdx] = useState(0);

  const draw = trpc.blindbox.draw.useMutation({
    onSuccess: (data) => {
      setCurrentItem(data);
      setIsOpening(false);
      setOpened(true);
      setColorIdx(Math.floor(Math.random() * boxColors.length));
    },
    onError: () => {
      setIsOpening(false);
      toast.error("抽取失败，请重试");
    },
  });

  const handleOpen = () => {
    setIsOpening(true);
    setOpened(false);
    setTimeout(() => draw.mutate(undefined), 600);
  };

  const handleReset = () => {
    setOpened(false);
    setCurrentItem(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Gift className="w-12 h-12 text-amber-400" />
        <h2 className="font-display text-xl font-600">请先登录</h2>
        <a href={getLoginUrl()}><Button>登录使用</Button></a>
      </div>
    );
  }

  const typeInfo = currentItem ? (typeConfig[currentItem.type] || typeConfig.tip) : null;

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-xl">
            🎁
          </div>
          <h1 className="font-display text-2xl font-700">灵感盲盒</h1>
          <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">彩蛋功能</Badge>
        </div>
        <p className="text-muted-foreground text-sm ml-11">随机推送团队优秀案例、行业趣味设计冷知识，激发无限创意</p>
      </div>

      <div className="flex flex-col items-center justify-center py-8">
        {/* Box Animation */}
        <div className="relative mb-10">
          {/* Floating particles */}
          {opened && (
            <>
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full animate-ping opacity-60"
                  style={{
                    backgroundColor: ["#a78bfa", "#f472b6", "#fb923c", "#34d399", "#38bdf8"][i % 5],
                    left: `${50 + Math.cos(i * 45 * Math.PI / 180) * 60}px`,
                    top: `${50 + Math.sin(i * 45 * Math.PI / 180) * 60}px`,
                    animationDelay: `${i * 100}ms`,
                    animationDuration: "1s",
                  }}
                />
              ))}
            </>
          )}

          {/* Main box */}
          <div
            className={cn(
              "w-36 h-36 rounded-3xl flex items-center justify-center text-6xl cursor-pointer transition-all duration-300 shadow-xl select-none",
              "bg-gradient-to-br",
              boxColors[colorIdx],
              isOpening && "animate-bounce scale-110",
              !opened && !isOpening && "hover:scale-105 hover:shadow-2xl hover:rotate-3",
              opened && "scale-95 opacity-90"
            )}
            onClick={!opened && !isOpening ? handleOpen : undefined}
          >
            {isOpening ? (
              <Loader2 className="w-12 h-12 text-white animate-spin" />
            ) : opened ? (
              <span className="text-5xl">✨</span>
            ) : (
              <span>🎁</span>
            )}
          </div>
        </div>

        {/* CTA */}
        {!opened && !isOpening && (
          <div className="text-center animate-slide-up">
            <h2 className="font-display text-2xl font-700 mb-2">点击盲盒，获取今日灵感</h2>
            <p className="text-muted-foreground text-sm mb-6">每次抽取都是惊喜，可能是优秀案例、设计冷知识或行业趋势</p>
            <Button size="lg" className="rounded-2xl gap-2 px-8" onClick={handleOpen}>
              <Sparkles className="w-5 h-5" />
              开启灵感盲盒
            </Button>
          </div>
        )}

        {/* Result Card */}
        {opened && currentItem && typeInfo && (
          <div className="w-full max-w-lg animate-slide-up">
            <div className={cn("p-6 rounded-2xl border-2", typeInfo.bg)}>
              {/* Type Badge */}
              <div className="flex items-center gap-2 mb-4">
                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", typeInfo.bg)}>
                  <typeInfo.icon className={cn("w-4 h-4", typeInfo.color)} />
                </div>
                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", typeInfo.bg, typeInfo.color)}>
                  {typeInfo.label}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">今日灵感</span>
              </div>

              {/* Content */}
              <h3 className="font-display text-lg font-700 text-foreground mb-3 leading-tight">{currentItem.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{currentItem.content}</p>

              {/* Tags */}
              {currentItem.tags && currentItem.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {currentItem.tags.map((tag: string) => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-white/70 text-gray-600 border border-gray-200">{tag}</span>
                  ))}
                </div>
              )}

              {/* Source */}
              {currentItem.source && (
                <p className="text-xs text-muted-foreground">来源：{currentItem.source}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1 rounded-xl gap-2" onClick={handleReset}>
                <RefreshCw className="w-4 h-4" />
                再抽一次
              </Button>
              <Button className="flex-1 rounded-xl gap-2" onClick={() => { toast.success("已收藏到知识库！"); }}>
                <BookOpen className="w-4 h-4" />
                收藏到知识库
              </Button>
            </div>
          </div>
        )}

        {/* History hint */}
        <div className="mt-12 text-center text-muted-foreground">
          <p className="text-xs">💡 每次开启盲盒都会随机推送不同内容，包含团队沉淀的优秀案例和精选设计知识</p>
        </div>
      </div>
    </div>
  );
}
