import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ClipboardCheck, Upload, Loader2, Star, CheckCircle, AlertCircle, Info, X, GitCompare, Image as ImageIcon } from "lucide-react";

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
  const { isAuthenticated } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: reviews, isLoading } = trpc.reviews.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: detail } = trpc.reviews.get.useQuery({ id: selectedId! }, { enabled: !!selectedId });
  const { data: versions } = trpc.reviews.versions.useQuery({ id: selectedId! }, { enabled: !!selectedId });

  const upload = trpc.reviews.upload.useMutation({
    onSuccess: () => {
      toast.success("设计稿已上传，AI 正在评审中...");
      setUploadOpen(false);
      setTitle("");
      setImageFile(null);
      setImagePreview(null);
      utils.reviews.list.invalidate();
    },
    onError: () => toast.error("上传失败"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!title.trim()) { toast.error("请输入方案标题"); return; }
    if (!imageFile) { toast.error("请选择设计稿图片"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      const res = await fetch("/api/upload/image", { method: "POST", body: formData });
      const { url } = await res.json();
      await upload.mutateAsync({ title, designUrl: url });
    } catch {
      toast.error("上传失败，请重试");
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

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <ClipboardCheck className="w-12 h-12 text-indigo-400" />
        <h2 className="font-display text-xl font-600">请先登录</h2>
        <a href={getLoginUrl()}><Button>登录使用</Button></a>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            </div>
            <h1 className="font-display text-2xl font-700">方案智能评审</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">上传设计稿，AI 从多维度自动评分并生成专业评审意见</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2"><Upload className="w-4 h-4" />上传设计稿</Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-lg">
            <DialogHeader><DialogTitle className="font-display">上传设计稿</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="方案标题" value={title} onChange={e => setTitle(e.target.value)} className="rounded-xl" />
              <div
                className="border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="w-full max-h-48 object-contain" />
                ) : (
                  <div className="p-8 text-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">点击上传设计稿图片</p>
                    <p className="text-xs text-muted-foreground mt-1">支持 PNG、JPG、WebP</p>
                  </div>
                )}
              </div>
              <div className="p-3 rounded-xl bg-indigo-50 text-indigo-700">
                <p className="text-xs font-medium mb-1">AI 评审维度</p>
                <div className="flex flex-wrap gap-1.5">
                  {["B端业务逻辑", "交互一致性", "Accessibility", "视觉层级", "信息密度"].map(d => (
                    <span key={d} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{d}</span>
                  ))}
                </div>
              </div>
              <Button className="w-full rounded-xl" onClick={handleUpload} disabled={uploading || upload.isPending}>
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />上传中...</> : "开始 AI 评审"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
                <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {detail.status === "reviewing" && (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p className="text-sm">AI 正在评审中...</p>
                </div>
              )}

              {detail.status === "done" && detail.overallScore && (
                <>
                  {/* Score Overview */}
                  <div className="flex items-center justify-around p-5 rounded-2xl bg-gradient-to-r from-indigo-50 to-violet-50 mb-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-foreground">{Math.round(detail.overallScore)}</p>
                      <p className="text-xs text-muted-foreground mt-1">综合评分</p>
                    </div>
                    <div className="w-px h-12 bg-border" />
                    {detail.businessLogicScore && <ScoreRing score={detail.businessLogicScore} label="业务逻辑" color={getScoreColor(detail.businessLogicScore)} />}
                    {detail.interactionScore && <ScoreRing score={detail.interactionScore} label="交互一致性" color={getScoreColor(detail.interactionScore)} />}
                    {detail.accessibilityScore && <ScoreRing score={detail.accessibilityScore} label="无障碍性" color={getScoreColor(detail.accessibilityScore)} />}
                  </div>

                  {/* Design Image */}
                  {detail.designUrl && (
                    <div className="mb-4 rounded-xl overflow-hidden border border-border">
                      <img src={detail.designUrl} alt="design" className="w-full max-h-48 object-contain bg-gray-50" />
                    </div>
                  )}

                  {/* Review Comments */}
                  {(detail.reviewComments as any[])?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">维度评审意见</p>
                      <div className="space-y-2">
                        {(detail.reviewComments as any[]).map((rc, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/40">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <Info className="w-3.5 h-3.5 text-indigo-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">{rc.dimension}</span>
                                <span className="text-xs font-bold" style={{ color: getScoreColor(rc.score) }}>{Math.round(rc.score)}分</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{rc.comment}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggestions */}
                  {(detail.suggestions as string[])?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">优化建议</p>
                      <div className="space-y-2">
                        {(detail.suggestions as string[]).map((s, i) => (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-emerald-800">{s}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Version History */}
              {versions && versions.length > 1 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <GitCompare className="w-3.5 h-3.5" />历史版本对比
                  </p>
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
  );
}
