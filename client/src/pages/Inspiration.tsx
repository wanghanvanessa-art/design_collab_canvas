import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Sparkles, Loader2, Copy, Trash2, Image, Upload, Wand2,
  Bookmark, BookmarkCheck, GripVertical, Clock,
  Settings2, CheckCircle, Send, MessageSquare,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { ModelConfigDialog } from "@/components/ModelConfigDialog";

type AnalysisResult = {
  prompt: string;
  summaryCn: string;
  subject: string;
  style: string;
  colorPalette: string;
  composition: string;
  lighting: string;
  texture: string;
  details: string;
};

type InspirationCard = {
  id: string;
  title: string;
  category: "style" | "composition" | "mood";
  prompt: string;
  promptCn: string;
  description: string;
  saved: boolean;
};

type HistoryItem = {
  id: string;
  timestamp: number;
  prompt: string;
  imagePreview?: string;
  analysis: AnalysisResult;
  cards: InspirationCard[];
};

const CATEGORY_MAP: Record<string, { label: string; color: string; bg: string; bgActive: string }> = {
  style: { label: "风格", color: "text-purple-700", bg: "bg-purple-50 border-purple-200", bgActive: "bg-purple-600 text-white border-purple-600" },
  composition: { label: "构图", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", bgActive: "bg-blue-600 text-white border-blue-600" },
  mood: { label: "氛围", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", bgActive: "bg-amber-600 text-white border-amber-600" },
};

const HISTORY_KEY = "inspiration_workshop_history";
function loadHistory(): HistoryItem[] {
  try { const r = localStorage.getItem(HISTORY_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50)));
}

export default function Inspiration() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDragging, setImageDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // All cards (full set); activeFilter controls which subset is shown
  const [allCards, setAllCards] = useState<InspirationCard[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "style" | "composition" | "mood">("all");
  const [expanding, setExpanding] = useState(false);
  const [expandMode, setExpandMode] = useState<"all" | "style" | "composition" | "mood">("all");

  // Chat input
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>(loadHistory);
  const [showHistory, setShowHistory] = useState(false);
  const [modelConfigOpen, setModelConfigOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const analyzeImageMut = trpc.inspiration.analyzeImage.useMutation();
  const expandInspirationMut = trpc.inspiration.expandInspiration.useMutation();
  const chatExpandMut = trpc.inspiration.chatExpand.useMutation();

  // Derived: filtered cards based on activeFilter
  const filteredCards = activeFilter === "all"
    ? allCards
    : allCards.filter(c => c.category === activeFilter);

  // Category counts
  const catCounts = { all: allCards.length, style: 0, composition: 0, mood: 0 };
  allCards.forEach(c => { if (c.category in catCounts) catCounts[c.category as keyof typeof catCounts]++; });

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("请上传图片文件"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("图片大小不能超过 10MB"); return; }
    const reader = new FileReader();
    reader.onload = () => { setImagePreview(reader.result as string); setAnalysis(null); setAllCards([]); setActiveFilter("all"); };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setImageDragging(false);
    const file = e.dataTransfer.files[0]; if (file) handleFile(file);
  }, [handleFile]);

  const handleAnalyze = useCallback(async () => {
    if (!imagePreview) return;
    setAnalyzing(true);
    try {
      const result = await analyzeImageMut.mutateAsync({ imageBase64: imagePreview });
      setAnalysis(result as AnalysisResult);
      toast.success("图片分析完成！");
    } catch (e: any) { toast.error(e.message || "分析失败，请检查模型配置"); }
    finally { setAnalyzing(false); }
  }, [imagePreview, analyzeImageMut]);

  const handleExpand = useCallback(async () => {
    if (!analysis?.prompt) return;
    setExpanding(true);
    try {
      const result = await expandInspirationMut.mutateAsync({ prompt: analysis.prompt, mode: expandMode });
      const newCards: InspirationCard[] = (result.cards || []).map((c: any, i: number) => ({
        id: `${Date.now()}-${i}`, title: c.title, category: c.category,
        prompt: c.prompt, promptCn: c.promptCn || "", description: c.description, saved: false,
      }));
      setAllCards(prev => [...prev, ...newCards]);
      setActiveFilter("all");
      toast.success(`已生成 ${newCards.length} 张灵感卡片`);
      if (imagePreview && analysis) {
        const item: HistoryItem = {
          id: `${Date.now()}`, timestamp: Date.now(),
          prompt: analysis.prompt, imagePreview: imagePreview || undefined, analysis, cards: newCards,
        };
        const updated = [item, ...history].slice(0, 50);
        setHistory(updated); saveHistory(updated);
      }
    } catch (e: any) { toast.error(e.message || "灵感发散失败，请检查模型配置"); }
    finally { setExpanding(false); }
  }, [analysis, expandMode, expandInspirationMut, imagePreview, history]);

  const handleChatExpand = useCallback(async () => {
    if (!analysis?.prompt || !chatInput.trim()) return;
    setChatLoading(true);
    try {
      const result = await chatExpandMut.mutateAsync({ basePrompt: analysis.prompt, userMessage: chatInput.trim() });
      const newCards: InspirationCard[] = (result.cards || []).map((c: any, i: number) => ({
        id: `chat-${Date.now()}-${i}`, title: c.title, category: c.category,
        prompt: c.prompt, promptCn: c.promptCn || "", description: c.description, saved: false,
      }));
      setAllCards(prev => [...prev, ...newCards]);
      setChatInput("");
      toast.success(`AI 根据你的描述生成了 ${newCards.length} 张灵感卡片`);
    } catch (e: any) { toast.error(e.message || "对话发散失败"); }
    finally { setChatLoading(false); }
  }, [analysis, chatInput, chatExpandMut]);

  const copyText = useCallback((text: string) => { navigator.clipboard.writeText(text); toast.success("已复制到剪贴板"); }, []);
  const copyAllPrompts = useCallback(() => {
    const all = [analysis?.prompt, ...filteredCards.map(c => `${c.promptCn}\n${c.prompt}`)].filter(Boolean).join("\n\n---\n\n");
    copyText(all);
  }, [analysis, filteredCards, copyText]);
  const handleClear = useCallback(() => { setImagePreview(null); setAnalysis(null); setAllCards([]); setActiveFilter("all"); }, []);
  const toggleSave = useCallback((id: string) => {
    setAllCards(prev => prev.map(c => c.id === id ? { ...c, saved: !c.saved } : c));
  }, []);

  const handleCardDragStart = useCallback((idx: number) => { setDragIdx(idx); }, []);
  const handleCardDragOver = useCallback((e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); }, []);
  const handleCardDrop = useCallback((targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    // reorder within filtered view, then map back
    const newFiltered = [...filteredCards];
    const [moved] = newFiltered.splice(dragIdx, 1);
    newFiltered.splice(targetIdx, 0, moved);
    // rebuild allCards: replace filtered subset with reordered, keep others
    const filteredIds = new Set(newFiltered.map(c => c.id));
    const others = allCards.filter(c => !filteredIds.has(c.id));
    setAllCards([...newFiltered, ...others]);
    setDragIdx(null); setDragOverIdx(null);
  }, [dragIdx, filteredCards, allCards]);

  const restoreHistory = useCallback((item: HistoryItem) => {
    setAnalysis(item.analysis); setAllCards(item.cards); setActiveFilter("all"); setShowHistory(false);
    if (item.imagePreview) { setImagePreview(item.imagePreview); }
    toast.success("已恢复历史记录");
  }, []);
  const deleteHistory = useCallback((id: string) => {
    const updated = history.filter(h => h.id !== id); setHistory(updated); saveHistory(updated);
  }, [history]);

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
            <h1 className="font-display text-2xl font-bold">灵感工坊</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">上传图片提取 AI 绘图提示词，一键发散多维灵感变体</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setShowHistory(!showHistory)}>
            <Clock className="w-4 h-4" />历史记录
            {history.length > 0 && <span className="ml-1 text-xs bg-pink-100 text-pink-700 rounded-full px-1.5">{history.length}</span>}
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => setModelConfigOpen(true)}>
            <Settings2 className="w-4 h-4" />模型配置
          </Button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 mx-8 mb-6 overflow-auto">
        <div className="grid grid-cols-12 gap-6 h-full">
          {/* ═══ Left: Upload + Prompt ═══ */}
          <div className="col-span-4 flex flex-col gap-4 overflow-auto pr-1">
            {/* Upload */}
            <div
              className={cn("rounded-2xl border-2 border-dashed p-6 text-center transition-all cursor-pointer",
                imageDragging ? "border-pink-400 bg-pink-50" : imagePreview ? "border-gray-200 bg-white" : "border-gray-300 bg-gray-50 hover:border-pink-300 hover:bg-pink-50/30")}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setImageDragging(true); }}
              onDragLeave={() => setImageDragging(false)}
              onClick={() => !imagePreview && fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              {imagePreview ? (
                <div className="space-y-3">
                  <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-xl object-contain" />
                  <div className="flex items-center justify-center gap-2">
                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs"
                      onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                      <Upload className="w-3.5 h-3.5" />更换图片
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => { e.stopPropagation(); handleClear(); }}>
                      <Trash2 className="w-3.5 h-3.5" />清空
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-6">
                  <Image className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">点击上传或拖拽图片到此处</p>
                  <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG、WebP，最大 10MB</p>
                </div>
              )}
            </div>

            {imagePreview && !analysis && (
              <Button className="w-full rounded-xl gap-2 bg-pink-600 hover:bg-pink-700" onClick={handleAnalyze} disabled={analyzing}>
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {analyzing ? "AI 分析中..." : "提取提示词"}
              </Button>
            )}

            {/* Analysis Result */}
            {analysis && (
              <div className="rounded-2xl border bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />提示词提取结果
                  </h3>
                </div>

                {/* Chinese summary */}
                {analysis.summaryCn && (
                  <div className="bg-pink-50 rounded-xl p-3 border border-pink-100">
                    <p className="text-xs font-medium text-pink-600 mb-1">中文整合描述</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{analysis.summaryCn}</p>
                    <button className="mt-1.5 text-[10px] text-pink-500 hover:text-pink-700 flex items-center gap-0.5"
                      onClick={() => copyText(analysis.summaryCn)}>
                      <Copy className="w-2.5 h-2.5" />复制中文
                    </button>
                  </div>
                )}

                {/* English prompt */}
                <div className="bg-gray-50 rounded-xl p-3 border">
                  <p className="text-xs font-medium text-gray-500 mb-1.5">AI 绘图提示词（英文）</p>
                  <p className="text-sm text-gray-800 leading-relaxed font-mono">{analysis.prompt}</p>
                  <button className="mt-1.5 text-[10px] text-gray-500 hover:text-gray-700 flex items-center gap-0.5"
                    onClick={() => copyText(analysis.prompt)}>
                    <Copy className="w-2.5 h-2.5" />复制英文
                  </button>
                </div>

                {/* Dimension tags */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "主体", value: analysis.subject },
                    { label: "风格", value: analysis.style },
                    { label: "色彩", value: analysis.colorPalette },
                    { label: "构图", value: analysis.composition },
                    { label: "光影", value: analysis.lighting },
                    { label: "质感", value: analysis.texture },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                      <p className="text-[10px] font-medium text-gray-400 mb-0.5">{label}</p>
                      <p className="text-xs text-gray-700 leading-snug">{value}</p>
                    </div>
                  ))}
                </div>
                {analysis.details && (
                  <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                    <p className="text-[10px] font-medium text-gray-400 mb-0.5">细节</p>
                    <p className="text-xs text-gray-700 leading-snug">{analysis.details}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ═══ Right: Inspiration Cards ═══ */}
          <div className="col-span-8 flex flex-col gap-4 overflow-auto">
            {analysis && (
              <div className="rounded-2xl border bg-white p-4 space-y-3">
                {/* Chat bar */}
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-pink-500 shrink-0" />
                  <Input
                    placeholder="用自然语言描述你想要的灵感方向，如：加一些日式浮世绘风格、改成雨天夜景氛围..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !chatLoading) { e.preventDefault(); handleChatExpand(); } }}
                    className="rounded-xl text-sm h-9 flex-1"
                    disabled={chatLoading}
                  />
                  <Button size="sm" className="rounded-xl gap-1 bg-pink-600 hover:bg-pink-700 shrink-0 h-9 px-3"
                    onClick={handleChatExpand} disabled={chatLoading || !chatInput.trim()}>
                    {chatLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  </Button>
                </div>

                {/* Filter tabs + expand controls */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-sm flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-pink-500" />灵感发散
                    </h3>
                    {/* Filter tabs */}
                    <div className="flex gap-1">
                      {(["all", "style", "composition", "mood"] as const).map((f) => {
                        const count = catCounts[f];
                        const isActive = activeFilter === f;
                        return (
                          <button key={f} onClick={() => setActiveFilter(f)}
                            className={cn("px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
                              isActive ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-400")}>
                            {f === "all" ? "全部" : CATEGORY_MAP[f].label}
                            {count > 0 && <span className={cn("ml-1", isActive ? "text-gray-300" : "text-gray-400")}>{count}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {allCards.length > 0 && (
                      <Button size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs h-7" onClick={copyAllPrompts}>
                        <Copy className="w-3 h-3" />复制全部
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expand row */}
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <span className="text-xs text-gray-400 shrink-0">批量生成：</span>
                  <div className="flex gap-1">
                    {(["all", "style", "composition", "mood"] as const).map((m) => (
                      <button key={m} onClick={() => setExpandMode(m)}
                        className={cn("px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                          expandMode === m ? "bg-pink-600 text-white border-pink-600" : "bg-white text-gray-500 border-gray-200 hover:border-pink-300")}>
                        {m === "all" ? "全部" : CATEGORY_MAP[m].label}
                      </button>
                    ))}
                  </div>
                  <Button className="rounded-xl gap-1.5 ml-auto bg-pink-600 hover:bg-pink-700 h-7 text-xs" size="sm"
                    onClick={handleExpand} disabled={expanding}>
                    {expanding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    {expanding ? "发散中..." : "生成灵感"}
                  </Button>
                </div>
              </div>
            )}

            {/* Cards grid */}
            {filteredCards.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {filteredCards.map((card, idx) => {
                  const cat = CATEGORY_MAP[card.category] || CATEGORY_MAP.style;
                  return (
                    <div key={card.id} draggable
                      onDragStart={() => handleCardDragStart(idx)}
                      onDragOver={(e) => handleCardDragOver(e, idx)}
                      onDrop={() => handleCardDrop(idx)}
                      onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                      className={cn(
                        "rounded-2xl border p-4 bg-white transition-all hover:shadow-md cursor-grab active:cursor-grabbing relative",
                        dragOverIdx === idx && "ring-2 ring-pink-300",
                        dragIdx === idx && "opacity-50"
                      )}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3.5 h-3.5 text-gray-300" />
                          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", cat.bg, cat.color)}>{cat.label}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <button className="p-1 text-gray-400 hover:text-pink-500 transition-colors"
                            onClick={() => toggleSave(card.id)} title={card.saved ? "取消收藏" : "收藏"}>
                            {card.saved ? <BookmarkCheck className="w-3.5 h-3.5 text-pink-500" /> : <Bookmark className="w-3.5 h-3.5" />}
                          </button>
                          <button className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                            onClick={() => copyText(`${card.promptCn || card.description}\n\n${card.prompt}`)} title="复制中英文提示词">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h4 className="font-semibold text-sm mb-1">{card.title}</h4>
                      <p className="text-xs text-gray-500 mb-2">{card.description}</p>
                      {/* Chinese prompt with hover tooltip */}
                      <div className="relative group/cn mb-1.5">
                        <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-[10px] font-medium text-gray-400">中文提示词</p>
                            <button className="text-[10px] text-gray-400 hover:text-blue-500 flex items-center gap-0.5 opacity-0 group-hover/cn:opacity-100 transition-opacity"
                              onClick={() => copyText(card.promptCn || card.description)}>
                              <Copy className="w-2.5 h-2.5" />复制
                            </button>
                          </div>
                          <p className="text-[11px] text-gray-700 leading-relaxed line-clamp-3">{card.promptCn || card.description}</p>
                        </div>
                        {(card.promptCn || card.description).length > 50 && (
                          <div className="pointer-events-none absolute z-50 left-0 right-0 top-full mt-1 bg-gray-900 text-white rounded-xl p-3 shadow-xl max-h-40 overflow-auto invisible group-hover/cn:visible opacity-0 group-hover/cn:opacity-100 transition-all duration-150">
                            <p className="text-[10px] font-medium text-gray-300 mb-1">完整中文提示词</p>
                            <p className="text-xs leading-relaxed">{card.promptCn || card.description}</p>
                          </div>
                        )}
                      </div>
                      {/* English prompt with hover tooltip */}
                      <div className="relative group/en">
                        <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-[10px] font-medium text-gray-400">English Prompt</p>
                            <button className="text-[10px] text-gray-400 hover:text-blue-500 flex items-center gap-0.5 opacity-0 group-hover/en:opacity-100 transition-opacity"
                              onClick={() => copyText(card.prompt)}>
                              <Copy className="w-2.5 h-2.5" />复制
                            </button>
                          </div>
                          <p className="text-[11px] text-gray-600 font-mono leading-relaxed line-clamp-2">{card.prompt}</p>
                        </div>
                        {card.prompt.length > 50 && (
                          <div className="pointer-events-none absolute z-50 left-0 right-0 top-full mt-1 bg-gray-900 text-white rounded-xl p-3 shadow-xl invisible group-hover/en:visible opacity-0 group-hover/en:opacity-100 transition-all duration-150">
                            <p className="text-[10px] font-medium text-gray-300 mb-1">完整英文提示词</p>
                            <p className="text-xs font-mono leading-relaxed break-all">{card.prompt}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : analysis ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <Sparkles className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">{allCards.length > 0 ? "当前分类暂无卡片，试试切换其他分类" : "点击「生成灵感」或输入描述开始创意发散"}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <Image className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">上传图片后开始提取提示词</p>
              </div>
            )}
          </div>
        </div>

        {/* History Panel */}
        {showHistory && (
          <div className="fixed inset-0 bg-black/20 z-50" onClick={() => setShowHistory(false)}>
            <div className="absolute right-0 top-0 h-full w-96 bg-white shadow-xl p-6 overflow-auto"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">历史记录</h3>
                <Button size="sm" variant="ghost" onClick={() => setShowHistory(false)}>关闭</Button>
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">暂无历史记录</p>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="rounded-xl border p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => restoreHistory(item)}>
                      <div className="flex gap-3">
                        {item.imagePreview && (
                          <img src={item.imagePreview} alt="历史图片" className="w-14 h-14 rounded-lg object-cover shrink-0 border border-gray-100" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-400">{new Date(item.timestamp).toLocaleString("zh-CN")}</span>
                            <button className="text-gray-300 hover:text-red-500 transition-colors"
                              onClick={(e) => { e.stopPropagation(); deleteHistory(item.id); }}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2 font-mono">{item.prompt}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{item.cards.length} 张灵感卡片</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <ModelConfigDialog open={modelConfigOpen} onOpenChange={setModelConfigOpen} />
    </div>
  );
}