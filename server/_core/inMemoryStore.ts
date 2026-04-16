import type {
  Idea,
  IdeaComment,
  Interview,
  KnowledgeArticle,
  KnowledgeComment,
  KnowledgeFavorite,
  KnowledgeView,
  Meeting,
  MeetingComment,
  Todo,
  Activity,
  DesignReview,
  InspirationItem,
} from "../../drizzle/schema";
import { DEV_KNOWLEDGE_SAMPLES } from "./devKnowledgeSamples";

type MeetingUploadInput = {
  userId: number;
  title: string;
  audioUrl: string;
  transcript?: string;
};

const now = () => new Date();

function safeTrim(s: string | undefined | null) {
  return (s ?? "").trim();
}

function splitSentences(transcript: string) {
  const cleaned = transcript.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
  const parts = cleaned
    .split(/[\n。！？!?]+/g)
    .map(s => s.trim())
    .filter(Boolean);
  return parts;
}

function buildMeetingArtifacts(transcriptRaw: string) {
  const transcript = safeTrim(transcriptRaw);
  const sentences = splitSentences(transcript);

  const summary = sentences.slice(0, 2).join("，").slice(0, 220);
  const keyInsights = sentences.filter(s => s.length >= 8).slice(0, 5);

  const todos = keyInsights.slice(0, 3).map(t => ({
    title: t.slice(0, 60),
    priority: "medium" as const,
    assignee: null as string | null,
  }));

  const structuredMinutes = sentences.slice(0, 8).map((s, i) => ({
    speaker: "发言人",
    timestamp: `00:${String(i * 2).padStart(2, "0")}`,
    content: s,
  }));

  const aiInsights = keyInsights.slice(0, 3).map(k => {
    const lower = k.toLowerCase();
    if (lower.includes("风险") || lower.includes("问题") || lower.includes("堵")) {
      return { type: "risk" as const, content: k };
    }
    if (lower.includes("决策") || lower.includes("决定") || lower.includes("结论")) {
      return { type: "decision" as const, content: k };
    }
    return { type: "action" as const, content: k };
  });

  return { summary, keyInsights, todos, structuredMinutes, aiInsights, attendees: [] as string[] };
}

class InMemoryStore {
  private next = {
    user: 0,
    meeting: 1,
    todo: 1,
    idea: 1,
    ideaComment: 1,
    interview: 1,
    knowledge: 1,
    knowledgeComment: 1,
    knowledgeFavorite: 1,
    knowledgeView: 1,
    meetingComment: 1,
    activity: 1,
    designReview: 1,
    inspirationItem: 1,
  };

  // Model configuration
  private modelConfig = {
    apiKey: "",
    apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: "qwen-vl-max",
    maxTokens: 32768,
  };

  private meetings: Meeting[] = [];
  private todos: Todo[] = [];
  private meetingComments: MeetingComment[] = [];

  private ideas: Idea[] = [];
  private ideaComments: IdeaComment[] = [];

  private interviews: Interview[] = [];

  private knowledgeArticles: KnowledgeArticle[] = [];
  private knowledgeComments: KnowledgeComment[] = [];
  private knowledgeFavorites: KnowledgeFavorite[] = [];
  private knowledgeViews: KnowledgeView[] = [];

  private activities: Activity[] = [];
  private designReviews: DesignReview[] = [];
  private inspirationItems: InspirationItem[] = [];
  private inspirationSpawn = { x: 40, y: 40 };

  listMeetings(userId: number) {
    return [...this.meetings]
      .filter(m => m.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getMeetingWithTodos(userId: number, meetingId: number) {
    const meeting = this.meetings.find(m => m.userId === userId && m.id === meetingId);
    if (!meeting) return null;
    const mtodos = this.todos
      .filter(t => t.meetingId === meetingId && t.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { ...meeting, todos: mtodos };
  }

  uploadMeeting(input: MeetingUploadInput) {
    const id = this.next.meeting++;
    const transcript = safeTrim(input.transcript);
    const artifacts = buildMeetingArtifacts(transcript);

    const meeting: Meeting = {
      id,
      userId: input.userId,
      title: input.title,
      audioUrl: input.audioUrl,
      transcript,
      summary: artifacts.summary,
      keyInsights: artifacts.keyInsights,
      structuredMinutes: artifacts.structuredMinutes,
      aiInsights: artifacts.aiInsights,
      duration: Math.max(0, Math.round((transcript.length / 40) * 10)),
      attendees: artifacts.attendees,
      status: artifacts.todos.length > 0 || transcript ? "done" : "done",
      createdAt: now(),
      updatedAt: now(),
    };

    this.meetings.push(meeting);

    for (const t of artifacts.todos) {
      const todoId = this.next.todo++;
      this.todos.push({
        id: todoId,
        meetingId: id,
        userId: input.userId,
        title: t.title,
        description: null,
        priority: t.priority,
        assignee: t.assignee,
        dueDate: null,
        completed: false,
        sourceType: "meeting",
        sourceId: id,
        createdAt: now(),
        updatedAt: now(),
      } as Todo);
    }

    // Minimal activity record for timeline.
    try {
      this.activities.push({
        id: this.next.activity++,
        userId: input.userId,
        userName: "本地访客",
        type: "todo_done" as any,
        title: `会议「${input.title}」已解析`,
        detail: artifacts.summary || "已生成待办",
        refId: id,
        refType: "meeting" as any,
        createdAt: now(),
      } as Activity);
    } catch {}

    return { id };
  }

  listTodos(userId: number, priority?: "high" | "medium" | "low") {
    return this.todos
      .filter(t => t.userId === userId)
      .filter(t => (priority ? t.priority === priority : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  statsTodos(userId: number) {
    const all = this.todos.filter(t => t.userId === userId);
    return {
      total: all.length,
      pending: all.filter(t => !t.completed).length,
      done: all.filter(t => t.completed).length,
    };
  }

  createTodo(userId: number, input: { title: string; priority: "high" | "medium" | "low"; assignee?: string; dueDate?: string | null }) {
    const id = this.next.todo++;
    this.todos.push({
      id,
      meetingId: null,
      userId,
      title: input.title,
      description: null,
      priority: input.priority,
      assignee: input.assignee ?? null,
      dueDate: input.dueDate ?? null,
      completed: false,
      sourceType: "manual",
      sourceId: null,
      createdAt: now(),
      updatedAt: now(),
    } as Todo);
    return { success: true };
  }

  updateTodo(userId: number, id: number, updates: Partial<Omit<Todo, "id" | "userId">> & { completed?: boolean }) {
    const idx = this.todos.findIndex(t => t.userId === userId && t.id === id);
    if (idx === -1) return { success: false };
    this.todos[idx] = {
      ...this.todos[idx],
      ...(updates as any),
      updatedAt: now(),
    };
    return { success: true };
  }

  toggleTodo(userId: number, id: number, completed: boolean) {
    return this.updateTodo(userId, id, { completed });
  }

  deleteTodo(userId: number, id: number) {
    const before = this.todos.length;
    this.todos = this.todos.filter(t => !(t.userId === userId && t.id === id));
    return { success: this.todos.length !== before };
  }

  listMeetingComments(userId: number, meetingId: number) {
    return this.meetingComments
      .filter(c => c.meetingId === meetingId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  addMeetingComment(userId: number, userName: string | undefined, meetingId: number, content: string, parentId?: number) {
    const id = this.next.meetingComment++;
    this.meetingComments.push({
      id,
      meetingId,
      userId,
      userName: userName ?? "匿名",
      content,
      parentId: parentId ?? null,
      createdAt: now(),
    } as MeetingComment);
    return { success: true };
  }

  saveMeetingToKnowledge(userId: number, input: { meetingId: number; title: string; content: string; tags?: string[]; category?: string }) {
    const rootId = this.next.knowledge++;
    const article: KnowledgeArticle = {
      id: rootId,
      userId,
      title: input.title,
      content: input.content,
      tags: input.tags ?? ["会议纪要"],
      version: 1,
      parentId: null,
      category: input.category ?? "会议纪要",
      collaborators: [],
      sourceType: "meeting",
      sourceMeetingId: input.meetingId,
      createdAt: now(),
      updatedAt: now(),
    };
    this.knowledgeArticles.push(article);

    try {
      this.activities.push({
        id: this.next.activity++,
        userId,
        userName: "本地访客",
        type: "knowledge_added" as any,
        title: `会议「${input.meetingId}」已保存到知识库`,
        detail: input.title,
        refId: rootId,
        refType: "knowledge" as any,
        createdAt: now(),
      } as Activity);
    } catch {}

    return { success: true, articleId: rootId };
  }

  listIdeas(userId: number) {
    return this.ideas
      .filter(i => i.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getIdea(userId: number, id: number) {
    return this.ideas.find(i => i.userId === userId && i.id === id) ?? null;
  }

  createIdea(userId: number, input: { title: string; content: string; tags?: string[] }) {
    const id = this.next.idea++;
    this.ideas.push({
      id,
      userId,
      title: input.title,
      content: input.content,
      tags: input.tags ?? [],
      status: "published",
      likesCount: 0,
      commentsCount: 0,
      createdAt: now(),
      updatedAt: now(),
    } as Idea);
    return { success: true };
  }

  updateIdea(userId: number, input: { id: number; title?: string; content?: string; status?: string; tags?: string[]; changeNote?: string }) {
    const idx = this.ideas.findIndex(i => i.userId === userId && i.id === input.id);
    if (idx < 0) throw new Error("Not found");
    const idea = this.ideas[idx] as any;
    if (input.title !== undefined) idea.title = input.title;
    if (input.content !== undefined) idea.content = input.content;
    if (input.status !== undefined) idea.status = input.status;
    if (input.tags !== undefined) idea.tags = input.tags;
    idea.updatedAt = now();
    return { success: true };
  }

  listIdeaComments(ideaId: number) {
    return [...this.ideaComments]
      .filter(c => (c as any).ideaId === ideaId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  addIdeaComment(userId: number, input: { ideaId: number; content: string }) {
    const id = this.next.ideaComment++;
    this.ideaComments.push({
      id,
      ideaId: input.ideaId,
      userId,
      content: input.content,
      createdAt: now(),
    } as IdeaComment);
    // bump comment count
    const idea = this.ideas.find(i => i.id === input.ideaId) as any;
    if (idea) idea.commentsCount = (idea.commentsCount || 0) + 1;
    return { success: true };
  }

  listInterviews(userId: number) {
    return this.interviews
      .filter(iv => iv.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getInterview(userId: number, id: number) {
    return this.interviews.find(iv => iv.userId === userId && iv.id === id) ?? null;
  }

  createInterview(userId: number, input: { title: string; interviewee?: string; content?: string; date?: string }) {
    const id = this.next.interview++;
    this.interviews.push({
      id,
      userId,
      title: input.title,
      interviewee: input.interviewee ?? null,
      content: input.content ?? null,
      date: input.date ?? null,
      audienceLabels: [],
      painPoints: [],
      designSolutions: [],
      status: "draft",
      createdAt: now(),
      updatedAt: now(),
    } as any);
    return { success: true };
  }

  analyzeInterview(userId: number, id: number) {
    const idx = this.interviews.findIndex(iv => iv.userId === userId && iv.id === id);
    if (idx < 0) throw new Error("Not found");

    const iv = this.interviews[idx];
    const content = safeTrim(iv.content);
    const title = safeTrim(iv.title);
    const text = `${title}\n${content}`.toLowerCase();

    // Simple heuristic analysis for local preview (no LLM).
    // We intentionally keep it deterministic so local testing is reliable.
    const painPoints: string[] = [];
    const designSolutions: string[] = [];
    const audienceLabels: string[] = [];

    const pushOnce = (arr: string[], item: string, limit = 6) => {
      const normalized = item.trim();
      if (!normalized) return;
      if (arr.includes(normalized)) return;
      arr.push(normalized);
      if (arr.length > limit) arr.length = limit;
    };

    if (text.includes("卡") || text.includes("慢") || text.includes("延迟") || text.includes("等待")) {
      pushOnce(painPoints, "流程/操作存在明显卡顿或等待成本，影响使用效率。");
      pushOnce(designSolutions, "提供更清晰的进度反馈与关键路径提示，降低等待不确定性。");
    }
    if (text.includes("难") || text.includes("复杂") || text.includes("门槛") || text.includes("不会")) {
      pushOnce(painPoints, "信息结构不清晰，导致学习成本高、难以快速上手。");
      pushOnce(designSolutions, "用分步引导与示例模板组织内容，让用户能按步骤完成目标。");
    }
    if (text.includes("不一致") || text.includes("不稳定") || text.includes("差异")) {
      pushOnce(painPoints, "不同场景下体验不一致，用户难以形成稳定预期。");
      pushOnce(designSolutions, "统一交互规范与关键组件行为，并在多入口场景保持一致。");
    }
    if (text.includes("沟通") || text.includes("协作") || text.includes("反馈") || text.includes("对齐")) {
      pushOnce(painPoints, "团队协作过程中结论难沉淀，反馈难追踪。");
      pushOnce(designSolutions, "将洞察输出结构化（痛点/方案/行动），并支持版本与可追溯。");
    }

    // Fallbacks
    if (painPoints.length === 0) {
      pushOnce(painPoints, "用户在关键节点上缺少明确指引，导致决策与执行成本偏高。");
      pushOnce(painPoints, "当前内容组织方式无法快速定位所需信息。");
    }
    if (designSolutions.length === 0) {
      pushOnce(designSolutions, "用“目标-步骤-产出”组织信息，并在关键节点提供可操作建议。");
      pushOnce(designSolutions, "引入结构化卡片与搜索/标签，提升信息可发现性。");
    }
    if (audienceLabels.length === 0) {
      pushOnce(audienceLabels, "高频使用者");
      pushOnce(audienceLabels, "流程导向人群");
    }

    this.interviews[idx] = {
      ...(this.interviews[idx] as any),
      audienceLabels,
      painPoints,
      designSolutions,
      status: "done",
      updatedAt: now(),
    } as any;

    return { success: true };
  }

  updateInterview(
    userId: number,
    input: { id: number; title: string; interviewee?: string; content?: string; date?: string }
  ) {
    const idx = this.interviews.findIndex(iv => iv.userId === userId && iv.id === input.id);
    if (idx < 0) throw new Error("Not found");

    // Updating the base interview content invalidates previous AI analysis results.
    this.interviews[idx] = {
      ...(this.interviews[idx] as any),
      title: input.title,
      interviewee: input.interviewee ?? null,
      content: input.content ?? null,
      date: input.date ?? null,
      audienceLabels: [],
      painPoints: [],
      designSolutions: [],
      status: "draft",
      updatedAt: now(),
    } as any;

    return { success: true };
  }

  deleteInterview(userId: number, id: number) {
    const before = this.interviews.length;
    this.interviews = this.interviews.filter(iv => !(iv.userId === userId && iv.id === id));
    return { success: this.interviews.length !== before };
  }

  listKnowledgeRootArticles(userId: number) {
    return this.knowledgeArticles
      .filter(a => a.userId === userId && (a.parentId === null || a.parentId === undefined))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  getKnowledgeArticle(userId: number, id: number) {
    return this.knowledgeArticles.find(a => a.userId === userId && a.id === id) ?? null;
  }

  versionsKnowledge(userId: number, id: number) {
    const root = this.knowledgeArticles.find(a => a.userId === userId && a.id === id);
    if (!root) return [];
    const rootId = root.parentId ?? root.id;
    return this.knowledgeArticles
      .filter(a => a.userId === userId && (a.id === rootId || a.parentId === rootId))
      .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  }

  createKnowledge(
    userId: number,
    input: { title: string; content: string; tags?: string[]; category?: string; sourceType?: string | null },
  ) {
    const id = this.next.knowledge++;
    this.knowledgeArticles.push({
      id,
      userId,
      title: input.title,
      content: input.content,
      tags: input.tags ?? [],
      version: 1,
      parentId: null,
      category: input.category ?? null,
      collaborators: [],
      sourceType: (input.sourceType ?? null) as any,
      sourceMeetingId: null as any,
      createdAt: now(),
      updatedAt: now(),
    } as any);
    return { success: true };
  }

  updateKnowledge(userId: number, input: { id: number; content: string }) {
    const root = this.knowledgeArticles.find(a => a.userId === userId && a.id === input.id);
    if (!root) throw new Error("Not found");

    const rootId = root.parentId ?? root.id;
    const versions = this.knowledgeArticles.filter(
      a => a.userId === userId && (a.id === rootId || a.parentId === rootId)
    );
    const maxVersion = Math.max(...versions.map(v => v.version ?? 1), 1);
    const nextVersion = maxVersion + 1;

    // Create a new snapshot row.
    const snapshotId = this.next.knowledge++;
    this.knowledgeArticles.push({
      ...(root as any),
      id: snapshotId,
      content: input.content,
      version: nextVersion,
      parentId: rootId,
      createdAt: now(),
      updatedAt: now(),
    } as any);

    // Update original to latest content.
    const rootIdx = this.knowledgeArticles.findIndex(a => a.userId === userId && a.id === root.id);
    if (rootIdx >= 0) {
      this.knowledgeArticles[rootIdx] = {
        ...(this.knowledgeArticles[rootIdx] as any),
        content: input.content,
        version: nextVersion,
        updatedAt: now(),
      };
    }

    return { success: true };
  }

  updateKnowledgeTitle(userId: number, input: { id: number; title: string }) {
    const root = this.knowledgeArticles.find(a => a.userId === userId && a.id === input.id);
    if (!root) throw new Error("Not found");

    const rootId = root.parentId ?? root.id;
    const nextTitle = safeTrim(input.title);
    if (!nextTitle) throw new Error("Title is empty");

    this.knowledgeArticles = this.knowledgeArticles.map(a => {
      if (a.userId !== userId) return a;
      const belongsToRoot = a.id === rootId || a.parentId === rootId;
      if (!belongsToRoot) return a;
      return {
        ...(a as any),
        title: nextTitle,
        updatedAt: now(),
      } as any;
    });

    return { success: true };
  }

  deleteKnowledgeArticle(userId: number, id: number) {
    const target = this.knowledgeArticles.find(a => a.userId === userId && a.id === id);
    if (!target) throw new Error("Not found");

    const rootId = target.parentId ?? target.id;

    // Remove root + all snapshots/versions (rootId + parentId == rootId).
    this.knowledgeArticles = this.knowledgeArticles.filter(a => !(
      a.userId === userId && (a.id === rootId || a.parentId === rootId)
    ));

    // Clean related entities bound to the root article.
    this.knowledgeComments = this.knowledgeComments.filter(c => !(c.articleId === rootId));
    this.knowledgeFavorites = this.knowledgeFavorites.filter(f => !(f.articleId === rootId));
    this.knowledgeViews = this.knowledgeViews.filter(v => !(v.articleId === rootId));
    this.activities = this.activities.filter(a => !(
      a.refType === "knowledge" && a.refId === rootId
    ));

    return { success: true };
  }

  listDesignReviews(userId: number) {
    return [...this.designReviews]
      .filter(r => r.userId === userId && (r.parentId === null || r.parentId === undefined))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getDesignReview(userId: number, id: number) {
    return this.designReviews.find(r => r.userId === userId && r.id === id) ?? null;
  }

  versionsDesignReview(userId: number, id: number) {
    const root = this.getDesignReview(userId, id);
    if (!root) return [];
    const rootId = root.parentId ?? root.id;
    return this.designReviews
      .filter(r => r.userId === userId && (r.id === rootId || r.parentId === rootId))
      .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
  }

  uploadDesignReview(userId: number, input: { title: string; designUrl: string; designUrls?: string[]; mode?: "single" | "compare" }) {
    const id = this.next.designReview++;
    const title = safeTrim(input.title) || "未命名方案";
    const url = safeTrim(input.designUrl);

    const row: DesignReview = {
      id,
      userId,
      title,
      designUrl: url as any,
      version: 1,
      parentId: null as any,
      businessLogicScore: null as any,
      interactionScore: null as any,
      accessibilityScore: null as any,
      overallScore: null as any,
      reviewComments: [] as any,
      suggestions: [] as any,
      status: "reviewing" as any,
      createdAt: now(),
      updatedAt: now(),
    } as any;

    // Store extra fields as expando properties
    (row as any).designUrls = input.designUrls || [url];
    (row as any).mode = input.mode || "single";
    (row as any).overview = "";
    (row as any).highlights = [];
    (row as any).issues = [];

    this.designReviews.push(row);
    return { id };
  }

  applyDesignReviewResult(
    userId: number,
    id: number,
    input: {
      productScore: number;
      interactionScore: number;
      designScore: number;
      overallScore: number;
      overview?: string;
      highlights?: string[];
      issues?: string[];
      reviewComments: Array<{ dimension: string; score: number; comment: string }>;
      suggestions: string[];
      status?: "done" | "error" | "reviewing";
    }
  ) {
    const idx = this.designReviews.findIndex(r => r.userId === userId && r.id === id);
    if (idx < 0) throw new Error("Not found");
    this.designReviews[idx] = {
      ...(this.designReviews[idx] as any),
      businessLogicScore: input.productScore as any,
      interactionScore: input.interactionScore as any,
      accessibilityScore: input.designScore as any,
      overallScore: input.overallScore as any,
      reviewComments: (input.reviewComments || []) as any,
      suggestions: (input.suggestions || []) as any,
      overview: input.overview || "",
      highlights: input.highlights || [],
      issues: input.issues || [],
      status: (input.status || "done") as any,
      updatedAt: now(),
    } as any;
    return { success: true };
  }

  applyDesignReviewHeuristic(userId: number, id: number) {
    const r = this.getDesignReview(userId, id);
    if (!r) throw new Error("Not found");
    const title = safeTrim(r.title);
    const base = Math.min(88, Math.max(55, 68 + (title.length % 17)));
    const productScore = Math.min(95, base + 5);
    const interactionScore = Math.min(92, base + 2);
    const designScore = Math.min(90, base - 1);
    const overallScore = Math.round(productScore * 0.35 + interactionScore * 0.35 + designScore * 0.3);

    return this.applyDesignReviewResult(userId, id, {
      productScore,
      interactionScore,
      designScore,
      overallScore,
      overview: `设计稿「${title}」整体完成度较高，核心业务流程闭环完整，视觉风格统一。`,
      highlights: [
        `整体布局采用标准栅格体系，信息层级清晰，主操作区域的视觉权重分配合理。`,
        `核心功能入口明确，用户可快速定位关键操作按钮，操作路径简洁高效。`,
      ],
      issues: [
        `部分二级信息区域信息密度偏高，在中低分辨率屏幕下可能产生阅读压力。`,
        `表单区域控件间距不够统一，部分输入框与标签的对齐存在微调空间。`,
      ],
      reviewComments: [
        { dimension: "产品功能", score: productScore, comment: `设计稿「${title}」的核心业务流程覆盖完整，关键功能点均有明确的入口和操作路径；信息架构分层合理，一级导航与二级内容区域的层级关系清晰；数据展示区域图表类型选择恰当，但部分边界场景（空状态、异常状态）的设计缺少明确规范。` },
        { dimension: "交互体验", score: interactionScore, comment: `核心任务操作路径控制在 3 步以内，操作效率良好；表单控件选择基本恰当，下拉选择和输入框的使用符合 B 端用户习惯；反馈机制方面，主要操作有明确的 loading 和 success 状态设计，但取消和撤销操作的反馈提示有待补充。` },
        { dimension: "设计样式", score: designScore, comment: `整体布局遵循 8px 栅格规范，主要区域间距一致性良好；色彩体系以品牌蓝为主色调，功能色（成功绿、警告橙、错误红）使用规范；字体层级分为标题/正文/辅助三级，行高设置合理；但部分组件（如标签、徽章）的圆角和阴影风格存在不一致，建议统一 Design Token。` },
      ],
      suggestions: [
        `问题：设计稿「${title}」中部分信息区域密度偏高，首屏信息量过大 → 改进：采用渐进式披露策略，将次要字段折叠至"展开更多"区域 → 收益：用户首屏信息获取效率提升约 35%，认知负荷显著降低。`,
        "问题：表单控件间距不统一，标签与输入框对齐方式混用 → 改进：建立统一的表单布局规范，固定标签宽度和间距 Token → 收益：表单区域视觉一致性提升，后续新增表单页面开发效率提升约 40%。",
        "问题：空状态和异常状态设计缺失，用户遇到边界场景时缺少引导 → 改进：为列表空状态、加载失败、无权限等场景补充插画+文案+操作引导设计 → 收益：用户体验完整度提升，减少因边界场景导致的用户流失。",
      ],
      status: "done",
    });
  }

  deleteDesignReview(userId: number, id: number) {
    const before = this.designReviews.length;
    this.designReviews = this.designReviews.filter(
      r => !(r.userId === userId && (r.id === id || (r as any).parentId === id))
    );
    return { success: this.designReviews.length !== before };
  }


  listInspirationItems(userId: number) {
    return [...this.inspirationItems]
      .filter(i => i.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  createInspirationItem(userId: number, input: {
    type: "text" | "image" | "link" | "screenshot";
    title?: string;
    content?: string;
    url?: string;
    color?: string;
    posX?: number;
    posY?: number;
  }) {
    const id = this.next.inspirationItem++;
    // Avoid stacking at (0,0) for local preview: auto-spawn with mild offset.
    const posX = typeof input.posX === "number" ? input.posX : this.inspirationSpawn.x;
    const posY = typeof input.posY === "number" ? input.posY : this.inspirationSpawn.y;
    this.inspirationSpawn.x += 26;
    this.inspirationSpawn.y += 18;
    if (this.inspirationSpawn.x > 520) this.inspirationSpawn.x = 40;
    if (this.inspirationSpawn.y > 360) this.inspirationSpawn.y = 40;

    const row: InspirationItem = {
      id,
      userId,
      boardId: null as any,
      type: input.type as any,
      title: input.title?.trim() ? input.title.trim() : null,
      content: input.content?.trim() ? input.content.trim() : null,
      imageUrl: input.type === "image" ? (input.url?.trim() || null) : null,
      url: input.url?.trim() ? input.url.trim() : null,
      posX: posX as any,
      posY: posY as any,
      width: 220 as any,
      height: 150 as any,
      styleTags: [] as any,
      linkedTodoId: null as any,
      linkedInterviewId: null as any,
      color: input.color?.trim() ? input.color.trim() : "#fef9c3",
      createdAt: now(),
      updatedAt: now(),
    } as any;

    this.inspirationItems.push(row);
    return { success: true, id };
  }

  updateInspirationPosition(userId: number, input: { id: number; posX: number; posY: number; width?: number; height?: number }) {
    const idx = this.inspirationItems.findIndex(i => i.userId === userId && i.id === input.id);
    if (idx < 0) throw new Error("Not found");
    this.inspirationItems[idx] = {
      ...(this.inspirationItems[idx] as any),
      posX: input.posX as any,
      posY: input.posY as any,
      ...(typeof input.width === "number" ? { width: input.width as any } : {}),
      ...(typeof input.height === "number" ? { height: input.height as any } : {}),
      updatedAt: now(),
    } as any;
    return { success: true };
  }

  updateInspirationContent(userId: number, input: { id: number; title?: string; content?: string }) {
    const idx = this.inspirationItems.findIndex(i => i.userId === userId && i.id === input.id);
    if (idx < 0) throw new Error("Not found");
    this.inspirationItems[idx] = {
      ...(this.inspirationItems[idx] as any),
      ...(input.title !== undefined ? { title: input.title.trim() ? input.title.trim() : null } : {}),
      ...(input.content !== undefined ? { content: input.content.trim() ? input.content.trim() : null } : {}),
      updatedAt: now(),
    } as any;
    return { success: true };
  }

  deleteInspirationItem(userId: number, id: number) {
    const before = this.inspirationItems.length;
    this.inspirationItems = this.inspirationItems.filter(i => !(i.userId === userId && i.id === id));
    return { success: this.inspirationItems.length !== before };
  }

  listKnowledgeComments(articleId: number) {
    return this.knowledgeComments
      .filter(c => c.articleId === articleId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  addKnowledgeComment(input: { userId: number; userName: string | undefined; articleId: number; content: string; parentId?: number; emoji?: string }) {
    const id = this.next.knowledgeComment++;
    this.knowledgeComments.push({
      id,
      articleId: input.articleId,
      userId: input.userId,
      userName: input.userName ?? "匿名用户",
      content: input.content,
      parentId: input.parentId ?? null,
      emoji: input.emoji ?? null,
      createdAt: now(),
    } as any);
    return { success: true };
  }

  toggleKnowledgeFavorite(userId: number, articleId: number) {
    const existingIdx = this.knowledgeFavorites.findIndex(f => f.userId === userId && f.articleId === articleId);
    if (existingIdx >= 0) {
      this.knowledgeFavorites.splice(existingIdx, 1);
      return { favorited: false };
    }
    const id = this.next.knowledgeFavorite++;
    this.knowledgeFavorites.push({
      id,
      articleId,
      userId,
      createdAt: now(),
    } as any);
    return { favorited: true };
  }

  recordKnowledgeView(userId: number, articleId: number) {
    const existing = this.knowledgeViews.some(v => v.userId === userId && v.articleId === articleId);
    if (!existing) {
      const id = this.next.knowledgeView++;
      this.knowledgeViews.push({
        id,
        articleId,
        userId,
        createdAt: now(),
      } as any);
    }
    return { success: true };
  }

  listKnowledgeTags() {
    const tagCount: Record<string, number> = {};
    const roots = this.knowledgeArticles.filter(a => a.parentId === null || a.parentId === undefined);
    for (const a of roots) {
      for (const tag of (a.tags as any as string[]) ?? []) {
        if (!tag) continue;
        tagCount[tag] = (tagCount[tag] ?? 0) + 1;
      }
    }
    return Object.entries(tagCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  autocompleteKnowledge(query: string) {
    const q = query.trim();
    if (!q) return { titles: [], tags: [] };
    const roots = this.knowledgeArticles.filter(a => a.parentId === null || a.parentId === undefined);
    const matched = roots
      .filter(a => safeTrim(a.title).includes(q) || safeTrim(a.content).includes(q))
      .slice(0, 5)
      .map(a => ({ id: a.id, title: a.title }));

    const matchingTags = new Set<string>();
    for (const a of roots) {
      for (const tag of ((a.tags as any as string[]) ?? [])) {
        if (tag.toLowerCase().includes(q.toLowerCase())) matchingTags.add(tag);
      }
    }
    return { titles: matched, tags: Array.from(matchingTags).slice(0, 5) };
  }

  /** 开发环境且当前用户无知识根条目时写入示例数据 */
  ensureDevKnowledgeSeed(userId: number) {
    if (process.env.NODE_ENV === "production") return;
    const roots = this.knowledgeArticles.filter(
      a => (a.parentId === null || a.parentId === undefined) && a.userId === userId,
    );
    if (roots.length > 0) return;
    for (const s of DEV_KNOWLEDGE_SAMPLES) {
      this.createKnowledge(userId, {
        title: s.title,
        content: s.content,
        tags: s.tags,
        category: s.category,
        sourceType: s.sourceType,
      });
    }
  }

  advancedSearchKnowledge(input: {
    ctxUserId: number;
    query?: string;
    tags?: string[];
    author?: string;
    category?: string;
    dateFrom?: string;
    dateTo?: string;
    searchIn?: "content" | "member" | "comments";
    sortBy?: "latest" | "popular" | "mostCommented" | "mostFavorited";
  }) {
    const {
      ctxUserId,
      query,
      tags,
      category,
      dateFrom,
      dateTo,
      searchIn = "content",
      sortBy = "latest",
    } = input;

    const q = query?.trim();
    const df = dateFrom
      ? (() => {
          const [y, m, d] = dateFrom.split("-").map((n) => parseInt(n, 10));
          return !y || !m || !d ? new Date(dateFrom) : new Date(y, m - 1, d, 0, 0, 0, 0);
        })()
      : null;
    const dt = dateTo
      ? (() => {
          const [y, m, d] = dateTo.split("-").map((n) => parseInt(n, 10));
          return !y || !m || !d ? new Date(dateTo) : new Date(y, m - 1, d, 23, 59, 59, 999);
        })()
      : null;

    let roots = this.knowledgeArticles.filter(
      a => (a.parentId === null || a.parentId === undefined) && a.userId === ctxUserId
    );

    if (q) {
      if (searchIn === "comments") {
        const matchedArticleIds = new Set(
          this.knowledgeComments
            .filter(c => safeTrim(c.content).includes(q))
            .map(c => c.articleId)
        );
        roots = roots.filter(a => matchedArticleIds.has(a.id));
      } else {
        roots = roots.filter(a => safeTrim(a.title).includes(q) || safeTrim(a.content).includes(q));
      }
    }
    if (category) {
      roots = roots.filter(a => a.category === category);
    }
    if (df) roots = roots.filter(a => a.createdAt >= df);
    if (dt) roots = roots.filter(a => a.createdAt <= dt);
    if (tags && tags.length > 0) {
      roots = roots.filter(a => ((a.tags as any as string[]) ?? []).some(t => tags.includes(t)));
    }

    const withStats = roots.map(a => {
      const articleId = a.id;
      const commentCount = this.knowledgeComments.filter(c => c.articleId === articleId).length;
      const favoriteCount = this.knowledgeFavorites.filter(f => f.articleId === articleId).length;
      const viewCount = this.knowledgeViews.filter(v => v.articleId === articleId).length;
      const isFavorited = this.knowledgeFavorites.some(f => f.articleId === articleId && f.userId === ctxUserId);
      return { ...a, commentCount, favoriteCount, viewCount, isFavorited };
    });

    const sorted = (() => {
      if (sortBy === "popular") return withStats.sort((a, b) => b.viewCount - a.viewCount);
      if (sortBy === "mostCommented") return withStats.sort((a, b) => b.commentCount - a.commentCount);
      if (sortBy === "mostFavorited") return withStats.sort((a, b) => b.favoriteCount - a.favoriteCount);
      return withStats.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    })();

    return { articles: sorted, total: sorted.length };
  }

  relatedArticlesKnowledge(input: { articleId: number; limit: number }) {
    const article = this.knowledgeArticles.find(a => a.id === input.articleId);
    if (!article) return [];
    const articleTags = ((article.tags as any as string[]) ?? []).slice();
    const others = this.knowledgeArticles
      .filter(a => (a.parentId === null || a.parentId === undefined) && a.id !== input.articleId)
      .slice(0, 100);

    const scored = others
      .map(a => {
        const aTags = ((a.tags as any as string[]) ?? []).slice();
        const overlap = aTags.filter(t => articleTags.includes(t)).length;
        const sameCategory = article.category && a.category === article.category ? 2 : 0;
        return { ...a, score: overlap + sameCategory };
      })
      .filter(a => (a as any).score > 0)
      .sort((a, b) => (b as any).score - (a as any).score)
      .slice(0, input.limit);
    if (scored.length >= input.limit) return scored;
    return scored;
  }

  // Model configuration methods
  getModelConfig() {
    return { ...this.modelConfig };
  }

  setModelConfig(input: { apiKey?: string; apiUrl?: string; model?: string; maxTokens?: number }) {
    this.modelConfig = {
      ...this.modelConfig,
      ...input,
    };
    return { ...this.modelConfig };
  }

  testModelConnection(config?: { apiKey: string; apiUrl: string; model: string }) {
    // For now, just return success - actual test will be done in the router
    return { success: true };
  }
}

export const demoStore = new InMemoryStore();

