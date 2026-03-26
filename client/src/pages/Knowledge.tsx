import { useState, useEffect, useRef } from "react";
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
import {
  BookOpen, Plus, Search, Tag, Clock, Edit3, Loader2, X, GitBranch, Save,
  Eye, Heart, MessageCircle, Flame, Users, ChevronRight, Send, Bookmark,
  TrendingUp, Activity, Sparkles, GitCompare, UserPlus, Hash
} from "lucide-react";
import { BackButton } from "@/components/BackButton";

// ─── Avatar helper ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-pink-400", "bg-violet-400", "bg-sky-400", "bg-emerald-400",
  "bg-amber-400", "bg-rose-400", "bg-indigo-400", "bg-teal-400",
];
function Avatar({ name, size = "sm" }: { name: string; size?: "xs" | "sm" | "md" }) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  const sizeClass = size === "xs" ? "w-5 h-5 text-[9px]" : size === "md" ? "w-8 h-8 text-sm" : "w-6 h-6 text-[10px]";
  return (
    <div className={cn("rounded-full flex items-center justify-center text-white font-bold shrink-0", AVATAR_COLORS[idx], sizeClass)}>
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

// ─── Time helper ──────────────────────────────────────────────────────────────
function timeAgo(date: Date | string) {
  const diff = Date.now() - new Date(date).getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

// ─── Category colors ──────────────────────────────────────────────────────────
const categoryColors: Record<string, string> = {
  "交互设计": "bg-violet-100 text-violet-700 border-violet-200",
  "视觉设计": "bg-pink-100 text-pink-700 border-pink-200",
  "用户研究": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "设计规范": "bg-sky-100 text-sky-700 border-sky-200",
  "竞品分析": "bg-amber-100 text-amber-700 border-amber-200",
};

// ─── Pixel Cat reaction ───────────────────────────────────────────────────────
function CatReaction({ trigger }: { trigger: boolean }) {
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");
  const msgs = ["📚 又有新知识啦！", "✨ 团队在协作！", "🎉 知识库更新了！", "💡 灵感涌现中~", "🔥 好活跃的团队！"];
  useEffect(() => {
    if (trigger) {
      setMsg(msgs[Math.floor(Math.random() * msgs.length)]);
      setShow(true);
      const t = setTimeout(() => setShow(false), 3000);
      return () => clearTimeout(t);
    }
  }, [trigger]);
  if (!show) return null;
  return (
    <div className="fixed bottom-20 right-6 z-50 animate-bounce-in flex items-end gap-2">
      <div className="bg-white border border-border rounded-2xl px-3 py-2 shadow-lg text-xs font-medium text-foreground">
        {msg}
      </div>
      <div className="text-2xl">🐱</div>
    </div>
  );
}

export default function Knowledge() {
  const { isAuthenticated, user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState<"content" | "comments" | "versions">("content");
  const [catTrigger, setCatTrigger] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", tags: "", category: "", collaborators: "" });
  const [showVersionCompare, setShowVersionCompare] = useState(false);
  const [compareVersions, setCompareVersions] = useState<[number, number] | null>(null);
  const utils = trpc.useUtils();

  const { data: articles, isLoading } = trpc.knowledge.listWithStats.useQuery(
    { search: searchQuery || undefined },
    { enabled: isAuthenticated }
  );
  const { data: detail } = trpc.knowledge.get.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );
  const { data: versions } = trpc.knowledge.versions.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId }
  );
  const { data: comments, refetch: refetchComments } = trpc.knowledge.listComments.useQuery(
    { articleId: selectedId! },
    { enabled: !!selectedId }
  );
  const { data: teamActivity } = trpc.knowledge.teamActivity.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
  const { data: tagStats } = trpc.knowledge.listTags.useQuery(undefined, { enabled: isAuthenticated });

  const create = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      toast.success("知识条目已创建");
      setCreateOpen(false);
      setForm({ title: "", content: "", tags: "", category: "", collaborators: "" });
      utils.knowledge.listWithStats.invalidate();
      setCatTrigger(v => !v);
    },
  });

  const update = trpc.knowledge.update.useMutation({
    onSuccess: () => {
      toast.success("已保存新版本");
      setEditMode(false);
      utils.knowledge.get.invalidate({ id: selectedId! });
      utils.knowledge.versions.invalidate({ id: selectedId! });
      utils.knowledge.teamActivity.invalidate();
      setCatTrigger(v => !v);
    },
  });

  const toggleFavorite = trpc.knowledge.toggleFavorite.useMutation({
    onSuccess: (data) => {
      toast.success(data.favorited ? "已收藏" : "已取消收藏");
      utils.knowledge.listWithStats.invalidate();
    },
  });

  const addComment = trpc.knowledge.addComment.useMutation({
    onSuccess: () => {
      setCommentText("");
      refetchComments();
      utils.knowledge.teamActivity.invalidate();
      setCatTrigger(v => !v);
    },
  });

  const recordView = trpc.knowledge.recordView.useMutation();

  function handleSelectArticle(id: number) {
    setSelectedId(selectedId === id ? null : id);
    setEditMode(false);
    setActiveTab("content");
    if (id !== selectedId) {
      recordView.mutate({ articleId: id });
    }
  }

  // Hot threshold: top 20% by view count
  const maxViews = Math.max(...(articles?.map(a => (a as any).viewCount || 0) || [0]));
  const hotThreshold = maxViews * 0.6;

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <BookOpen className="w-12 h-12 text-sky-400" />
        <h2 className="font-display text-xl font-600">请先登录</h2>
        <a href={getLoginUrl()}><Button>登录使用</Button></a>
      </div>
    );
  }

  const selectedArticle = articles?.find(a => a.id === selectedId);

  return (
    <div className="pb-8 min-h-screen">
      <CatReaction trigger={catTrigger} />
      <BackButton />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-sky-600" />
            </div>
            <h1 className="font-display text-2xl font-700">设计知识库</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">团队共创知识，持续流动沉淀</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Tag stats summary */}
          {tagStats && tagStats.length > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/50 border border-border">
              <Hash className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{tagStats.length} 个标签</span>
            </div>
          )}
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
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="标签（逗号分隔）" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} className="rounded-xl pl-9" />
                </div>
                {/* Tag suggestions */}
                {tagStats && tagStats.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tagStats.slice(0, 8).map(t => (
                      <button
                        key={t.name}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100 transition-colors"
                        onClick={() => setForm(p => ({ ...p, tags: p.tags ? `${p.tags}, ${t.name}` : t.name }))}
                      >
                        {t.name} <span className="opacity-60">×{t.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input placeholder="邀请协作成员（用户名，逗号分隔）" value={form.collaborators} onChange={e => setForm(p => ({ ...p, collaborators: e.target.value }))} className="rounded-xl pl-9" />
                </div>
                <Textarea placeholder="知识内容..." value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} className="rounded-xl min-h-48 resize-none" />
                <Button className="w-full rounded-xl" onClick={() => create.mutate({ title: form.title, content: form.content, tags: form.tags.split(",").map(t => t.trim()).filter(Boolean), category: form.category })} disabled={create.isPending}>
                  {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}创建条目
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search + Tag filter */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索知识库..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        {tagStats && tagStats.slice(0, 5).map(t => (
          <button
            key={t.name}
            className="hidden md:flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 transition-colors text-muted-foreground"
            onClick={() => setSearchQuery(t.name)}
          >
            <Hash className="w-3 h-3" />{t.name}
            <span className="opacity-50 text-[10px]">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Three-column layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_260px] gap-5">

        {/* ── Left: Article List ── */}
        <div className="space-y-2.5">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : articles?.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{searchQuery ? "未找到相关内容" : "知识库还是空的"}</p>
            </div>
          ) : (
            (articles as any[])?.map((article) => {
              const isHot = (article.viewCount || 0) >= hotThreshold && maxViews > 0;
              const isSelected = selectedId === article.id;
              return (
                <div
                  key={article.id}
                  className={cn(
                    "p-4 rounded-2xl border bg-card cursor-pointer transition-all hover:shadow-md group",
                    isSelected && "ring-2 ring-sky-200 shadow-md bg-sky-50/30"
                  )}
                  onClick={() => handleSelectArticle(article.id)}
                >
                  {/* Title row */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isHot && <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                      <h3 className="font-medium text-sm text-foreground leading-tight truncate">{article.title}</h3>
                    </div>
                    {article.category && (
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium border", categoryColors[article.category] || "bg-gray-100 text-gray-600 border-gray-200")}>
                        {article.category}
                      </span>
                    )}
                  </div>

                  {/* Preview */}
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">{article.content}</p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-2.5">
                    {(article.tags as string[])?.slice(0, 3).map((tag: string) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100">{tag}</span>
                    ))}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{article.viewCount || 0}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{article.commentCount || 0}</span>
                    <span className="flex items-center gap-0.5"><Heart className={cn("w-3 h-3", article.isFavorited && "fill-pink-500 text-pink-500")} />{article.favoriteCount || 0}</span>
                    <span className="ml-auto flex items-center gap-0.5"><GitBranch className="w-3 h-3" />v{article.version}</span>
                  </div>

                  {/* Collaborators hint */}
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                    <div className="flex -space-x-1">
                      {["设计师A", "研究员B"].slice(0, 2).map(n => (
                        <Avatar key={n} name={n} size="xs" />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{timeAgo(article.updatedAt)}</span>
                    <ChevronRight className={cn("w-3 h-3 ml-auto text-muted-foreground transition-transform", isSelected && "rotate-90")} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Center: Detail Panel ── */}
        <div>
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
              <BookOpen className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">选择左侧条目查看详情</p>
            </div>
          ) : detail ? (
            <div className="rounded-2xl border bg-card animate-slide-up overflow-hidden">
              {/* Detail header */}
              <div className="px-6 pt-5 pb-4 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-600 leading-tight mb-1.5">{detail.title}</h2>
                    <div className="flex items-center gap-2 flex-wrap">
                      {detail.category && (
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium border", categoryColors[detail.category] || "bg-gray-100 text-gray-600 border-gray-200")}>
                          {detail.category}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <GitBranch className="w-3 h-3" />版本 {detail.version}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />{new Date(detail.updatedAt).toLocaleDateString("zh-CN")}
                      </span>
                      {/* Realtime collab indicator */}
                      <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        协作中
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      className={cn("p-1.5 rounded-lg hover:bg-muted transition-colors", selectedArticle?.isFavorited && "text-pink-500")}
                      onClick={() => toggleFavorite.mutate({ articleId: detail.id })}
                      title="收藏"
                    >
                      <Heart className={cn("w-4 h-4", selectedArticle?.isFavorited && "fill-pink-500")} />
                    </button>
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
                    <button onClick={() => setSelectedId(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tags */}
                {(detail.tags as string[])?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(detail.tags as string[]).map((tag) => (
                      <span key={tag} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
                        <Tag className="w-3 h-3" />{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Tab bar */}
              <div className="flex border-b border-border px-6">
                {(["content", "comments", "versions"] as const).map(tab => (
                  <button
                    key={tab}
                    className={cn(
                      "py-3 px-1 mr-5 text-sm font-medium border-b-2 transition-colors",
                      activeTab === tab
                        ? "border-sky-500 text-sky-600"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === "content" ? "正文" : tab === "comments" ? `评论 ${comments?.length || ""}` : "版本历史"}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="p-6">
                {activeTab === "content" && (
                  editMode ? (
                    <Textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="rounded-xl min-h-64 resize-none text-sm"
                    />
                  ) : (
                    <div className="p-4 rounded-xl bg-muted/30 min-h-32">
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{detail.content}</p>
                    </div>
                  )
                )}

                {activeTab === "comments" && (
                  <div className="space-y-4">
                    {/* Comment input */}
                    <div className="flex gap-2.5">
                      <Avatar name={user?.name || "我"} size="sm" />
                      <div className="flex-1 relative">
                        <Textarea
                          placeholder="添加评论，支持 @提及成员..."
                          value={commentText}
                          onChange={e => setCommentText(e.target.value)}
                          className="rounded-xl resize-none text-sm pr-10 min-h-[72px]"
                          onKeyDown={e => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && commentText.trim()) {
                              addComment.mutate({ articleId: detail.id, content: commentText });
                            }
                          }}
                        />
                        <button
                          className="absolute right-2.5 bottom-2.5 p-1.5 rounded-lg bg-sky-500 text-white hover:bg-sky-600 transition-colors disabled:opacity-40"
                          disabled={!commentText.trim() || addComment.isPending}
                          onClick={() => addComment.mutate({ articleId: detail.id, content: commentText })}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Emoji quick reactions */}
                    <div className="flex gap-1.5">
                      {["👍", "💡", "🔥", "❓", "✅"].map(emoji => (
                        <button
                          key={emoji}
                          className="text-base px-2 py-1 rounded-lg hover:bg-muted transition-colors"
                          onClick={() => addComment.mutate({ articleId: detail.id, content: emoji, emoji })}
                        >
                          {emoji}
                        </button>
                      ))}
                      <span className="text-xs text-muted-foreground self-center ml-1">快速反应</span>
                    </div>
                    {/* Comment list */}
                    {comments?.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">还没有评论，来说点什么吧</p>
                    ) : (
                      <div className="space-y-3">
                        {comments?.map(c => (
                          <div key={c.id} className="flex gap-2.5">
                            <Avatar name={c.userName || "?"} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">{c.userName || "匿名"}</span>
                                <span className="text-[10px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                              </div>
                              <div className="text-sm text-foreground bg-muted/30 rounded-xl px-3 py-2 leading-relaxed">
                                {c.content}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "versions" && (
                  <div className="space-y-3">
                    {versions && versions.length > 1 ? (
                      <>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium">共 {versions.length} 个版本</p>
                          <Button size="sm" variant="outline" className="rounded-xl gap-1.5 text-xs" onClick={() => setShowVersionCompare(!showVersionCompare)}>
                            <GitCompare className="w-3.5 h-3.5" />对比差异
                          </Button>
                        </div>
                        {versions.map((v, i) => (
                          <div key={v.id} className={cn("p-3 rounded-xl border transition-colors", i === 0 && "border-sky-200 bg-sky-50/30")}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", i === 0 ? "bg-sky-500 text-white" : "bg-muted text-muted-foreground")}>
                                  v{v.version}
                                </span>
                                {i === 0 && <span className="text-[10px] text-sky-600 font-medium">当前版本</span>}
                              </div>
                              <span className="text-[10px] text-muted-foreground">{new Date(v.updatedAt).toLocaleDateString("zh-CN")}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{v.content.slice(0, 80)}...</p>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">暂无历史版本</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          )}
        </div>

        {/* ── Right: Team Activity Sidebar ── */}
        <div className="space-y-4">
          {/* Team activity timeline */}
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-sky-500" />
              <h3 className="text-sm font-semibold">团队知识动态</h3>
              <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
              </span>
            </div>
            {!teamActivity || teamActivity.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">暂无团队动态</p>
                <p className="text-[10px] mt-1 opacity-60">编辑或评论后会显示在这里</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamActivity.slice(0, 8).map((act: any, i: number) => (
                  <div key={act.id} className="flex gap-2.5">
                    <div className="flex flex-col items-center">
                      <Avatar name={act.userName || "?"} size="xs" />
                      {i < teamActivity.slice(0, 8).length - 1 && (
                        <div className="w-px flex-1 bg-border mt-1 mb-0" style={{ minHeight: 12 }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-2">
                      <p className="text-xs text-foreground leading-snug">
                        <span className="font-medium">{act.userName}</span>
                        {" "}{act.title}
                      </p>
                      {act.detail && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{act.detail}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(act.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tag cloud */}
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-violet-500" />
              <h3 className="text-sm font-semibold">热门标签</h3>
            </div>
            {tagStats && tagStats.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {tagStats.slice(0, 12).map(t => (
                  <button
                    key={t.name}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 border border-transparent transition-colors text-muted-foreground"
                    onClick={() => setSearchQuery(t.name)}
                  >
                    <Hash className="w-2.5 h-2.5" />{t.name}
                    <span className="text-[9px] opacity-60 ml-0.5">{t.count}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">暂无标签数据</p>
            )}
          </div>

          {/* Quick stats */}
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold">知识库概览</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "条目总数", value: articles?.length || 0, icon: BookOpen, color: "text-sky-500" },
                { label: "热门条目", value: articles?.filter(a => ((a as any).viewCount || 0) >= hotThreshold && maxViews > 0).length || 0, icon: Flame, color: "text-orange-500" },
                { label: "总评论", value: articles?.reduce((s, a) => s + ((a as any).commentCount || 0), 0) || 0, icon: MessageCircle, color: "text-violet-500" },
                { label: "总收藏", value: articles?.reduce((s, a) => s + ((a as any).favoriteCount || 0), 0) || 0, icon: Bookmark, color: "text-pink-500" },
              ].map(stat => (
                <div key={stat.label} className="p-2.5 rounded-xl bg-muted/40 text-center">
                  <stat.icon className={cn("w-4 h-4 mx-auto mb-1", stat.color)} />
                  <p className="text-base font-bold">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
