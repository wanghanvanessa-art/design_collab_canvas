import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  BookOpen, Plus, Search, Tag, Clock, Edit3, Loader2, X, GitBranch, Save,
  Eye, Heart, MessageCircle, Flame, Users, ChevronRight, Send, Bookmark,
  TrendingUp, Activity, Sparkles, GitCompare, UserPlus, Hash, Filter,
  SlidersHorizontal, Grid3X3, List, ArrowUpDown, User, Calendar, RotateCcw,
  ChevronDown, Lightbulb, Zap, Trash2
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

// ─── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = ["全部", "交互设计", "视觉设计", "用户研究", "设计规范", "竞品分析"];
const categoryColors: Record<string, string> = {
  "交互设计": "bg-violet-100 text-violet-700 border-violet-200",
  "视觉设计": "bg-pink-100 text-pink-700 border-pink-200",
  "用户研究": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "设计规范": "bg-sky-100 text-sky-700 border-sky-200",
  "竞品分析": "bg-amber-100 text-amber-700 border-amber-200",
};
const categoryNavColors: Record<string, string> = {
  "全部": "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200",
  "交互设计": "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  "视觉设计": "bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100",
  "用户研究": "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
  "设计规范": "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100",
  "竞品分析": "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
};

// ─── Keyword highlight helper ─────────────────────────────────────────────────
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">{part}</mark>
          : part
      )}
    </>
  );
}

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
    <div className="fixed bottom-20 right-6 z-50 flex items-end gap-2" style={{ animation: "slideUp 0.3s ease" }}>
      <div className="bg-white border border-border rounded-2xl px-3 py-2 shadow-lg text-xs font-medium text-foreground">
        {msg}
      </div>
      <div className="text-2xl">🐱</div>
    </div>
  );
}

// ─── Search mode tabs ─────────────────────────────────────────────────────────
const SEARCH_MODES = [
  { key: "content", label: "内容", icon: BookOpen },
  { key: "member", label: "成员", icon: User },
  { key: "comments", label: "评论", icon: MessageCircle },
] as const;

// ─── Sort options ─────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { key: "latest", label: "最新更新" },
  { key: "popular", label: "最多浏览" },
  { key: "mostCommented", label: "最多评论" },
  { key: "mostFavorited", label: "最多收藏" },
] as const;

export default function Knowledge() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitleMode, setEditTitleMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [commentText, setCommentText] = useState("");
  const [activeTab, setActiveTab] = useState<"content" | "comments" | "versions">("content");
  const [catTrigger, setCatTrigger] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", tags: "", category: "", collaborators: "" });
  const [showVersionCompare, setShowVersionCompare] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"content" | "member" | "comments">("content");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"latest" | "popular" | "mostCommented" | "mostFavorited">("latest");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // Debounce search query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Close autocomplete on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node) &&
        searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowAutocomplete(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Autocomplete
  const { data: autocomplete } = trpc.knowledge.autocomplete.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.length >= 1 && showAutocomplete }
  );

  // Advanced search
  const { data: searchResult, isLoading } = trpc.knowledge.advancedSearch.useQuery(
    {
      query: debouncedQuery || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      author: searchMode === "member" ? memberQuery || undefined : undefined,
      category: selectedCategory !== "全部" ? selectedCategory : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      sortBy,
      searchIn: searchMode,
      viewMode,
    },
  );

  const articles = searchResult?.articles || [];
  const totalCount = searchResult?.total || 0;

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
    refetchInterval: 30000,
  });
  const { data: tagStats } = trpc.knowledge.listTags.useQuery();
  const { data: relatedArticles } = trpc.knowledge.relatedArticles.useQuery(
    { articleId: selectedId! },
    { enabled: !!selectedId }
  );

  const create = trpc.knowledge.create.useMutation({
    onSuccess: () => {
      toast.success("知识条目已创建");
      setCreateOpen(false);
      setForm({ title: "", content: "", tags: "", category: "", collaborators: "" });
      // 触发 left list 一定重拉：命中当前查询 key + 清空筛选后的默认 key
      const currentAdvancedSearchInput = {
        query: debouncedQuery || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        author: searchMode === "member" ? memberQuery || undefined : undefined,
        category: selectedCategory !== "全部" ? selectedCategory : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        searchIn: searchMode,
        viewMode,
      };

      const defaultAdvancedSearchInput = {
        query: undefined,
        tags: undefined,
        author: undefined,
        category: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        sortBy: "latest" as const,
        searchIn: "content" as const,
        viewMode,
      };

      utils.knowledge.advancedSearch.invalidate(currentAdvancedSearchInput as any);
      utils.knowledge.advancedSearch.invalidate(defaultAdvancedSearchInput as any);
      clearFilters();
      setCatTrigger(v => !v);
    },
    onError: (err) => {
      console.error("[Knowledge] create failed:", err);
      const msg = err instanceof Error ? err.message : "创建失败，请重试";
      toast.error(msg);
    },
  });

  const update = trpc.knowledge.update.useMutation({
    onSuccess: () => {
      toast.success("已保存新版本");
      setEditMode(false);
      setEditTitleMode(false);
      setEditTitle("");
      utils.knowledge.get.invalidate({ id: selectedId! });
      utils.knowledge.versions.invalidate({ id: selectedId! });
      utils.knowledge.teamActivity.invalidate();
      setCatTrigger(v => !v);
    },
  });

  const updateTitle = trpc.knowledge.updateTitle.useMutation({
    onSuccess: () => {
      toast.success("标题已更新");
      if (selectedId) {
        utils.knowledge.get.invalidate({ id: selectedId });
        utils.knowledge.versions.invalidate({ id: selectedId });
      }

      const currentAdvancedSearchInput = {
        query: debouncedQuery || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        author: searchMode === "member" ? memberQuery || undefined : undefined,
        category: selectedCategory !== "全部" ? selectedCategory : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        searchIn: searchMode,
        viewMode,
      };

      const defaultAdvancedSearchInput = {
        query: undefined,
        tags: undefined,
        author: undefined,
        category: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        sortBy: "latest" as const,
        searchIn: "content" as const,
        viewMode,
      };

      utils.knowledge.advancedSearch.invalidate(currentAdvancedSearchInput as any);
      utils.knowledge.advancedSearch.invalidate(defaultAdvancedSearchInput as any);
      utils.knowledge.teamActivity.invalidate();
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "更新失败，请重试";
      toast.error(msg);
    },
  });

  const deleteArticle = trpc.knowledge.delete.useMutation({
    onSuccess: () => {
      toast.success("知识条目已删除");
      setSelectedId(null);
      setEditMode(false);
      setEditTitleMode(false);
      setEditTitle("");

      const currentAdvancedSearchInput = {
        query: debouncedQuery || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        author: searchMode === "member" ? memberQuery || undefined : undefined,
        category: selectedCategory !== "全部" ? selectedCategory : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        sortBy,
        searchIn: searchMode,
        viewMode,
      };

      const defaultAdvancedSearchInput = {
        query: undefined,
        tags: undefined,
        author: undefined,
        category: undefined,
        dateFrom: undefined,
        dateTo: undefined,
        sortBy: "latest" as const,
        searchIn: "content" as const,
        viewMode,
      };

      utils.knowledge.advancedSearch.invalidate(currentAdvancedSearchInput as any);
      utils.knowledge.advancedSearch.invalidate(defaultAdvancedSearchInput as any);
      clearFilters();
      setCatTrigger(v => !v);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "删除失败，请重试";
      toast.error(msg);
    },
  });

  const toggleFavorite = trpc.knowledge.toggleFavorite.useMutation({
    onSuccess: (data) => {
      toast.success(data.favorited ? "已收藏" : "已取消收藏");
      utils.knowledge.advancedSearch.invalidate();
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
    setEditTitleMode(false);
    setEditTitle("");
    setActiveTab("content");
    if (id !== selectedId) {
      recordView.mutate({ articleId: id });
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function clearFilters() {
    setSearchQuery("");
    setDebouncedQuery("");
    setSelectedCategory("全部");
    setSelectedTags([]);
    setSortBy("latest");
    setDateFrom("");
    setDateTo("");
    setMemberQuery("");
    setSearchMode("content");
  }

  const hasActiveFilters = debouncedQuery || selectedCategory !== "全部" || selectedTags.length > 0 || dateFrom || dateTo || sortBy !== "latest";

  const maxViews = Math.max(...(articles?.map((a: any) => a.viewCount || 0) || [0]));
  const hotThreshold = maxViews * 0.6;

  const selectedArticle = articles?.find((a: any) => a.id === selectedId);

  return (
    <div className="pb-8 min-h-screen">
      <CatReaction trigger={catTrigger} />
      <BackButton />

      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5">
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
                <Button
                  className="w-full rounded-xl"
                  onClick={() => create.mutate({
                    title: form.title.trim(),
                    content: form.content.trim(),
                    tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
                    category: form.category.trim(),
                  })}
                  disabled={create.isPending || !form.title.trim() || !form.content.trim()}
                >
                  {create.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}创建条目
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Smart Search Bar ── */}
      <div className="mb-4 space-y-3">
        {/* Search mode tabs */}
        <div className="flex items-center gap-1.5">
          {SEARCH_MODES.map(mode => (
            <button
              key={mode.key}
              onClick={() => setSearchMode(mode.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                searchMode === mode.key
                  ? "bg-sky-500 text-white shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <mode.icon className="w-3.5 h-3.5" />
              {mode.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={cn("p-1.5 transition-colors", viewMode === "list" ? "bg-sky-500 text-white" : "text-muted-foreground hover:bg-muted")}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={cn("p-1.5 transition-colors", viewMode === "grid" ? "bg-sky-500 text-white" : "text-muted-foreground hover:bg-muted")}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* Sort */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {SORT_OPTIONS.find(s => s.key === sortBy)?.label}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" align="end">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSortBy(opt.key)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-xs rounded-lg transition-colors",
                      sortBy === opt.key ? "bg-sky-50 text-sky-700 font-medium" : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Main search input */}
        <div className="relative">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              {searchMode === "member" ? (
                <Input
                  ref={searchRef}
                  placeholder="搜索成员名称，查看其创建/编辑的知识..."
                  value={memberQuery}
                  onChange={e => setMemberQuery(e.target.value)}
                  className="pl-10 pr-10 rounded-xl h-11 text-sm"
                />
              ) : (
                <Input
                  ref={searchRef}
                  placeholder={searchMode === "comments" ? "搜索评论内容..." : "搜索标题、内容、标签..."}
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowAutocomplete(true); }}
                  onFocus={() => setShowAutocomplete(true)}
                  className="pl-10 pr-10 rounded-xl h-11 text-sm"
                />
              )}
              {(searchQuery || memberQuery) && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => { setSearchQuery(""); setMemberQuery(""); setShowAutocomplete(false); }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
              className={cn(
                "flex items-center gap-1.5 px-3 h-11 rounded-xl border text-xs font-medium transition-all shrink-0",
                showAdvancedFilter || hasActiveFilters
                  ? "border-sky-300 bg-sky-50 text-sky-700"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              高级筛选
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />}
            </button>
          </div>

          {/* Autocomplete dropdown */}
          {showAutocomplete && searchQuery.length >= 1 && autocomplete && (autocomplete.titles.length > 0 || autocomplete.tags.length > 0) && (
            <div
              ref={autocompleteRef}
              className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden"
            >
              {autocomplete.titles.length > 0 && (
                <div className="p-2">
                  <p className="text-[10px] text-muted-foreground px-2 mb-1 font-medium uppercase tracking-wide">条目</p>
                  {autocomplete.titles.map(item => (
                    <button
                      key={item.id}
                      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted flex items-center gap-2"
                      onClick={() => { handleSelectArticle(item.id); setSearchQuery(item.title); setShowAutocomplete(false); }}
                    >
                      <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <HighlightText text={item.title} query={searchQuery} />
                    </button>
                  ))}
                </div>
              )}
              {autocomplete.tags.length > 0 && (
                <div className="p-2 border-t border-border">
                  <p className="text-[10px] text-muted-foreground px-2 mb-1 font-medium uppercase tracking-wide">标签</p>
                  <div className="flex flex-wrap gap-1.5 px-2">
                    {autocomplete.tags.map(tag => (
                      <button
                        key={tag}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100 hover:bg-sky-100"
                        onClick={() => { toggleTag(tag); setShowAutocomplete(false); }}
                      >
                        <Hash className="w-2.5 h-2.5" />{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Advanced filter panel */}
        {showAdvancedFilter && (
          <div className="p-4 rounded-2xl border border-sky-100 bg-sky-50/40 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-sky-800">高级筛选</p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <RotateCcw className="w-3 h-3" />清除筛选
                </button>
              )}
            </div>
            {/* Date range */}
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground w-12">时间段</span>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="rounded-lg h-8 text-xs flex-1" />
              <span className="text-xs text-muted-foreground">至</span>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="rounded-lg h-8 text-xs flex-1" />
            </div>
            {/* Tag filter */}
            {tagStats && tagStats.length > 0 && (
              <div className="flex items-start gap-2">
                <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-1" />
                <span className="text-xs text-muted-foreground w-12 mt-0.5">标签</span>
                <div className="flex flex-wrap gap-1.5 flex-1">
                  {tagStats.slice(0, 12).map(t => (
                    <button
                      key={t.name}
                      onClick={() => toggleTag(t.name)}
                      className={cn(
                        "flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                        selectedTags.includes(t.name)
                          ? "bg-sky-500 text-white border-sky-500"
                          : "bg-white text-muted-foreground border-border hover:border-sky-300 hover:text-sky-700"
                      )}
                    >
                      <Hash className="w-2.5 h-2.5" />{t.name}
                      <span className="opacity-60">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Category nav */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all",
                selectedCategory === cat
                  ? "bg-sky-500 text-white border-sky-500 shadow-sm"
                  : categoryNavColors[cat] || "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {cat}
            </button>
          ))}
          {/* Active filters summary */}
          {selectedTags.length > 0 && (
            <div className="flex items-center gap-1 shrink-0">
              {selectedTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-sky-500 text-white"
                >
                  <Hash className="w-2.5 h-2.5" />{tag}
                  <X className="w-2.5 h-2.5" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Result count */}
        {(debouncedQuery || selectedCategory !== "全部" || selectedTags.length > 0) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Search className="w-3.5 h-3.5" />
            <span>找到 <strong className="text-foreground">{totalCount}</strong> 条结果</span>
            {debouncedQuery && <span>关键词：<strong className="text-sky-600">"{debouncedQuery}"</strong></span>}
          </div>
        )}
      </div>

      {/* ── Three-column layout ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr_260px] gap-5">

        {/* ── Left: Article List ── */}
        <div className={cn(viewMode === "grid" ? "space-y-0" : "space-y-2.5")}>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : articles.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm mb-2">{debouncedQuery ? "未找到相关内容" : "知识库还是空的"}</p>
              {debouncedQuery && (
                <div className="mt-4 p-3 rounded-xl bg-muted/40 text-left">
                  <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500" />智能推荐
                  </p>
                  {tagStats?.slice(0, 3).map(t => (
                    <button
                      key={t.name}
                      onClick={() => setSearchQuery(t.name)}
                      className="block text-xs text-sky-600 hover:underline mb-1"
                    >
                      → 试试搜索「{t.name}」
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-2.5">
              {(articles as any[]).map((article) => {
                const isHot = (article.viewCount || 0) >= hotThreshold && maxViews > 0;
                const isSelected = selectedId === article.id;
                return (
                  <div
                    key={article.id}
                    className={cn(
                      "p-3 rounded-xl border bg-card cursor-pointer transition-all hover:shadow-md group relative",
                      isSelected && "ring-2 ring-sky-200 shadow-md bg-sky-50/30"
                    )}
                    onClick={() => handleSelectArticle(article.id)}
                    onMouseEnter={() => setHoveredId(article.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {isHot && <Flame className="w-3 h-3 text-orange-500 shrink-0" />}
                      <h3 className="font-medium text-xs text-foreground leading-tight truncate flex-1">
                        <HighlightText text={article.title} query={debouncedQuery} />
                      </h3>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
                      <HighlightText text={article.content} query={debouncedQuery} />
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{article.viewCount || 0}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" />{article.commentCount || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            (articles as any[]).map((article) => {
              const isHot = (article.viewCount || 0) >= hotThreshold && maxViews > 0;
              const isSelected = selectedId === article.id;
              const isHovered = hoveredId === article.id;
              return (
                <div
                  key={article.id}
                  className={cn(
                    "rounded-2xl border bg-card cursor-pointer transition-all hover:shadow-md group relative",
                    isSelected && "ring-2 ring-sky-200 shadow-md bg-sky-50/30"
                  )}
                  onClick={() => handleSelectArticle(article.id)}
                  onMouseEnter={() => setHoveredId(article.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="p-4">
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isHot && <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                        <h3 className="font-medium text-sm text-foreground leading-tight truncate">
                          <HighlightText text={article.title} query={debouncedQuery} />
                        </h3>
                      </div>
                      {article.category && (
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full shrink-0 font-medium border", categoryColors[article.category] || "bg-gray-100 text-gray-600 border-gray-200")}>
                          {article.category}
                        </span>
                      )}
                    </div>

                    {/* Preview with highlight */}
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">
                      <HighlightText text={article.content} query={debouncedQuery} />
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-2.5">
                      {(article.tags as string[])?.slice(0, 3).map((tag: string) => (
                        <span
                          key={tag}
                          className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded-md border transition-colors",
                            selectedTags.includes(tag)
                              ? "bg-sky-500 text-white border-sky-500"
                              : "bg-sky-50 text-sky-600 border-sky-100"
                          )}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{article.viewCount || 0}</span>
                      <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{article.commentCount || 0}</span>
                      <span className="flex items-center gap-0.5"><Heart className={cn("w-3 h-3", article.isFavorited && "fill-pink-500 text-pink-500")} />{article.favoriteCount || 0}</span>
                      <span className="ml-auto flex items-center gap-0.5"><GitBranch className="w-3 h-3" />v{article.version}</span>
                    </div>

                    {/* Collaborators + time */}
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

                  {/* Hover quick preview */}
                  {isHovered && !isSelected && (
                    <div className="absolute left-full top-0 ml-2 w-64 bg-white border border-border rounded-2xl shadow-xl z-40 p-4 pointer-events-none">
                      <p className="text-xs font-semibold mb-2 text-foreground">{article.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-5 leading-relaxed">{article.content}</p>
                      {(article.tags as string[])?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {(article.tags as string[]).slice(0, 4).map((tag: string) => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-600 border border-sky-100">{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{article.viewCount || 0}</span>
                        <span className="flex items-center gap-0.5"><MessageCircle className="w-3 h-3" />{article.commentCount || 0}</span>
                        <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{article.favoriteCount || 0}</span>
                      </div>
                    </div>
                  )}
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
              <p className="text-xs mt-1 opacity-60">或使用搜索框快速定位</p>
            </div>
          ) : detail ? (
            <div className="rounded-2xl border bg-card animate-slide-up overflow-hidden">
              {/* Detail header */}
              <div className="px-6 pt-5 pb-4 border-b border-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {editTitleMode ? (
                      <Input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="w-full rounded-xl text-lg font-600 leading-tight mb-1.5"
                        onKeyDown={e => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          const next = editTitle.trim();
                          if (!next) return;
                          updateTitle.mutate({ id: detail.id, title: next });
                        }}
                      />
                    ) : (
                      <h2 className="font-display text-lg font-600 leading-tight mb-1.5">{detail.title}</h2>
                    )}
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl gap-1.5"
                          onClick={() => {
                            setEditMode(false);
                            setEditTitleMode(false);
                            setEditTitle("");
                          }}
                        >
                          <X className="w-3.5 h-3.5" />取消
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-xl gap-1.5"
                          onClick={() => {
                            const nextTitle = editTitle.trim();
                            const titleChanged = nextTitle && nextTitle !== (detail.title || "");
                            if (titleChanged) {
                              updateTitle.mutate({ id: detail.id, title: nextTitle });
                            }
                            update.mutate({ id: detail.id, content: editContent });
                          }}
                          disabled={update.isPending || updateTitle.isPending}
                        >
                          {update.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}保存
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1.5"
                        onClick={() => {
                          setEditMode(true);
                          setEditTitleMode(true);
                          setEditTitle(detail.title || "");
                          setEditContent(detail.content);
                        }}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        编辑
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl gap-1.5 text-red-600 border-red-200 hover:text-red-700"
                      onClick={() => {
                        const ok = window.confirm("确定删除该知识条目吗？删除后无法恢复。");
                        if (!ok) return;
                        deleteArticle.mutate({ id: detail.id });
                      }}
                      disabled={deleteArticle.isPending || updateTitle.isPending || update.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      删除
                    </Button>
                    <button
                      onClick={() => {
                        setSelectedId(null);
                        setEditMode(false);
                        setEditTitleMode(false);
                        setEditTitle("");
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tags */}
                {(detail.tags as string[])?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(detail.tags as string[]).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                          "flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors",
                          selectedTags.includes(tag)
                            ? "bg-sky-500 text-white border-sky-500"
                            : "bg-sky-50 text-sky-700 border-sky-100 hover:bg-sky-100"
                        )}
                      >
                        <Tag className="w-3 h-3" />{tag}
                      </button>
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
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {debouncedQuery ? (
                          <HighlightText text={detail.content} query={debouncedQuery} />
                        ) : detail.content}
                      </p>
                    </div>
                  )
                )}

                {activeTab === "comments" && (
                  <div className="space-y-4">
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
                                {debouncedQuery && searchMode === "comments"
                                  ? <HighlightText text={c.content} query={debouncedQuery} />
                                  : c.content}
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

              {/* ── Related articles (You may also like) ── */}
              {relatedArticles && relatedArticles.length > 0 && (
                <div className="px-6 pb-6 border-t border-border pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <h3 className="text-sm font-semibold">你可能还想看</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(relatedArticles as any[]).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => handleSelectArticle(r.id)}
                        className="text-left p-3 rounded-xl border border-border hover:border-sky-200 hover:bg-sky-50/30 transition-all group"
                      >
                        <p className="text-xs font-medium text-foreground line-clamp-2 group-hover:text-sky-700 transition-colors">{r.title}</p>
                        {r.category && (
                          <span className={cn("inline-block text-[10px] px-1.5 py-0.5 rounded-md border mt-1.5", categoryColors[r.category] || "bg-gray-100 text-gray-600 border-gray-200")}>
                            {r.category}
                          </span>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{(r as any).viewCount || 0}</span>
                          <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{(r as any).favoriteCount || 0}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                      {i < Math.min(teamActivity.length, 8) - 1 && (
                        <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: 12 }} />
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
                    className={cn(
                      "flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border transition-colors",
                      selectedTags.includes(t.name)
                        ? "bg-sky-500 text-white border-sky-500"
                        : "bg-muted hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 border-transparent text-muted-foreground"
                    )}
                    onClick={() => toggleTag(t.name)}
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
                { label: "条目总数", value: totalCount, icon: BookOpen, color: "text-sky-500" },
                { label: "热门条目", value: articles.filter((a: any) => ((a as any).viewCount || 0) >= hotThreshold && maxViews > 0).length, icon: Flame, color: "text-orange-500" },
                { label: "总评论", value: articles.reduce((s: number, a: any) => s + ((a as any).commentCount || 0), 0), icon: MessageCircle, color: "text-violet-500" },
                { label: "总收藏", value: articles.reduce((s: number, a: any) => s + ((a as any).favoriteCount || 0), 0), icon: Bookmark, color: "text-pink-500" },
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
