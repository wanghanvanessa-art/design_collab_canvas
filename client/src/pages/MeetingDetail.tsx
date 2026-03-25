import { useState, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Play, Pause, Download, FileText, FileSpreadsheet, Calendar,
  CheckCircle2, Circle, Clock, User, ChevronDown, ChevronRight,
  Loader2, AlertTriangle, Zap, GitBranch, MessageSquare, Send,
  BarChart3, Target, TrendingUp, Mic2, Users, Tag, Edit3, Check, X,
  ExternalLink, BookOpen, Sparkles, ListTodo, Filter,
} from "lucide-react";

// ─── Priority config ──────────────────────────────────────────────────────────
const PRIORITY = {
  high:   { label: "高", color: "text-red-600",   bg: "bg-red-50",   border: "border-red-200",   dot: "bg-red-400" },
  medium: { label: "中", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-400" },
  low:    { label: "低", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-400" },
};

const INSIGHT_CONFIG = {
  risk:     { label: "风险", icon: AlertTriangle, color: "text-red-600",   bg: "bg-red-50",    border: "border-red-200" },
  action:   { label: "行动", icon: Zap,           color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  decision: { label: "决策", icon: GitBranch,     color: "text-sky-600",   bg: "bg-sky-50",    border: "border-sky-200" },
};

// ─── Inline editable todo row ─────────────────────────────────────────────────
function TodoRow({ todo, onUpdate }: {
  todo: any;
  onUpdate: (id: number, updates: any) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);
  const [editAssignee, setEditAssignee] = useState(todo.assignee || "");
  const [editDue, setEditDue] = useState(todo.dueDate || "");
  const p = PRIORITY[todo.priority as keyof typeof PRIORITY] || PRIORITY.medium;

  const save = () => {
    onUpdate(todo.id, { title: editTitle, assignee: editAssignee || undefined, dueDate: editDue || undefined });
    setEditing(false);
  };

  return (
    <div className={cn(
      "group flex items-start gap-3 p-3 rounded-xl border transition-all",
      todo.completed ? "bg-gray-50 border-gray-100 opacity-60" : `${p.bg} ${p.border}`
    )}>
      {/* Checkbox */}
      <button
        onClick={() => onUpdate(todo.id, { completed: !todo.completed })}
        className="mt-0.5 shrink-0"
      >
        {todo.completed
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : <Circle className="w-4 h-4 text-gray-400 hover:text-emerald-400 transition-colors" />
        }
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <Input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="h-7 text-sm rounded-lg"
              autoFocus
            />
            <div className="flex gap-2">
              <Input
                placeholder="责任人"
                value={editAssignee}
                onChange={e => setEditAssignee(e.target.value)}
                className="h-6 text-xs rounded-lg flex-1"
              />
              <Input
                type="date"
                value={editDue}
                onChange={e => setEditDue(e.target.value)}
                className="h-6 text-xs rounded-lg flex-1"
              />
            </div>
            <div className="flex gap-1.5">
              <button onClick={save} className="p-1 rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">
                <Check className="w-3 h-3" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className={cn("text-sm font-medium leading-tight", todo.completed && "line-through")}>{todo.title}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Priority badge */}
              <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", p.color, "bg-white/70")}>
                {p.label}优先
              </span>
              {todo.assignee && (
                <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                  <User className="w-2.5 h-2.5" />{todo.assignee}
                </span>
              )}
              {todo.dueDate && (
                <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                  <Clock className="w-2.5 h-2.5" />{todo.dueDate}
                </span>
              )}
              {todo.sourceType === "meeting" && (
                <span className="flex items-center gap-0.5 text-[10px] text-violet-500">
                  <Mic2 className="w-2.5 h-2.5" />来自会议
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit button */}
      {!editing && !todo.completed && (
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-white/60"
        >
          <Edit3 className="w-3 h-3 text-gray-400" />
        </button>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const meetingId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [activeSection, setActiveSection] = useState("summary");
  const audioRef = useRef<HTMLAudioElement>(null);

  // Queries
  const { data: meeting, isLoading } = trpc.meetings.getById.useQuery(
    { id: meetingId },
    { enabled: !!meetingId }
  );
  const { data: comments = [] } = trpc.meetings.listComments.useQuery(
    { meetingId },
    { enabled: !!meetingId }
  );

  // Mutations
  const addComment = trpc.meetings.addComment.useMutation({
    onSuccess: () => {
      setCommentText("");
      utils.meetings.listComments.invalidate({ meetingId });
    },
    onError: () => toast.error("评论失败"),
  });

  const updateTodo = trpc.meetings.updateTodo.useMutation({
    onSuccess: () => utils.meetings.getById.invalidate({ id: meetingId }),
    onError: () => toast.error("更新失败"),
  });

  // Helpers
  const formatDuration = (sec?: number | null) => {
    if (!sec) return "--";
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  const statusMap = {
    uploading:   { label: "上传中",   color: "bg-blue-100 text-blue-700" },
    transcribing:{ label: "转录中",   color: "bg-amber-100 text-amber-700" },
    analyzing:   { label: "分析中",   color: "bg-violet-100 text-violet-700" },
    done:        { label: "已完成",   color: "bg-emerald-100 text-emerald-700" },
    error:       { label: "处理失败", color: "bg-red-100 text-red-700" },
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Mic2 className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500">会议记录不存在</p>
        <Button variant="outline" onClick={() => navigate("/meetings")}>返回列表</Button>
      </div>
    );
  }

  const allTodos = (meeting.todos || []) as any[];
  const filteredTodos = filterPriority === "all"
    ? allTodos
    : allTodos.filter(t => t.priority === filterPriority);
  const doneTodos = allTodos.filter(t => t.completed).length;
  const progress = allTodos.length > 0 ? Math.round((doneTodos / allTodos.length) * 100) : 0;

  const minutes = (meeting.structuredMinutes || []) as any[];
  const insights = (meeting.aiInsights || []) as any[];
  const attendees = (meeting.attendees || []) as string[];

  const toc = [
    { id: "summary",  label: "会议摘要",   icon: FileText },
    { id: "minutes",  label: "结构化纪要", icon: BookOpen },
    { id: "insights", label: "AI 洞察",    icon: Sparkles },
    { id: "todos",    label: "待办清单",   icon: ListTodo },
  ];

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px)" }}>

      {/* ── TOP HEADER ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4 sticky top-0 z-30">
        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          <span className="hidden sm:inline">返回主页</span>
        </button>
        <div className="w-px h-5 bg-gray-200 shrink-0" />

        {/* Title + meta */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
            <Mic2 className="w-4 h-4 text-violet-600" />
          </div>
          <div className="min-w-0">
            <h1 className="font-display font-bold text-base text-gray-900 truncate">{meeting.title}</h1>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(meeting.createdAt)}</span>
              {meeting.duration && <span className="flex items-center gap-1"><Play className="w-3 h-3" />{formatDuration(meeting.duration)}</span>}
              {attendees.length > 0 && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{attendees.join("、")}</span>}
            </div>
          </div>
        </div>

        {/* Status */}
        <Badge className={cn("text-xs shrink-0", statusMap[meeting.status as keyof typeof statusMap]?.color || "bg-gray-100 text-gray-600")}>
          {statusMap[meeting.status as keyof typeof statusMap]?.label || meeting.status}
        </Badge>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Play audio */}
          {meeting.audioUrl && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 text-xs"
              onClick={() => {
                if (audioRef.current) {
                  isPlaying ? audioRef.current.pause() : audioRef.current.play();
                  setIsPlaying(!isPlaying);
                }
              }}
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {isPlaying ? "暂停" : "播放录音"}
            </Button>
          )}
          {/* Export PDF */}
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-xs"
            onClick={() => toast.info("正在生成 PDF 纪要...")}
          >
            <FileText className="w-3 h-3" />导出纪要
          </Button>
          {/* Export Excel */}
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5 text-xs"
            onClick={() => toast.info("正在导出待办 Excel...")}
          >
            <FileSpreadsheet className="w-3 h-3" />导出待办
          </Button>
          {/* Sync calendar */}
          <Button
            size="sm"
            className="rounded-xl gap-1.5 text-xs bg-violet-600 hover:bg-violet-700"
            onClick={() => toast.info("已同步到团队日历")}
          >
            <Calendar className="w-3 h-3" />同步日历
          </Button>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT SIDEBAR ─────────────────────────────────────────────────── */}
        <aside className="w-52 shrink-0 border-r border-gray-100 bg-gray-50/50 flex flex-col overflow-y-auto">
          {/* TOC */}
          <div className="p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">目录</p>
            <nav className="space-y-0.5">
              {toc.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    document.getElementById(`section-${item.id}`)?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all text-left",
                    activeSection === item.id
                      ? "bg-violet-100 text-violet-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <item.icon className="w-3.5 h-3.5 shrink-0" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="mx-4 border-t border-gray-200" />

          {/* Todo filter */}
          <div className="p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">待办筛选</p>
            <div className="space-y-1">
              {[
                { v: "all",    label: "全部", count: allTodos.length },
                { v: "high",   label: "高优先", count: allTodos.filter(t => t.priority === "high").length },
                { v: "medium", label: "中优先", count: allTodos.filter(t => t.priority === "medium").length },
                { v: "low",    label: "低优先", count: allTodos.filter(t => t.priority === "low").length },
              ].map(f => (
                <button
                  key={f.v}
                  onClick={() => setFilterPriority(f.v)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all",
                    filterPriority === f.v ? "bg-violet-100 text-violet-700 font-medium" : "text-gray-500 hover:bg-gray-100"
                  )}
                >
                  <span>{f.label}</span>
                  <span className="text-[10px] bg-white rounded-full px-1.5 py-0.5 text-gray-500">{f.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mx-4 border-t border-gray-200" />

          {/* Related modules */}
          <div className="p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">关联模块</p>
            <div className="space-y-1">
              {[
                { label: "想法落地页", icon: BookOpen, href: "/ideas" },
                { label: "设计知识库", icon: Tag,      href: "/knowledge" },
                { label: "用户访谈",   icon: Users,    href: "/interviews" },
              ].map(m => (
                <button
                  key={m.label}
                  onClick={() => navigate(m.href)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 transition-all"
                >
                  <m.icon className="w-3 h-3" />
                  {m.label}
                  <ExternalLink className="w-2.5 h-2.5 ml-auto opacity-50" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── MAIN CONTENT (double column) ─────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-0 h-full divide-x divide-gray-100">

            {/* LEFT: Meeting minutes */}
            <div className="overflow-y-auto p-6 space-y-6">

              {/* Summary */}
              <section id="section-summary">
                <h2 className="font-display font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-500" />会议摘要
                </h2>
                {meeting.summary ? (
                  <div className="p-4 rounded-xl bg-violet-50 border border-violet-100 text-sm text-gray-700 leading-relaxed">
                    {meeting.summary}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-400 text-center">
                    {meeting.status === "done" ? "暂无摘要" : "AI 正在分析中..."}
                  </div>
                )}
              </section>

              {/* Key Insights */}
              {(meeting.keyInsights as string[] || []).length > 0 && (
                <section>
                  <h2 className="font-display font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-500" />核心洞察
                  </h2>
                  <div className="space-y-2">
                    {(meeting.keyInsights as string[]).map((insight, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-100">
                        <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                        <p className="text-sm text-gray-700">{insight}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Structured minutes */}
              <section id="section-minutes">
                <h2 className="font-display font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-sky-500" />结构化纪要
                  <span className="text-[10px] text-gray-400 font-normal">（发言人 · 时间戳 · 内容）</span>
                </h2>
                {minutes.length > 0 ? (
                  <div className="space-y-2">
                    {minutes.map((m: any, i: number) => (
                      <div
                        key={i}
                        className={cn(
                          "p-3 rounded-xl border text-sm",
                          m.isConclusion
                            ? "bg-emerald-50 border-emerald-200"
                            : "bg-white border-gray-100"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-xs text-violet-700">{m.speaker}</span>
                          <span className="text-[10px] text-gray-400">{m.timestamp}</span>
                          {m.isConclusion && (
                            <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0 px-1.5 py-0">结论</Badge>
                          )}
                        </div>
                        <p className="text-gray-700 leading-relaxed">{m.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-400 text-center">
                    {meeting.status === "done" ? "暂无结构化纪要" : "AI 正在生成纪要..."}
                  </div>
                )}
              </section>

              {/* AI Insights */}
              <section id="section-insights">
                <h2 className="font-display font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-500" />AI 洞察
                </h2>
                {insights.length > 0 ? (
                  <div className="space-y-2">
                    {insights.map((ins: any, i: number) => {
                      const cfg = INSIGHT_CONFIG[ins.type as keyof typeof INSIGHT_CONFIG] || INSIGHT_CONFIG.action;
                      return (
                        <div key={i} className={cn("flex items-start gap-2.5 p-3 rounded-xl border", cfg.bg, cfg.border)}>
                          <cfg.icon className={cn("w-4 h-4 shrink-0 mt-0.5", cfg.color)} />
                          <div>
                            <span className={cn("text-[10px] font-semibold mr-2", cfg.color)}>{cfg.label}</span>
                            <span className="text-sm text-gray-700">{ins.content}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-400 text-center">
                    {meeting.status === "done" ? "暂无 AI 洞察" : "AI 正在分析..."}
                  </div>
                )}
              </section>
            </div>

            {/* RIGHT: Todo list */}
            <div className="overflow-y-auto p-6" id="section-todos">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-sm text-gray-700 flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-violet-500" />待办清单
                  <span className="text-xs text-gray-400 font-normal">{doneTodos}/{allTodos.length} 完成</span>
                </h2>
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-gray-400" />
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="h-7 text-xs rounded-lg w-24 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">全部</SelectItem>
                      <SelectItem value="high">🔴 高优先</SelectItem>
                      <SelectItem value="medium">🟡 中优先</SelectItem>
                      <SelectItem value="low">🟢 低优先</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                  <span>整体进度</span>
                  <span className="font-semibold text-violet-600">{progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-400 to-violet-600 rounded-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Todo items */}
              {filteredTodos.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <ListTodo className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无待办事项</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Pending */}
                  {filteredTodos.filter(t => !t.completed).map(todo => (
                    <TodoRow
                      key={todo.id}
                      todo={todo}
                      onUpdate={(id, updates) => updateTodo.mutate({ id, ...updates })}
                    />
                  ))}
                  {/* Completed */}
                  {filteredTodos.filter(t => t.completed).length > 0 && (
                    <>
                      <div className="flex items-center gap-2 pt-2">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-[10px] text-gray-400">已完成 {filteredTodos.filter(t => t.completed).length} 项</span>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                      {filteredTodos.filter(t => t.completed).map(todo => (
                        <TodoRow
                          key={todo.id}
                          todo={todo}
                          onUpdate={(id, updates) => updateTodo.mutate({ id, ...updates })}
                        />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 border-l border-gray-100 bg-gray-50/50 flex flex-col overflow-y-auto">

          {/* Progress visualization */}
          <div className="p-4 border-b border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">待办进度</p>
            <div className="flex items-center gap-3">
              {/* Donut */}
              <div className="relative w-14 h-14 shrink-0">
                <svg viewBox="0 0 56 56" className="w-14 h-14 -rotate-90">
                  <circle cx="28" cy="28" r="22" fill="none" stroke="#f3f4f6" strokeWidth="6" />
                  <circle
                    cx="28" cy="28" r="22" fill="none"
                    stroke="#7c3aed" strokeWidth="6"
                    strokeDasharray={`${2 * Math.PI * 22}`}
                    strokeDashoffset={`${2 * Math.PI * 22 * (1 - progress / 100)}`}
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-violet-700">{progress}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  已完成 {doneTodos} 项
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-gray-200" />
                  待处理 {allTodos.length - doneTodos} 项
                </div>
              </div>
            </div>
            {/* Priority breakdown */}
            <div className="mt-3 space-y-1.5">
              {(["high", "medium", "low"] as const).map(p => {
                const cnt = allTodos.filter(t => t.priority === p).length;
                const cfg = PRIORITY[p];
                return (
                  <div key={p} className="flex items-center gap-2">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
                    <span className="text-[10px] text-gray-500 w-10">{cfg.label}优先</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", cfg.dot)}
                        style={{ width: allTodos.length > 0 ? `${(cnt / allTodos.length) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400 w-4 text-right">{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Insights panel (compact) */}
          {insights.length > 0 && (
            <div className="p-4 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">AI 洞察摘要</p>
              <div className="space-y-1.5">
                {insights.slice(0, 3).map((ins: any, i: number) => {
                  const cfg = INSIGHT_CONFIG[ins.type as keyof typeof INSIGHT_CONFIG] || INSIGHT_CONFIG.action;
                  return (
                    <div key={i} className={cn("flex items-start gap-1.5 p-2 rounded-lg text-xs", cfg.bg)}>
                      <cfg.icon className={cn("w-3 h-3 shrink-0 mt-0.5", cfg.color)} />
                      <p className="text-gray-600 line-clamp-2">{ins.content}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="flex-1 flex flex-col p-4 min-h-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              评论互动 <span className="text-gray-300">({comments.length})</span>
            </p>
            <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-0">
              {comments.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <MessageSquare className="w-6 h-6 mx-auto mb-1 opacity-30" />
                  <p className="text-xs">暂无评论</p>
                </div>
              ) : (
                comments.map((c: any) => (
                  <div key={c.id} className="p-2.5 rounded-xl bg-white border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-[10px] font-bold text-violet-700">
                        {(c.userName || "?")[0].toUpperCase()}
                      </div>
                      <span className="text-[10px] font-medium text-gray-700">{c.userName || "匿名"}</span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {new Date(c.createdAt).toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">{c.content}</p>
                  </div>
                ))
              )}
            </div>
            {/* Comment input */}
            <div className="flex gap-1.5">
              <Textarea
                placeholder="添加评论..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                className="text-xs rounded-xl resize-none min-h-[60px] border-gray-200"
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && commentText.trim()) {
                    addComment.mutate({ meetingId, content: commentText });
                  }
                }}
              />
              <Button
                size="sm"
                className="rounded-xl self-end px-2 bg-violet-600 hover:bg-violet-700"
                disabled={!commentText.trim() || addComment.isPending}
                onClick={() => addComment.mutate({ meetingId, content: commentText })}
              >
                {addComment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Ctrl+Enter 快速发送</p>
          </div>
        </aside>
      </div>

      {/* ── BOTTOM DELIVERY ZONE ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-gray-500 shrink-0">交付物</span>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { icon: FileText,        label: "纪要 PDF",  desc: "规范报告格式，含封面目录",  color: "text-violet-600 bg-violet-50 border-violet-200" },
              { icon: FileSpreadsheet, label: "待办 Excel", desc: "含优先级、责任人、截止时间", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
              { icon: Calendar,        label: "同步日历",  desc: "将待办同步到团队日历",       color: "text-sky-600 bg-sky-50 border-sky-200" },
              { icon: BookOpen,        label: "存入知识库", desc: "将纪要沉淀为知识库条目",     color: "text-amber-600 bg-amber-50 border-amber-200" },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => toast.info(`${item.label}功能即将上线`)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all hover:shadow-sm",
                  item.color
                )}
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-[10px] opacity-70">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      {meeting.audioUrl && (
        <audio
          ref={audioRef}
          src={meeting.audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}
