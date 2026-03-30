import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

type CatMood = "idle" | "happy" | "curious" | "sleeping" | "excited";

const ENCOURAGEMENTS = [
  "你今天的设计真的太棒了！✨",
  "每一个像素都是你的心血，加油！🎨",
  "设计师是把想象变成现实的魔法师 🪄",
  "好的设计让用户感受不到设计的存在 💡",
  "今天完成了多少待办？继续冲！🚀",
  "记得给自己倒杯水，创意需要水分滋养 💧",
  "你的每一个设计决策都有意义 🎯",
  "团队因为有你而更有创意！🌟",
  "休息一下，好的灵感往往在放松时出现 ☕",
  "设计不是装饰，是解决问题的艺术 🔧",
];

const DESIGN_FACTS = [
  "💡 设计冷知识：人眼每秒可以处理约1000万种颜色",
  "📐 黄金比例 1:1.618 在自然界和设计中无处不在",
  "🎨 红色能让人感到紧迫感，这就是为什么「清仓」标签常用红色",
  "👁️ 用户阅读网页时的视线轨迹呈 F 形或 Z 形",
  "⏱️ 用户在页面停留的平均时间只有 15 秒，第一印象很重要",
  "🔤 无衬线字体在屏幕上比衬线字体可读性更高",
  "📱 移动端触控目标最小尺寸应为 44×44 像素",
  "🌈 色盲影响约 8% 的男性，设计时要考虑色彩无障碍",
];

// Pixel cat SVG frames
const CAT_FRAMES = {
  idle: (
    <svg width="48" height="48" viewBox="0 0 16 16" className="pixelated" style={{ imageRendering: "pixelated" }}>
      {/* Body */}
      <rect x="4" y="8" width="8" height="6" fill="#f4a261" />
      {/* Head */}
      <rect x="3" y="3" width="10" height="7" fill="#f4a261" />
      {/* Ears */}
      <rect x="3" y="1" width="2" height="3" fill="#f4a261" />
      <rect x="11" y="1" width="2" height="3" fill="#f4a261" />
      <rect x="3.5" y="1.5" width="1" height="2" fill="#e76f51" />
      <rect x="11.5" y="1.5" width="1" height="2" fill="#e76f51" />
      {/* Eyes */}
      <rect x="5" y="5" width="2" height="2" fill="#2d3436" />
      <rect x="9" y="5" width="2" height="2" fill="#2d3436" />
      <rect x="5.5" y="5.5" width="1" height="1" fill="#74b9ff" />
      <rect x="9.5" y="5.5" width="1" height="1" fill="#74b9ff" />
      {/* Nose */}
      <rect x="7.5" y="7" width="1" height="1" fill="#e17055" />
      {/* Mouth */}
      <rect x="6.5" y="8" width="1" height="0.5" fill="#2d3436" />
      <rect x="8" y="8" width="1" height="0.5" fill="#2d3436" />
      {/* Tail */}
      <rect x="12" y="10" width="2" height="1" fill="#f4a261" />
      <rect x="13" y="9" width="1" height="1" fill="#f4a261" />
      {/* Stripes */}
      <rect x="5" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
      <rect x="7" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
      <rect x="9" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
    </svg>
  ),
  happy: (
    <svg width="48" height="48" viewBox="0 0 16 16" className="pixelated" style={{ imageRendering: "pixelated" }}>
      <rect x="4" y="8" width="8" height="6" fill="#f4a261" />
      <rect x="3" y="3" width="10" height="7" fill="#f4a261" />
      <rect x="3" y="1" width="2" height="3" fill="#f4a261" />
      <rect x="11" y="1" width="2" height="3" fill="#f4a261" />
      <rect x="3.5" y="1.5" width="1" height="2" fill="#e76f51" />
      <rect x="11.5" y="1.5" width="1" height="2" fill="#e76f51" />
      {/* Happy eyes (curved) */}
      <rect x="5" y="6" width="2" height="1" fill="#2d3436" />
      <rect x="9" y="6" width="2" height="1" fill="#2d3436" />
      {/* Big smile */}
      <rect x="6" y="7.5" width="4" height="1" fill="#2d3436" />
      <rect x="5.5" y="7" width="1" height="1" fill="#2d3436" />
      <rect x="9.5" y="7" width="1" height="1" fill="#2d3436" />
      {/* Rosy cheeks */}
      <rect x="4" y="7" width="1.5" height="1" fill="#fab1a0" opacity="0.7" />
      <rect x="10.5" y="7" width="1.5" height="1" fill="#fab1a0" opacity="0.7" />
      {/* Wagging tail */}
      <rect x="12" y="8" width="2" height="1" fill="#f4a261" />
      <rect x="13" y="7" width="1" height="2" fill="#f4a261" />
      <rect x="5" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
      <rect x="7" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
      <rect x="9" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
    </svg>
  ),
  curious: (
    <svg width="48" height="48" viewBox="0 0 16 16" className="pixelated" style={{ imageRendering: "pixelated" }}>
      <rect x="4" y="8" width="8" height="6" fill="#f4a261" />
      {/* Head tilted slightly */}
      <rect x="3" y="3" width="10" height="7" fill="#f4a261" />
      <rect x="2" y="1" width="2" height="3" fill="#f4a261" />
      <rect x="12" y="1" width="2" height="3" fill="#f4a261" />
      <rect x="2.5" y="1.5" width="1" height="2" fill="#e76f51" />
      <rect x="12.5" y="1.5" width="1" height="2" fill="#e76f51" />
      {/* Curious eyes - one bigger */}
      <rect x="4" y="5" width="3" height="2" fill="#2d3436" />
      <rect x="9" y="5" width="2" height="2" fill="#2d3436" />
      <rect x="4.5" y="5.5" width="1.5" height="1" fill="#74b9ff" />
      <rect x="9.5" y="5.5" width="1" height="1" fill="#74b9ff" />
      {/* Question mark head tilt */}
      <rect x="7" y="7" width="1" height="1" fill="#e17055" />
      <rect x="6" y="8" width="1" height="0.5" fill="#2d3436" />
      <rect x="8" y="8" width="1" height="0.5" fill="#2d3436" />
      <rect x="12" y="10" width="2" height="1" fill="#f4a261" />
      <rect x="13" y="9" width="1" height="1" fill="#f4a261" />
      <rect x="5" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
      <rect x="7" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
      <rect x="9" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
    </svg>
  ),
  sleeping: (
    <svg width="48" height="48" viewBox="0 0 16 16" className="pixelated" style={{ imageRendering: "pixelated" }}>
      <rect x="4" y="8" width="8" height="6" fill="#f4a261" />
      <rect x="3" y="3" width="10" height="7" fill="#f4a261" />
      <rect x="3" y="1" width="2" height="3" fill="#f4a261" />
      <rect x="11" y="1" width="2" height="3" fill="#f4a261" />
      <rect x="3.5" y="1.5" width="1" height="2" fill="#e76f51" />
      <rect x="11.5" y="1.5" width="1" height="2" fill="#e76f51" />
      {/* Closed eyes (sleeping) */}
      <rect x="5" y="6" width="2" height="0.5" fill="#2d3436" />
      <rect x="9" y="6" width="2" height="0.5" fill="#2d3436" />
      {/* Zzz */}
      <rect x="13" y="2" width="1" height="0.5" fill="#a29bfe" />
      <rect x="14" y="2.5" width="0.5" height="0.5" fill="#a29bfe" />
      <rect x="13" y="3" width="1.5" height="0.5" fill="#a29bfe" />
      {/* Snoring mouth */}
      <rect x="7" y="7.5" width="2" height="0.5" fill="#2d3436" />
      <rect x="12" y="10" width="2" height="1" fill="#f4a261" />
      <rect x="5" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
      <rect x="7" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
      <rect x="9" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
    </svg>
  ),
  excited: (
    <svg width="48" height="48" viewBox="0 0 16 16" className="pixelated" style={{ imageRendering: "pixelated" }}>
      <rect x="4" y="8" width="8" height="6" fill="#f4a261" />
      <rect x="3" y="2" width="10" height="7" fill="#f4a261" />
      {/* Perked up ears */}
      <rect x="2" y="0" width="3" height="4" fill="#f4a261" />
      <rect x="11" y="0" width="3" height="4" fill="#f4a261" />
      <rect x="2.5" y="0.5" width="2" height="3" fill="#e76f51" />
      <rect x="11.5" y="0.5" width="2" height="3" fill="#e76f51" />
      {/* Star eyes */}
      <rect x="5" y="4" width="2" height="2" fill="#fdcb6e" />
      <rect x="9" y="4" width="2" height="2" fill="#fdcb6e" />
      <rect x="5.5" y="4.5" width="1" height="1" fill="#e17055" />
      <rect x="9.5" y="4.5" width="1" height="1" fill="#e17055" />
      {/* Big open mouth */}
      <rect x="6" y="7" width="4" height="1.5" fill="#2d3436" />
      <rect x="6.5" y="7.5" width="3" height="1" fill="#e17055" />
      {/* Sparkles */}
      <rect x="1" y="3" width="1" height="1" fill="#fdcb6e" />
      <rect x="14" y="3" width="1" height="1" fill="#fdcb6e" />
      <rect x="2" y="6" width="0.5" height="0.5" fill="#74b9ff" />
      {/* Excited tail up */}
      <rect x="12" y="7" width="1" height="3" fill="#f4a261" />
      <rect x="13" y="6" width="1" height="2" fill="#f4a261" />
      <rect x="5" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
      <rect x="7" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
      <rect x="9" y="9" width="1" height="4" fill="#e76f51" opacity="0.4" />
    </svg>
  ),
};

interface PixelCatProps {
  activityLevel?: number; // 0-10
}

export default function PixelCat({ activityLevel = 0 }: PixelCatProps) {
  const [mood, setMood] = useState<CatMood>("idle");
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleText, setBubbleText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [idleTime, setIdleTime] = useState(0);

  // Update mood based on activity
  useEffect(() => {
    if (activityLevel >= 8) setMood("excited");
    else if (activityLevel >= 5) setMood("happy");
    else if (activityLevel >= 2) setMood("curious");
    else setMood("idle");
  }, [activityLevel]);

  // Idle timer - cat sleeps after inactivity
  useEffect(() => {
    const timer = setInterval(() => {
      setIdleTime(prev => {
        const next = prev + 1;
        if (next >= 30 && activityLevel < 2) setMood("sleeping");
        return next;
      });
    }, 10000); // every 10s
    return () => clearInterval(timer);
  }, [activityLevel]);

  // Reset idle on activity
  useEffect(() => {
    if (activityLevel > 0) {
      setIdleTime(0);
      if (mood === "sleeping") setMood("idle");
    }
  }, [activityLevel]);

  const handleClick = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setIdleTime(0);
    setMood("excited");

    // Random message
    const allMessages = [...ENCOURAGEMENTS, ...DESIGN_FACTS];
    const msg = allMessages[Math.floor(Math.random() * allMessages.length)];
    setBubbleText(msg);
    setShowBubble(true);

    setTimeout(() => {
      setIsAnimating(false);
      setMood(activityLevel >= 5 ? "happy" : "idle");
    }, 2000);

    setTimeout(() => setShowBubble(false), 4000);
  }, [isAnimating, activityLevel]);

  const moodEmoji = {
    idle: "😺",
    happy: "😸",
    curious: "🐱",
    sleeping: "😴",
    excited: "🙀",
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Speech Bubble */}
      {showBubble && (
        <div className="animate-slide-up max-w-56 p-3 rounded-2xl rounded-br-sm bg-white border border-border shadow-lg">
          <p className="text-xs text-foreground leading-relaxed">{bubbleText}</p>
          <div className="absolute bottom-0 right-4 translate-y-full">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white" />
          </div>
        </div>
      )}

      {/* Cat */}
      <div
        className={cn(
          "relative cursor-pointer select-none transition-transform",
          "hover:scale-110 active:scale-95",
          isAnimating && "animate-bounce",
          mood === "sleeping" && "opacity-80"
        )}
        onClick={handleClick}
        title="点击我获取鼓励！"
      >
        {/* Cat container with pixel art style */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          {/* Glow effect for active moods */}
          {(mood === "happy" || mood === "excited") && (
            <div className="absolute inset-0 rounded-full bg-amber-300/20 animate-ping" />
          )}
          {/* Pixel cat */}
          <div
            className={cn(
              "transition-all duration-300",
              mood === "sleeping" && "translate-y-1",
              mood === "excited" && "-translate-y-1",
            )}
            style={{ transform: mood === "curious" ? "rotate(-8deg)" : undefined }}
          >
            {CAT_FRAMES[mood]}
          </div>
        </div>

        {/* Mood indicator */}
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center text-[10px] shadow-sm">
          {moodEmoji[mood]}
        </div>

        {/* Sleeping Zzz */}
        {mood === "sleeping" && (
          <div className="absolute -top-4 -right-2 text-xs text-purple-400 animate-bounce font-bold">
            z z z
          </div>
        )}
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-[9px] text-muted-foreground font-medium tracking-wider">云团宠 · 像素猫</p>
      </div>
    </div>
  );
}
