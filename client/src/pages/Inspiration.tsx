import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Sparkles, Plus, Loader2, Link2, Type, Image, X, Move, Tag,
  Pencil, Eraser, Stamp, SquarePen,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";

const CARD_COLORS = [
  { name: "黄色", value: "#fef9c3", border: "#fef08a" },
  { name: "紫色", value: "#f3e8ff", border: "#e9d5ff" },
  { name: "绿色", value: "#dcfce7", border: "#bbf7d0" },
  { name: "粉色", value: "#fce7f3", border: "#fbcfe8" },
  { name: "蓝色", value: "#e0f2fe", border: "#bae6fd" },
  { name: "白色", value: "#ffffff", border: "#e5e7eb" },
];

const MIN_W = 160;
const MIN_H = 100;

/** 画笔预设 10 色（可再搭配自定义取色） */
const PEN_PRESET_COLORS = [
  "#111827", // 墨黑
  "#ef4444", // 红
  "#f97316", // 橙
  "#eab308", // 黄
  "#22c55e", // 绿
  "#14b8a6", // 青
  "#3b82f6", // 蓝
  "#8b5cf6", // 紫
  "#ec4899", // 粉
  "#78716c", // 灰棕
] as const;

/** 印章 10 款（emoji） */
const STAMP_EMOJIS = [
  "💡", "✅", "⭐", "🔥", "❤️",
  "👍", "🎨", "✨", "📝", "🚀",
] as const;

type InspirationCard = {
  id: number;
  type: string;
  title: string | null;
  content: string | null;
  imageUrl: string | null;
  url: string | null;
  posX: number | null;
  posY: number | null;
  width: number | null;
  height: number | null;
  styleTags: unknown;
  color: string | null;
  linkedTodoId: number | null;
  linkedInterviewId: number | null;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  boardId: number | null;
};

// Resize handle corners
type ResizeDir = "se" | "sw" | "ne" | "nw";

const RESIZE_CURSORS: Record<ResizeDir, string> = {
  se: "cursor-se-resize",
  sw: "cursor-sw-resize",
  ne: "cursor-ne-resize",
  nw: "cursor-nw-resize",
};

export default function Inspiration() {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<InspirationCard | null>(null);
  const [editForm, setEditForm] = useState({ title: "", content: "" });
  const [selectedCard, setSelectedCard] = useState<InspirationCard | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Resize state
  const [resizing, setResizing] = useState<{ id: number; dir: ResizeDir; startX: number; startY: number; startW: number; startH: number; startPosX: number; startPosY: number } | null>(null);

  const [form, setForm] = useState({ type: "text" as "text" | "image" | "link", title: "", content: "", url: "", color: "#fef9c3" });

  // ── Goodnotes-like tools (pen / stamp / eraser) ─────────────────────────────
  type ToolMode = "select" | "pen" | "eraser" | "stamp";
  const [tool, setTool] = useState<ToolMode>("select");
  const [penColor, setPenColor] = useState<string>(PEN_PRESET_COLORS[0]);
  const [penWidth, setPenWidth] = useState(3);
  const [stamp, setStamp] = useState<string>(STAMP_EMOJIS[0]);
  const [isDrawing, setIsDrawing] = useState(false);

  type Stroke = { id: string; mode: "pen" | "eraser"; color: string; width: number; points: Array<{ x: number; y: number }> };
  type StampMark = { id: string; x: number; y: number; text: string; size: number };
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [stamps, setStamps] = useState<StampMark[]>([]);
  const activeStrokeRef = useRef<Stroke | null>(null);

  const drawLayerRef = useRef<HTMLCanvasElement>(null);
  const drawLayerWrapRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: items, isLoading } = trpc.inspiration.list.useQuery();

  const create = trpc.inspiration.create.useMutation({
    onSuccess: () => {
      toast.success("灵感卡片已添加到画布！");
      setAddOpen(false);
      setForm({ type: "text", title: "", content: "", url: "", color: "#fef9c3" });
      utils.inspiration.list.invalidate();
    },
  });

  const updatePos = trpc.inspiration.updatePosition.useMutation({
    onSettled: () => utils.inspiration.list.invalidate(),
  });

  const deleteItem = trpc.inspiration.delete.useMutation({
    onSuccess: () => {
      toast.success("已删除");
      setSelectedCard(null);
      utils.inspiration.list.invalidate();
    },
  });

  const updateContent = trpc.inspiration.updateContent.useMutation({
    onSuccess: () => {
      toast.success("便利贴已更新");
      setEditOpen(false);
      setEditingCard(null);
      utils.inspiration.list.invalidate();
    },
  });

  const openEditDialog = useCallback((item: InspirationCard) => {
    setEditingCard(item);
    setEditForm({
      title: item.title ?? "",
      content: item.content ?? "",
    });
    setEditOpen(true);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingCard) return;
    updateContent.mutate({
      id: editingCard.id,
      title: editForm.title,
      content: editForm.content,
    });
  }, [editForm.content, editForm.title, editingCard, updateContent]);

  // ── Drag handlers（仅「选择」模式下可拖拽便利贴）────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent, id: number, posX: number, posY: number) => {
    if (tool !== "select") return;
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging(id);
    setDragOffset({ x: e.clientX - rect.left - posX, y: e.clientY - rect.top - posY });
  }, [tool]);

  // ── Resize handlers（仅「选择」模式下可拖四角缩放）───────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent, item: InspirationCard, dir: ResizeDir) => {
    if (tool !== "select") return;
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      id: item.id,
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startW: item.width ?? 200,
      startH: item.height ?? 120,
      startPosX: item.posX ?? 0,
      startPosY: item.posY ?? 0,
    });
  }, [tool]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (resizing !== null) {
      const dx = e.clientX - resizing.startX;
      const dy = e.clientY - resizing.startY;
      let newW = resizing.startW;
      let newH = resizing.startH;
      let newPosX = resizing.startPosX;
      let newPosY = resizing.startPosY;

      if (resizing.dir === "se") {
        newW = Math.max(MIN_W, resizing.startW + dx);
        newH = Math.max(MIN_H, resizing.startH + dy);
      } else if (resizing.dir === "sw") {
        newW = Math.max(MIN_W, resizing.startW - dx);
        newH = Math.max(MIN_H, resizing.startH + dy);
        newPosX = resizing.startPosX + (resizing.startW - newW);
      } else if (resizing.dir === "ne") {
        newW = Math.max(MIN_W, resizing.startW + dx);
        newH = Math.max(MIN_H, resizing.startH - dy);
        newPosY = resizing.startPosY + (resizing.startH - newH);
      } else if (resizing.dir === "nw") {
        newW = Math.max(MIN_W, resizing.startW - dx);
        newH = Math.max(MIN_H, resizing.startH - dy);
        newPosX = resizing.startPosX + (resizing.startW - newW);
        newPosY = resizing.startPosY + (resizing.startH - newH);
      }

      utils.inspiration.list.setData(undefined, (old) =>
        old?.map(item => item.id === resizing.id
          ? { ...item, width: newW, height: newH, posX: newPosX, posY: newPosY }
          : item
        )
      );
      return;
    }

    if (dragging === null) return;
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;
    utils.inspiration.list.setData(undefined, (old) =>
      old?.map(item => item.id === dragging ? { ...item, posX: newX, posY: newY } : item)
    );
  }, [dragging, dragOffset, resizing, utils]);

  const handleMouseUp = useCallback(() => {
    if (resizing !== null) {
      const item = items?.find(i => i.id === resizing.id);
      if (item) {
        updatePos.mutate({
          id: resizing.id,
          posX: item.posX ?? 0,
          posY: item.posY ?? 0,
          width: item.width ?? 200,
          height: item.height ?? 120,
        });
      }
      setResizing(null);
      return;
    }
    if (dragging === null) return;
    const item = items?.find(i => i.id === dragging);
    if (item) updatePos.mutate({ id: dragging, posX: item.posX ?? 0, posY: item.posY ?? 0 });
    setDragging(null);
  }, [dragging, resizing, items, updatePos]);

  const handleCardClick = useCallback((e: React.MouseEvent, item: InspirationCard) => {
    e.stopPropagation();
    if (tool !== "select") return;
    if (dragging !== null || resizing !== null) return;
    setSelectedCard(prev => prev?.id === item.id ? null : item);
  }, [dragging, resizing, tool]);

  const activeCursor =
    tool !== "select"
      ? ""
      : resizing
        ? RESIZE_CURSORS[resizing.dir]
        : dragging !== null
          ? "cursor-grabbing"
          : "";

  const redrawDrawLayer = useCallback(() => {
    const canvas = drawLayerRef.current;
    const wrap = drawLayerWrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w <= 0 || h <= 0) return;

    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // Strokes
    for (const s of strokes) {
      if (s.points.length < 2) continue;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = s.width;
      if (s.mode === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = s.color;
      }
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
      ctx.stroke();
      ctx.restore();
    }

    // Stamps
    for (const m of stamps) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.font = `700 ${m.size}px ui-sans-serif, system-ui`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(m.text, m.x, m.y);
      ctx.restore();
    }
  }, [strokes, stamps]);

  useEffect(() => {
    redrawDrawLayer();
  }, [redrawDrawLayer]);

  useEffect(() => {
    const onResize = () => redrawDrawLayer();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redrawDrawLayer]);

  const getLocalPoint = (e: React.PointerEvent) => {
    const wrap = drawLayerWrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleDrawPointerDown = (e: React.PointerEvent) => {
    if (tool === "select") return;
    e.preventDefault();
    e.stopPropagation();
    const p = getLocalPoint(e);
    if (!p) return;

    if (tool === "stamp") {
      setStamps(prev => prev.concat({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        x: p.x,
        y: p.y,
        text: stamp,
        size: 26,
      }));
      return;
    }

    const mode = tool === "eraser" ? "eraser" : "pen";
    const s: Stroke = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      mode,
      color: penColor,
      width: tool === "eraser" ? Math.max(10, penWidth * 4) : penWidth,
      points: [p],
    };
    activeStrokeRef.current = s;
    setIsDrawing(true);
    setStrokes(prev => prev.concat(s));
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleDrawPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    if (tool !== "pen" && tool !== "eraser") return;
    const p = getLocalPoint(e);
    if (!p) return;
    const current = activeStrokeRef.current;
    if (!current) return;

    // Append point to the last stroke
    setStrokes(prev => {
      const last = prev[prev.length - 1];
      if (!last || last.id !== current.id) return prev;
      const next = { ...last, points: last.points.concat(p) };
      return prev.slice(0, -1).concat(next);
    });
  };

  const handleDrawPointerUp = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    if (tool !== "pen" && tool !== "eraser") return;
    e.preventDefault();
    e.stopPropagation();
    setIsDrawing(false);
    activeStrokeRef.current = null;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div className="flex items-start justify-between px-8 pt-4 pb-4 shrink-0">
        <div>
          <BackButton />
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-pink-600" />
            </div>
            <h1 className="font-display text-2xl font-bold">灵感碰撞墙</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">
            自由拖拽灵感素材，拖拽四角调整大小；左侧工具栏支持画笔/印章/橡皮
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2"><Plus className="w-4 h-4" />添加灵感</Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader><DialogTitle className="font-display">添加灵感卡片</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex gap-2">
                {[{ v: "text", icon: Type, label: "文字" }, { v: "link", icon: Link2, label: "链接" }, { v: "image", icon: Image, label: "图片" }].map(({ v, icon: Icon, label }) => (
                  <button
                    key={v}
                    onClick={() => setForm(p => ({ ...p, type: v as any }))}
                    className={cn("flex-1 flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors", form.type === v ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-xs">{label}</span>
                  </button>
                ))}
              </div>
              <Input placeholder="标题（可选）" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
              {form.type === "text" && (
                <textarea placeholder="灵感内容..." value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} className="w-full rounded-xl border border-input p-3 text-sm min-h-24 resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
              )}
              {form.type === "link" && (
                <Input placeholder="URL 链接" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} className="rounded-xl" />
              )}
              {form.type === "image" && (
                <Input placeholder="图片 URL" value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} className="rounded-xl" />
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-2">卡片颜色</p>
                <div className="flex gap-2">
                  {CARD_COLORS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setForm(p => ({ ...p, color: c.value }))}
                      className={cn("w-7 h-7 rounded-full border-2 transition-transform hover:scale-110", form.color === c.value ? "border-primary scale-110" : "border-transparent")}
                      style={{ backgroundColor: c.value, outline: `1px solid ${c.border}` }}
                    />
                  ))}
                </div>
              </div>
              <Button className="w-full rounded-xl" onClick={() => create.mutate({ type: form.type, title: form.title || undefined, content: form.content || undefined, url: form.url || undefined, color: form.color, posX: Math.random() * 400 + 50, posY: Math.random() * 300 + 50 })} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}添加到画布
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={editOpen} onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingCard(null);
        }}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">编辑便利贴</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <Input
                placeholder="标题（可选）"
                value={editForm.title}
                onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                className="rounded-xl"
              />
              <textarea
                placeholder="灵感内容..."
                value={editForm.content}
                onChange={(e) => setEditForm((prev) => ({ ...prev, content: e.target.value }))}
                className="w-full rounded-xl border border-input p-3 text-sm min-h-28 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button
                className="w-full rounded-xl"
                onClick={handleSaveEdit}
                disabled={updateContent.isPending || !editingCard}
              >
                {updateContent.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                保存修改
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Canvas */}
      <div className="flex-1 mx-8 overflow-hidden">
        <div
          className={cn("w-full h-full rounded-2xl border border-gray-200 relative overflow-hidden", activeCursor)}
          style={{
            backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            backgroundColor: "#ffffff",
          }}
          onClick={() => setSelectedCard(null)}
        >
          {/* Left toolbar */}
          <div className="absolute left-4 top-4 z-30">
            <div className="rounded-2xl border bg-white/90 backdrop-blur px-2 py-2 shadow-sm flex flex-col gap-2">
              <button
                className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-colors",
                  tool === "select" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")}
                onClick={(e) => { e.stopPropagation(); setTool("select"); }}
                title="选择/拖拽"
              >
                <Move className="w-4 h-4" />
              </button>
              <button
                className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-colors",
                  tool === "pen" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")}
                onClick={(e) => { e.stopPropagation(); setTool("pen"); }}
                title="画笔"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-colors",
                  tool === "eraser" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")}
                onClick={(e) => { e.stopPropagation(); setTool("eraser"); }}
                title="橡皮"
              >
                <Eraser className="w-4 h-4" />
              </button>
              <button
                className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-colors",
                  tool === "stamp" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")}
                onClick={(e) => { e.stopPropagation(); setTool("stamp"); }}
                title="印章"
              >
                <Stamp className="w-4 h-4" />
              </button>

              {/* tool options */}
              <div className="pt-1 border-t border-gray-100 flex flex-col gap-2 px-1">
                {(tool === "pen" || tool === "eraser") && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-500 w-7">粗细</span>
                      <input
                        type="range"
                        min={2}
                        max={10}
                        value={penWidth}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setPenWidth(parseInt(e.target.value, 10))}
                        className="w-24"
                      />
                    </div>
                    {tool === "pen" && (
                      <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-5 gap-1.5 w-[152px]">
                          {PEN_PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              type="button"
                              className={cn(
                                "w-6 h-6 rounded-full border border-gray-200 shadow-inner transition-transform hover:scale-110",
                                penColor.toLowerCase() === c.toLowerCase() ? "ring-2 ring-pink-500 ring-offset-1" : "",
                              )}
                              style={{ backgroundColor: c }}
                              onClick={(e) => { e.stopPropagation(); setPenColor(c); }}
                              title={c}
                            />
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 shrink-0">自定义</span>
                          <input
                            type="color"
                            value={penColor.startsWith("#") && penColor.length >= 7 ? penColor.slice(0, 7) : "#111827"}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => { e.stopPropagation(); setPenColor(e.target.value); }}
                            className="h-7 w-12 cursor-pointer rounded-md border border-gray-200 bg-white p-0.5"
                            title="自定义颜色"
                          />
                          <span className="text-[10px] text-gray-400 font-mono truncate max-w-[4.5rem]" title={penColor}>
                            {penColor}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {tool === "stamp" && (
                  <div className="grid grid-cols-5 gap-1 w-[152px]">
                    {STAMP_EMOJIS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={cn(
                          "w-7 h-7 rounded-lg border text-base leading-none flex items-center justify-center",
                          stamp === s ? "bg-gray-900 text-white border-gray-900" : "bg-white border-gray-200 hover:bg-gray-50",
                        )}
                        onClick={(e) => { e.stopPropagation(); setStamp(s); }}
                        title={`印章 ${s}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStrokes([]);
                    setStamps([]);
                  }}
                >
                  清空笔记
                </Button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : items?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Sparkles className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">画布是空的</p>
              <p className="text-xs mt-1">点击「添加灵感」开始创作</p>
            </div>
          ) : (
            <div
              ref={canvasRef}
              className="relative w-full h-full"
              style={{ minHeight: "400px" }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Drawing layer：外层必须 pointer-events-none，否则全屏 z-10 会挡住下方便利贴；仅 canvas 在绘制模式下接事件 */}
              <div ref={drawLayerWrapRef} className="absolute inset-0 z-10 pointer-events-none">
                <canvas
                  ref={drawLayerRef}
                  className={cn("absolute inset-0", tool === "select" ? "pointer-events-none" : "pointer-events-auto")}
                  style={{ touchAction: "none" }}
                  onPointerDown={handleDrawPointerDown}
                  onPointerMove={handleDrawPointerMove}
                  onPointerUp={handleDrawPointerUp}
                  onPointerCancel={handleDrawPointerUp}
                />
              </div>
              {items?.map((item) => {
                const tags = (item.styleTags as string[]) || [];
                const isSelected = selectedCard?.id === item.id;
                const isAIReply = item.title === "✨ AI 回复";
                const cardW = item.width ?? 200;
                const cardH = item.height ?? 120;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "absolute rounded-2xl border-2 p-3 shadow-sm hover:shadow-md transition-shadow select-none",
                      tool === "select" ? "pointer-events-auto" : "pointer-events-none",
                      isSelected && "ring-2 ring-pink-400/60 shadow-lg",
                      dragging === item.id && "shadow-xl z-50",
                      resizing?.id === item.id && "z-50",
                      isAIReply && "border-blue-200"
                    )}
                    style={{
                      left: item.posX ?? 0,
                      top: item.posY ?? 0,
                      width: cardW,
                      height: cardH,
                      backgroundColor: isAIReply ? "#eff6ff" : (item.color || "#ffffff"),
                      borderColor: isAIReply ? "#bfdbfe" : (CARD_COLORS.find(c => c.value === item.color)?.border || "#e5e7eb"),
                      zIndex: dragging === item.id || resizing?.id === item.id ? 50 : isSelected ? 10 : 1,
                      overflow: "hidden",
                    }}
                    onMouseDown={(e) => handleMouseDown(e, item.id, item.posX ?? 0, item.posY ?? 0)}
                    onClick={(e) => handleCardClick(e, item as InspirationCard)}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <Move className={cn("w-3 h-3 text-gray-400 shrink-0 mt-0.5", tool === "select" ? "cursor-grab" : "cursor-default")} />
                      <div className="flex items-center gap-1">
                        {isSelected && (
                          <button
                            className="text-gray-400 hover:text-gray-700 transition-colors"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditDialog(item as InspirationCard);
                            }}
                            title="编辑便利贴"
                          >
                            <SquarePen className="w-3 h-3" />
                          </button>
                        )}
                        {isSelected && (
                          <button
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); deleteItem.mutate({ id: item.id }); }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Card content */}
                    {item.title && (
                      <p className={cn("text-xs font-semibold mb-1 leading-tight", isAIReply ? "text-blue-700" : "text-gray-800")}>
                        {item.title}
                      </p>
                    )}
                    {item.content && <p className="text-xs text-gray-600 leading-relaxed overflow-hidden">{item.content}</p>}
                    {item.url && item.type === "link" && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline break-all" onMouseDown={e => e.stopPropagation()}>
                        {item.url.slice(0, 40)}...
                      </a>
                    )}
                    {(item.imageUrl || (item.url && item.type === "image")) && (
                      <img src={item.imageUrl || item.url || ""} alt="" className="w-full rounded-lg mt-1 object-cover" style={{ maxHeight: cardH - 60 }} />
                    )}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tags.map((tag) => (
                          <span key={tag} className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-white/70 text-gray-600 border border-gray-200">
                            <Tag className="w-2 h-2" />{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* ── Resize handles (4 corners) — always visible on selected, subtle otherwise ── */}
                    {(["se", "sw", "ne", "nw"] as ResizeDir[]).map((dir) => {
                      const isCornerSE = dir === "se";
                      const isCornerSW = dir === "sw";
                      const isCornerNE = dir === "ne";
                      const isCornerNW = dir === "nw";
                      return (
                        <div
                          key={dir}
                          className={cn(
                            "absolute w-3 h-3 rounded-sm border-2 border-white bg-pink-400 opacity-0 hover:opacity-100 transition-opacity z-30",
                            isSelected && "opacity-70",
                            RESIZE_CURSORS[dir],
                            isCornerSE && "bottom-1 right-1",
                            isCornerSW && "bottom-1 left-1",
                            isCornerNE && "top-1 right-1",
                            isCornerNW && "top-1 left-1",
                          )}
                          onMouseDown={(e) => handleResizeStart(e, item as InspirationCard, dir)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
