import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Users, Plus, Sparkles, Loader2, Tag, AlertTriangle, Lightbulb, X, ChevronRight } from "lucide-react";

export default function Interviews() {
  const { isAuthenticated } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState({ title: "", interviewee: "", content: "", date: "" });
  const utils = trpc.useUtils();

  const { data: interviews, isLoading } = trpc.interviews.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: detail } = trpc.interviews.get.useQuery({ id: selectedId! }, { enabled: !!selectedId });

  const create = trpc.interviews.create.useMutation({
    onSuccess: () => {
      toast.success("访谈记录已创建");
      setCreateOpen(false);
      setForm({ title: "", interviewee: "", content: "", date: "" });
      utils.interviews.list.invalidate();
    },
  });

  const analyze = trpc.interviews.analyze.useMutation({
    onSuccess: () => {
      toast.success("AI 分析完成！");
      utils.interviews.get.invalidate({ id: selectedId! });
      utils.interviews.list.invalidate();
    },
    onError: () => toast.error("分析失败，请重试"),
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Users className="w-12 h-12 text-emerald-400" />
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
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <h1 className="font-display text-2xl font-700">用户访谈管理</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">全流程管理访谈记录，AI 分析人群标签并自动生成设计解决方案</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2"><Plus className="w-4 h-4" />新建访谈</Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-lg">
            <DialogHeader><DialogTitle className="font-display">新建访谈记录</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="访谈主题" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
              <Input placeholder="受访者姓名/角色" value={form.interviewee} onChange={e => setForm(p => ({ ...p, interviewee: e.target.value }))} className="rounded-xl" />
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="rounded-xl" />
              <Textarea placeholder="访谈内容记录..." value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} className="rounded-xl min-h-40 resize-none" />
              <Button className="w-full rounded-xl" onClick={() => create.mutate({ title: form.title, interviewee: form.interviewee, content: form.content, date: form.date || undefined })} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}创建访谈
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* List */}
        <div className="xl:col-span-1 space-y-3">
          <h2 className="font-display text-sm font-600 text-muted-foreground uppercase tracking-wider mb-3">访谈记录</h2>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : interviews?.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">暂无访谈记录</p>
            </div>
          ) : (
            interviews?.map((iv) => (
              <div
                key={iv.id}
                className={cn("p-4 rounded-2xl border bg-card cursor-pointer hover:shadow-md transition-all", selectedId === iv.id && "ring-2 ring-emerald-200 shadow-md")}
                onClick={() => setSelectedId(selectedId === iv.id ? null : iv.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm text-foreground">{iv.title}</h3>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", {
                    "border-emerald-200 text-emerald-600 bg-emerald-50": iv.status === "done",
                    "border-amber-200 text-amber-600 bg-amber-50": iv.status === "analyzing",
                    "border-gray-200 text-gray-500": iv.status === "draft",
                  })}>
                    {iv.status === "done" ? "✓ 已分析" : iv.status === "analyzing" ? "分析中" : "草稿"}
                  </Badge>
                </div>
                {iv.interviewee && <p className="text-xs text-muted-foreground mt-1">受访者：{iv.interviewee}</p>}
                {iv.date && <p className="text-xs text-muted-foreground">{iv.date}</p>}
                {(iv.audienceLabels as string[])?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(iv.audienceLabels as string[]).slice(0, 3).map((label) => (
                      <span key={label} className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{label}</span>
                    ))}
                  </div>
                )}
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground mt-2 ml-auto" />
              </div>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="xl:col-span-2">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
              <Users className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">选择左侧访谈记录查看详情</p>
            </div>
          ) : detail ? (
            <div className="p-6 rounded-2xl border bg-card animate-slide-up">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-display text-lg font-600">{detail.title}</h2>
                  {detail.interviewee && <p className="text-sm text-muted-foreground mt-0.5">受访者：{detail.interviewee}</p>}
                </div>
                <div className="flex gap-2">
                  {detail.status === "draft" && (
                    <Button
                      size="sm"
                      className="rounded-xl gap-1.5"
                      onClick={() => analyze.mutate({ id: detail.id })}
                      disabled={analyze.isPending}
                    >
                      {analyze.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      AI 分析
                    </Button>
                  )}
                  <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 rounded-xl bg-muted/40 mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">访谈内容</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{detail.content || "暂无内容"}</p>
              </div>

              {/* Analysis Results */}
              {detail.status === "done" && (
                <div className="space-y-4">
                  {/* Audience Labels */}
                  {(detail.audienceLabels as string[])?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Tag className="w-4 h-4 text-emerald-600" />
                        <p className="text-sm font-medium">人群标签</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(detail.audienceLabels as string[]).map((label) => (
                          <span key={label} className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">{label}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pain Points */}
                  {(detail.painPoints as string[])?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <p className="text-sm font-medium">用户痛点</p>
                      </div>
                      <div className="space-y-2">
                        {(detail.painPoints as string[]).map((point, i) => (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
                            <span className="text-amber-600 text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                            <p className="text-xs text-amber-800">{point}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Design Solutions */}
                  {(detail.designSolutions as string[])?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-violet-600" />
                        <p className="text-sm font-medium">设计解决方案建议</p>
                      </div>
                      <div className="space-y-2">
                        {(detail.designSolutions as string[]).map((sol, i) => (
                          <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-violet-50 border border-violet-100">
                            <Lightbulb className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-violet-800">{sol}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detail.status === "analyzing" && (
                <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <p className="text-sm">AI 正在分析中...</p>
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
