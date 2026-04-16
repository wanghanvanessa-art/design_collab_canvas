import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { demoStore } from "./_core/inMemoryStore";
import { getDb } from "./db";
import {
  meetings, todos, ideas, ideaComments, ideaVersions, ideaReactions, interviews,
  knowledgeArticles, inspirationItems, designReviews, blindboxItems, activities,
  meetingComments, knowledgeComments, knowledgeFavorites, knowledgeViews, knowledgeTags
} from "../drizzle/schema";
import { eq, and, like, or, desc, isNull, gte, lte } from "drizzle-orm";

// ─── Auth Router ──────────────────────────────────────────────────────────────
const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// ─── Meetings Router ──────────────────────────────────────────────────────────
const meetingsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(meetings).where(eq(meetings.userId, ctx.user.id)).orderBy(desc(meetings.createdAt));
  }),

  upload: protectedProcedure.input(z.object({
    title: z.string().min(1),
    audioUrl: z.string().url(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const [result] = await db.insert(meetings).values({
      userId: ctx.user.id,
      title: input.title,
      audioUrl: input.audioUrl,
      status: "transcribing",
    });
    const meetingId = (result as any).insertId as number;

    // Async: transcribe + analyze
    (async () => {
      try {
        const db2 = await getDb();
        if (!db2) return;
        // Transcribe
        let transcript = "";
        try {
          const transcription = await transcribeAudio({ audioUrl: input.audioUrl, language: "zh" });
          transcript = (transcription as any).text || "";
        } catch {
          transcript = "（音频转录失败，请检查文件格式）";
        }
        await db2.update(meetings).set({ transcript, status: "analyzing" }).where(eq(meetings.id, meetingId));

        // Analyze
        const llmRes = await invokeLLM({
          messages: [
            { role: "system", content: "你是一个专业的会议助手，请从会议记录中提取核心信息并生成结构化待办。请用JSON格式回复。" },
            { role: "user", content: `会议标题：${input.title}\n\n会议记录：${transcript}\n\n请提取：1. 会议摘要(summary) 2. 核心洞察列表(keyInsights, 数组) 3. 待办事项列表(todos, 每项包含title/priority/assignee)` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "meeting_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  keyInsights: { type: "array", items: { type: "string" } },
                  todos: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        assignee: { type: "string" },
                      },
                      required: ["title", "priority", "assignee"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "keyInsights", "todos"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = llmRes.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

        await db2.update(meetings).set({
          summary: parsed.summary || "",
          keyInsights: parsed.keyInsights || [],
          structuredMinutes: parsed.structuredMinutes || [],
          aiInsights: parsed.aiInsights || [],
          attendees: parsed.attendees || [],
          status: "done",
        }).where(eq(meetings.id, meetingId));

        // Create todos
        if (parsed.todos?.length > 0) {
          for (const t of parsed.todos) {
            await db2.insert(todos).values({
              userId: ctx.user.id,
              meetingId,
              title: t.title,
              priority: t.priority || "medium",
              assignee: t.assignee || null,
              sourceType: "meeting",
              sourceId: meetingId,
            });
          }
        }
      } catch (e) {
        const db3 = await getDb();
        if (db3) await db3.update(meetings).set({ status: "error" }).where(eq(meetings.id, meetingId));
      }
    })();

    return { id: meetingId };
  }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const [meeting] = await db.select().from(meetings).where(and(eq(meetings.id, input.id), eq(meetings.userId, ctx.user.id)));
    if (!meeting) return null;
    const meetingTodos = await db.select().from(todos).where(eq(todos.meetingId, input.id)).orderBy(desc(todos.createdAt));
    return { ...meeting, todos: meetingTodos };
  }),

  listComments: protectedProcedure.input(z.object({ meetingId: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(meetingComments).where(eq(meetingComments.meetingId, input.meetingId)).orderBy(desc(meetingComments.createdAt));
  }),

  addComment: protectedProcedure.input(z.object({
    meetingId: z.number(),
    content: z.string().min(1),
    parentId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(meetingComments).values({
      meetingId: input.meetingId,
      userId: ctx.user.id,
      userName: ctx.user.name || "匿名",
      content: input.content,
      parentId: input.parentId ?? null,
    });
    return { success: true };
  }),

  updateTodo: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    priority: z.enum(["high", "medium", "low"]).optional(),
    assignee: z.string().optional(),
    dueDate: z.string().optional(),
    completed: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { id, ...updates } = input;
    await db.update(todos).set(updates as any).where(and(eq(todos.id, id), eq(todos.userId, ctx.user.id)));
    return { success: true };
  }),

  // 一键保存会议纪要到知识库
  saveToKnowledge: protectedProcedure.input(z.object({
    meetingId: z.number(),
    title: z.string().min(1),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    // Verify meeting belongs to user
    const [meeting] = await db.select().from(meetings).where(and(eq(meetings.id, input.meetingId), eq(meetings.userId, ctx.user.id)));
    if (!meeting) throw new Error("Meeting not found");
    const [result] = await db.insert(knowledgeArticles).values({
      userId: ctx.user.id,
      title: input.title,
      content: input.content,
      tags: input.tags || ["会议纪要"],
      category: input.category || "会议纪要",
      version: 1,
      sourceType: "meeting",
      sourceMeetingId: input.meetingId,
    });
    const articleId = (result as any).insertId as number;
    // Record activity
    try {
      await db.insert(activities).values({
        userId: ctx.user.id,
        userName: ctx.user.name || "团队成员",
        type: "knowledge_added",
        title: `会议「${meeting.title}」已保存到知识库`,
        detail: input.title,
        refId: articleId,
        refType: "knowledge",
      });
    } catch {}
    return { success: true, articleId };
  }),
});

// ─── Todos Router ─────────────────────────────────────────────────────────────
const todosRouter = router({
  list: protectedProcedure.input(z.object({
    priority: z.enum(["high", "medium", "low"]).optional(),
  }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [eq(todos.userId, ctx.user.id)];
    if (input?.priority) conditions.push(eq(todos.priority, input.priority));
    return db.select().from(todos).where(and(...conditions)).orderBy(desc(todos.createdAt));
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { total: 0, pending: 0, done: 0 };
    const all = await db.select().from(todos).where(eq(todos.userId, ctx.user.id));
    return {
      total: all.length,
      pending: all.filter(t => !t.completed).length,
      done: all.filter(t => t.completed).length,
    };
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    priority: z.enum(["high", "medium", "low"]).default("medium"),
    assignee: z.string().optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(todos).values({
      userId: ctx.user.id,
      title: input.title,
      priority: input.priority,
      assignee: input.assignee || null,
      dueDate: input.dueDate || null,
      sourceType: "manual",
    });
    return { success: true };
  }),

  toggle: protectedProcedure.input(z.object({
    id: z.number(),
    completed: z.boolean(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.update(todos).set({ completed: input.completed }).where(and(eq(todos.id, input.id), eq(todos.userId, ctx.user.id)));
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(todos).where(and(eq(todos.id, input.id), eq(todos.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Ideas Router ─────────────────────────────────────────────────────────────
const ideasRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return demoStore.listIdeas(ctx.user.id);
    return db.select().from(ideas).where(eq(ideas.userId, ctx.user.id)).orderBy(desc(ideas.createdAt));
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.getIdea(ctx.user.id, input.id);
    const [idea] = await db.select().from(ideas).where(and(eq(ideas.id, input.id), eq(ideas.userId, ctx.user.id)));
    return idea || null;
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.createIdea(ctx.user.id, { title: input.title, content: input.content, tags: input.tags });
    await db.insert(ideas).values({
      userId: ctx.user.id,
      title: input.title,
      content: input.content,
      tags: input.tags || [],
      status: "published",
    });
    return { success: true };
  }),

  comments: protectedProcedure.input(z.object({ ideaId: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.listIdeaComments(input.ideaId);
    return db.select().from(ideaComments).where(eq(ideaComments.ideaId, input.ideaId)).orderBy(desc(ideaComments.createdAt));
  }),

  addComment: protectedProcedure.input(z.object({
    ideaId: z.number(),
    content: z.string().min(1),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.addIdeaComment(ctx.user.id, { ideaId: input.ideaId, content: input.content });
    await db.insert(ideaComments).values({
      ideaId: input.ideaId,
      userId: ctx.user.id,
      content: input.content,
    });
    // Update comment count
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, input.ideaId));
    if (idea) {
      await db.update(ideas).set({ commentsCount: (idea.commentsCount || 0) + 1 }).where(eq(ideas.id, input.ideaId));
    }
    return { success: true };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    content: z.string().optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    tags: z.array(z.string()).optional(),
    modules: z.array(z.object({ id: z.string(), title: z.string(), content: z.string() })).optional(),
    changeNote: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.updateIdea(ctx.user.id, { id: input.id, title: input.title, content: input.content, status: input.status, tags: input.tags, changeNote: input.changeNote });
    const [idea] = await db.select().from(ideas).where(and(eq(ideas.id, input.id), eq(ideas.userId, ctx.user.id)));
    if (!idea) throw new Error("Not found");

    // Save version snapshot before update
    const versionCount = await db.select().from(ideaVersions).where(eq(ideaVersions.ideaId, input.id));
    await db.insert(ideaVersions).values({
      ideaId: input.id,
      userId: ctx.user.id,
      title: idea.title,
      content: idea.content,
      modules: input.modules || [],
      versionNum: versionCount.length + 1,
      changeNote: input.changeNote || `版本 ${versionCount.length + 1}`,
    });

    const updateData: Record<string, unknown> = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.content !== undefined) updateData.content = input.content;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.tags !== undefined) updateData.tags = input.tags;
    await db.update(ideas).set(updateData).where(eq(ideas.id, input.id));
    return { success: true };
  }),

  versions: protectedProcedure.input(z.object({ ideaId: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(ideaVersions).where(eq(ideaVersions.ideaId, input.ideaId)).orderBy(desc(ideaVersions.createdAt));
  }),

  rollbackVersion: protectedProcedure.input(z.object({ ideaId: z.number(), versionId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { success: true };
    const [ver] = await db.select().from(ideaVersions).where(eq(ideaVersions.id, input.versionId));
    if (!ver) throw new Error("Version not found");
    await db.update(ideas).set({ title: ver.title, content: ver.content }).where(and(eq(ideas.id, input.ideaId), eq(ideas.userId, ctx.user.id)));
    return { success: true };
  }),

  reactions: protectedProcedure.input(z.object({ ideaId: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { useful: 0, discuss: 0, question: 0, userReaction: null };
    const allReactions = await db.select().from(ideaReactions).where(eq(ideaReactions.ideaId, input.ideaId));
    const userReaction = allReactions.find(r => r.userId === ctx.user.id);
    return {
      useful: allReactions.filter(r => r.type === "useful").length,
      discuss: allReactions.filter(r => r.type === "discuss").length,
      question: allReactions.filter(r => r.type === "question").length,
      userReaction: userReaction?.type || null,
    };
  }),

  addReaction: protectedProcedure.input(z.object({
    ideaId: z.number(),
    type: z.enum(["useful", "discuss", "question"]),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { action: "added" };
    // Toggle: remove if same type already exists
    const existing = await db.select().from(ideaReactions).where(and(eq(ideaReactions.ideaId, input.ideaId), eq(ideaReactions.userId, ctx.user.id)));
    if (existing.length > 0) {
      if (existing[0].type === input.type) {
        await db.delete(ideaReactions).where(eq(ideaReactions.id, existing[0].id));
        return { action: "removed" };
      } else {
        await db.update(ideaReactions).set({ type: input.type }).where(eq(ideaReactions.id, existing[0].id));
        return { action: "updated" };
      }
    }
    await db.insert(ideaReactions).values({ ideaId: input.ideaId, userId: ctx.user.id, type: input.type });
    return { action: "added" };
  }),

  generateExport: protectedProcedure.input(z.object({
    id: z.number(),
    format: z.enum(["pdf", "word", "blog", "video_script"]),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const idea = db
      ? (await db.select().from(ideas).where(eq(ideas.id, input.id)))[0]
      : demoStore.getIdea(ctx.user.id, input.id);
    if (!idea) throw new Error("Idea not found");

    const systemPrompts: Record<string, string> = {
      pdf: "你是一个专业报告排版师。请将以下想法内容整理成一份规范的 PDF 报告，包含：摘要、背景分析、方案详情、预期效果、下一步行动。输出 Markdown 格式。",
      word: "你是一个文档整理师。请将以下想法内容整理成一份 Word 文档，保留层级标题和内容结构，适合二次编辑。输出 Markdown 格式。",
      blog: "你是一个内容运营专家。请将以下想法整理成一篇适合对外发布的博客文章，包含吸引人的标题、摘要、正文和标签建议。输出 Markdown 格式。",
      video_script: "你是一个视频脚本策划师。请将以下想法整理成视频脚本，按「镜头编号 | 画面描述 | 台词内容 | 时长建议」的表格格式输出，共 5-8 个镜头。",
    };

    const llmRes = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompts[input.format] },
        { role: "user", content: `想法标题：${idea.title}\n\n想法内容：${idea.content}` },
      ],
    });

    const rawContent = llmRes.choices[0]?.message?.content || "";
    const rawText = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    let content = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    if (!content) content = rawText;

    return { title: idea.title, content, format: input.format };
  }),

  export: protectedProcedure.input(z.object({
    id: z.number(),
    format: z.enum(["pdf", "word", "blog", "markdown"]),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const idea = db
      ? (await db.select().from(ideas).where(eq(ideas.id, input.id)))[0]
      : demoStore.getIdea(ctx.user.id, input.id);
    if (!idea) throw new Error("Idea not found");

    const commentsData = db
      ? await db.select().from(ideaComments).where(eq(ideaComments.ideaId, input.id))
      : demoStore.listIdeaComments(input.id);

    let content = "";
    if (input.format === "markdown" || input.format === "blog") {
      content = `# ${idea.title}\n\n${idea.content}\n\n---\n\n## 评论 (${commentsData.length})\n\n${commentsData.map(c => `> ${c.content}`).join("\n\n")}`;
    } else {
      content = `${idea.title}\n\n${idea.content}\n\n评论 (${commentsData.length}):\n${commentsData.map(c => `- ${c.content}`).join("\n")}`;
    }

    return { title: idea.title, content, format: input.format === "word" ? "docx" : input.format };
  }),
});

// ─── Interviews Router ────────────────────────────────────────────────────────
const interviewsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return demoStore.listInterviews(ctx.user.id);
    return db.select().from(interviews).where(eq(interviews.userId, ctx.user.id)).orderBy(desc(interviews.createdAt));
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.getInterview(ctx.user.id, input.id);
    const [iv] = await db.select().from(interviews).where(and(eq(interviews.id, input.id), eq(interviews.userId, ctx.user.id)));
    return iv || null;
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    interviewee: z.string().optional(),
    content: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      return demoStore.createInterview(ctx.user.id, {
        title: input.title,
        interviewee: input.interviewee,
        content: input.content,
        date: input.date,
      });
    }
    await db.insert(interviews).values({
      userId: ctx.user.id,
      title: input.title,
      interviewee: input.interviewee || null,
      content: input.content || null,
      date: input.date || null,
      status: "draft",
    });
    return { success: true };
  }),

  analyze: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.analyzeInterview(ctx.user.id, input.id);
    const [iv] = await db.select().from(interviews).where(and(eq(interviews.id, input.id), eq(interviews.userId, ctx.user.id)));
    if (!iv) throw new Error("Not found");

    await db.update(interviews).set({ status: "analyzing" }).where(eq(interviews.id, input.id));

    // Async analysis
    (async () => {
      try {
        const db2 = await getDb();
        if (!db2) return;
        const llmRes = await invokeLLM({
          messages: [
            { role: "system", content: "你是一个专业的用户研究分析师。请分析访谈内容，提取用户画像标签、痛点和设计解决方案建议。请用JSON格式回复。" },
            { role: "user", content: `访谈主题：${iv.title}\n受访者：${iv.interviewee || "未知"}\n\n访谈内容：\n${iv.content || "（无内容）"}\n\n请分析并提取：1. 人群标签(audienceLabels, 数组) 2. 用户痛点(painPoints, 数组) 3. 设计解决方案建议(designSolutions, 数组)` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "interview_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  audienceLabels: { type: "array", items: { type: "string" } },
                  painPoints: { type: "array", items: { type: "string" } },
                  designSolutions: { type: "array", items: { type: "string" } },
                },
                required: ["audienceLabels", "painPoints", "designSolutions"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = llmRes.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
        await db2.update(interviews).set({
          audienceLabels: parsed.audienceLabels || [],
          painPoints: parsed.painPoints || [],
          designSolutions: parsed.designSolutions || [],
          status: "done",
        }).where(eq(interviews.id, input.id));
      } catch {
        const db3 = await getDb();
        if (db3) await db3.update(interviews).set({ status: "draft" }).where(eq(interviews.id, input.id));
      }
    })();

    return { success: true };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().min(1),
    interviewee: z.string().optional(),
    content: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.updateInterview(ctx.user.id, input);
    const [iv] = await db.select().from(interviews).where(and(eq(interviews.id, input.id), eq(interviews.userId, ctx.user.id)));
    if (!iv) throw new Error("Not found");
    await db.update(interviews).set({
      title: input.title,
      interviewee: input.interviewee || null,
      content: input.content || null,
      date: input.date || null,
      audienceLabels: [],
      painPoints: [],
      designSolutions: [],
      status: "draft",
    }).where(eq(interviews.id, input.id));
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.deleteInterview(ctx.user.id, input.id);
    await db.delete(interviews).where(and(eq(interviews.id, input.id), eq(interviews.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Knowledge Router ─────────────────────────────────────────────────────────
const knowledgeRouter = router({
  list: protectedProcedure.input(z.object({
    search: z.string().optional(),
    tag: z.string().optional(),
  }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [eq(knowledgeArticles.userId, ctx.user.id), isNull(knowledgeArticles.parentId)];
    if (input?.search) {
      conditions.push(or(
        like(knowledgeArticles.title, `%${input.search}%`),
        like(knowledgeArticles.content, `%${input.search}%`),
      ) as any);
    }
    return db.select().from(knowledgeArticles).where(and(...conditions)).orderBy(desc(knowledgeArticles.updatedAt));
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.getKnowledgeArticle(ctx.user.id, input.id);
    const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, input.id));
    return article || null;
  }),

  versions: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.versionsKnowledge(ctx.user.id, input.id);
    const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, input.id));
    if (!article) return [];
    const rootId = article.parentId || article.id;
    const allVersions = await db.select().from(knowledgeArticles).where(
      or(eq(knowledgeArticles.id, rootId), eq(knowledgeArticles.parentId, rootId))
    );
    return allVersions.sort((a, b) => b.version - a.version);
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      return demoStore.createKnowledge(ctx.user.id, {
        title: input.title,
        content: input.content,
        tags: input.tags,
        category: input.category,
      });
    }
    await db.insert(knowledgeArticles).values({
      userId: ctx.user.id,
      title: input.title,
      content: input.content,
      tags: input.tags || [],
      category: input.category || null,
      version: 1,
    });
    return { success: true };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    content: z.string().min(1),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.updateKnowledge(ctx.user.id, { id: input.id, content: input.content });
    const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, input.id));
    if (!article) throw new Error("Not found");

    // Create new version
    const rootId = article.parentId || article.id;
    const allVersions = await db.select().from(knowledgeArticles).where(
      or(eq(knowledgeArticles.id, rootId), eq(knowledgeArticles.parentId, rootId))
    );
    const maxVersion = Math.max(...allVersions.map(v => v.version));

    await db.insert(knowledgeArticles).values({
      userId: ctx.user.id,
      title: article.title,
      content: input.content,
      tags: article.tags,
      category: article.category,
      version: maxVersion + 1,
      parentId: rootId,
    });

    // Update original to latest content
    await db.update(knowledgeArticles).set({ content: input.content, version: maxVersion + 1 }).where(eq(knowledgeArticles.id, input.id));

    // Record activity
    await db.insert(activities).values({
      userId: ctx.user.id,
      userName: ctx.user.name || '匿名用户',
      type: 'knowledge_added',
      title: `更新了「${article.title}」`,
      detail: `版本 v${maxVersion + 1}`,
      refId: input.id,
      refType: 'knowledge',
    });
    return { success: true };
  }),

  // 获取带统计数据的列表（评论数、收藏数、浏览数）
  listWithStats: protectedProcedure.input(z.object({
    search: z.string().optional(),
    tag: z.string().optional(),
  }).optional()).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [isNull(knowledgeArticles.parentId)];
    if (input?.search) {
      conditions.push(or(
        like(knowledgeArticles.title, `%${input.search}%`),
        like(knowledgeArticles.content, `%${input.search}%`),
      ) as any);
    }
    const articles = await db.select().from(knowledgeArticles).where(and(...conditions)).orderBy(desc(knowledgeArticles.updatedAt));
    // Attach stats
    const withStats = await Promise.all(articles.map(async (a) => {
      const [commentRows, favoriteRows, viewRows] = await Promise.all([
        db.select().from(knowledgeComments).where(eq(knowledgeComments.articleId, a.id)),
        db.select().from(knowledgeFavorites).where(eq(knowledgeFavorites.articleId, a.id)),
        db.select().from(knowledgeViews).where(eq(knowledgeViews.articleId, a.id)),
      ]);
      const isFavorited = favoriteRows.some(f => f.userId === ctx.user.id);
      return { ...a, commentCount: commentRows.length, favoriteCount: favoriteRows.length, viewCount: viewRows.length, isFavorited };
    }));
    return withStats;
  }),

  // 记录浏览
  recordView: protectedProcedure.input(z.object({ articleId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) { demoStore.recordKnowledgeView(ctx.user.id, input.articleId); return { success: true }; }
    // 避免重复记录（同一用户同一文章当天只记录一次）
    const existing = await db.select().from(knowledgeViews)
      .where(and(eq(knowledgeViews.articleId, input.articleId), eq(knowledgeViews.userId, ctx.user.id)));
    if (existing.length === 0) {
      await db.insert(knowledgeViews).values({ articleId: input.articleId, userId: ctx.user.id });
    }
    return { success: true };
  }),

  // 收藏/取消收藏
  toggleFavorite: protectedProcedure.input(z.object({ articleId: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.toggleKnowledgeFavorite(ctx.user.id, input.articleId);
    const existing = await db.select().from(knowledgeFavorites)
      .where(and(eq(knowledgeFavorites.articleId, input.articleId), eq(knowledgeFavorites.userId, ctx.user.id)));
    if (existing.length > 0) {
      await db.delete(knowledgeFavorites).where(and(eq(knowledgeFavorites.articleId, input.articleId), eq(knowledgeFavorites.userId, ctx.user.id)));
      return { favorited: false };
    } else {
      await db.insert(knowledgeFavorites).values({ articleId: input.articleId, userId: ctx.user.id });
      return { favorited: true };
    }
  }),

  // 评论列表
  listComments: protectedProcedure.input(z.object({ articleId: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.listKnowledgeComments(input.articleId);
    return db.select().from(knowledgeComments).where(eq(knowledgeComments.articleId, input.articleId)).orderBy(desc(knowledgeComments.createdAt));
  }),

  // 添加评论
  addComment: protectedProcedure.input(z.object({
    articleId: z.number(),
    content: z.string().min(1),
    parentId: z.number().optional(),
    emoji: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      demoStore.addKnowledgeComment({ userId: ctx.user.id, userName: ctx.user.name || undefined, articleId: input.articleId, content: input.content, parentId: input.parentId, emoji: input.emoji });
      return { success: true };
    }
    await db.insert(knowledgeComments).values({
      articleId: input.articleId,
      userId: ctx.user.id,
      userName: ctx.user.name || '匿名用户',
      content: input.content,
      parentId: input.parentId || null,
      emoji: input.emoji || null,
    });
    return { success: true };
  }),

  // 团队知识动态（最近 24h）
  teamActivity: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const acts = await db.select().from(activities)
      .where(and(
        eq(activities.refType, 'knowledge'),
      ))
      .orderBy(desc(activities.createdAt))
      .limit(30);
    // Also get recent comments
    const recentComments = await db.select().from(knowledgeComments)
      .orderBy(desc(knowledgeComments.createdAt))
      .limit(10);
    const commentActivities = recentComments.map(c => ({
      id: c.id + 100000,
      userId: c.userId,
      userName: c.userName || '匿名用户',
      type: 'comment' as const,
      title: `评论了知识条目`,
      detail: c.content.slice(0, 50),
      refId: c.articleId,
      refType: 'knowledge',
      createdAt: c.createdAt,
    }));
    const combined = [
      ...acts.map(a => ({ ...a, type: a.type as string })),
      ...commentActivities,
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);
    return combined;
  }),

  // 标签库（带使用频次）
  listTags: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    // 从所有文章的 tags 字段统计频次
    const articles = await db.select({ tags: knowledgeArticles.tags }).from(knowledgeArticles).where(isNull(knowledgeArticles.parentId));
    const tagCount: Record<string, number> = {};
    for (const a of articles) {
      for (const tag of (a.tags as string[] || [])) {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      }
    }
    return Object.entries(tagCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }),

  // 高级搜索（多维度：关键词+标签+作者+时间+分类+排序）
  advancedSearch: protectedProcedure.input(z.object({
    query: z.string().optional(),
    tags: z.array(z.string()).optional(),
    author: z.string().optional(),
    category: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortBy: z.enum(['latest', 'popular', 'mostCommented', 'mostFavorited']).default('latest'),
    searchIn: z.enum(['content', 'member', 'comments']).default('content'),
    viewMode: z.enum(['list', 'grid']).default('list'),
  })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      demoStore.ensureDevKnowledgeSeed(ctx.user.id);
      return demoStore.advancedSearchKnowledge({
        ctxUserId: ctx.user.id,
        query: input.query,
        tags: input.tags,
        author: input.author,
        category: input.category,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        searchIn: input.searchIn,
        sortBy: input.sortBy,
      });
    }

    // Search in comments mode
    if (input.searchIn === 'comments' && input.query) {
      const matchedComments = await db.select().from(knowledgeComments)
        .where(like(knowledgeComments.content, `%${input.query}%`))
        .orderBy(desc(knowledgeComments.createdAt))
        .limit(50);
      const articleIds = Array.from(new Set(matchedComments.map(c => c.articleId)));
      if (articleIds.length === 0) return { articles: [], total: 0, comments: [] };
      const matchedArticles = await db.select().from(knowledgeArticles)
        .where(and(isNull(knowledgeArticles.parentId)));
      const filtered = matchedArticles.filter(a => articleIds.includes(a.id));
      const withStats = await Promise.all(filtered.map(async (a) => {
        const [commentRows, favoriteRows, viewRows] = await Promise.all([
          db.select().from(knowledgeComments).where(eq(knowledgeComments.articleId, a.id)),
          db.select().from(knowledgeFavorites).where(eq(knowledgeFavorites.articleId, a.id)),
          db.select().from(knowledgeViews).where(eq(knowledgeViews.articleId, a.id)),
        ]);
        const isFavorited = favoriteRows.some(f => f.userId === ctx.user.id);
        const matchedCmts = matchedComments.filter(c => c.articleId === a.id);
        return { ...a, commentCount: commentRows.length, favoriteCount: favoriteRows.length, viewCount: viewRows.length, isFavorited, matchedComments: matchedCmts };
      }));
      return { articles: withStats, total: withStats.length };
    }

    // Search in member mode
    if (input.searchIn === 'member' && input.author) {
      const memberArticles = await db.select().from(knowledgeArticles)
        .where(and(isNull(knowledgeArticles.parentId)))
        .orderBy(desc(knowledgeArticles.updatedAt));
      // Filter by author name (stored in activities or user lookup)
      const withStats = await Promise.all(memberArticles.map(async (a) => {
        const [commentRows, favoriteRows, viewRows] = await Promise.all([
          db.select().from(knowledgeComments).where(eq(knowledgeComments.articleId, a.id)),
          db.select().from(knowledgeFavorites).where(eq(knowledgeFavorites.articleId, a.id)),
          db.select().from(knowledgeViews).where(eq(knowledgeViews.articleId, a.id)),
        ]);
        const isFavorited = favoriteRows.some(f => f.userId === ctx.user.id);
        return { ...a, commentCount: commentRows.length, favoriteCount: favoriteRows.length, viewCount: viewRows.length, isFavorited };
      }));
      return { articles: withStats, total: withStats.length };
    }

    // Standard content search
    const conditions: any[] = [isNull(knowledgeArticles.parentId)];
    if (input.query) {
      conditions.push(or(
        like(knowledgeArticles.title, `%${input.query}%`),
        like(knowledgeArticles.content, `%${input.query}%`),
      ) as any);
    }
    if (input.category) {
      conditions.push(eq(knowledgeArticles.category, input.category));
    }
    if (input.dateFrom) {
      conditions.push(gte(knowledgeArticles.createdAt, new Date(input.dateFrom)) as any);
    }
    if (input.dateTo) {
      conditions.push(lte(knowledgeArticles.createdAt, new Date(input.dateTo)) as any);
    }

    let articles = await db.select().from(knowledgeArticles)
      .where(and(...conditions))
      .orderBy(desc(knowledgeArticles.updatedAt));

    // Filter by tags
    if (input.tags && input.tags.length > 0) {
      articles = articles.filter(a => {
        const articleTags = a.tags as string[] || [];
        return input.tags!.some(t => articleTags.includes(t));
      });
    }

    const withStats = await Promise.all(articles.map(async (a) => {
      const [commentRows, favoriteRows, viewRows] = await Promise.all([
        db.select().from(knowledgeComments).where(eq(knowledgeComments.articleId, a.id)),
        db.select().from(knowledgeFavorites).where(eq(knowledgeFavorites.articleId, a.id)),
        db.select().from(knowledgeViews).where(eq(knowledgeViews.articleId, a.id)),
      ]);
      const isFavorited = favoriteRows.some(f => f.userId === ctx.user.id);
      return { ...a, commentCount: commentRows.length, favoriteCount: favoriteRows.length, viewCount: viewRows.length, isFavorited };
    }));

    // Sort
    let sorted = withStats;
    if (input.sortBy === 'popular') sorted = withStats.sort((a, b) => b.viewCount - a.viewCount);
    else if (input.sortBy === 'mostCommented') sorted = withStats.sort((a, b) => b.commentCount - a.commentCount);
    else if (input.sortBy === 'mostFavorited') sorted = withStats.sort((a, b) => b.favoriteCount - a.favoriteCount);

    return { articles: sorted, total: sorted.length };
  }),

  // 关联推荐（基于标签和分类）
  relatedArticles: protectedProcedure.input(z.object({
    articleId: z.number(),
    limit: z.number().default(4),
  })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.relatedArticlesKnowledge({ articleId: input.articleId, limit: input.limit });
    const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, input.articleId));
    if (!article) return [];
    const articleTags = article.tags as string[] || [];
    // Get all other articles
    const others = await db.select().from(knowledgeArticles)
      .where(and(isNull(knowledgeArticles.parentId)))
      .orderBy(desc(knowledgeArticles.updatedAt))
      .limit(100);
    // Score by tag overlap + same category
    const scored = others
      .filter(a => a.id !== input.articleId)
      .map(a => {
        const aTags = a.tags as string[] || [];
        const overlap = aTags.filter(t => articleTags.includes(t)).length;
        const sameCategory = a.category === article.category ? 2 : 0;
        return { ...a, score: overlap + sameCategory };
      })
      .filter(a => a.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, input.limit);
    // If not enough, fill with recent articles
    if (scored.length < input.limit) {
      const recent = others
        .filter(a => a.id !== input.articleId && !scored.find(s => s.id === a.id))
        .slice(0, input.limit - scored.length)
        .map(a => ({ ...a, score: 0 }));
      return [...scored, ...recent];
    }
    return scored;
  }),

  // 自动补全建议
  autocomplete: protectedProcedure.input(z.object({
    query: z.string(),
  })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { titles: [], tags: [] };
    if (!input.query || input.query.length < 1) return { titles: [], tags: [] };
    const articles = await db.select({ id: knowledgeArticles.id, title: knowledgeArticles.title, tags: knowledgeArticles.tags })
      .from(knowledgeArticles)
      .where(and(isNull(knowledgeArticles.parentId), like(knowledgeArticles.title, `%${input.query}%`)))
      .limit(5);
    // Collect matching tags
    const allArticles = await db.select({ tags: knowledgeArticles.tags }).from(knowledgeArticles).where(isNull(knowledgeArticles.parentId));
    const matchingTags = new Set<string>();
    for (const a of allArticles) {
      for (const tag of (a.tags as string[] || [])) {
        if (tag.toLowerCase().includes(input.query.toLowerCase())) matchingTags.add(tag);
      }
    }
    return {
      titles: articles.map(a => ({ id: a.id, title: a.title })),
      tags: Array.from(matchingTags).slice(0, 5),
    };
  }),
});

// ─── Inspiration Router ───────────────────────────────────────────────────────
const inspirationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return demoStore.listInspirationItems(ctx.user.id);
    return db.select().from(inspirationItems).where(eq(inspirationItems.userId, ctx.user.id)).orderBy(desc(inspirationItems.createdAt));
  }),

  create: protectedProcedure.input(z.object({
    type: z.enum(["text", "image", "link", "screenshot"]).default("text"),
    title: z.string().optional(),
    content: z.string().optional(),
    url: z.string().optional(),
    color: z.string().optional(),
    posX: z.number().default(0),
    posY: z.number().default(0),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.createInspirationItem(ctx.user.id, {
      type: input.type,
      title: input.title,
      content: input.content,
      url: input.url,
      color: input.color,
      posX: input.posX,
      posY: input.posY,
    });
    await db.insert(inspirationItems).values({
      userId: ctx.user.id,
      type: input.type,
      title: input.title || null,
      content: input.content || null,
      url: input.url || null,
      imageUrl: input.type === "image" ? (input.url || null) : null,
      color: input.color || "#ffffff",
      posX: input.posX,
      posY: input.posY,
      styleTags: [],
    });
    return { success: true };
  }),

  updatePosition: protectedProcedure.input(z.object({
    id: z.number(),
    posX: z.number(),
    posY: z.number(),
    width: z.number().optional(),
    height: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.updateInspirationPosition(ctx.user.id, input);
    const updateData: Record<string, number> = { posX: input.posX, posY: input.posY };
    if (input.width !== undefined) updateData.width = input.width;
    if (input.height !== undefined) updateData.height = input.height;
    await db.update(inspirationItems).set(updateData).where(and(eq(inspirationItems.id, input.id), eq(inspirationItems.userId, ctx.user.id)));
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.deleteInspirationItem(ctx.user.id, input.id);
    await db.delete(inspirationItems).where(and(eq(inspirationItems.id, input.id), eq(inspirationItems.userId, ctx.user.id)));
    return { success: true };
  }),

  updateContent: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    content: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.updateInspirationContent(ctx.user.id, input);
    const updateData: Record<string, string | null> = {};
    if (input.title !== undefined) updateData.title = input.title.trim() || null;
    if (input.content !== undefined) updateData.content = input.content.trim() || null;
    await db.update(inspirationItems).set(updateData).where(and(eq(inspirationItems.id, input.id), eq(inspirationItems.userId, ctx.user.id)));
    return { success: true };
  }),

  askAI: protectedProcedure.input(z.object({
    cardId: z.number(),
    question: z.string().min(1),
    attachmentUrls: z.array(z.string()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("AI 功能需要数据库连接");

    // Get the target card
    const [card] = await db.select().from(inspirationItems).where(
      and(eq(inspirationItems.id, input.cardId), eq(inspirationItems.userId, ctx.user.id))
    );
    if (!card) throw new Error("Card not found");

    const cardContext = [
      card.title ? `标题：${card.title}` : "",
      card.content ? `内容：${card.content}` : "",
      card.url ? `链接：${card.url}` : "",
    ].filter(Boolean).join("\n");

    // Build messages with optional image attachments
    const userContent: any[] = [
      { type: "text", text: `下面是一张灵感便利贴的内容：\n${cardContext}\n\n用户问题：${input.question}` },
    ];
    if (input.attachmentUrls && input.attachmentUrls.length > 0) {
      for (const url of input.attachmentUrls) {
        userContent.push({ type: "image_url", image_url: { url, detail: "auto" } });
      }
    }

    const llmRes = await invokeLLM({
      messages: [
        { role: "system", content: "你是一个专业设计顾问和灵感探索助手。用户会就一张灵感便利贴提问，请给出具体、实用的回答和设计建议。回答要简洁清晰，100-200字为宜。" },
        { role: "user", content: userContent },
      ],
    });

    const rawAnswer = llmRes.choices[0]?.message?.content || "暂无回答";
    const rawText = typeof rawAnswer === "string" ? rawAnswer : JSON.stringify(rawAnswer);
    // Strip thinking process: remove <think>...</think> blocks and keep only the final answer
    let answerText = rawText;
    // Remove <think>...</think> blocks (including nested)
    answerText = answerText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    // Also handle cases where model outputs thinking without closing tag (truncated)
    const thinkStart = answerText.indexOf("<think>");
    if (thinkStart !== -1) {
      answerText = answerText.slice(0, thinkStart).trim();
    }
    if (!answerText) answerText = "暂无回答";

    // Generate an inspiration image based on the question
    let generatedImageUrl: string | null = null;
    try {
      const { generateImage } = await import("./_core/imageGeneration");
      const imagePrompt = `Design inspiration: ${input.question}. Style: modern, clean, professional design reference image`;
      const imgResult = await generateImage({ prompt: imagePrompt });
      generatedImageUrl = imgResult.url || null;
    } catch {
      // Image generation is optional
    }

    // Save the AI reply as a new inspiration card near the original
    const replyCard = await db.insert(inspirationItems).values({
      userId: ctx.user.id,
      type: generatedImageUrl ? "image" : "text",
      title: `✨ AI 回复`,
      content: answerText,
      url: generatedImageUrl || null,
      imageUrl: generatedImageUrl || null,
      color: "#f0f9ff",
      posX: (card.posX ?? 0) + 220,
      posY: card.posY ?? 0,
      styleTags: [],
    });

    return {
      answer: answerText,
      imageUrl: generatedImageUrl,
      replyCardId: (replyCard as any).insertId as number,
    };
  }),

  generateTags: protectedProcedure.input(z.object({})).mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return { success: true };
    const items = await db.select().from(inspirationItems).where(eq(inspirationItems.userId, ctx.user.id));
    if (items.length === 0) return { success: true };

    const itemsSummary = items.map(i => `${i.type}: ${i.title || ""} ${i.content || ""}`).join("\n");
    const llmRes = await invokeLLM({
      messages: [
        { role: "system", content: "你是一个设计风格分析师。请分析这些灵感素材，为每个素材生成风格标签。请用JSON格式回复。" },
        { role: "user", content: `灵感素材列表：\n${itemsSummary}\n\n请为每个素材生成2-4个风格标签（如：极简主义、扁平化、Material Design、新拟态等）。返回格式：{items: [{id: number, tags: string[]}]}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "style_tags",
          strict: true,
          schema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    tags: { type: "array", items: { type: "string" } },
                  },
                  required: ["id", "tags"],
                  additionalProperties: false,
                },
              },
            },
            required: ["items"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = llmRes.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

    for (const item of (parsed.items || [])) {
      const dbItem = items.find(i => i.id === item.id);
      if (dbItem) {
        await db.update(inspirationItems).set({ styleTags: item.tags }).where(eq(inspirationItems.id, item.id));
      }
    }

    return { success: true };
  }),
});

// ─── Reviews Router ───────────────────────────────────────────────────────────
const reviewsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return demoStore.listDesignReviews(ctx.user.id);
    return db.select().from(designReviews).where(and(eq(designReviews.userId, ctx.user.id), isNull(designReviews.parentId))).orderBy(desc(designReviews.createdAt));
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.getDesignReview(ctx.user.id, input.id);
    const [review] = await db.select().from(designReviews).where(eq(designReviews.id, input.id));
    return review || null;
  }),

  versions: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.versionsDesignReview(ctx.user.id, input.id);
    const [review] = await db.select().from(designReviews).where(eq(designReviews.id, input.id));
    if (!review) return [];
    const rootId = review.parentId || review.id;
    const allVersions = await db.select().from(designReviews).where(
      or(eq(designReviews.id, rootId), eq(designReviews.parentId, rootId))
    );
    return allVersions.sort((a, b) => b.version - a.version);
  }),

  upload: protectedProcedure.input(z.object({
    title: z.string().min(1),
    designUrls: z.array(z.string().min(1).refine(
      (value) => /^https?:\/\//i.test(value) || /^data:image\//i.test(value),
      "designUrl must be an http(s) or data:image URL",
    )).min(1).max(10),
    mode: z.enum(["single", "compare"]).default("single"),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();

    const isSingle = input.mode === "single";
    const imageCount = input.designUrls.length;

    const designReviewSystemPrompt = isSingle
      ? `你是一位资深 UI/UX 设计评审专家，拥有 10 年以上 B 端企业级 SaaS/中台产品设计经验。你的职责是**仔细观察用户上传的设计稿图片**，从「产品功能」「交互体验」「设计样式」三个维度进行专业深度分析，并给出综合总览。

【综合总览】
- 一句话概括设计稿的整体评价（不超过 30 字）
- 总体评分（overallScore, 0-100）
- 核心亮点（不少于 2 条，必须引用设计稿中的具体视觉元素）
- 主要问题（不少于 2 条，必须指出设计稿中的具体位置或元素）

【产品功能维度】(productScore, 0-100)
- 业务目标达成度：核心业务流程是否完整闭环
- 功能完整性：关键功能点覆盖率、边界 case 处理
- 信息架构：内容组织逻辑、导航结构、标签命名清晰度
- 数据展示：数据可视化的准确性和有效性

【交互体验维度】(interactionScore, 0-100)
- 操作流程：核心任务路径的步骤合理性
- 控件选择：表单控件、操作按钮的类型是否恰当
- 反馈机制：操作结果反馈、加载状态、空状态处理
- 可用性：学习成本、容错设计、操作效率

【设计样式维度】(designScore, 0-100)
- 布局结构：栅格系统使用、间距一致性、对齐规范
- 色彩体系：主题色、功能色、中性色搭配合理性
- 字体排版：字号层级、行高间距、阅读舒适度
- 视觉一致性：组件风格统一性、设计规范遵循度

评审要求：
1. **必须具体描述你在设计稿中看到的视觉元素**（按钮位置、颜色值、布局方式、文字内容等），不要泛泛而谈
2. 每个维度给出 0-100 的量化评分和不少于 80 字的详细评审意见
3. 综合评分 = 三维度加权平均（产品功能 35%、交互体验 35%、设计样式 30%）
4. 优化建议必须可操作、可量化，每条包含「问题描述 → 改进方向 → 预期收益」三段式

负面清单：
- 禁止使用"还不错""整体良好"等模糊评价
- 禁止给出无法落地的建议
- 禁止忽略设计稿图片中的实际内容
- 禁止编造设计稿中不存在的元素

请严格以如下 JSON 格式回复，不要输出任何多余文字：
{"overview":"综合总览文字","highlights":["亮点1","亮点2"],"issues":["问题1","问题2"],"productScore":85,"interactionScore":80,"designScore":82,"overallScore":82,"reviewComments":[{"dimension":"产品功能","score":85,"comment":"详细评审意见"},{"dimension":"交互体验","score":80,"comment":"详细评审意见"},{"dimension":"设计样式","score":82,"comment":"详细评审意见"}],"suggestions":["建议1","建议2"]}`
      : `你是一位资深 UI/UX 设计评审专家，拥有 10 年以上 B 端企业级 SaaS/中台产品设计经验。你的职责是**对用户上传的多张设计稿进行竞品对比分析**，从「产品功能」「交互体验」「设计样式」三个维度进行横向对比，并给出综合对比总结。

用户上传了 ${imageCount} 张设计稿，请按顺序编号为"方案 A、方案 B、方案 C…"。

【综合对比总结】
- 一句话概括哪个方案综合最优及原因（不超过 50 字）
- 各方案总体评分（overallScore, 0-100）
- 红榜（每个方案的最大亮点，必须引用具体视觉元素）
- 黑榜（每个方案的最大问题，必须指出具体位置或元素）

【产品功能对比】(productScore, 0-100)
- 逐方案对比：业务流程完整性、功能覆盖率、信息架构优劣
- 给出各方案的排名和分数

【交互体验对比】(interactionScore, 0-100)
- 逐方案对比：操作路径长度、控件选择合理性、反馈机制完善度
- 给出各方案的排名和分数

【设计样式对比】(designScore, 0-100)
- 逐方案对比：布局规范性、色彩搭配、字体排版、视觉一致性
- 给出各方案的排名和分数

对比要求：
1. **必须具体描述每张设计稿中的视觉元素差异**，不要泛泛而谈
2. 每个维度给出各方案 0-100 的量化评分和详细对比分析
3. 综合评分 = 三维度加权平均（产品功能 35%、交互体验 35%、设计样式 30%）
4. 对比结论必须有明确的推荐排名
5. 优化建议针对各方案分别给出「问题 → 改进 → 收益」三段式

请严格以如下 JSON 格式回复，不要输出任何多余文字：
{"overview":"对比总结","highlights":["方案A亮点","方案B亮点"],"issues":["方案A问题","方案B问题"],"productScore":85,"interactionScore":80,"designScore":82,"overallScore":82,"reviewComments":[{"dimension":"产品功能对比","score":85,"comment":"详细对比分析"},{"dimension":"交互体验对比","score":80,"comment":"详细对比分析"},{"dimension":"设计样式对比","score":82,"comment":"详细对比分析"}],"suggestions":["方案A建议","方案B建议"]}`;

    const buildDesignReviewUserContent = (title: string, designUrls: string[], mode: "single" | "compare"): import("./_core/llm").MessageContent[] => {
      const parts: import("./_core/llm").MessageContent[] = [];
      if (mode === "single") {
        parts.push({ type: "text" as const, text: `设计方案标题：${title}\n\n请仔细观察上传的设计稿图片，从「产品功能」「交互体验」「设计样式」三个维度进行深度分析，并给出综合总览。\n\n评审维度：\n1. 产品功能(productScore, 0-100)\n2. 交互体验(interactionScore, 0-100)\n3. 设计样式(designScore, 0-100)\n\n请给出各维度的详细评审意见(reviewComments)、综合总览(overview)、优化建议(suggestions)和综合评分(overallScore)。` });
        for (const url of designUrls) {
          parts.push({ type: "image_url" as const, image_url: { url, detail: "high" as const } });
        }
      } else {
        parts.push({ type: "text" as const, text: `对比分析标题：${title}\n\n以下是 ${designUrls.length} 张待对比的设计稿，请按顺序编号为"方案 A、方案 B、方案 C…"，从「产品功能」「交互体验」「设计样式」三个维度进行横向竞品对比分析。\n\n对比维度：\n1. 产品功能(productScore, 0-100)\n2. 交互体验(interactionScore, 0-100)\n3. 设计样式(designScore, 0-100)\n\n请给出各方案各维度的详细对比分析(reviewComments)、综合对比总结(overview)、各方案优化建议(suggestions)和各方案综合评分(overallScore)。` });
        for (const url of designUrls) {
          parts.push({ type: "image_url" as const, image_url: { url, detail: "high" as const } });
        }
      }
      return parts;
    };

    // NOTE: Many vision models (qwen-vl, glm-4v, etc.) do NOT support response_format.
    // We rely on the system prompt to enforce JSON output instead.
    const designReviewResponseFormat: import("./_core/llm").ResponseFormat | undefined = undefined;

    const primaryDesignUrl = input.designUrls[0];

    if (!db) {
      const { id } = demoStore.uploadDesignReview(ctx.user.id, {
        title: input.title,
        designUrl: primaryDesignUrl,
        designUrls: input.designUrls,
        mode: input.mode,
      });
      invokeLLM({
        messages: [
          { role: "system", content: designReviewSystemPrompt },
          { role: "user", content: buildDesignReviewUserContent(input.title, input.designUrls, input.mode) },
        ],
        ...(designReviewResponseFormat ? { response_format: designReviewResponseFormat } : {}),
      }).then((llmRes) => {
        const rawContent = llmRes.choices[0]?.message?.content || "{}";
        let jsonStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        // Strip thinking blocks and markdown code fences
        jsonStr = jsonStr
          .replace(/<think>[\s\S]*?<\/think>/gi, "")
          .replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1")
          .trim();
        // Try to extract JSON object from text (model may add surrounding text)
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];
        let parsed: any;
        try {
          parsed = JSON.parse(jsonStr || "{}");
        } catch {
          console.error("[reviews.upload] JSON parse failed, raw:", jsonStr.slice(0, 500));
          throw new Error("AI 返回的内容无法解析为 JSON，请尝试更换模型或重新评审");
        }
        demoStore.applyDesignReviewResult(ctx.user.id, id, {
          productScore: parsed.productScore ?? 70,
          interactionScore: parsed.interactionScore ?? 70,
          designScore: parsed.designScore ?? 70,
          overallScore: parsed.overallScore ?? 70,
          overview: parsed.overview || "",
          highlights: parsed.highlights || [],
          issues: parsed.issues || [],
          reviewComments: parsed.reviewComments || [],
          suggestions: parsed.suggestions || [],
          status: "done",
        });
      }).catch((err: unknown) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        demoStore.applyDesignReviewResult(ctx.user.id, id, {
          productScore: 0,
          interactionScore: 0,
          designScore: 0,
          overallScore: 0,
          overview: `AI 分析失败：${errMsg}。请检查 API 配置是否正确。`,
          highlights: [],
          issues: ["API 调用失败，请前往设置配置正确的模型 API Key"],
          reviewComments: [],
          suggestions: ["请点击右上角「配置 AI 模型」按钮，填写有效的 API Key 后重新发起评审"],
          status: "error",
        });
      });
      return { id };
    }

    const [result] = await db.insert(designReviews).values({
      userId: ctx.user.id,
      title: input.title,
      designUrl: primaryDesignUrl,
      status: "reviewing",
      version: 1,
    });
    const reviewId = (result as any).insertId as number;

    // Async AI review
    (async () => {
      try {
        const db2 = await getDb();
        if (!db2) return;
        const llmRes = await invokeLLM({
          messages: [
            { role: "system", content: designReviewSystemPrompt },
            { role: "user", content: buildDesignReviewUserContent(input.title, input.designUrls, input.mode) },
          ],
          ...(designReviewResponseFormat ? { response_format: designReviewResponseFormat } : {}),
        });

        const rawContent = llmRes.choices[0]?.message?.content || "{}";
        const rawStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
        // Strip <think> blocks and markdown code fences
        let cleaned = rawStr
          .replace(/<think>[\s\S]*?<\/think>/gi, "")
          .replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1")
          .trim();
        // Try to extract JSON object from text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) cleaned = jsonMatch[0];
        let parsed: any;
        try {
          parsed = JSON.parse(cleaned || "{}");
        } catch {
          console.error("[reviews.upload] JSON parse failed, raw:", cleaned.slice(0, 500));
          throw new Error("AI 返回的内容无法解析为 JSON");
        }

        await db2.update(designReviews).set({
          businessLogicScore: parsed.productScore ?? null,
          interactionScore: parsed.interactionScore ?? null,
          accessibilityScore: parsed.designScore ?? null,
          overallScore: parsed.overallScore ?? null,
          reviewComments: parsed.reviewComments || [],
          suggestions: parsed.suggestions || [],
          status: "done",
        }).where(eq(designReviews.id, reviewId));
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const db3 = await getDb();
        if (db3) await db3.update(designReviews).set({
          status: "error",
          suggestions: [`AI 分析失败：${errMsg}。请检查模型是否支持图片分析（视觉模型）。`],
          reviewComments: [],
        }).where(eq(designReviews.id, reviewId));
        console.error("[reviews.upload] AI review failed:", errMsg);
      }
    })();

    return { id: reviewId };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.deleteDesignReview(ctx.user.id, input.id);
    await db.delete(designReviews).where(and(eq(designReviews.id, input.id), eq(designReviews.userId, ctx.user.id)));
    return { success: true };
  }),
});

// ─── Blindbox Router ──────────────────────────────────────────────────────────
const BUILTIN_BLINDBOX = [
  { type: "knowledge" as const, title: "设计冷知识：为什么蓝色是最受欢迎的颜色？", content: "研究表明，全球约40%的人最喜欢蓝色。这与人类进化有关——蓝色天空和清洁水源是安全的信号。这也是为什么科技公司（Facebook、Twitter、LinkedIn）都偏爱蓝色。", tags: ["色彩心理学", "设计原理"], source: "色彩研究所" },
  { type: "tip" as const, title: "B端设计黄金法则：信息密度与认知负荷", content: "B端产品用户是专业人士，他们需要高密度信息。但信息密度≠混乱堆砌。关键是建立清晰的视觉层级：主要信息→次要信息→辅助信息，让用户能快速扫描定位。", tags: ["B端设计", "信息架构"], source: "设计团队沉淀" },
  { type: "knowledge" as const, title: "Fitts定律：为什么大按钮更好点击？", content: "Fitts定律指出：点击目标所需时间与目标大小成反比，与距离成正比。这解释了为什么移动端按钮至少需要44×44px，为什么重要操作应放在屏幕边缘或角落。", tags: ["交互设计", "可用性"], source: "HCI研究" },
  { type: "tip" as const, title: "设计评审前必做的5件事", content: "1. 明确评审目标（视觉/交互/业务？）2. 准备设计决策的理由 3. 标注尚未解决的问题 4. 准备备选方案 5. 提前发送设计稿给评审者。充分准备让评审更高效。", tags: ["设计流程", "协作"], source: "设计团队沉淀" },
  { type: "knowledge" as const, title: "格式塔原理：大脑如何感知设计", content: "格式塔心理学的核心原理：相近的元素被认为是一组（接近律）、相似的元素被认为是一组（相似律）、封闭的形状更容易被识别（封闭律）。掌握这些原理能让你的设计更直觉化。", tags: ["视觉设计", "心理学"], source: "设计基础理论" },
  { type: "case" as const, title: "Notion的信息架构：从复杂到简单", content: "Notion成功的关键在于将复杂的数据库功能包装在简单的块编辑器中。用户先看到的是熟悉的文档界面，高级功能通过渐进式披露呈现。这种设计让新手和专家都能找到自己的节奏。", tags: ["产品设计", "信息架构", "案例分析"], source: "产品分析" },
  { type: "tip" as const, title: "空状态设计：不要浪费这个机会", content: "空状态是用户首次使用功能时看到的界面。好的空状态设计应该：1. 解释这个功能是什么 2. 告诉用户如何开始 3. 提供一个明确的CTA。空状态是引导用户的绝佳机会。", tags: ["UI设计", "用户引导"], source: "设计团队沉淀" },
  { type: "knowledge" as const, title: "为什么圆角让人感觉更友好？", content: "神经科学研究表明，人类大脑对尖角有潜意识的警惕反应（可能是进化的危险信号）。圆角触发更放松、友好的感知。这也是为什么现代UI设计普遍采用圆角——它降低了视觉紧张感。", tags: ["视觉设计", "神经科学"], source: "认知科学研究" },
  { type: "case" as const, title: "Linear的设计哲学：速度即设计", content: "Linear将「速度」作为核心设计价值。他们的界面极度精简，大量使用键盘快捷键，加载时间控制在100ms以内。这种对速度的执着让专业用户爱不释手，也证明了B端工具的设计可以非常优雅。", tags: ["B端设计", "产品哲学", "案例分析"], source: "产品分析" },
  { type: "tip" as const, title: "对比度不只是无障碍要求", content: "WCAG要求正文文字对比度至少4.5:1，但好的对比度设计远不止于此。高对比度能提升可读性、建立视觉层级、在各种光线环境下保持可用性。推荐工具：Colour Contrast Analyser。", tags: ["Accessibility", "视觉设计"], source: "设计规范" },
];

const blindboxRouter = router({
  saveToKnowledge: protectedProcedure.input(z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
    category: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      return demoStore.createKnowledge(ctx.user.id, {
        title: input.title,
        content: input.content,
        tags: input.tags,
        category: input.category || "灵感盲盒",
      });
    }
    await db.insert(knowledgeArticles).values({
      userId: ctx.user.id,
      title: input.title,
      content: input.content,
      tags: input.tags || [],
      category: input.category || "灵感盲盒",
      version: 1,
    });
    return { success: true };
  }),

  draw: protectedProcedure.input(z.void().optional()).mutation(async ({ ctx }) => {
    const db = await getDb();

    // Try DB first
    if (db) {
      try {
        const dbItems = await db.select().from(blindboxItems);
        if (dbItems.length > 0) {
          const item = dbItems[Math.floor(Math.random() * dbItems.length)];
          return { ...item, tags: [] };
        }
      } catch {}
    }

    // Fallback to builtin
    const item = BUILTIN_BLINDBOX[Math.floor(Math.random() * BUILTIN_BLINDBOX.length)];
    return { id: 0, imageUrl: null, createdAt: new Date(), ...item };
  }),
});

// ─── Activities Router ──────────────────────────────────────────────────────
const activitiesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db.select().from(activities).orderBy(desc(activities.createdAt)).limit(20);
    return rows;
  }),
  create: protectedProcedure
    .input(z.object({
      type: z.enum(["todo_done", "idea_posted", "review_passed", "interview_added", "knowledge_added", "inspiration_added"]),
      title: z.string().min(1).max(255),
      detail: z.string().optional(),
      refId: z.number().optional(),
      refType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.insert(activities).values({
        userId: ctx.user.id,
        userName: ctx.user.name || "团队成员",
        type: input.type,
        title: input.title,
        detail: input.detail,
        refId: input.refId,
        refType: input.refType,
      });
      return { success: true };
    }),
});
// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  meetings: meetingsRouter,
  todos: todosRouter,
  ideas: ideasRouter,
  interviews: interviewsRouter,
  knowledge: knowledgeRouter,
  inspiration: inspirationRouter,
  reviews: reviewsRouter,
  blindbox: blindboxRouter,
  activities: activitiesRouter,
});

export type AppRouter = typeof appRouter;
