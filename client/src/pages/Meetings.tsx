import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import {
  Mic2, Upload, Plus, CheckCircle2, Circle, Clock, User,
  Loader2, FileAudio, Trash2, AlertCircle,
  Sparkles, ListTodo, ArrowRight, ExternalLink,
  MicOff, Square, BookOpen, Check, Pause,
  FileText, Link2, Settings, Send,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { ModelConfigDialog } from "@/components/ModelConfigDialog";

const priorityConfig = {
  high: { label: "高优先级", class: "priority-high", dot: "bg-red-400" },
  medium: { label: "中优先级", class: "priority-medium", dot: "bg-amber-400" },
  low: { label: "低优先级", class: "priority-low", dot: "bg-emerald-400" },
};

// ─── Save to Knowledge Dialog ─────────────────────────────────────────────────
function SaveToKnowledgeDialog({
  meeting,
  open,
  onOpenChange,
}: {
  meeting: { id: number; title: string; summary?: string | null; keyInsights?: string[] | null };
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [title, setTitle] = useState(`记事纪要：${meeting.title}`);
  const [tags, setTags] = useState("待办记事");
  const [saved, setSaved] = useState(false);

  const content = [
    meeting.summary ? `## 内容摘要\n${meeting.summary}` : "",
    meeting.keyInsights && (meeting.keyInsights as string[]).length > 0
      ? `## 核心要点\n${(meeting.keyInsights as string[]).map((k, i) => `${i + 1}. ${k}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n") || `来源记事：${meeting.title}`;

  const saveToKnowledge = trpc.meetings.saveToKnowledge.useMutation({
    onSuccess: () => {
      setSaved(true);
      toast.success("已成功保存到知识库！");
      setTimeout(() => { onOpenChange(false); setSaved(false); }, 1500);
    },
    onError: () => toast.error("保存失败，请重试"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            保存到知识库
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">知识库条目标题</label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="rounded-xl"
              placeholder="输入标题"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">内容预览</label>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-600 max-h-32 overflow-y-auto whitespace-pre-wrap leading-relaxed">
              {content}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">标签（逗号分隔）</label>
            <Input
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="rounded-xl"
              placeholder="待办记事, 设计决策"
            />
          </div>
          <Button
            className="w-full rounded-xl"
            onClick={() => saveToKnowledge.mutate({
              meetingId: meeting.id,
              title: title.trim() || `记事纪要：${meeting.title}`,
              content,
              tags: tags.split(",").map(t => t.trim()).filter(Boolean),
              category: "待办记事",
            })}
            disabled={saveToKnowledge.isPending || saved}
          >
            {saved ? (
              <><Check className="w-4 h-4 mr-2" />已保存</>
            ) : saveToKnowledge.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" />保存中...</>
            ) : (
              <><BookOpen className="w-4 h-4 mr-2" />保存到知识库</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Meetings() {
  const [, navigate] = useLocation();
  const [configOpen, setConfigOpen] = useState(false);
  const [newTodoOpen, setNewTodoOpen] = useState(false);
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [newTodo, setNewTodo] = useState({ title: "", priority: "medium" as "high" | "medium" | "low", assignee: "", dueDate: "" });
  const utils = trpc.useUtils();

  // Analyze form state
  const [analyzeTitle, setAnalyzeTitle] = useState("");
  const [analyzeContent, setAnalyzeContent] = useState("");
  const [analyzeLink, setAnalyzeLink] = useState("");

  // Save to knowledge dialog
  const [saveKnowledgeMeeting, setSaveKnowledgeMeeting] = useState<any>(null);

  const { data: meetings, isLoading: meetingsLoading } = trpc.meetings.list.useQuery(undefined, {
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.some((m: any) => m.status === "analyzing" || m.status === "transcribing")) return 2000;
      return false;
    },
  });
  const { data: todos, isLoading: todosLoading } = trpc.todos.list.useQuery({ priority: filterPriority === "all" ? undefined : filterPriority as any });

  const analyzeText = trpc.meetings.analyzeText.useMutation({
    onSuccess: () => {
      toast.success("已提交，AI 正在解析生成待办...");
      setAnalyzeOpen(false);
      setAnalyzeTitle("");
      setAnalyzeContent("");
      setAnalyzeLink("");
      utils.meetings.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "提交失败"),
  });

  const uploadMeeting = trpc.meetings.upload.useMutation({
    onSuccess: () => {
      toast.success("录音上传成功，AI 正在分析中...");
      utils.meetings.list.invalidate();
    },
    onError: () => toast.error("上传失败，请重试"),
  });

  const createTodo = trpc.todos.create.useMutation({
    onSuccess: () => {
      toast.success("待办已创建");
      setNewTodoOpen(false);
      setNewTodo({ title: "", priority: "medium", assignee: "", dueDate: "" });
      utils.todos.list.invalidate();
    },
    onError: () => toast.error("创建失败"),
  });

  const toggleTodo = trpc.todos.toggle.useMutation({
    onMutate: async ({ id, completed }) => {
      await utils.todos.list.cancel();
      const prev = utils.todos.list.getData({ priority: filterPriority === "all" ? undefined : filterPriority as any });
      utils.todos.list.setData({ priority: filterPriority === "all" ? undefined : filterPriority as any }, (old) =>
        old?.map((t) => t.id === id ? { ...t, completed } : t)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) utils.todos.list.setData({ priority: filterPriority === "all" ? undefined : filterPriority as any }, ctx.prev);
    },
    onSettled: () => utils.todos.list.invalidate(),
  });

  const deleteTodo = trpc.todos.delete.useMutation({
    onSuccess: () => { toast.success("已删除"); utils.todos.list.invalidate(); },
  });

  const handleAnalyze = () => {
    if (!analyzeTitle.trim()) { toast.error("请输入标题"); return; }
    if (!analyzeContent.trim() && !analyzeLink.trim()) { toast.error("请输入文字记录或录音链接"); return; }
    analyzeText.mutate({
      title: analyzeTitle.trim(),
      content: analyzeContent.trim() || undefined,
      audioLink: analyzeLink.trim() || undefined,
    });
  };

  const pendingTodos = todos?.filter(t => !t.completed) || [];
  const doneTodos = todos?.filter(t => t.completed) || [];

  return (
    <>
      <div className="pb-8">
        <BackButton />
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-violet-600" />
              </div>
              <h1 className="font-display text-2xl font-700 text-foreground">AI 待办记事本</h1>
            </div>
            <p className="text-muted-foreground text-sm ml-11">粘贴录音链接或输入零散的文字记录，AI 自动解析并生成结构化待办清单</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => setConfigOpen(true)}>
              <Settings className="w-4 h-4" />
              模型配置
            </Button>
            <Dialog open={newTodoOpen} onOpenChange={setNewTodoOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="rounded-xl gap-2"><Plus className="w-4 h-4" />新建待办</Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl">
                <DialogHeader><DialogTitle className="font-display">新建待办</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input placeholder="待办标题" value={newTodo.title} onChange={e => setNewTodo(p => ({ ...p, title: e.target.value }))} className="rounded-xl" />
                  <Select value={newTodo.priority} onValueChange={v => setNewTodo(p => ({ ...p, priority: v as any }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">🔴 高优先级</SelectItem>
                      <SelectItem value="medium">🟡 中优先级</SelectItem>
                      <SelectItem value="low">🟢 低优先级</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="责任人（可选）" value={newTodo.assignee} onChange={e => setNewTodo(p => ({ ...p, assignee: e.target.value }))} className="rounded-xl" />
                  <Input type="date" value={newTodo.dueDate} onChange={e => setNewTodo(p => ({ ...p, dueDate: e.target.value }))} className="rounded-xl" />
                  <Button className="w-full rounded-xl" onClick={() => createTodo.mutate({ title: newTodo.title, priority: newTodo.priority, assignee: newTodo.assignee || undefined, dueDate: newTodo.dueDate || undefined })} disabled={createTodo.isPending}>
                    {createTodo.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}创建待办
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* AI 解析 Dialog */}
            <Dialog open={analyzeOpen} onOpenChange={(v) => {
              setAnalyzeOpen(v);
              if (!v) { setAnalyzeTitle(""); setAnalyzeContent(""); setAnalyzeLink(""); }
            }}>
              <DialogTrigger asChild>
                <Button className="rounded-xl gap-2"><Sparkles className="w-4 h-4" />AI 智能解析</Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl max-w-lg">
                <DialogHeader><DialogTitle className="font-display">AI 智能解析</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <Input
                    placeholder="标题（如：周三产品评审会）"
                    value={analyzeTitle}
                    onChange={e => setAnalyzeTitle(e.target.value)}
                    className="rounded-xl"
                  />

                  {/* 文字记录输入 — 核心区域 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      会议记录 / 零散文字
                    </label>
                    <textarea
                      placeholder={"粘贴会议纪要、零散笔记、或从京东慧记等录音工具导出的转录文字...\n\n例如：\n- 首页需要改版，下周三前完成\n- 小王负责组件库更新\n- 需要做用户调研，优先级高\n- 配色方案待定，等品牌确认\n\n💡 京东慧记用户：打开慧记录音详情 → 复制转录文字 → 粘贴到此处"}
                      value={analyzeContent}
                      onChange={e => setAnalyzeContent(e.target.value)}
                      className="w-full min-h-[180px] p-3 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                  </div>

                  {/* 录音链接输入 — 辅助区域 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" />
                      录音链接（可选，仅支持音频直链）
                    </label>
                    <Input
                      placeholder="https://example.com/audio.mp3"
                      value={analyzeLink}
                      onChange={e => setAnalyzeLink(e.target.value)}
                      className="rounded-xl font-mono text-sm"
                    />
                    <p className="text-[10px] text-muted-foreground pl-1">仅支持 mp3/wav/webm/m4a 格式的音频直链，可自动转录</p>
                  </div>

                  {/* 慧记使用引导 */}
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-xs font-semibold text-amber-800 mb-1.5">📋 京东慧记等录音平台用法</p>
                    <ol className="text-[11px] text-amber-700 space-y-1 pl-3 list-decimal">
                      <li>打开慧记，进入对应会议录音详情页</li>
                      <li>找到「转录文字」或「会议纪要」区域</li>
                      <li>全选并复制文字内容</li>
                      <li>粘贴到上方「会议记录」输入框中</li>
                    </ol>
                    <p className="text-[10px] text-amber-600 mt-1.5">慧记等平台的链接需要登录鉴权，无法直接下载音频，请复制转录文字使用。</p>
                  </div>

                  {/* AI 提示 */}
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-violet-50 text-violet-700">
                    <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-xs">AI 将自动理解你的记录内容，提取核心要点，并生成按优先级分类的结构化待办清单。</p>
                  </div>

                  <Button
                    className="w-full rounded-xl gap-2"
                    onClick={handleAnalyze}
                    disabled={analyzeText.isPending}
                  >
                    {analyzeText.isPending
                      ? <><Loader2 className="w-4 h-4 animate-spin" />AI 解析中...</>
                      : <><Send className="w-4 h-4" />开始 AI 解析</>
                    }
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Records List */}
          <div className="xl:col-span-1">
            <h2 className="font-display text-sm font-600 text-muted-foreground uppercase tracking-wider mb-3">解析记录</h2>
            {meetingsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : meetings?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">暂无解析记录</p>
                <p className="text-xs mt-1">点击「AI 智能解析」开始使用</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings?.map((m) => (
                  <div key={m.id} className="p-4 rounded-2xl border border-border bg-card hover:shadow-md transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm text-foreground leading-tight">{m.title}</h3>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", {
                        "border-violet-200 text-violet-600 bg-violet-50": m.status === "done",
                        "border-amber-200 text-amber-600 bg-amber-50": m.status === "analyzing" || m.status === "transcribing",
                        "border-red-200 text-red-600 bg-red-50": m.status === "error",
                        "border-blue-200 text-blue-600 bg-blue-50": m.status === "uploading",
                      })}>
                        {m.status === "done" ? "✓ 完成" : m.status === "analyzing" ? "AI 解析中" : m.status === "transcribing" ? "转录中" : m.status === "error" ? "失败" : "上传中"}
                      </Badge>
                    </div>
                    {m.summary && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{m.summary}</p>}
                    {m.keyInsights && (m.keyInsights as string[]).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {(m.keyInsights as string[]).slice(0, 2).map((insight, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <ArrowRight className="w-3 h-3 text-violet-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-muted-foreground">{insight}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {m.status === "error" && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
                        <p className="text-xs text-red-500">解析失败，请检查模型配置</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
                      <p className="text-[10px] text-muted-foreground">{new Date(m.createdAt).toLocaleDateString("zh-CN")}</p>
                      <div className="flex items-center gap-2">
                        {m.status === "done" && (
                          <>
                            <button
                              onClick={() => setSaveKnowledgeMeeting(m)}
                              className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800 font-medium transition-colors"
                            >
                              <BookOpen className="w-2.5 h-2.5" />存知识库
                            </button>
                            <button
                              onClick={() => navigate(`/meetings/${m.id}`)}
                              className="flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-800 font-medium transition-colors"
                            >
                              进入详情 <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </>
                        )}
                        {m.status === "error" && (
                          <button
                            onClick={() => setConfigOpen(true)}
                            className="flex items-center gap-1 text-[10px] text-violet-600 hover:text-violet-800 font-medium transition-colors"
                          >
                            <Settings className="w-2.5 h-2.5" />配置模型
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Todos */}
          <div className="xl:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-600 text-muted-foreground uppercase tracking-wider">待办清单</h2>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-32 h-8 text-xs rounded-lg">
                  <SelectValue placeholder="筛选优先级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="high">高优先级</SelectItem>
                  <SelectItem value="medium">中优先级</SelectItem>
                  <SelectItem value="low">低优先级</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {todosLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : todos?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ListTodo className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">暂无待办事项</p>
                <p className="text-xs mt-1">使用 AI 智能解析或手动创建待办</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Pending */}
                {pendingTodos.map((todo) => {
                  const pc = priorityConfig[todo.priority];
                  return (
                    <div key={todo.id} className={cn("group flex items-start gap-3 p-4 rounded-2xl border bg-card hover:shadow-sm transition-all", todo.completed && "opacity-60")}>
                      <Checkbox
                        checked={todo.completed}
                        onCheckedChange={(checked) => toggleTodo.mutate({ id: todo.id, completed: !!checked })}
                        className="mt-0.5 rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium", todo.completed && "line-through text-muted-foreground")}>{todo.title}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", pc.class)}>{pc.label}</span>
                          {todo.assignee && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <User className="w-3 h-3" />{todo.assignee}
                            </span>
                          )}
                          {todo.dueDate && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="w-3 h-3" />{todo.dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteTodo.mutate({ id: todo.id })}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {/* Done */}
                {doneTodos.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 pt-2">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs text-muted-foreground">已完成 {doneTodos.length} 项</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    {doneTodos.map((todo) => {
                      const pc = priorityConfig[todo.priority];
                      return (
                        <div key={todo.id} className="group flex items-start gap-3 p-4 rounded-2xl border bg-muted/30 opacity-60">
                          <Checkbox
                            checked={todo.completed}
                            onCheckedChange={(checked) => toggleTodo.mutate({ id: todo.id, completed: !!checked })}
                            className="mt-0.5 rounded-full"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm line-through text-muted-foreground">{todo.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", pc.class)}>{pc.label}</span>
                            </div>
                          </div>
                          <button onClick={() => deleteTodo.mutate({ id: todo.id })} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Save to Knowledge Dialog */}
        {saveKnowledgeMeeting && (
          <SaveToKnowledgeDialog
            meeting={saveKnowledgeMeeting}
            open={!!saveKnowledgeMeeting}
            onOpenChange={(v) => { if (!v) setSaveKnowledgeMeeting(null); }}
          />
        )}
      </div>
      <ModelConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
    </>
  );
}