import { openLoginModal } from "@/lib/loginModal";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Lightbulb, Plus, MessageCircle, Heart, Loader2, ArrowRight } from "lucide-react";
import { BackButton } from "@/components/BackButton";

export default function Ideas() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [newIdea, setNewIdea] = useState({ title: "", content: "", tags: "" });
  const utils = trpc.useUtils();

  const { data: ideas, isLoading } = trpc.ideas.list.useQuery(undefined, { enabled: isAuthenticated });

  const createIdea = trpc.ideas.create.useMutation({
    onSuccess: () => {
      toast.success("想法已发布！");
      setCreateOpen(false);
      setNewIdea({ title: "", content: "", tags: "" });
      utils.ideas.list.invalidate();
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Lightbulb className="w-12 h-12 text-amber-400" />
        <h2 className="font-display text-xl font-600">请先登录</h2>
        <Button onClick={openLoginModal}>登录使用</Button>
      </div>
    );
  }

  const tagColors = ["bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-sky-100 text-sky-700", "bg-pink-100 text-pink-700"];

  return (
    <div className="pb-8">
      <BackButton />
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
        <div className="xl:col-span-3">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : ideas?.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>还没有想法，来发布第一个吧！</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {ideas?.map((idea, i) => (
                <div
                  key={idea.id}
                  className="p-5 rounded-2xl border bg-card hover:shadow-md transition-all animate-slide-up group"
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-display font-600 text-sm text-foreground leading-tight">{idea.title}</h3>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", idea.status === "published" ? "border-emerald-200 text-emerald-600" : "border-gray-200 text-gray-500")}>
                      {idea.status === "published" ? "讨论中" : "草稿"}
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
                  <button
                    className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs text-amber-600 hover:bg-amber-50 transition-colors border border-amber-200 opacity-0 group-hover:opacity-100"
                    onClick={() => navigate(`/ideas/${idea.id}`)}
                  >
                    进入详情 <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
