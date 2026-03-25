import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Lightbulb, MoreHorizontal, Download, Share2, Bookmark,
  AtSign, ChevronDown, Edit3, Archive, Trash2, Clock, GitBranch,
  Link2, FileText, List, Send, ThumbsUp, MessageSquare, HelpCircle,
  Plus, X, Loader2, Eye, RotateCcw, ChevronRight, Layers,
  BookOpen, Users, CheckSquare, FileDown, Video, Globe,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
type Module = { id: string; title: string; content: string };

const DEFAULT_MODULES: Module[] = [
  { id: "background", title: "背景", content: "" },
  { id: "goal", title: "目标", content: "" },
  { id: "solution", title: "方案细节", content: "" },
  { id: "effect", title: "预期效果", content: "" },
  { id: "todo", title: "待解决问题", content: "" },
];

const STATUS_CONFIG = {
  draft:     { label: "草稿",   color: "bg-gray-100 text-gray-600 border-gray-200" },
  published: { label: "讨论中", color: "bg-blue-100 text-blue-600 border-blue-200" },
  archived:  { label: "已落地", color: "bg-emerald-100 text-emerald-600 border-emerald-200" },
};

const EXPORT_FORMATS = [
  { key: "pdf",          icon: FileDown,  label: "导出 PDF",      desc: "规范报告格式，含封面目录" },
  { key: "word",         icon: FileText,  label: "导出 Word",     desc: "富文本格式，方便二次编辑" },
  { key: "blog",         icon: Globe,     label: "生成博客",      desc: "对外发布排版，含摘要标签" },
  { key: "video_script", icon: Video,     label: "生成视频脚本",  desc: "镜头/台词/画面结构拆分" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseModulesFromContent(content: string): Module[] {
  // Try to parse structured modules from content (JSON or markdown headings)
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  // Parse markdown headings
  const lines = content.split("\n");
  const modules: Module[] = [];
  let current: Module | null = null;
  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (current) modules.push(current);
      current = { id: headingMatch[1].toLowerCase().replace(/\s+/g, "_"), title: headingMatch[1], content: "" };
    } else if (current) {
      current.content += (current.content ? "\n" : "") + line;
    }
  }
  if (current) modules.push(current);
  return modules.length > 0 ? modules : DEFAULT_MODULES.map(m => ({ ...m }));
}

function modulesToContent(modules: Module[]): string {
  return modules.map(m => `## ${m.title}\n\n${m.content}`).join("\n\n");
}

function generateTOC(modules: Module[]): { id: string; title: string }[] {
  return modules.map(m => ({ id: m.id, title: m.title }));
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function IdeaDetail({ id }: { id: number }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: idea, isLoading } = trpc.ideas.get.useQuery({ id });
  const { data: comments } = trpc.ideas.comments.useQuery({ ideaId: id });
  const { data: versions } = trpc.ideas.versions.useQuery({ ideaId: id });
  const { data: reactions } = trpc.ideas.reactions.useQuery({ ideaId: id });

  // Local state
  const [modules, setModules] = useState<Module[]>(DEFAULT_MODULES.map(m => ({ ...m })));
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; user: string } | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [exportDialog, setExportDialog] = useState<{ open: boolean; format: string; content: string; title: string }>({ open: false, format: "", content: "", title: "" });
  const [activeSection, setActiveSection] = useState("background");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Sync modules from idea content
  useEffect(() => {
    if (idea?.content) {
      const parsed = parseModulesFromContent(idea.content);
      setModules(parsed);
    }
    if (idea?.title) setEditTitle(idea.title);
    if (idea?.tags) setEditTags((idea.tags as string[]).join(", "));
  }, [idea]);

  const updateIdea = trpc.ideas.update.useMutation({
    onSuccess: () => {
      toast.success("已保存");
      setIsEditing(false);
      utils.ideas.get.invalidate({ id });
      utils.ideas.versions.invalidate({ ideaId: id });
    },
  });

  const rollback = trpc.ideas.rollbackVersion.useMutation({
    onSuccess: () => {
      toast.success("已回滚到该版本");
      utils.ideas.get.invalidate({ id });
    },
  });

  const addComment = trpc.ideas.addComment.useMutation({
    onSuccess: () => {
      setCommentText("");
      setReplyTo(null);
      utils.ideas.comments.invalidate({ ideaId: id });
    },
  });

  const addReaction = trpc.ideas.addReaction.useMutation({
    onSuccess: () => utils.ideas.reactions.invalidate({ ideaId: id }),
  });

  const generateExport = trpc.ideas.generateExport.useMutation({
    onSuccess: (data) => {
      setExportDialog({ open: true, format: data.format, content: data.content, title: data.title });
    },
    onError: () => toast.error("生成失败，请重试"),
  });

  const handleSave = useCallback(() => {
    const content = modulesToContent(modules);
    updateIdea.mutate({
      id,
      title: editTitle,
      content,
      tags: editTags.split(",").map(t => t.trim()).filter(Boolean),
      modules,
      changeNote: `手动保存`,
    });
  }, [id, editTitle, editTags, modules, updateIdea]);

  const handleModuleChange = (moduleId: string, newContent: string) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, content: newContent } : m));
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!idea) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Lightbulb className="w-10 h-10 text-amber-300" />
        <p className="text-muted-foreground">想法不存在或无权访问</p>
        <Button variant="outline" onClick={() => navigate("/ideas")}>返回列表</Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[idea.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;
  const toc = generateTOC(modules);

  return (
    <div className="flex flex-col min-h-screen" style={{ height: "calc(100vh - 56px)" }}>
      {/* ── TOP HEADER ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-30">
        {/* Back + Title */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">返回主页</span>
        </button>

        <div className="w-px h-5 bg-gray-200 shrink-0" />

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4 text-amber-600" />
          </div>
          {isEditing ? (
            <Input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="font-display font-bold text-base h-8 rounded-lg border-amber-300 focus-visible:ring-amber-300 max-w-sm"
            />
          ) : (
            <h1 className="font-display font-bold text-base text-gray-900 truncate">{idea.title}</h1>
          )}
          <Badge variant="outline" className={cn("text-xs shrink-0", statusCfg.color)}>
            {statusCfg.label}
          </Badge>
        </div>

        {/* Meta info */}
        <div className="hidden md:flex items-center gap-3 text-xs text-gray-400 shrink-0">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {new Date(idea.createdAt).toLocaleDateString("zh-CN")}
          </span>
          <span className="flex items-center gap-1">
            <GitBranch className="w-3.5 h-3.5" />
            {versions?.length || 0} 个版本
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isEditing ? (
            <>
              <Button size="sm" className="rounded-lg h-8 bg-amber-500 hover:bg-amber-600 text-white" onClick={handleSave} disabled={updateIdea.isPending}>
                {updateIdea.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}保存
              </Button>
              <Button size="sm" variant="ghost" className="rounded-lg h-8" onClick={() => setIsEditing(false)}>取消</Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="rounded-lg h-8 gap-1.5" onClick={() => setIsEditing(true)}>
              <Edit3 className="w-3.5 h-3.5" />编辑
            </Button>
          )}

          {/* Collaboration */}
          <Button size="sm" variant="ghost" className="rounded-lg h-8 gap-1.5 text-gray-500 hover:text-gray-700" onClick={() => toast.info("@提及功能即将上线")}>
            <AtSign className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="rounded-lg h-8 gap-1.5 text-gray-500 hover:text-gray-700" onClick={() => toast.success("已收藏")}>
            <Bookmark className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="rounded-lg h-8 gap-1.5 text-gray-500 hover:text-gray-700" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("链接已复制"); }}>
            <Share2 className="w-3.5 h-3.5" />
          </Button>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="rounded-lg h-8 gap-1.5">
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">导出</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-52">
              {EXPORT_FORMATS.map(fmt => {
                const Icon = fmt.icon;
                return (
                  <DropdownMenuItem
                    key={fmt.key}
                    className="rounded-lg cursor-pointer gap-2 py-2"
                    onClick={() => generateExport.mutate({ id, format: fmt.key as any })}
                    disabled={generateExport.isPending}
                  >
                    <Icon className="w-4 h-4 text-gray-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{fmt.label}</p>
                      <p className="text-[10px] text-gray-400">{fmt.desc}</p>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="rounded-lg h-8 w-8 p-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-44">
              <DropdownMenuItem className="rounded-lg cursor-pointer gap-2" onClick={() => updateIdea.mutate({ id, status: "archived" })}>
                <Archive className="w-4 h-4" />归档
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-lg cursor-pointer gap-2 text-destructive focus:text-destructive" onClick={() => { toast.error("删除功能即将上线"); }}>
                <Trash2 className="w-4 h-4" />删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── MAIN BODY (3-column) ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <aside className="w-56 shrink-0 border-r border-gray-100 bg-gray-50/50 overflow-y-auto flex flex-col hidden lg:flex">
          {/* TOC */}
          <div className="p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <List className="w-3 h-3" />目录
            </p>
            <nav className="space-y-0.5">
              {toc.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={cn(
                    "w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5",
                    activeSection === item.id
                      ? "bg-amber-100 text-amber-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  {item.title}
                </button>
              ))}
            </nav>
          </div>

          <div className="border-t border-gray-100 mx-4" />

          {/* Version History */}
          <div className="p-4">
            <button
              className="w-full flex items-center justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 hover:text-gray-600"
              onClick={() => setShowVersions(v => !v)}
            >
              <span className="flex items-center gap-1.5"><GitBranch className="w-3 h-3" />版本历史</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", showVersions && "rotate-180")} />
            </button>
            {showVersions && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {versions?.length === 0 && (
                  <p className="text-[11px] text-gray-400 text-center py-2">暂无版本记录</p>
                )}
                {versions?.map(ver => (
                  <div key={ver.id} className="p-2 rounded-lg bg-white border border-gray-100 hover:border-amber-200 transition-colors">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <p className="text-[10px] font-medium text-gray-700">v{ver.versionNum}</p>
                        <p className="text-[9px] text-gray-400">{new Date(ver.createdAt).toLocaleDateString("zh-CN")}</p>
                        {ver.changeNote && <p className="text-[9px] text-gray-500 mt-0.5">{ver.changeNote}</p>}
                      </div>
                      <button
                        className="text-[9px] text-amber-600 hover:text-amber-700 flex items-center gap-0.5 shrink-0"
                        onClick={() => rollback.mutate({ ideaId: id, versionId: ver.id })}
                      >
                        <RotateCcw className="w-2.5 h-2.5" />回滚
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 mx-4" />

          {/* Related modules */}
          <div className="p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3 h-3" />关联模块
            </p>
            <div className="space-y-1.5">
              {[
                { icon: CheckSquare, label: "会议待办", color: "text-violet-600", bg: "bg-violet-50", href: "/meetings" },
                { icon: Users,       label: "访谈记录", color: "text-emerald-600", bg: "bg-emerald-50", href: "/interviews" },
                { icon: BookOpen,    label: "知识库条目", color: "text-blue-600", bg: "bg-blue-50", href: "/knowledge" },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-left"
                    onClick={() => toast.info(`关联${item.label}功能即将上线`)}
                  >
                    <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", item.bg)}>
                      <Icon className={cn("w-3 h-3", item.color)} />
                    </div>
                    <span className="text-xs text-gray-600">{item.label}</span>
                    <Plus className="w-3 h-3 text-gray-300 ml-auto" />
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── CENTER: CONTENT EDITOR ────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Tags row */}
            {isEditing ? (
              <div className="mb-6">
                <Input
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  placeholder="标签（逗号分隔）"
                  className="rounded-xl text-sm max-w-sm"
                />
              </div>
            ) : (
              (idea.tags as string[])?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {(idea.tags as string[]).map((tag, i) => {
                    const colors = ["bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700", "bg-sky-100 text-sky-700", "bg-pink-100 text-pink-700"];
                    return <span key={tag} className={cn("text-xs px-2.5 py-0.5 rounded-full font-medium", colors[i % colors.length])}>{tag}</span>;
                  })}
                </div>
              )
            )}

            {/* Modules */}
            <div className="space-y-8">
              {modules.map((mod) => (
                <div
                  key={mod.id}
                  ref={el => { sectionRefs.current[mod.id] = el; }}
                  className="scroll-mt-8"
                  onClick={() => setActiveSection(mod.id)}
                >
                  {/* Module header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-1 h-5 rounded-full bg-amber-400" />
                    <h2 className="font-display font-bold text-base text-gray-900">{mod.title}</h2>
                    {isEditing && (
                      <button
                        className="ml-auto text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
                        onClick={() => setEditingModuleId(editingModuleId === mod.id ? null : mod.id)}
                      >
                        <Edit3 className="w-3 h-3" />
                        {editingModuleId === mod.id ? "完成" : "编辑"}
                      </button>
                    )}
                  </div>

                  {/* Module content */}
                  {(isEditing && editingModuleId === mod.id) ? (
                    <Textarea
                      value={mod.content}
                      onChange={e => handleModuleChange(mod.id, e.target.value)}
                      placeholder={`在此输入「${mod.title}」的内容，支持 Markdown 格式...`}
                      className="rounded-xl min-h-32 resize-none text-sm leading-relaxed border-amber-200 focus-visible:ring-amber-300"
                      autoFocus
                    />
                  ) : (
                    <div
                      className={cn(
                        "min-h-12 rounded-xl p-4 text-sm leading-relaxed text-gray-700 transition-colors",
                        isEditing
                          ? "bg-gray-50 border border-dashed border-gray-200 cursor-pointer hover:border-amber-300 hover:bg-amber-50/30"
                          : "bg-gray-50/50"
                      )}
                      onClick={() => isEditing && setEditingModuleId(mod.id)}
                    >
                      {mod.content ? (
                        <div className="whitespace-pre-wrap">{mod.content}</div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">
                          {isEditing ? "点击编辑此模块..." : "（暂无内容）"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Reaction bar */}
            <div className="mt-12 pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-3 text-center">对这个想法有什么看法？</p>
              <div className="flex items-center justify-center gap-3">
                {[
                  { type: "useful" as const,   emoji: "👍", label: "有用",   count: reactions?.useful   || 0 },
                  { type: "discuss" as const,  emoji: "🤔", label: "待讨论", count: reactions?.discuss  || 0 },
                  { type: "question" as const, emoji: "❓", label: "有疑问", count: reactions?.question || 0 },
                ].map(r => (
                  <button
                    key={r.type}
                    onClick={() => addReaction.mutate({ ideaId: id, type: r.type })}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm",
                      reactions?.userReaction === r.type
                        ? "border-amber-400 bg-amber-50 text-amber-700 font-medium"
                        : "border-gray-200 hover:border-amber-300 hover:bg-amber-50/50 text-gray-600"
                    )}
                  >
                    <span className="text-base">{r.emoji}</span>
                    <span>{r.label}</span>
                    {r.count > 0 && <span className="text-xs font-semibold">{r.count}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR: COMMENTS ───────────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-l border-gray-100 flex flex-col hidden xl:flex">
          {/* Comments header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">评论</span>
              <span className="text-xs text-gray-400">({comments?.length || 0})</span>
            </div>
          </div>

          {/* Comment list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(!comments || comments.length === 0) && (
              <div className="text-center py-8 text-gray-400">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">暂无评论，来发表第一条吧</p>
              </div>
            )}
            {comments?.map((c) => (
              <div key={c.id} className="group">
                <div className={cn(
                  "p-3 rounded-xl text-xs leading-relaxed transition-colors",
                  c.parentId ? "ml-4 bg-gray-50 border border-gray-100" : "bg-white border border-gray-100 hover:border-amber-200"
                )}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[9px] font-bold text-amber-700">
                        {user?.name?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <span className="font-medium text-gray-700">{user?.name || "匿名用户"}</span>
                      {c.replyToUser && (
                        <span className="text-gray-400">回复 <span className="text-amber-600">@{c.replyToUser}</span></span>
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {new Date(c.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                  <p className="text-gray-700">{c.content}</p>
                  <button
                    className="mt-1.5 text-[10px] text-gray-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setReplyTo({ id: c.id, user: user?.name || "用户" })}
                  >
                    回复
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Comment input */}
          <div className="p-4 border-t border-gray-100 space-y-2">
            {replyTo && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-amber-50 rounded-lg text-xs text-amber-700">
                <span>回复 @{replyTo.user}</span>
                <button onClick={() => setReplyTo(null)} className="ml-auto"><X className="w-3 h-3" /></button>
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={replyTo ? `回复 @${replyTo.user}...` : "发表评论，支持 @提及..."}
                className="rounded-xl text-xs min-h-[60px] resize-none flex-1"
                onKeyDown={e => {
                  if (e.key === "Enter" && e.ctrlKey && commentText.trim()) {
                    addComment.mutate({
                      ideaId: id,
                      content: replyTo ? `@${replyTo.user} ${commentText}` : commentText,
                    });
                  }
                }}
              />
            </div>
            <Button
              size="sm"
              className="w-full rounded-xl h-8 bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
              onClick={() => commentText.trim() && addComment.mutate({
                ideaId: id,
                content: replyTo ? `@${replyTo.user} ${commentText}` : commentText,
              })}
              disabled={!commentText.trim() || addComment.isPending}
            >
              {addComment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              发送 <span className="text-[10px] opacity-60">Ctrl+Enter</span>
            </Button>
          </div>
        </aside>
      </div>

      {/* ── BOTTOM: DELIVERABLES ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <FileDown className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">交付物沉淀</span>
            <span className="text-xs text-gray-400 ml-1">AI 一键生成，可直接下载使用</span>
            {generateExport.isPending && (
              <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-600">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />AI 正在生成...
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {EXPORT_FORMATS.map(fmt => {
              const Icon = fmt.icon;
              return (
                <button
                  key={fmt.key}
                  onClick={() => generateExport.mutate({ id, format: fmt.key as any })}
                  disabled={generateExport.isPending}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-200 hover:border-amber-300 hover:shadow-sm transition-all text-left group disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 group-hover:bg-amber-200 transition-colors">
                    <Icon className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">{fmt.label}</p>
                    <p className="text-[10px] text-gray-400 leading-tight">{fmt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── EXPORT PREVIEW DIALOG ────────────────────────────────────────────── */}
      <Dialog open={exportDialog.open} onOpenChange={open => setExportDialog(p => ({ ...p, open }))}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-500" />
              {EXPORT_FORMATS.find(f => f.key === exportDialog.format)?.label} 预览
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-2">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono text-xs">
              {exportDialog.content}
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <Button
              className="flex-1 rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => {
                const blob = new Blob([exportDialog.content], { type: "text/plain;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${exportDialog.title}.${exportDialog.format === "video_script" ? "txt" : "md"}`;
                a.click();
                toast.success("已下载");
              }}
            >
              <Download className="w-4 h-4" />下载文件
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => { navigator.clipboard.writeText(exportDialog.content); toast.success("已复制到剪贴板"); }}>
              复制内容
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
