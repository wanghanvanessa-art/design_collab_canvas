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
import { Lightbulb, Plus, MessageCircle, Download, Heart, Loader2, ArrowRight, Send, X } from "lucide-react";

export default function Ideas() {
  const { isAuthenticated, user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState<number | null>(null);
  const [newIdea, setNewIdea] = useState({ title: "", content: "", tags: "" });
  const [comment, setComment] = useState("");
  const utils = trpc.useUtils();

  const { data: ideas, isLoading } = trpc.ideas.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: ideaDetail } = trpc.ideas.get.useQuery({ id: selectedIdea! }, { enabled: !!selectedIdea });
  const { data: comments } = trpc.ideas.comments.useQuery({ ideaId: selectedIdea! }, { enabled: !!selectedIdea });

  const createIdea = trpc.ideas.create.useMutation({
    onSuccess: () => {
      toast.success("想法已发布！");
      setCreateOpen(false);
      setNewIdea({ title: "", content: "", tags: "" });
      utils.ideas.list.invalidate();
    },
  });

  const addComment = trpc.ideas.addComment.useMutation({
    onSuccess: () => {
      setComment("");
      utils.ideas.comments.invalidate({ ideaId: selectedIdea! });
      utils.ideas.list.invalidate();
    },
  });

  const exportIdea = trpc.ideas.export.useMutation({
    onSuccess: (data) => {
      const blob = new Blob([data.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${data.title}.${data.format}`; a.click();
      toast.success(`已导出为 ${data.format.toUpperCase()} 格式`);
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Lightbulb className="w-12 h-12 text-amber-400" />
        <h2 className="font-display text-xl font-600">请先登录</h2>
        <a href={getLoginUrl()}><Button>登录使用</Button></a>
      </div>
    );
  }

  const tagColors = ["bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-sky-100 text-sky-700", "bg-pink-100 text-pink-700"];

  return (
    <div className="pb-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-amber-600" />
            </div>
            <h1 className="font-display text-2xl font-700">想法落地页</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">发布创意想法，团队实时评论互动，多格式导出交付</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2"><Plus className="w-4 h-4" />发布想法</Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-lg">
            <DialogHeader><DialogTitle className="font-display">发布新想法</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <Input placeholder="想法标题" value={newIdea.title} onChange={e => setNewIdea(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
              <Textarea placeholder="详细描述你的想法..." value={newIdea.content} onChange={e => setNewIdea(p => ({ ...p, content: e.target.value }))} className="rounded-xl min-h-32 resize-none" />
              <Input placeholder="标签（用逗号分隔，如：交互设计,用户体验）" value={newIdea.tags} onChange={e => setNewIdea(p => ({ ...p, tags: e.target.value }))} className="rounded-xl" />
              <Button className="w-full rounded-xl" onClick={() => createIdea.mutate({ title: newIdea.title, content: newIdea.content, tags: newIdea.tags.split(",").map(t => t.trim()).filter(Boolean) })} disabled={createIdea.isPending}>
                {createIdea.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}发布想法
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Ideas Grid */}
        <div className={cn("space-y-4", selectedIdea ? "xl:col-span-2" : "xl:col-span-3")}>
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : ideas?.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>还没有想法，来发布第一个吧！</p>
            </div>
          ) : (
            <div className={cn("grid gap-4", selectedIdea ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3")}>
              {ideas?.map((idea, i) => (
                <div
                  key={idea.id}
                  className={cn("p-5 rounded-2xl border bg-card cursor-pointer hover:shadow-md transition-all animate-slide-up", selectedIdea === idea.id && "ring-2 ring-primary/30 shadow-md")}
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
                  onClick={() => setSelectedIdea(selectedIdea === idea.id ? null : idea.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-display font-600 text-sm text-foreground leading-tight">{idea.title}</h3>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", idea.status === "published" ? "border-emerald-200 text-emerald-600" : "border-gray-200 text-gray-500")}>
                      {idea.status === "published" ? "已发布" : "草稿"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-3">{idea.content}</p>
                  {(idea.tags as string[])?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {(idea.tags as string[]).slice(0, 3).map((tag, ti) => (
                        <span key={tag} className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", tagColors[ti % tagColors.length])}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1 text-xs"><MessageCircle className="w-3.5 h-3.5" />{idea.commentsCount}</span>
                    <span className="flex items-center gap-1 text-xs"><Heart className="w-3.5 h-3.5" />{idea.likesCount}</span>
                    <span className="ml-auto text-[10px]">{new Date(idea.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedIdea && ideaDetail && (
          <div className="xl:col-span-1">
            <div className="sticky top-8 p-5 rounded-2xl border bg-card animate-slide-in-right">
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-display font-600 text-sm">{ideaDetail.title}</h3>
                <button onClick={() => setSelectedIdea(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">{ideaDetail.content}</p>

              {/* Export */}
              <div className="mb-4">
                <p className="text-xs font-medium text-foreground mb-2">导出格式</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {["pdf", "word", "blog", "markdown"].map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => exportIdea.mutate({ id: selectedIdea, format: fmt as any })}
                      className="flex items-center gap-1.5 p-2 rounded-lg border border-border hover:bg-accent/50 transition-colors text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Download className="w-3 h-3" />
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div>
                <p className="text-xs font-medium text-foreground mb-2">评论 ({comments?.length || 0})</p>
                <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                  {comments?.map((c) => (
                    <div key={c.id} className="p-2.5 rounded-xl bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">设计师</p>
                      <p className="text-xs text-foreground">{c.content}</p>
                    </div>
                  ))}
                  {(!comments || comments.length === 0) && (
                    <p className="text-xs text-muted-foreground text-center py-4">暂无评论，来发表第一条吧</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="发表评论..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    className="rounded-xl text-xs h-8"
                    onKeyDown={e => { if (e.key === "Enter" && comment.trim()) addComment.mutate({ ideaId: selectedIdea, content: comment }); }}
                  />
                  <Button size="icon" className="h-8 w-8 rounded-xl shrink-0" onClick={() => comment.trim() && addComment.mutate({ ideaId: selectedIdea, content: comment })}>
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
