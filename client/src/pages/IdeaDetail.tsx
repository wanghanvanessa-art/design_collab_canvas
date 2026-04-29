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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Lightbulb, MoreHorizontal, Download, Share2, Bookmark,
  ChevronDown, Edit3, Archive, Trash2, Clock, GitBranch,
  FileText, List, Send, MessageSquare, Settings,
  Plus, X, Loader2, Eye, RotateCcw, ChevronRight, Layers,
  BookOpen, Users, CheckSquare, FileDown, Video, Globe,
  Sparkles, Brain, Zap, RefreshCw, ListTodo, Star,
  ChevronUp, AlertCircle, CheckCircle2, ExternalLink,
} from "lucide-react";
import { ModelConfigDialog } from "@/components/ModelConfigDialog";

// ─── Types ───────────────────────────────────────────────────────────────────
type Module = { id: string; title: string; content: string; isAI?: boolean };

const STATUS_CONFIG = {
  draft:     { label: "草稿",   color: "bg-gray-100 text-gray-600 border-gray-200" },
  published: { label: "发散中", color: "bg-amber-100 text-amber-600 border-amber-200" },
  archived:  { label: "已落地", color: "bg-emerald-100 text-emerald-600 border-emerald-200" },
};

const EXPORT_FORMATS = [
  { key: "pdf",          icon: FileDown,  label: "导出 PDF",      desc: "规范报告格式" },
  { key: "word",         icon: FileText,  label: "导出 Word",     desc: "方便二次编辑" },
  { key: "blog",         icon: Globe,     label: "生成博客",      desc: "对外发布排版" },
  { key: "video_script", icon: Video,     label: "视频脚本",      desc: "镜头结构拆分" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** 清理文本中的 Markdown 格式符号和乱码，保留纯文本 */
function cleanMarkdownSymbols(text: string): string {
  return text
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")   // 移除 *加粗/斜体* 包裹
    .replace(/^#{1,6}\s+/gm, "")                 // 移除行首 # 标题符号
    .replace(/`([^`]+)`/g, "$1")                  // 移除反引号包裹
    .replace(/\*{1,3}/g, "")                      // 移除残留的独立星号
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // 移除控制字符
    .replace(/\uFFFD/g, "");                      // 移除 Unicode 替换字符（乱码方块）
}

/** 将文本中的 Markdown 链接 [text](url) 和裸 URL 渲染为可点击的 <a> 标签，同时清理 Markdown 格式符号 */
function RichTextContent({ text }: { text: string }) {
  // 先清理 Markdown 格式符号
  const cleanedText = cleanMarkdownSymbols(text);
  // 匹配 Markdown 链接 [label](url) 或裸 https:// URL
  const TOKEN_RE = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s\])]+)/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(cleanedText)) !== null) {
    // 前面的普通文本
    if (match.index > lastIndex) {
      elements.push(cleanedText.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Markdown 链接: [label](url)
      elements.push(
        <a
          key={match.index}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 underline underline-offset-2 decoration-blue-300 hover:decoration-blue-500 transition-colors font-medium"
          onMouseDown={e => e.stopPropagation()}
        >
          {match[2]}
          <ExternalLink className="w-3 h-3 shrink-0 inline" />
        </a>
      );
    } else if (match[4]) {
      // 裸 URL
      elements.push(
        <a
          key={match.index}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 underline underline-offset-2 decoration-blue-300 hover:decoration-blue-500 transition-colors break-all"
          onMouseDown={e => e.stopPropagation()}
        >
          {match[4].length > 50 ? match[4].slice(0, 50) + "..." : match[4]}
          <ExternalLink className="w-3 h-3 shrink-0 inline" />
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // 尾部剩余文本
  if (lastIndex < cleanedText.length) {
    elements.push(cleanedText.slice(lastIndex));
  }

  return <>{elements}</>;
}

function parseModulesFromContent(content: string): Module[] {
  try { const p = JSON.parse(content); if (Array.isArray(p)) return p; } catch {}
  const lines = content.split("\n");
  const modules: Module[] = [];
  let current: Module | null = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(.+)/);
    if (m) {
      if (current) modules.push(current);
      current = { id: m[1].toLowerCase().replace(/[^a-z0-9]+/g, "_"), title: m[1], content: "" };
    } else if (current) {
      current.content += (current.content ? "\n" : "") + line;
    }
  }
  if (current) modules.push(current);
  return modules.length > 0 ? modules : [{ id: "main", title: "主要内容", content }];
}

function modulesToContent(modules: Module[]): string {
  return modules.map(m => `## ${m.title}\n\n${m.content}`).join("\n\n");
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
  const [modules, setModules] = useState<Module[]>([]);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState<{ id: number; user: string } | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [exportDialog, setExportDialog] = useState({ open: false, format: "", content: "", title: "" });
  const [activeSection, setActiveSection] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editTags, setEditTags] = useState("");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // AI state
  const [configOpen, setConfigOpen] = useState(false);
  const [continueStyle, setContinueStyle] = useState<"creative" | "professional" | "user_perspective">("creative");
  const [continueInstruction, setContinueInstruction] = useState("");
  const [continueModuleId, setContinueModuleId] = useState<string | null>(null);
  const [reviewResult, setReviewResult] = useState<any>(null);

  useEffect(() => {
    if (idea?.content) {
      const parsed = parseModulesFromContent(idea.content);
      setModules(parsed);
      if (parsed.length > 0 && !activeSection) setActiveSection(parsed[0].id);
    }
    if (idea?.title) setEditTitle(idea.title);
    if (idea?.tags) setEditTags((idea.tags as string[]).join(", "));
  }, [idea]);

  const updateIdea = trpc.ideas.update.useMutation({
    onSuccess: () => { toast.success("已保存"); setIsEditing(false); utils.ideas.get.invalidate({ id }); utils.ideas.versions.invalidate({ ideaId: id }); },
  });

  const deleteIdea = trpc.ideas.delete.useMutation({
    onSuccess: () => { toast.success("已删除"); navigate("/ideas"); },
    onError: (err) => toast.error(err.message || "删除失败"),
  });

  const rollback = trpc.ideas.rollbackVersion.useMutation({
    onSuccess: () => { toast.success("已回滚"); utils.ideas.get.invalidate({ id }); },
  });

  const addComment = trpc.ideas.addComment.useMutation({
    onSuccess: () => { setCommentText(""); setReplyTo(null); utils.ideas.comments.invalidate({ ideaId: id }); },
  });

  const addReaction = trpc.ideas.addReaction.useMutation({
    onSuccess: () => utils.ideas.reactions.invalidate({ ideaId: id }),
  });

  const generateExport = trpc.ideas.generateExport.useMutation({
    onSuccess: (data) => setExportDialog({ open: true, format: data.format, content: data.content, title: data.title }),
    onError: () => toast.error("生成失败"),
  });

  // AI mutations
  const aiContinue = trpc.ideas.aiContinueWrite.useMutation({
    onSuccess: (data) => {
      if (continueModuleId) {
        setModules(prev => prev.map(m =>
          m.id === continueModuleId ? { ...m, content: m.content + "\n\n" + data.text } : m
        ));
        toast.success("AI 续写完成");
      }
      setContinueModuleId(null);
      setContinueInstruction("");
    },
    onError: (err) => toast.error(err.message || "AI 续写失败"),
  });

  const aiReview = trpc.ideas.aiReview.useMutation({
    onSuccess: (data) => { setReviewResult(data); toast.success("AI 评审完成"); },
    onError: (err) => toast.error(err.message || "AI 评审失败"),
  });

  const aiConvertTodos = trpc.ideas.aiConvertToTodos.useMutation({
    onSuccess: (data) => toast.success(`已创建 ${data.created.length} 个待办`),
    onError: () => toast.error("转化待办失败"),
  });

  const aiSaveKnowledge = trpc.ideas.aiSaveToKnowledge.useMutation({
    onSuccess: () => toast.success("已沉淀到知识库"),
    onError: () => toast.error("保存知识库失败"),
  });

  const handleSave = useCallback(() => {
    updateIdea.mutate({ id, title: editTitle, content: modulesToContent(modules), tags: editTags.split(",").map(t => t.trim()).filter(Boolean), modules, changeNote: "手动保存" });
  }, [id, editTitle, editTags, modules, updateIdea]);

  const handleModuleChange = (moduleId: string, newContent: string) => {
    setModules(prev => prev.map(m => m.id === moduleId ? { ...m, content: newContent } : m));
  };

  const handleAIContinue = (moduleId: string) => {
    const mod = modules.find(m => m.id === moduleId);
    if (!mod) return;
    setContinueModuleId(moduleId);
    aiContinue.mutate({
      ideaId: id,
      existingContent: mod.content,
      instruction: continueInstruction || "请继续展开这个方向",
      style: continueStyle,
    });
  };

  const handleAIReview = () => {
    const content = modulesToContent(modules);
    if (!content.trim()) { toast.error("内容为空"); return; }
    aiReview.mutate({ ideaId: id, content });
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!idea) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Brain className="w-10 h-10 text-amber-300" />
      <p className="text-muted-foreground">创意不存在或无权访问</p>
      <Button variant="outline" onClick={() => navigate("/ideas")}>返回列表</Button>
    </div>
  );

  const statusCfg = STATUS_CONFIG[idea.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.draft;

  return (
    <div className="flex flex-col min-h-screen" style={{ height: "calc(100vh - 56px)" }}>
      {/* ── TOP HEADER ────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-30">
        <button onClick={() => navigate("/ideas")} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0 group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">创意列表</span>
        </button>
        <div className="w-px h-5 bg-gray-200 shrink-0" />
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-amber-600" />
          </div>
          {isEditing ? (
            <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="font-display font-bold text-base h-8 rounded-lg border-amber-300 focus-visible:ring-amber-300 max-w-sm" />
          ) : (
            <h1 className="font-display font-bold text-base text-gray-900 truncate">{idea.title}</h1>
          )}
          <Badge variant="outline" className={cn("text-xs shrink-0", statusCfg.color)}>{statusCfg.label}</Badge>
        </div>

        <div className="hidden md:flex items-center gap-3 text-xs text-gray-400 shrink-0">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(idea.createdAt).toLocaleDateString("zh-CN")}</span>
          <span className="flex items-center gap-1"><GitBranch className="w-3.5 h-3.5" />{versions?.length || 0} 版</span>
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

          {/* AI buttons */}
          <Button size="sm" variant="outline" className="rounded-lg h-8 gap-1.5 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={handleAIReview} disabled={aiReview.isPending}>
            {aiReview.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">AI 评审</span>
          </Button>

          <Button size="sm" variant="ghost" className="rounded-lg h-8" onClick={() => setConfigOpen(true)}>
            <Settings className="w-3.5 h-3.5" />
          </Button>

          <Button size="sm" variant="ghost" className="rounded-lg h-8" onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("链接已复制"); }}>
            <Share2 className="w-3.5 h-3.5" />
          </Button>

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="rounded-lg h-8 gap-1.5">
                <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">导出</span><ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-48">
              {EXPORT_FORMATS.map(fmt => {
                const Icon = fmt.icon;
                return (
                  <DropdownMenuItem key={fmt.key} className="rounded-lg cursor-pointer gap-2 py-2" onClick={() => generateExport.mutate({ id, format: fmt.key as any })} disabled={generateExport.isPending}>
                    <Icon className="w-4 h-4 text-gray-500" />
                    <div><p className="text-sm font-medium">{fmt.label}</p><p className="text-[10px] text-gray-400">{fmt.desc}</p></div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* More */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="rounded-lg h-8 w-8 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl w-44">
              <DropdownMenuItem className="rounded-lg cursor-pointer gap-2" onClick={() => aiSaveKnowledge.mutate({ ideaId: id, title: idea.title, content: modulesToContent(modules), tags: (idea.tags as string[]) || [] })}>
                <BookOpen className="w-4 h-4" />沉淀知识库
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg cursor-pointer gap-2" onClick={() => updateIdea.mutate({ id, status: "archived" })}>
                <Archive className="w-4 h-4" />标记已落地
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="rounded-lg cursor-pointer gap-2 text-destructive focus:text-destructive"
                onClick={() => { if (window.confirm("确定要删除这条创意吗？删除后不可恢复。")) deleteIdea.mutate({ id }); }}
              >
                <Trash2 className="w-4 h-4" />删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── MAIN BODY (3-column) ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR: AI Brain Tree + Versions ─────────────────────── */}
        <aside className="w-56 shrink-0 border-r border-gray-100 bg-gray-50/50 overflow-y-auto flex-col hidden lg:flex">
          {/* Brain tree nav */}
          <div className="p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Brain className="w-3 h-3" />创意脑图
            </p>
            <nav className="space-y-0.5">
              {modules.map((mod, i) => (
                <button
                  key={mod.id}
                  onClick={() => scrollToSection(mod.id)}
                  className={cn(
                    "w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5",
                    activeSection === mod.id ? "bg-amber-100 text-amber-700 font-medium" : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <ChevronRight className="w-3 h-3 shrink-0" />
                  <span className="truncate">{mod.title}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="border-t border-gray-100 mx-4" />

          {/* Version History */}
          <div className="p-4">
            <button className="w-full flex items-center justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 hover:text-gray-600" onClick={() => setShowVersions(v => !v)}>
              <span className="flex items-center gap-1.5"><GitBranch className="w-3 h-3" />版本历史</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform", showVersions && "rotate-180")} />
            </button>
            {showVersions && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {versions?.length === 0 && <p className="text-[11px] text-gray-400 text-center py-2">暂无版本记录</p>}
                {versions?.map(ver => (
                  <div key={ver.id} className="p-2 rounded-lg bg-white border border-gray-100 hover:border-amber-200 transition-colors">
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <p className="text-[10px] font-medium text-gray-700">v{ver.versionNum}</p>
                        <p className="text-[9px] text-gray-400">{new Date(ver.createdAt).toLocaleDateString("zh-CN")}</p>
                        {ver.changeNote && <p className="text-[9px] text-gray-500 mt-0.5">{ver.changeNote}</p>}
                      </div>
                      <button className="text-[9px] text-amber-600 hover:text-amber-700 flex items-center gap-0.5 shrink-0" onClick={() => rollback.mutate({ ideaId: id, versionId: ver.id })}>
                        <RotateCcw className="w-2.5 h-2.5" />回滚
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 mx-4" />

          {/* AI Style Selector */}
          <div className="p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Zap className="w-3 h-3" />续写风格
            </p>
            <Select value={continueStyle} onValueChange={v => setContinueStyle(v as any)}>
              <SelectTrigger className="rounded-lg h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="creative">🎨 创意发散</SelectItem>
                <SelectItem value="professional">📊 严谨专业</SelectItem>
                <SelectItem value="user_perspective">👤 用户视角</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-gray-100 mx-4" />

          {/* Related modules */}
          <div className="p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Layers className="w-3 h-3" />关联模块
            </p>
            <div className="space-y-1.5">
              {[
                { icon: CheckSquare, label: "待办清单", color: "text-violet-600", bg: "bg-violet-50", href: "/meetings" },
                { icon: Users, label: "访谈记录", color: "text-emerald-600", bg: "bg-emerald-50", href: "/interviews" },
                { icon: BookOpen, label: "知识库", color: "text-blue-600", bg: "bg-blue-50", href: "/knowledge" },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.label} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-left" onClick={() => navigate(item.href)}>
                    <div className={cn("w-5 h-5 rounded flex items-center justify-center shrink-0", item.bg)}><Icon className={cn("w-3 h-3", item.color)} /></div>
                    <span className="text-xs text-gray-600">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ── CENTER: AI Creative Canvas ──────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Topic title — 灵感问题标题 */}
            {isEditing ? (
              <div className="mb-4">
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="font-display font-extrabold text-2xl h-auto py-2 px-0 border-0 border-b-2 border-amber-300 rounded-none focus-visible:ring-0 focus-visible:border-amber-500 text-gray-900 bg-transparent"
                  placeholder="输入灵感问题标题..."
                />
              </div>
            ) : (
              <h1 className="font-display font-extrabold text-2xl text-gray-900 mb-4 leading-snug">{idea.title}</h1>
            )}

            {/* Tags row */}
            {isEditing ? (
              <div className="mb-6"><Input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="标签（逗号分隔）" className="rounded-xl text-sm max-w-sm" /></div>
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

            {/* Modules / Creative Cards */}
            <div className="space-y-6">
              {modules.map((mod) => (
                <div
                  key={mod.id}
                  ref={el => { sectionRefs.current[mod.id] = el; }}
                  className="scroll-mt-8 group"
                  onClick={() => setActiveSection(mod.id)}
                >
                  <div className="p-5 rounded-2xl border border-gray-100 hover:border-amber-200 transition-all hover:shadow-sm bg-white">
                    {/* Module header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1.5 h-5 rounded-full bg-amber-400" />
                      <h2 className="font-display font-bold text-base text-gray-900 flex-1">{mod.title}</h2>
                      {/* AI continue button */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isEditing && (
                          <button className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-amber-50" onClick={() => setEditingModuleId(editingModuleId === mod.id ? null : mod.id)}>
                            <Edit3 className="w-3 h-3" />{editingModuleId === mod.id ? "完成" : "编辑"}
                          </button>
                        )}
                        <button
                          className="text-xs text-violet-600 hover:text-violet-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-violet-50"
                          onClick={() => handleAIContinue(mod.id)}
                          disabled={aiContinue.isPending}
                        >
                          {aiContinue.isPending && continueModuleId === mod.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                          续写
                        </button>
                      </div>
                    </div>

                    {/* Module content */}
                    {(isEditing && editingModuleId === mod.id) ? (
                      <div className="space-y-2">
                        <Textarea
                          value={mod.content}
                          onChange={e => handleModuleChange(mod.id, e.target.value)}
                          placeholder={`在此编辑「${mod.title}」的内容...`}
                          className="rounded-xl min-h-32 resize-none text-sm leading-relaxed border-amber-200 focus-visible:ring-amber-300"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "min-h-8 text-sm leading-relaxed text-gray-700 transition-colors",
                          isEditing && "cursor-pointer hover:bg-amber-50/30 rounded-lg p-2 -m-2"
                        )}
                        onClick={() => isEditing && setEditingModuleId(mod.id)}
                      >
                        {mod.content?.trim() ? (
                          <div className="whitespace-pre-wrap"><RichTextContent text={mod.content.trim()} /></div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">{isEditing ? "点击编辑..." : "（暂无内容）"}</span>
                        )}
                      </div>
                    )}

                    {/* AI continue instruction (inline) */}
                    {continueModuleId === mod.id && !aiContinue.isPending && (
                      <div className="mt-3 flex gap-2">
                        <Input
                          value={continueInstruction}
                          onChange={e => setContinueInstruction(e.target.value)}
                          placeholder="输入续写指令（如：从用户场景角度展开）"
                          className="rounded-lg text-xs h-8 flex-1"
                          onKeyDown={e => e.key === "Enter" && handleAIContinue(mod.id)}
                        />
                        <Button size="sm" className="rounded-lg h-8 bg-violet-500 hover:bg-violet-600" onClick={() => handleAIContinue(mod.id)}>
                          <Sparkles className="w-3 h-3 mr-1" />续写
                        </Button>
                        <Button size="sm" variant="ghost" className="rounded-lg h-8" onClick={() => setContinueModuleId(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Reaction bar */}
            <div className="mt-10 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-center gap-3">
                {[
                  { type: "useful" as const, emoji: "👍", label: "有用", count: reactions?.useful || 0 },
                  { type: "discuss" as const, emoji: "🤔", label: "待讨论", count: reactions?.discuss || 0 },
                  { type: "question" as const, emoji: "❓", label: "有疑问", count: reactions?.question || 0 },
                ].map(r => (
                  <button key={r.type} onClick={() => addReaction.mutate({ ideaId: id, type: r.type })} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm", reactions?.userReaction === r.type ? "border-amber-400 bg-amber-50 text-amber-700 font-medium" : "border-gray-200 hover:border-amber-300 text-gray-600")}>
                    <span className="text-base">{r.emoji}</span><span>{r.label}</span>{r.count > 0 && <span className="text-xs font-semibold">{r.count}</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR: AI Review + Comments ────────────────────────── */}
        <aside className="w-80 shrink-0 border-l border-gray-100 flex flex-col hidden xl:flex">
          {/* AI Review section */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-gray-700">AI 方案评审</span>
            </div>
          </div>
          <div className="px-4 py-3 border-b border-gray-100 overflow-y-auto" style={{ maxHeight: "45%" }}>
            {aiReview.isPending ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-amber-500" /><span className="ml-2 text-xs text-gray-400">AI 评审中...</span></div>
            ) : reviewResult ? (
              <div className="space-y-3">
                {/* Overall score */}
                <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <div className="text-2xl font-bold text-amber-600">{reviewResult.overallScore || "—"}</div>
                  <div className="flex-1"><p className="text-xs font-medium text-amber-800">综合评分</p><p className="text-[10px] text-amber-600">{reviewResult.summary?.slice(0, 60)}</p></div>
                </div>
                {/* Dimensions */}
                {reviewResult.dimensions?.map((dim: any, i: number) => {
                  const colors = ["text-blue-600 bg-blue-50 border-blue-100", "text-emerald-600 bg-emerald-50 border-emerald-100", "text-violet-600 bg-violet-50 border-violet-100"];
                  return (
                    <div key={i} className={cn("p-3 rounded-xl border", colors[i % 3])}>
                      <div className="flex items-center justify-between mb-1"><span className="text-xs font-semibold">{dim.name}</span><span className="text-xs font-bold">{dim.score}/10</span></div>
                      <p className="text-[11px] leading-relaxed mb-1.5">{dim.feedback}</p>
                      {dim.suggestions?.map((s: string, si: number) => (
                        <p key={si} className="text-[10px] opacity-80 flex items-start gap-1"><span>•</span>{s}</p>
                      ))}
                    </div>
                  );
                })}
                {/* Action items → convert to todos */}
                {reviewResult.actionItems?.length > 0 && (
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700 flex items-center gap-1"><ListTodo className="w-3 h-3" />行动项</span>
                      <button
                        className="text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-0.5"
                        onClick={() => aiConvertTodos.mutate({ ideaId: id, actionItems: reviewResult.actionItems })}
                        disabled={aiConvertTodos.isPending}
                      >
                        {aiConvertTodos.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <CheckSquare className="w-2.5 h-2.5" />}
                        转为待办
                      </button>
                    </div>
                    {reviewResult.actionItems.map((item: string, i: number) => (
                      <p key={i} className="text-[11px] text-gray-600 flex items-start gap-1.5 mb-1"><CheckCircle2 className="w-3 h-3 text-gray-400 mt-0.5 shrink-0" />{item}</p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">点击顶部「AI 评审」按钮</p>
                <p className="text-[10px] mt-0.5">获取多维度方案反馈</p>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-700">评论</span>
            <span className="text-xs text-gray-400">({comments?.length || 0})</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {(!comments || comments.length === 0) && (
              <div className="text-center py-6 text-gray-400"><MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-30" /><p className="text-xs">暂无评论</p></div>
            )}
            {comments?.map((c) => (
              <div key={c.id} className="group">
                <div className={cn("p-3 rounded-xl text-xs leading-relaxed", c.parentId ? "ml-4 bg-gray-50 border border-gray-100" : "bg-white border border-gray-100 hover:border-amber-200")}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[9px] font-bold text-amber-700">{user?.name?.charAt(0)?.toUpperCase() || "U"}</div>
                      <span className="font-medium text-gray-700">{user?.name || "用户"}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                  <p className="text-gray-700">{c.content}</p>
                  <button className="mt-1.5 text-[10px] text-gray-400 hover:text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setReplyTo({ id: c.id, user: user?.name || "用户" })}>回复</button>
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
              <Textarea value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="发表评论..." className="rounded-xl text-xs min-h-[50px] resize-none flex-1" onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey && commentText.trim()) addComment.mutate({ ideaId: id, content: commentText }); }} />
            </div>
            <Button size="sm" className="w-full rounded-xl h-8 bg-amber-500 hover:bg-amber-600 text-white gap-1.5" onClick={() => commentText.trim() && addComment.mutate({ ideaId: id, content: commentText })} disabled={!commentText.trim() || addComment.isPending}>
              {addComment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              发送
            </Button>
          </div>
        </aside>
      </div>

      {/* ── BOTTOM: Deliverables ────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-3 overflow-x-auto">
          <span className="text-xs font-semibold text-gray-500 shrink-0 flex items-center gap-1.5"><FileDown className="w-3.5 h-3.5" />一键交付</span>
          {EXPORT_FORMATS.map(fmt => {
            const Icon = fmt.icon;
            return (
              <button key={fmt.key} onClick={() => generateExport.mutate({ id, format: fmt.key as any })} disabled={generateExport.isPending} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-amber-300 hover:shadow-sm transition-all text-left shrink-0 disabled:opacity-50">
                <Icon className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-medium text-gray-700">{fmt.label}</span>
              </button>
            );
          })}
          <button onClick={() => aiSaveKnowledge.mutate({ ideaId: id, title: idea.title, content: modulesToContent(modules), tags: (idea.tags as string[]) || [] })} disabled={aiSaveKnowledge.isPending} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all shrink-0 disabled:opacity-50">
            <BookOpen className="w-3.5 h-3.5 text-blue-600" />
            <span className="text-xs font-medium text-gray-700">沉淀知识库</span>
          </button>
        </div>
      </div>

      {/* ── Export preview dialog ──────────────────────────────────────────── */}
      <Dialog open={exportDialog.open} onOpenChange={open => setExportDialog(p => ({ ...p, open }))}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-500" />
              {EXPORT_FORMATS.find(f => f.key === exportDialog.format)?.label} 预览
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto mt-2">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono text-xs">{exportDialog.content}</div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-gray-100">
            <Button className="flex-1 rounded-xl gap-2 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => { const blob = new Blob([exportDialog.content], { type: "text/plain;charset=utf-8" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${exportDialog.title}.${exportDialog.format === "video_script" ? "txt" : "md"}`; a.click(); toast.success("已下载"); }}>
              <Download className="w-4 h-4" />下载
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => { navigator.clipboard.writeText(exportDialog.content); toast.success("已复制"); }}>复制</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ModelConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  );
}