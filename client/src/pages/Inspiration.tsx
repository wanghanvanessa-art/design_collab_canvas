import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Sparkles, Plus, Loader2, Link2, Type, Image, X, Move, Tag,
  Send, Paperclip, MessageSquare,
} from "lucide-react";

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

  // AI Chat state
  const [chatQuestion, setChatQuestion] = useState("");
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [attachInput, setAttachInput] = useState("");
  const [showAttachInput, setShowAttachInput] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "ai"; text: string; imageUrl?: string }>>([]);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const askAI = trpc.inspiration.askAI.useMutation({
    onSuccess: (data) => {
      setChatMessages(prev => [...prev, {
        role: "ai",
        text: data.answer,
        imageUrl: data.imageUrl || undefined,
      }]);
      utils.inspiration.list.invalidate();
    },
    onError: () => toast.error("AI 回复失败，请重试"),
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

  const handleCardClick = useCallback((e: React.MouseEvent, item: InspirationCard) => {
    e.stopPropagation();
    if (dragging !== null) return;
    setSelectedCard(prev => prev?.id === item.id ? null : item);
    setChatMessages([]);
  }, [dragging]);

  const handleSendQuestion = () => {
    if (!chatQuestion.trim() || !selectedCard) return;
    setChatMessages(prev => [...prev, { role: "user", text: chatQuestion }]);
    askAI.mutate({
      cardId: selectedCard.id,
      question: chatQuestion,
      attachmentUrls: attachmentUrls.length > 0 ? attachmentUrls : undefined,
    });
    setChatQuestion("");
    setAttachmentUrls([]);
    setShowAttachInput(false);
  };

  const handleAddAttachment = () => {
    if (!attachInput.trim()) return;
    setAttachmentUrls(prev => [...prev, attachInput.trim()]);
    setAttachInput("");
    setShowAttachInput(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Sparkles className="w-12 h-12 text-pink-400" />
        <h2 className="font-display text-xl font-semibold">请先登录</h2>
        <a href={getLoginUrl()}><Button>登录使用</Button></a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div className="flex items-start justify-between px-8 pt-6 pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-pink-600" />
            </div>
            <h1 className="font-display text-2xl font-bold">灵感碰撞墙</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">
            自由拖拽灵感素材，点击便利贴向 AI 提问，自动生成灵感图片
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
      </div>

      {/* Main area: canvas + sidebar */}
      <div className="flex flex-1 gap-0 px-8 pb-0 overflow-hidden">
        {/* Canvas */}
        <div
          className="flex-1 rounded-2xl border border-gray-200 relative overflow-hidden"
          style={{
            backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            backgroundColor: "#ffffff",
          }}
          onClick={() => setSelectedCard(null)}
        >
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
              {items?.map((item) => {
                const tags = (item.styleTags as string[]) || [];
                const isSelected = selectedCard?.id === item.id;
                const isAIReply = item.title === "✨ AI 回复";
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "absolute rounded-2xl border-2 p-3 cursor-pointer shadow-sm hover:shadow-md transition-all select-none",
                      isSelected && "ring-2 ring-pink-400/60 shadow-lg scale-[1.02]",
                      dragging === item.id && "shadow-xl scale-105 z-50",
                      isAIReply && "border-blue-200 bg-blue-50"
                    )}
                    style={{
                      left: item.posX ?? 0,
                      top: item.posY ?? 0,
                      width: item.width ?? 200,
                      minHeight: item.height ?? 120,
                      backgroundColor: isAIReply ? "#eff6ff" : (item.color || "#ffffff"),
                      borderColor: isAIReply ? "#bfdbfe" : (CARD_COLORS.find(c => c.value === item.color)?.border || "#e5e7eb"),
                      zIndex: dragging === item.id ? 50 : isSelected ? 10 : 1,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, item.id, item.posX ?? 0, item.posY ?? 0)}
                    onClick={(e) => handleCardClick(e, item as InspirationCard)}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <Move className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
                      <div className="flex items-center gap-1">
                        {isSelected && !isAIReply && (
                          <span className="text-[9px] text-pink-500 font-medium flex items-center gap-0.5">
                            <MessageSquare className="w-2.5 h-2.5" />点击提问
                          </span>
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
                    {item.title && (
                      <p className={cn("text-xs font-semibold mb-1 leading-tight", isAIReply ? "text-blue-700" : "text-gray-800")}>
                        {item.title}
                      </p>
                    )}
                    {item.content && <p className="text-xs text-gray-600 leading-relaxed">{item.content}</p>}
                    {item.url && item.type === "link" && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 underline break-all" onMouseDown={e => e.stopPropagation()}>
                        {item.url.slice(0, 40)}...
                      </a>
                    )}
                    {(item.imageUrl || (item.url && item.type === "image")) && (
                      <img src={item.imageUrl || item.url || ""} alt="" className="w-full rounded-lg mt-1 object-cover max-h-32" />
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

      {/* Bottom AI Chat Bar */}
      <div className="px-8 py-4 shrink-0">
        {/* Selected card hint */}
        {selectedCard && (
          <div className="mb-2 flex items-center gap-2 text-xs text-pink-600 font-medium">
            <MessageSquare className="w-3.5 h-3.5" />
            正在就「{selectedCard.title || selectedCard.content?.slice(0, 20) || "便利贴"}」提问
            <button className="ml-auto text-gray-400 hover:text-gray-600" onClick={() => setSelectedCard(null)}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Chat history */}
        {chatMessages.length > 0 && (
          <div className="mb-3 max-h-48 overflow-y-auto space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
            {chatMessages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                  msg.role === "user"
                    ? "bg-pink-500 text-white"
                    : "bg-white border border-gray-200 text-gray-700"
                )}>
                  <p>{msg.text}</p>
                  {msg.imageUrl && (
                    <img src={msg.imageUrl} alt="AI 生成灵感图" className="mt-2 rounded-lg max-h-40 w-full object-cover" />
                  )}
                </div>
              </div>
            ))}
            {askAI.isPending && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-500 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />AI 正在思考并生成灵感图...
                </div>
              </div>
            )}
          </div>
        )}

        {/* Attachment pills */}
        {attachmentUrls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachmentUrls.map((url, i) => (
              <span key={i} className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2.5 py-1">
                <Paperclip className="w-3 h-3" />
                {url.slice(0, 30)}...
                <button onClick={() => setAttachmentUrls(prev => prev.filter((_, j) => j !== i))}>
                  <X className="w-3 h-3 ml-0.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Attachment URL input */}
        {showAttachInput && (
          <div className="flex gap-2 mb-2">
            <Input
              value={attachInput}
              onChange={e => setAttachInput(e.target.value)}
              placeholder="粘贴图片 URL..."
              className="rounded-xl text-sm flex-1"
              onKeyDown={e => e.key === "Enter" && handleAddAttachment()}
            />
            <Button size="sm" variant="outline" className="rounded-xl" onClick={handleAddAttachment}>确认</Button>
            <Button size="sm" variant="ghost" className="rounded-xl" onClick={() => setShowAttachInput(false)}>取消</Button>
          </div>
        )}

        {/* Main input bar */}
        <div className={cn(
          "flex items-center gap-2 rounded-2xl border px-4 py-2.5 transition-all",
          selectedCard
            ? "border-pink-300 bg-white shadow-[0_0_0_3px_rgba(236,72,153,0.08)]"
            : "border-gray-200 bg-gray-50"
        )}>
          {/* Attachment button */}
          <button
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            onClick={() => setShowAttachInput(v => !v)}
            title="添加图片附件"
          >
            <Plus className="w-5 h-5" />
          </button>

          <input
            value={chatQuestion}
            onChange={e => setChatQuestion(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSendQuestion()}
            placeholder={selectedCard ? `就「${selectedCard.title || "便利贴"}」提问，AI 将生成灵感图片...` : "点击便利贴后，在此输入问题..."}
            disabled={!selectedCard || askAI.isPending}
            className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none min-w-0"
          />

          <button
            className={cn(
              "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all",
              selectedCard && chatQuestion.trim()
                ? "bg-pink-500 hover:bg-pink-600 text-white"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
            )}
            onClick={handleSendQuestion}
            disabled={!selectedCard || !chatQuestion.trim() || askAI.isPending}
          >
            {askAI.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
