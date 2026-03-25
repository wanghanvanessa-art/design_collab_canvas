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
import { BookOpen, Plus, Search, Tag, Clock, Users, Edit3, Loader2, X, GitBranch, Save } from "lucide-react";

export default function Knowledge() {
  const { isAuthenticated } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [form, setForm] = useState({ title: "", content: "", tags: "", category: "" });
  const utils = trpc.useUtils();

  const { data: articles, isLoading } = trpc.knowledge.list.useQuery({ search: searchQuery || undefined }, { enabled: isAuthenticated });
  const { data: detail } = trpc.knowledge.get.useQuery({ id: selectedId! }, { enabled: !!selectedId });
  const { data: versions } = trpc.knowledge.versions.useQuery({ id: selectedId! }, { enabled: !!selectedId });

  const create = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      toast.success("知识条目已创建");
      setCreateOpen(false);
      setForm({ title: "", content: "", tags: "", category: "" });
      utils.knowledge.list.invalidate();
    },
  });

  const update = trpc.knowledge.update.useMutation({
    onSuccess: () => {
      toast.success("已保存新版本");
      setEditMode(false);
      utils.knowledge.get.invalidate({ id: selectedId! });
      utils.knowledge.versions.invalidate({ id: selectedId! });
    },
  });

  const categoryColors: Record<string, string> = {
    "交互设计": "bg-violet-100 text-violet-700",
    "视觉设计": "bg-pink-100 text-pink-700",
    "用户研究": "bg-emerald-100 text-emerald-700",
    "设计规范": "bg-sky-100 text-sky-700",
    "竞品分析": "bg-amber-100 text-amber-700",
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <BookOpen className="w-12 h-12 text-sky-400" />
        <h2 className="font-display text-xl font-600">请先登录</h2>
        <a href={getLoginUrl()}><Button>登录使用</Button></a>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-sky-600" />
            </div>
            <h1 className="font-display text-2xl font-700">设计知识库</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">沉淀调研成果，支持标签检索、版本对比与多人协作编辑</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl gap-2"><Plus className="w-4 h-4" />新建条目</Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-2xl">
            <DialogHeader><DialogTitle className="font-display">新建知识条目</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="条目标题" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
                <Input placeholder="分类（如：交互设计）" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="rounded-xl" />
              </div>
              <Input placeholder="标签（逗号分隔）" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="rounded-xl" />
              <Textarea placeholder="知识内容..." value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} className="rounded-xl min-h-48 resize-none" />
              <Button className="w-full rounded-xl" onClick={() => create.mutate({ title: form.title, content: form.content, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean), category: form.category })} disabled={create.isPending}>
                {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}创建条目
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="搜索知识库..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 rounded-xl"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* List */}
        <div className="xl:col-span-1 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : articles?.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{searchQuery ? "未找到相关内容" : "知识库还是空的"}</p>
            </div>
          ) : (
            articles?.map((article) => (
              <div
                key={article.id}
                className={cn("p-4 rounded-2xl border bg-card cursor-pointer hover:shadow-md transition-all", selectedId === article.id && "ring-2 ring-sky-200 shadow-md")}
                onClick={() => { setSelectedId(selectedId === article.id ? null : article.id); setEditMode(false); }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-sm text-foreground leading-tight">{article.title}</h3>
                  {article.category && (
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium", categoryColors[article.category] || "bg-gray-100 text-gray-600")}>
                      {article.category}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{article.content}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {(article.tags as string[])?.slice(0, 3).map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">{tag}</span>
                  ))}
                  <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />v{article.version}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail */}
        <div className="xl:col-span-2">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
              <BookOpen className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">选择左侧条目查看详情</p>
            </div>
          ) : detail ? (
            <div className="p-6 rounded-2xl border bg-card animate-slide-up">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-display text-lg font-600">{detail.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {detail.category && (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", categoryColors[detail.category] || "bg-gray-100 text-gray-600")}>
                        {detail.category}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <GitBranch className="w-3 h-3" />版本 {detail.version}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />{new Date(detail.updatedAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {editMode ? (
                    <>
                      <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => setEditMode(false)}>
                        <X className="w-3.5 h-3.5" />取消
                      </Button>
                      <Button size="sm" className="rounded-xl gap-1.5" onClick={() => update.mutate({ id: detail.id, content: editContent })} disabled={update.isPending}>
                        {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}保存
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={() => { setEditMode(true); setEditContent(detail.content); }}>
                      <Edit3 className="w-3.5 h-3.5" />编辑
                    </Button>
                  )}
                  <button onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tags */}
              {(detail.tags as string[])?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {(detail.tags as string[]).map((tag) => (
                    <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                      <Tag className="w-3 h-3" />{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Content */}
              {editMode ? (
                <Textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="rounded-xl min-h-64 resize-none text-sm"
                />
              ) : (
                <div className="p-4 rounded-xl bg-muted/30 min-h-32">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{detail.content}</p>
                </div>
              )}

              {/* Version History */}
              {versions && versions.length > 1 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5" />历史版本 ({versions.length})
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {versions.map((v) => (
                      <div key={v.id} className="shrink-0 p-2.5 rounded-xl border border-border bg-muted/30 min-w-32">
                        <p className="text-xs font-medium">v{v.version}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(v.updatedAt).toLocaleDateString("zh-CN")}</p>
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
