import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Sparkles, Plus, Loader2, Link2, Type, Image, Wand2, X, Move, Tag } from "lucide-react";

const CARD_COLORS = [
  { name: "黄色", value: "#fef9c3", border: "#fef08a" },
  { name: "紫色", value: "#f3e8ff", border: "#e9d5ff" },
  { name: "绿色", value: "#dcfce7", border: "#bbf7d0" },
  { name: "粉色", value: "#fce7f3", border: "#fbcfe8" },
  { name: "蓝色", value: "#e0f2fe", border: "#bae6fd" },
  { name: "白色", value: "#ffffff", border: "#e5e7eb" },
];

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

export default function Inspiration() {
  const { isAuthenticated } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<InspirationCard | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [form, setForm] = useState({ type: "text" as "text" | "image" | "link", title: "", content: "", url: "", color: "#fef9c3" });
  const canvasRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: items, isLoading } = trpc.inspiration.list.useQuery(undefined, { enabled: isAuthenticated });

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

  const generateTags = trpc.inspiration.generateTags.useMutation({
    onSuccess: () => {
      toast.success("风格标签已生成！");
      utils.inspiration.list.invalidate();
    },
    onError: () => toast.error("生成失败"),
  });

  const handleMouseDown = useCallback((e: React.MouseEvent, id: number, posX: number, posY: number) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDragging(id);
    setDragOffset({ x: e.clientX - rect.left - posX, y: e.clientY - rect.top - posY });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging === null) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;
    utils.inspiration.list.setData(undefined, (old) =>
      old?.map(item => item.id === dragging ? { ...item, posX: newX, posY: newY } : item)
    );
  }, [dragging, dragOffset, utils]);

  const handleMouseUp = useCallback(() => {
    if (dragging === null) return;
    const item = items?.find(i => i.id === dragging);
    if (item) updatePos.mutate({ id: dragging, posX: item.posX ?? 0, posY: item.posY ?? 0 });
    setDragging(null);
  }, [dragging, items, updatePos]);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Sparkles className="w-12 h-12 text-pink-400" />
        <h2 className="font-display text-xl font-600">请先登录</h2>
        <a href={getLoginUrl()}><Button>登录使用</Button></a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between p-8 pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-pink-600" />
            </div>
            <h1 className="font-display text-2xl font-700">灵感碰撞墙</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">自由拖拽灵感素材，AI 自动生成风格标签和相似设计推荐</p>
        </div>
        <div className="flex gap-2">
          {items && items.length > 0 && (
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => generateTags.mutate({})} disabled={generateTags.isPending}>
              {generateTags.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              AI 生成风格标签
            </Button>
          )}
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2"><Plus className="w-4 h-4" />添加灵感</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader><DialogTitle className="font-display">添加灵感卡片</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Type */}
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
                {/* Color */}
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
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 mx-8 mb-8 rounded-2xl border-2 border-dashed border-border bg-gradient-to-br from-slate-50 to-purple-50/30 relative overflow-hidden" style={{ minHeight: "500px" }}>
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
            style={{ minHeight: "500px" }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {items?.map((item) => {
              const tags = (item.styleTags as string[]) || [];
              const isSelected = selectedCard?.id === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "absolute rounded-2xl border-2 p-3 cursor-move shadow-sm hover:shadow-md transition-shadow select-none",
                    isSelected && "ring-2 ring-primary/50 shadow-lg",
                    dragging === item.id && "shadow-xl scale-105 z-50"
                  )}
                  style={{
                    left: item.posX ?? 0,
                    top: item.posY ?? 0,
                    width: item.width ?? 200,
                    minHeight: item.height ?? 120,
                    backgroundColor: item.color || "#ffffff",
                    borderColor: CARD_COLORS.find(c => c.value === item.color)?.border || "#e5e7eb",
                    zIndex: dragging === item.id ? 50 : isSelected ? 10 : 1,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, item.id, item.posX ?? 0, item.posY ?? 0)}
                  onClick={(e) => { e.stopPropagation(); setSelectedCard(isSelected ? null : item as InspirationCard); }}
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <Move className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
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
                  {item.title && <p className="text-xs font-semibold text-gray-800 mb-1 leading-tight">{item.title}</p>}
                  {item.content && <p className="text-xs text-gray-600 leading-relaxed">{item.content}</p>}
                  {item.url && item.type === "link" && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline break-all" onMouseDown={e => e.stopPropagation()}>
                      {item.url.slice(0, 40)}...
                    </a>
                  )}
                  {item.url && item.type === "image" && (
                    <img src={item.url} alt="" className="w-full rounded-lg mt-1 object-cover max-h-32" />
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
