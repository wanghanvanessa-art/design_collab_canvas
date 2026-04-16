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
} from "lucide-react";
import { BackButton } from "@/components/BackButton";

const priorityConfig = {
  high: { label: "高优先级", class: "priority-high", dot: "bg-red-400" },
  medium: { label: "中优先级", class: "priority-medium", dot: "bg-amber-400" },
  low: { label: "低优先级", class: "priority-low", dot: "bg-emerald-400" },
};

// ─── Recording state ──────────────────────────────────────────────────────────
type RecordingState = "idle" | "recording" | "paused" | "uploading";

function RecordingTimer({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return <span className="font-mono text-sm tabular-nums">{m}:{s}</span>;
}

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
  const [title, setTitle] = useState(`会议纪要：${meeting.title}`);
  const [tags, setTags] = useState("会议纪要");
  const [saved, setSaved] = useState(false);

  const content = [
    meeting.summary ? `## 会议摘要\n${meeting.summary}` : "",
    meeting.keyInsights && meeting.keyInsights.length > 0
      ? `## 核心洞察\n${meeting.keyInsights.map((k, i) => `${i + 1}. ${k}`).join("\n")}`
      : "",
  ].filter(Boolean).join("\n\n") || `来源会议：${meeting.title}`;

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
              placeholder="会议纪要, 设计决策"
            />
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50">
            <BookOpen className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">保存后可在「设计知识库」中查看，并与团队共享此次会议的核心成果。</p>
          </div>
          <Button
            className="w-full rounded-xl"
            onClick={() => saveToKnowledge.mutate({
              meetingId: meeting.id,
              title: title.trim() || `会议纪要：${meeting.title}`,
              content,
              tags: tags.split(",").map(t => t.trim()).filter(Boolean),
              category: "会议纪要",
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
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newTodoOpen, setNewTodoOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [recordTitle, setRecordTitle] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [newTodo, setNewTodo] = useState({ title: "", priority: "medium" as "high" | "medium" | "low", assignee: "", dueDate: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Recording state
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real-time transcription state
  const [transcriptSegments, setTranscriptSegments] = useState<string[]>([]);
  const [interimTranscript, setInterimTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const shouldRestartRecognitionRef = useRef(false);
  const recordingStateRef = useRef<RecordingState>("idle");
  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  // Save to knowledge dialog
  const [saveKnowledgeMeeting, setSaveKnowledgeMeeting] = useState<any>(null);

  const { data: meetings, isLoading: meetingsLoading } = trpc.meetings.list.useQuery();
  const { data: todos, isLoading: todosLoading } = trpc.todos.list.useQuery({ priority: filterPriority === "all" ? undefined : filterPriority as any });

  const uploadMeeting = trpc.meetings.upload.useMutation({
    onSuccess: () => {
      toast.success("会议录音上传成功，AI 正在分析中...");
      setUploadOpen(false);
      setRecordOpen(false);
      setMeetingTitle("");
      setAudioFile(null);
      setAudioBlob(null);
      setRecordTitle("");
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

  // ─── Recording logic ────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start(200);
      mediaRecorderRef.current = mr;
      recordingStateRef.current = "recording";
      setRecordingState("recording");
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);

      // ── Start real-time speech recognition ──────────────────────────────
      const SpeechRecognitionAPI =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "zh-CN";

        recognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const text = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              setTranscriptSegments(prev => {
                const segs = [...prev];
                if (segs.length === 0 || segs[segs.length - 1].length > 80) {
                  segs.push(text);
                } else {
                  segs[segs.length - 1] += text;
                }
                return segs;
              });
              setInterimTranscript("");
            } else {
              interim += text;
            }
          }
          if (interim) setInterimTranscript(interim);
        };

        recognition.onerror = () => {};

        // Auto-restart when recognition ends if still recording
        recognition.onend = () => {
          if (shouldRestartRecognitionRef.current) {
            try { recognition.start(); } catch {}
          }
        };

        shouldRestartRecognitionRef.current = true;
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch {
      toast.error("无法访问麦克风，请检查权限设置");
    }
  };

  const stopRecording = () => {
    shouldRestartRecognitionRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setInterimTranscript("");
    recordingStateRef.current = "idle";
    setRecordingState("idle");
  };

  const pauseRecording = () => {
    shouldRestartRecognitionRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setInterimTranscript("");
    recordingStateRef.current = "paused";
    setRecordingState("paused");
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
    }
    if (recognitionRef.current) {
      shouldRestartRecognitionRef.current = true;
      try { recognitionRef.current.start(); } catch {}
    }
    timerRef.current = setInterval(() => setRecordSeconds(s => s + 1), 1000);
    recordingStateRef.current = "recording";
    setRecordingState("recording");
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Auto-scroll transcript to bottom when new content arrives
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [transcriptSegments, interimTranscript]);

  const handleUploadRecording = async () => {
    if (!recordTitle.trim()) { toast.error("请输入会议标题"); return; }
    if (!audioBlob) { toast.error("请先完成录音"); return; }
    if (audioBlob.size > 16 * 1024 * 1024) { toast.error("录音文件超过 16MB，请缩短录音时长"); return; }
    setRecordingState("uploading");
    try {
      const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("audio", file);
      const uploadRes = await fetch("/api/upload/audio", { method: "POST", body: formData });
      const { url } = await uploadRes.json();
      const transcript = transcriptSegments.map(s => s.trim()).filter(Boolean).join("\n").trim();
      await uploadMeeting.mutateAsync({
        title: recordTitle,
        audioUrl: url,
      });
    } catch {
      toast.error("上传失败，请重试");
    } finally {
      setRecordingState("idle");
    }
  };

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

  const pendingTodos = todos?.filter(t => !t.completed) || [];
  const doneTodos = todos?.filter(t => t.completed) || [];

  return (
    <div className="pb-8">
      <BackButton />
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Mic2 className="w-5 h-5 text-violet-600" />
            </div>
            <h1 className="font-display text-2xl font-700 text-foreground">会议转待办</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">上传或直接录制会议音频，AI 自动提取核心思路并生成结构化待办清单</p>
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

          {/* Direct Recording Dialog */}
          <Dialog open={recordOpen} onOpenChange={(v) => {
            if (!v) { stopRecording(); setAudioBlob(null); setRecordSeconds(0); setTranscriptSegments([]); setInterimTranscript(""); }
            setRecordOpen(v);
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl gap-2 border-rose-200 text-rose-600 hover:bg-rose-50">
                <Mic2 className="w-4 h-4" />直接录音
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-3xl w-full h-[760px] flex flex-col">
              <DialogHeader><DialogTitle className="font-display">直接录制会议</DialogTitle></DialogHeader>
              <div className="flex flex-col gap-4 pt-2 flex-1 min-h-0">
                <Input
                  placeholder="会议标题"
                  value={recordTitle}
                  onChange={e => setRecordTitle(e.target.value)}
                  className="rounded-xl"
                />

                {/* ── Real-time transcription area (60%+ of dialog space) ── */}
                <div className="flex flex-col gap-2 flex-[0.62] min-h-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full transition-colors",
                        recordingState === "recording" ? "bg-rose-500 animate-pulse" :
                        recordingState === "paused" ? "bg-amber-400" : "bg-gray-300"
                      )} />
                      实时转写
                    </span>
                    {(transcriptSegments.length > 0 || interimTranscript) && (
                      <button
                        onClick={() => { setTranscriptSegments([]); setInterimTranscript(""); }}
                        className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        清空
                      </button>
                    )}
                  </div>
                  <div
                    ref={transcriptScrollRef}
                    className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4"
                    style={{ fontSize: "16px", lineHeight: "1.5" }}
                  >
                    {transcriptSegments.length === 0 && !interimTranscript ? (
                      <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-400">
                        <Mic2 className="w-8 h-8 opacity-20" />
                        <p className="text-sm text-center">
                          {recordingState === "idle" && !audioBlob ? "开始录音后，语音将实时转为文字" :
                           recordingState === "recording" ? "正在倾听，请说话..." :
                           recordingState === "paused" ? "录音已暂停" :
                           audioBlob ? "转写内容已记录完毕" : ""}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 text-gray-800">
                        {transcriptSegments.map((seg, i) => (
                          <p
                            key={i}
                            className="whitespace-pre-wrap"
                            style={{ fontSize: "16px", lineHeight: "1.5" }}
                          >
                            {seg}
                          </p>
                        ))}
                        {interimTranscript && (
                          <p className="text-gray-400 italic whitespace-pre-wrap" style={{ fontSize: "16px", lineHeight: "1.5" }}>
                            {interimTranscript}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Recording controls ───────────────────────────────────── */}
                <div className={cn(
                  "flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all",
                  recordingState === "recording" ? "border-rose-300 bg-rose-50" :
                  recordingState === "paused" ? "border-amber-300 bg-amber-50" :
                  audioBlob ? "border-emerald-300 bg-emerald-50" :
                  "border-dashed border-gray-200 bg-gray-50"
                )}>
                  {recordingState === "recording" ? (
                    <>
                      <div className="flex items-center gap-1 h-8">
                        {[...Array(12)].map((_, i) => (
                          <div
                            key={i}
                            className="w-1 bg-rose-400 rounded-full animate-pulse"
                            style={{
                              height: `${20 + Math.sin(i * 0.8) * 12}px`,
                              animationDelay: `${i * 0.08}s`,
                              animationDuration: `${0.6 + (i % 3) * 0.2}s`,
                            }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-rose-600">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                        <span className="text-sm font-medium">录音中</span>
                        <RecordingTimer seconds={recordSeconds} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-amber-300 text-amber-600 hover:bg-amber-100 gap-1.5"
                          onClick={pauseRecording}
                        >
                          <Pause className="w-3.5 h-3.5" />暂停录音
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-rose-300 text-rose-600 hover:bg-rose-100 gap-1.5"
                          onClick={stopRecording}
                        >
                          <Square className="w-3.5 h-3.5" />停止录音
                        </Button>
                      </div>
                    </>
                  ) : recordingState === "paused" ? (
                    <>
                      <div className="flex items-center gap-2 text-amber-600">
                        <Pause className="w-5 h-5" />
                        <span className="text-sm font-medium">已暂停</span>
                        <RecordingTimer seconds={recordSeconds} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white gap-1.5"
                          onClick={resumeRecording}
                        >
                          <Mic2 className="w-3.5 h-3.5" />暂停录音
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-gray-300 text-gray-600 hover:bg-gray-100 gap-1.5"
                          onClick={stopRecording}
                        >
                          <Square className="w-3.5 h-3.5" />停止录音
                        </Button>
                      </div>
                    </>
                  ) : audioBlob ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-emerald-700">录音完成</p>
                        <p className="text-xs text-emerald-600 mt-0.5">
                          时长 <RecordingTimer seconds={recordSeconds} />，大小 {(audioBlob.size / 1024).toFixed(0)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => { setAudioBlob(null); setRecordSeconds(0); setTranscriptSegments([]); setInterimTranscript(""); }}
                        className="text-xs text-gray-400 hover:text-gray-600 underline"
                      >
                        重新录制
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Mic2 className="w-5 h-5 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500 text-center">点击开始录制会议音频</p>
                      <Button
                        size="sm"
                        className="rounded-xl bg-rose-500 hover:bg-rose-600 text-white gap-1.5"
                        onClick={startRecording}
                      >
                        <Mic2 className="w-3.5 h-3.5" />开始录音
                      </Button>
                    </>
                  )}
                </div>

                {audioBlob && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-violet-50">
                    <Sparkles className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-violet-700">AI 将自动转录音频、提取核心思路，并生成按优先级分类的待办清单，同时支持一键保存到知识库。</p>
                  </div>
                )}

                <Button
                  className="w-full rounded-xl"
                  onClick={handleUploadRecording}
                  disabled={!audioBlob || recordingState === "uploading" || uploadMeeting.isPending}
                >
                  {(recordingState === "uploading" || uploadMeeting.isPending)
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />上传分析中...</>
                    : <><Sparkles className="w-4 h-4 mr-2" />AI 分析录音</>
                  }
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Upload File Dialog */}
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2"><Upload className="w-4 h-4" />上传录音</Button>
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
              <p className="text-xs mt-1">上传录音或直接录制开始分析</p>
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

      {/* Save to Knowledge Dialog */}
      {saveKnowledgeMeeting && (
        <SaveToKnowledgeDialog
          meeting={saveKnowledgeMeeting}
          open={!!saveKnowledgeMeeting}
          onOpenChange={(v) => { if (!v) setSaveKnowledgeMeeting(null); }}
        />
      )}
    </div>
  );
}
