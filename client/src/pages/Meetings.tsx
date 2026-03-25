import { useState, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Mic2, Upload, Plus, CheckCircle2, Circle, Clock, User,
  ChevronDown, Loader2, FileAudio, Trash2, AlertCircle,
  Sparkles, ListTodo, ArrowRight
} from "lucide-react";

const priorityConfig = {
  high: { label: "高优先级", class: "priority-high", dot: "bg-red-400" },
  medium: { label: "中优先级", class: "priority-medium", dot: "bg-amber-400" },
  low: { label: "低优先级", class: "priority-low", dot: "bg-emerald-400" },
};

export default function Meetings() {
  const { isAuthenticated } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newTodoOpen, setNewTodoOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [newTodo, setNewTodo] = useState({ title: "", priority: "medium" as "high" | "medium" | "low", assignee: "", dueDate: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: meetings, isLoading: meetingsLoading } = trpc.meetings.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: todos, isLoading: todosLoading } = trpc.todos.list.useQuery({ priority: filterPriority === "all" ? undefined : filterPriority as any }, { enabled: isAuthenticated });

  const uploadMeeting = trpc.meetings.upload.useMutation({
    onSuccess: () => {
      toast.success("会议录音上传成功，AI 正在分析中...");
      setUploadOpen(false);
      setMeetingTitle("");
      setAudioFile(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 16 * 1024 * 1024) { toast.error("文件大小不能超过 16MB"); return; }
      setAudioFile(file);
    }
  };

  const handleUpload = async () => {
    if (!meetingTitle.trim()) { toast.error("请输入会议标题"); return; }
    if (!audioFile) { toast.error("请选择音频文件"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioFile);
      const uploadRes = await fetch("/api/upload/audio", { method: "POST", body: formData });
      const { url } = await uploadRes.json();
      await uploadMeeting.mutateAsync({ title: meetingTitle, audioUrl: url });
    } catch {
      toast.error("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Mic2 className="w-12 h-12 text-violet-400" />
        <h2 className="font-display text-xl font-600">请先登录</h2>
        <a href={getLoginUrl()}><Button>登录使用</Button></a>
      </div>
    );
  }

  const pendingTodos = todos?.filter(t => !t.completed) || [];
  const doneTodos = todos?.filter(t => t.completed) || [];

  return (
    <div className="pb-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Mic2 className="w-5 h-5 text-violet-600" />
            </div>
            <h1 className="font-display text-2xl font-700 text-foreground">会议转待办</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">上传会议录音，AI 自动提取核心思路并生成结构化待办清单</p>
        </div>
        <div className="flex gap-2">
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

          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2"><Upload className="w-4 h-4" />上传会议录音</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader><DialogTitle className="font-display">上传会议录音</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Input placeholder="会议标题" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} className="rounded-xl" />
                <div
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept=".mp3,.wav,.webm,.m4a,.ogg" className="hidden" onChange={handleFileChange} />
                  {audioFile ? (
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <FileAudio className="w-5 h-5" />
                      <span className="text-sm font-medium">{audioFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <FileAudio className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">点击上传音频文件</p>
                      <p className="text-xs text-muted-foreground mt-1">支持 MP3、WAV、WebM、M4A，最大 16MB</p>
                    </>
                  )}
                </div>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-violet-50 text-violet-700">
                  <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-xs">AI 将自动转录音频、提取核心思路，并生成按优先级分类的待办清单</p>
                </div>
                <Button className="w-full rounded-xl" onClick={handleUpload} disabled={uploading || uploadMeeting.isPending}>
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />上传中...</> : "开始分析"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Meetings List */}
        <div className="xl:col-span-1">
          <h2 className="font-display text-sm font-600 text-muted-foreground uppercase tracking-wider mb-3">会议记录</h2>
          {meetingsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : meetings?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileAudio className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无会议记录</p>
              <p className="text-xs mt-1">上传录音开始分析</p>
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
                      "border-blue-200 text-blue-600 bg-blue-50": m.status === "uploading",
                    })}>
                      {m.status === "done" ? "✓ 完成" : m.status === "analyzing" ? "分析中" : m.status === "transcribing" ? "转录中" : "上传中"}
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
                  <p className="text-[10px] text-muted-foreground mt-2">{new Date(m.createdAt).toLocaleDateString("zh-CN")}</p>
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
              <p className="text-xs mt-1">上传会议录音或手动创建待办</p>
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
    </div>
  );
}
