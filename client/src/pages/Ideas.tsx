import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Lightbulb, Plus, MessageCircle, Heart, Loader2, ArrowRight,
  Sparkles, Send, Settings, Zap, Brain, Eye,
} from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { ModelConfigDialog } from "@/components/ModelConfigDialog";

export default function Ideas() {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<"creative" | "professional" | "user_perspective">("creative");
  const [title, setTitle] = useState("");
  const utils = trpc.useUtils();

  const { data: ideas, isLoading } = trpc.ideas.list.useQuery();

  // AI brainstorm → create idea with generated content
  const brainstorm = trpc.ideas.aiBrainstorm.useMutation({
    onSuccess: (data) => {
      // Build structured plain-text content from AI result
      const d = data.data;

      // 统一的结构化内容组装（三种风格共用）
      const branchText = d.branches?.map((b: any, i: number) => {
        const header = `${i + 1}. ${b.title}`;
        const summary = `「核心观点」${b.summary}`;
        const details = b.details?.trim() || "";
        const tags = b.tags?.length ? `\n标签：${b.tags.join("、")}` : "";
        return `## ${header}\n\n${summary}\n\n${details}${tags}`;
      }).join("\n\n---\n\n") || "";

      const sectionTitle = style === "professional" ? "行业案例参考" : "相关案例";
      const casesText = d.cases?.length
        ? `\n\n---\n\n## ${sectionTitle}\n\n${d.cases.map((c: any, i: number) =>
          `案例 ${i + 1}：${c.title}${c.url ? ` [查看案例](${c.url})` : ""}\n\n${c.desc}\n\n「关联分析」${c.relevance}`
        ).join("\n\n")}`
        : "";

      const frameworkText = d.framework?.goal
        ? `\n\n---\n\n## 方案框架\n\n「总目标」${d.framework.goal}\n\n${d.framework.phases?.map((p: any, i: number) =>
          `阶段 ${i + 1}：${p.name}\n\n${p.tasks?.map((t: string, j: number) => `${j + 1}. ${t}`).join("\n")}`
        ).join("\n\n") || ""}`
        : "";

      const content = branchText + casesText + frameworkText;

      // Create idea with the content
      createIdea.mutate({
        title: title.trim() || prompt.trim().slice(0, 30),
        content,
        tags: ["AI发散", style === "creative" ? "创意" : style === "professional" ? "专业" : "用户视角"],
      });
    },
    onError: (err) => toast.error(err.message || "AI 发散失败，请检查模型配置"),
  });

  const createIdea = trpc.ideas.create.useMutation({
    onSuccess: () => {
      toast.success("创意已生成并保存！");
      setCreateOpen(false);
      setPrompt("");
      setTitle("");
      utils.ideas.list.invalidate();
    },
  });

  const tagColors = [
    "bg-violet-100 text-violet-700", "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700", "bg-sky-100 text-sky-700", "bg-pink-100 text-pink-700",
  ];

  const handleBrainstorm = () => {
    if (!prompt.trim()) { toast.error("请输入关键词或描述"); return; }
    brainstorm.mutate({ prompt: prompt.trim(), style });
  };

  const isGenerating = brainstorm.isPending || createIdea.isPending;

  return (
    <div className="pb-8">
      <BackButton />
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <h1 className="font-display text-2xl font-700">AI 创意发散台</h1>
          </div>
          <p className="text-muted-foreground text-sm ml-11">输入关键词或一句话，AI 自动生成多维度创意分支与结构化方案</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl gap-2" onClick={() => setConfigOpen(true)}>
            <Settings className="w-4 h-4" />
            模型配置
          </Button>

          {/* AI brainstorm dialog */}
          <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) { setPrompt(""); setTitle(""); } }}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2"><Sparkles className="w-4 h-4" />AI 创意发散</Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl max-w-lg">
              <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Brain className="w-5 h-5 text-amber-500" />AI 创意发散</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <Input
                  placeholder="标题（可选，如：新零售体验升级）"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="rounded-xl"
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    灵感输入（关键词 / 一句话 / 问题描述）
                  </label>
                  <textarea
                    placeholder={"输入任何灵感火花，AI 将为你发散出多维度创意方向...\n\n例如：\n• 如何提升电商首页转化率\n• 设计一个面向 Z 世代的社交产品\n• B 端 SaaS 仪表盘体验优化方案"}
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    className="w-full min-h-[140px] p-3 rounded-xl border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">发散风格</label>
                  <Select value={style} onValueChange={v => setStyle(v as any)}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="creative">🎨 创意发散 — 天马行空，鼓励突破性想法</SelectItem>
                      <SelectItem value="professional">📊 严谨专业 — 逻辑清晰，注重可行性</SelectItem>
                      <SelectItem value="user_perspective">👤 用户视角 — 关注痛点、体验和情感</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 text-amber-700">
                  <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="text-xs">AI 将从多个维度进行创意发散，生成结构化方案框架和相关案例推荐。生成后可进入详情页继续编辑、续写和评审。</p>
                </div>

                <Button className="w-full rounded-xl gap-2" onClick={handleBrainstorm} disabled={isGenerating}>
                  {isGenerating
                    ? <><Loader2 className="w-4 h-4 animate-spin" />AI 发散生成中...</>
                    : <><Send className="w-4 h-4" />开始 AI 创意发散</>
                  }
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-3">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : ideas?.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">还没有创意，点击「AI 创意发散」开始脑暴！</p>
              <p className="text-xs mt-1 text-muted-foreground/60">输入一个关键词，AI 就能帮你生成多个创意方向</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {ideas?.map((idea, i) => (
                <div
                  key={idea.id}
                  className="p-5 rounded-2xl border bg-card hover:shadow-md transition-all animate-slide-up group cursor-pointer"
                  style={{ animationDelay: `${i * 50}ms`, animationFillMode: "both" }}
                  onClick={() => navigate(`/ideas/${idea.id}`)}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 className="font-display font-600 text-sm text-foreground leading-tight">{idea.title}</h3>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", idea.status === "published" ? "border-amber-200 text-amber-600 bg-amber-50" : "border-gray-200 text-gray-500")}>
                      {idea.status === "published" ? "发散中" : idea.status === "archived" ? "已落地" : "草稿"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-3">{idea.content?.replace(/##\s*/g, "").replace(/\n/g, " ").slice(0, 120)}</p>
                  {(idea.tags as string[])?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {(idea.tags as string[]).slice(0, 4).map((tag, ti) => (
                        <span key={tag} className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", tagColors[ti % tagColors.length])}>{tag}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex items-center gap-1 text-xs"><MessageCircle className="w-3.5 h-3.5" />{idea.commentsCount}</span>
                    <span className="flex items-center gap-1 text-xs"><Heart className="w-3.5 h-3.5" />{idea.likesCount}</span>
                    <span className="ml-auto text-[10px]">{new Date(idea.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs text-amber-600 border border-amber-200 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="w-3.5 h-3.5" /> 进入创意画布 <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ModelConfigDialog open={configOpen} onOpenChange={setConfigOpen} />
    </div>
  );
}