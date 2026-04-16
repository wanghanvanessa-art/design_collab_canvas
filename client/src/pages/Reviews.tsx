import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Upload, Loader2, Star, CheckCircle, AlertCircle, X, GitCompare, Image as ImageIcon, Trash2, Layers, BarChart3, Sparkles, Settings } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { ModelConfigDialog } from "@/components/ModelConfigDialog";

function ScoreRing({ score, label, color }: { score: number; label: string; color: string }) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
          <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-foreground">{Math.round(score)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center leading-tight">{label}</p>
    </div>
  );
}

export default function Reviews() {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: reviews, isLoading } = trpc.reviews.list.useQuery(undefined, {
    refetchInterval: (query) => {
      // Auto-refresh when any review is still in "reviewing" status
      const data = query.state.data;
      if (data?.some((r) => r.status === "reviewing")) return 2000;
      return false;
    },
  });
  const { data: detail } = trpc.reviews.get.useQuery({ id: selectedId! }, {
    enabled: !!selectedId,
    refetchInterval: (query) => {
      // Poll every 2s while the selected review is still being processed
      const data = query.state.data;
      if (data && (data.status === "reviewing" || data.status === "uploading")) return 2000;
      return false;
    },
  });
  const { data: versions } = trpc.reviews.versions.useQuery({ id: selectedId! }, { enabled: !!selectedId });

  const upload = trpc.reviews.upload.useMutation({
    onSuccess: () => {
      toast.success("设计稿已上传，AI 正在评审中...");
      setUploadOpen(false);
      setTitle("");
      setImageFiles([]);
      setImagePreviews([]);
      setMode("single");
      utils.reviews.list.invalidate();
    },
    onError: () => toast.error("上传失败"),
  });

  const remove = trpc.reviews.delete.useMutation({
    onSuccess: () => {
      toast.success("评审记录已删除");
      setSelectedId(null);
      utils.reviews.list.invalidate();
    },
    onError: () => toast.error("删除失败"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (mode === "single") {
      // Single mode: replace
      const file = files[0];
      setImageFiles([file]);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreviews([ev.target?.result as string]);
      reader.readAsDataURL(file);
    } else {
      // Compare mode: accumulate up to 10
      const newFiles = [...imageFiles, ...files].slice(0, 10);
      setImageFiles(newFiles);
      // Generate previews
      const previews: string[] = [...imagePreviews];
      const startIdx = imagePreviews.length;
      let loaded = 0;
      const filesToRead = files.slice(0, 10 - imageFiles.length);
      if (filesToRead.length === 0) return;
      filesToRead.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          previews.push(ev.target?.result as string);
          loaded++;
          if (loaded === filesToRead.length) {
            setImagePreviews(previews.slice(0, 10));
          }
        };
        reader.readAsDataURL(file);
      });
    }
    // Reset file input
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (idx: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!title.trim()) { toast.error("请输入方案标题"); return; }
    if (imageFiles.length === 0) { toast.error("请选择设计稿图片"); return; }
    if (mode === "compare" && imageFiles.length < 2) { toast.error("竞品对比至少需要 2 张图片"); return; }
    for (const f of imageFiles) {
      if (f.size > 16 * 1024 * 1024) {
        toast.error(`图片"${f.name}"过大（>16MB），请压缩后再上传`);
        return;
      }
    }
    setUploading(true);
    try {
      const designUrls: string[] = [];
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch("/api/upload/image", { method: "POST", body: formData });
        if (!res.ok) {
          let msg = `上传失败（${res.status}）`;
          try { const err = await res.json(); if (err?.error) msg = err.error; } catch {}
          throw new Error(msg);
        }
        const data = await res.json();
        const url = data?.url as string | undefined;
        if (!url) throw new Error("上传失败：未返回图片地址");
        designUrls.push(url);
      }
      await upload.mutateAsync({ title, designUrls, mode });
    } catch (e: any) {
      toast.error(e instanceof Error ? e.message : "上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#22c55e";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { label: "优秀", class: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    if (score >= 60) return { label: "良好", class: "bg-amber-100 text-amber-700 border-amber-200" };
    return { label: "待改进", class: "bg-red-100 text-red-700 border-red-200" };
  };

  return (
    <>
      <div className="pb-8">
      <BackButton />
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <h1 className="font-display text-2xl font-700">方案智能评审</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">上传设计稿，AI 从产品功能、交互体验、设计样式三维度自动评审</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl gap-2" onClick={() => setConfigOpen(true)}>
              <Settings className="w-4 h-4" />
              模型配置
            </Button>
          <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) { setImageFiles([]); setImagePreviews([]); setMode("single"); setTitle(""); } }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2"><Upload className="w-4 h-4" />上传设计稿</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-lg">
              <DialogHeader><DialogTitle className="font-display">上传设计稿</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Mode Selector */}
                <div className="flex gap-2">
                  <button
                    className={cn("flex-1 p-3 rounded-xl border-2 transition-all text-left", mode === "single" ? "border-indigo-400 bg-indigo-50" : "border-border hover:border-indigo-200")}
                    onClick={() => { setMode("single"); setImageFiles([]); setImagePreviews([]); }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <ImageIcon className="w-4 h-4 text-indigo-600" />
                      <span className="text-sm font-medium">单图深度分析</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">上传单张设计稿，三维度深度评审</p>
                  </button>
                  <button
                    className={cn("flex-1 p-3 rounded-xl border-2 transition-all text-left", mode === "compare" ? "border-violet-400 bg-violet-50" : "border-border hover:border-violet-200")}
                    onClick={() => { setMode("compare"); setImageFiles([]); setImagePreviews([]); }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Layers className="w-4 h-4 text-violet-600" />
                      <span className="text-sm font-medium">多图竞品对比</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">上传 2-10 张设计稿横向对比</p>
                  </button>
                </div>

                <Input placeholder="方案标题" value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl" />

                {/* Image Upload Area */}
                <div
                  className="border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept="image/*" multiple={mode === "compare"} className="hidden" onChange={handleFileChange} />
                  {imagePreviews.length > 0 ? (
                    <div className="p-3">
                      <div className={cn("grid gap-2", imagePreviews.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                        {imagePreviews.map((p, i) => (
                          <div key={i} className="relative group">
                            <img src={p} alt={`preview-${i}`} className="w-full h-32 object-contain rounded-lg bg-gray-50 border" />
                            <button
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                            >
                              <X className="w-3 h-3" />
                            </button>
                            {mode === "compare" && (
                              <span className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">方案 {String.fromCharCode(65 + i)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {mode === "compare" && imageFiles.length < 10 && (
                        <p className="text-[10px] text-muted-foreground text-center mt-2">点击继续添加图片（已选 {imageFiles.length}/10）</p>
                      )}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">{mode === "single" ? "点击上传设计稿图片" : "点击上传多张设计稿图片进行对比"}</p>
                      <p className="text-xs text-muted-foreground mt-1">支持 PNG、JPG、WebP{mode === "compare" ? "（2-10 张）" : ""}</p>
                    </div>
                  )}
                </div>

                {/* Dimension Tags */}
                <div className="p-3 rounded-xl bg-indigo-50 text-indigo-700">
                  <p className="text-xs font-medium mb-1">AI 评审维度</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["综合总览", "产品功能", "交互体验", "设计样式"].map(d => (
                      <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{d}</span>
                    ))}
                    {mode === "compare" && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">竞品对比</span>}
                  </div>
                </div>

                <Button className="w-full rounded-xl" onClick={handleUpload} disabled={uploading || upload.isPending}>
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />上传中...</> : mode === "single" ? "开始 AI 深度分析" : "开始 AI 竞品对比"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* List */}
        <div className="xl:col-span-1 space-y-3">
          <h2 className="font-display text-sm font-600 text-muted-foreground uppercase tracking-wider mb-3">评审记录</h2>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : reviews?.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无评审记录</p>
            </div>
          ) : (
            reviews?.map((r) => {
              const badge = r.overallScore ? getScoreBadge(r.overallScore) : null;
              return (
                <div
                  key={r.id}
                  className={cn("p-4 rounded-2xl border bg-card cursor-pointer hover:shadow-md transition-all", selectedId === r.id && "ring-2 ring-indigo-200 shadow-md")}
                  onClick={() => setSelectedId(selectedId === r.id ? null : r.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-sm text-foreground leading-tight">{r.title}</h3>
                    {badge ? (
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", badge.class)}>{badge.label}</Badge>
                    ) : (
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", {
                        "border-indigo-200 text-indigo-600 bg-indigo-50": r.status === "reviewing",
                        "border-gray-200 text-gray-500": r.status === "uploading",
                      })}>
                        {r.status === "reviewing" ? "评审中" : "上传中"}
                      </Badge>
                    )}
                  </div>
                  {r.overallScore && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-bold text-foreground">{Math.round(r.overallScore)}</span>
                      <span className="text-xs text-muted-foreground">/ 100</span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.createdAt).toLocaleDateString("zh-CN")}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Detail */}
        <div className="xl:col-span-2">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
              <ClipboardCheck className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">选择左侧评审记录查看详情</p>
            </div>
          ) : detail ? (
            <div className="p-6 rounded-2xl border bg-card animate-slide-up">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="font-display text-lg font-600">{detail.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">v{detail.version} · {new Date(detail.createdAt).toLocaleDateString("zh-CN")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl gap-1.5 text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      if (!window.confirm("确定删除该评审记录吗？删除后无法恢复。")) return;
                      remove.mutate({ id: detail.id });
                    }}
                    disabled={remove.isPending}
                  >
                    {remove.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    删除
                  </Button>
                  <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {detail.status === "reviewing" && (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p className="text-sm">AI 正在评审中...</p>
                </div>
              )}

              {detail.status === "error" && (
                <div className="flex flex-col items-center justify-center gap-3 py-12">
                  <AlertCircle className="w-10 h-10 text-red-400" />
                  <p className="text-sm font-medium text-red-600">AI 评审失败</p>
                  {(detail as any).overview && (
                    <p className="text-xs text-muted-foreground text-center max-w-sm">{(detail as any).overview}</p>
                  )}
                  {(detail as any).suggestions?.length > 0 && (
                    <p className="text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg">{(detail as any).suggestions[0]}</p>
                  )}
                  <Button size="sm" variant="outline" className="rounded-xl gap-2 mt-1" onClick={() => setConfigOpen(true)}>
                    <Settings className="w-3.5 h-3.5" />配置 AI 模型
                  </Button>
                </div>
              )}

              {detail.status === "done" && detail.overallScore != null && (
                <>
                  {/* Score Overview */}
                  <div className="flex items-center justify-around p-5 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 mb-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-foreground">{Math.round(detail.overallScore)}</p>
                      <p className="text-xs text-muted-foreground mt-1">综合评分</p>
                    </div>
                    <div className="w-px h-12 bg-border" />
                    {detail.businessLogicScore && <ScoreRing score={detail.businessLogicScore} label="产品功能" color={getScoreColor(detail.businessLogicScore)} />}
                    {detail.interactionScore && <ScoreRing score={detail.interactionScore} label="交互体验" color={getScoreColor(detail.interactionScore)} />}
                    {detail.accessibilityScore && <ScoreRing score={detail.accessibilityScore} label="设计样式" color={getScoreColor(detail.accessibilityScore)} />}
                  </div>

                  {/* Overview Section */}
                  {(detail as any).overview && (
                    <div className="mb-4 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-sm font-medium text-indigo-900">综合总览</h3>
                      </div>
                      <p className="text-sm text-indigo-800">{(detail as any).overview}</p>
                    </div>
                  )}

                  {/* Highlights & Issues */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {(detail as any).highlights?.length > 0 && (
                      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <h3 className="text-sm font-medium text-emerald-900">核心亮点</h3>
                        </div>
                        <ul className="space-y-1.5">
                          {(detail as any).highlights.map((h: string, i: number) => (
                            <li key={i} className="text-sm text-emerald-800 flex items-start gap-1.5">
                              <span className="text-emerald-600 mt-0.5">•</span>
                              {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(detail as any).issues?.length > 0 && (
                      <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-600" />
                          <h3 className="text-sm font-medium text-red-900">主要问题</h3>
                        </div>
                        <ul className="space-y-1.5">
                          {(detail as any).issues.map((issue: string, i: number) => (
                            <li key={i} className="text-sm text-red-800 flex items-start gap-1.5">
                              <span className="text-red-600 mt-0.5">•</span>
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Design Images */}
                  {(detail.designUrl || (detail as any).designUrls?.length > 0) && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-muted-foreground" />
                        设计稿图片
                      </h3>
                      <div className={cn("grid gap-3", ((detail as any).designUrls?.length || 1) === 1 ? "grid-cols-1" : "grid-cols-2")}>
                        {((detail as any).designUrls || [detail.designUrl]).map((url: string, i: number) => (
                          <div key={i} className="relative rounded-xl overflow-hidden border border-border">
                            <img src={url} alt={`design-${i}`} className="w-full h-48 object-contain bg-gray-50" />
                            {((detail as any).designUrls?.length || 1) > 1 && (
                              <span className="absolute top-2 left-2 text-xs px-2 py-1 rounded bg-black/60 text-white">方案 {String.fromCharCode(65 + i)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Review Comments */}
                  {(detail.reviewComments as any[])?.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        维度评审意见
                      </h3>
                      <div className="space-y-3">
                        {(detail.reviewComments as any[]).map((rc, i) => (
                          <div key={i} className="p-4 rounded-xl bg-muted/40 border border-border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">{rc.dimension}</span>
                              <span className="text-sm font-bold" style={{ color: getScoreColor(rc.score) }}>{Math.round(rc.score)}分</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{rc.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {(detail.suggestions as string[])?.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-muted-foreground" />
                        优化建议
                      </h3>
                      <div className="space-y-3">
                        {(detail.suggestions as string[]).map((s, i) => (
                          <div key={i} className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                            <p className="text-sm text-emerald-800">{s}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Version History */}
              {versions && versions.length > 1 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5">
                    <GitCompare className="w-3.5 h-3.5" />历史版本对比
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {versions.map((v) => (
                      <div key={v.id} className={cn("shrink-0 p-3 rounded-xl border cursor-pointer hover:border-indigo-200 transition-colors", selectedId === v.id && "border-indigo-300 bg-indigo-50")} onClick={() => setSelectedId(v.id)}>
                        <p className="text-xs font-medium">v{v.version}</p>
                        {v.overallScore && <p className="text-xs text-indigo-600 font-bold">{Math.round(v.overallScore)}分</p>}
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(v.createdAt).toLocaleDateString("zh-CN")}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          )}
        </div>
      </div>
    </div>
      <ModelConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
    </>
  );
}