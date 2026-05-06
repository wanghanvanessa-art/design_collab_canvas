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
    if (!db) return demoStore.listMeetings(ctx.user.id);
    return db.select().from(meetings).where(eq(meetings.userId, ctx.user.id)).orderBy(desc(meetings.createdAt));
  }),

  upload: protectedProcedure.input(z.object({
    title: z.string().min(1),
    audioUrl: z.string().url(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) {
      const { id } = demoStore.uploadMeeting({ userId: ctx.user.id, title: input.title, audioUrl: input.audioUrl, transcript: "" });
      return { id };
    }

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

  // AI 待办记事本：文字/链接输入 → AI 解析生成待办
  analyzeText: protectedProcedure.input(z.object({
    title: z.string().min(1),
    content: z.string().optional().default(""),
    audioLink: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    if (!input.content?.trim() && !input.audioLink?.trim()) {
      throw new Error("请输入文字记录或录音链接");
    }

    const db = await getDb();

    // ─── Helper: transcribe audio link if provided ─────────────────────────
    const transcribeIfNeeded = async (audioLink?: string): Promise<string> => {
      if (!audioLink?.trim()) return "";
      const link = audioLink.trim();
      // Only attempt transcription for direct audio file URLs
      const isAudioUrl = /\.(mp3|wav|webm|m4a|ogg|flac|mp4)(\?.*)?$/i.test(link) || /^https?:\/\//i.test(link);
      if (!isAudioUrl) return `[录音链接] ${link}`;
      try {
        console.log("[analyzeText] Attempting to transcribe audio:", link);
        const result = await transcribeAudio({ audioUrl: link, language: "zh" });
        if ("error" in result) {
          console.warn("[analyzeText] Transcription service error:", result.error, result.details);
          // Fallback: try LLM with file_url for models that support audio
          return `[录音链接，语音转录失败: ${result.error}] ${link}`;
        }
        console.log("[analyzeText] Transcription success, length:", result.text.length);
        return `[以下是录音转录文字]\n${result.text}`;
      } catch (err: any) {
        console.warn("[analyzeText] Transcription failed:", err?.message);
        return `[录音链接，转录失败] ${link}`;
      }
    };

    // ─── Helper: build AI prompt and call LLM ──────────────────────────────
    const analyzeWithAI = async (title: string, textContent: string, transcribedAudio: string) => {
      const contentParts = [
        `标题：${title}`,
        transcribedAudio || "",
        textContent ? `内容记录：\n${textContent}` : "",
      ].filter(Boolean).join("\n\n");

      const llmRes = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `你是一个专业的 AI 待办助手。用户会输入零散的会议笔记、文字记录、或者已经转录好的录音文字，你需要：
1. 理解并整理这些零散信息
2. 提取核心要点和关键信息
3. 生成结构化的待办清单（按优先级分类）
4. 给出简短的内容摘要

请严格用以下 JSON 格式回复，不要输出多余文字：
{"summary":"内容摘要","keyInsights":["要点1","要点2"],"todos":[{"title":"待办标题","priority":"high/medium/low","assignee":""}]}`,
          },
          { role: "user", content: contentParts },
        ],
      });

      const rawContent = llmRes.choices[0]?.message?.content || "{}";
      let jsonStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
      jsonStr = jsonStr
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1")
        .trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      try {
        return JSON.parse(jsonStr || "{}");
      } catch {
        console.error("[meetings.analyzeText] JSON parse failed, raw:", jsonStr.slice(0, 500));
        throw new Error("AI 返回内容无法解析为 JSON，请尝试更换模型或重新提交");
      }
    };

    // ─── No-DB path: use demoStore ───────────────────────────────────────
    if (!db) {
      const { id } = demoStore.createAnalyzeMeeting(ctx.user.id, {
        title: input.title,
        content: input.content || "",
        audioLink: input.audioLink,
      });

      // Async: transcribe + analyze
      (async () => {
        try {
          const transcribed = await transcribeIfNeeded(input.audioLink);
          const parsed = await analyzeWithAI(input.title, input.content || "", transcribed);
          demoStore.updateMeetingResult(ctx.user.id, id, {
            summary: parsed.summary || "",
            keyInsights: parsed.keyInsights || [],
            status: "done",
          });
          if (parsed.todos?.length > 0) {
            demoStore.addTodosForMeeting(ctx.user.id, id, parsed.todos);
          }
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error("[meetings.analyzeText] failed:", errMsg);
          demoStore.updateMeetingResult(ctx.user.id, id, {
            summary: `AI 分析失败：${errMsg}。请检查模型配置是否正确。`,
            status: "error",
          });
        }
      })();

      return { id };
    }

    // ─── DB path ─────────────────────────────────────────────────────────
    const [result] = await db.insert(meetings).values({
      userId: ctx.user.id,
      title: input.title,
      audioUrl: input.audioLink || null,
      transcript: input.content || "",
      status: "analyzing",
    });
    const meetingId = (result as any).insertId as number;

    // Async: transcribe + analyze
    (async () => {
      try {
        const db2 = await getDb();
        if (!db2) return;

        const transcribed = await transcribeIfNeeded(input.audioLink);

        // If we got a transcript from audio, save it
        if (transcribed && transcribed.includes("[以下是录音转录文字]")) {
          await db2.update(meetings).set({ transcript: transcribed }).where(eq(meetings.id, meetingId));
        }

        const parsed = await analyzeWithAI(input.title, input.content || "", transcribed);

        await db2.update(meetings).set({
          summary: parsed.summary || "",
          keyInsights: parsed.keyInsights || [],
          status: "done",
        }).where(eq(meetings.id, meetingId));

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
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[meetings.analyzeText] failed:", errMsg);
        const db3 = await getDb();
        if (db3) {
          await db3.update(meetings).set({
            status: "error",
            summary: `AI 分析失败：${errMsg}。请检查模型配置是否正确。`,
          }).where(eq(meetings.id, meetingId));
        }
      }
    })();

    return { id: meetingId };
  }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.getMeetingWithTodos(ctx.user.id, input.id);
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
    if (!db) return demoStore.addMeetingComment(ctx.user.id, ctx.user.name ?? undefined, input.meetingId, input.content, input.parentId);
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
    if (!db) return demoStore.updateTodo(ctx.user.id, input.id, input);
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
    if (!db) return { success: true, articleId: 0 }; // graceful no-op in demo mode
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
    if (!db) return demoStore.listTodos(ctx.user.id, input?.priority);
    const conditions = [eq(todos.userId, ctx.user.id)];
    if (input?.priority) conditions.push(eq(todos.priority, input.priority));
    return db.select().from(todos).where(and(...conditions)).orderBy(desc(todos.createdAt));
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return demoStore.statsTodos(ctx.user.id);
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
    if (!db) return demoStore.createTodo(ctx.user.id, { title: input.title, priority: input.priority, assignee: input.assignee, dueDate: input.dueDate });
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
    if (!db) return demoStore.toggleTodo(ctx.user.id, input.id, input.completed);
    await db.update(todos).set({ completed: input.completed }).where(and(eq(todos.id, input.id), eq(todos.userId, ctx.user.id)));
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.deleteTodo(ctx.user.id, input.id);
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

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return demoStore.deleteIdea(ctx.user.id, input.id);
    const [idea] = await db.select().from(ideas).where(and(eq(ideas.id, input.id), eq(ideas.userId, ctx.user.id)));
    if (!idea) throw new Error("Not found");
    // 级联删除关联数据
    await db.delete(ideaReactions).where(eq(ideaReactions.ideaId, input.id));
    await db.delete(ideaComments).where(eq(ideaComments.ideaId, input.id));
    await db.delete(ideaVersions).where(eq(ideaVersions.ideaId, input.id));
    await db.delete(ideas).where(eq(ideas.id, input.id));
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

  // ─── AI Brainstorm: generate creative branches from a prompt ──────────────
  aiBrainstorm: protectedProcedure.input(z.object({
    prompt: z.string().min(1),
    style: z.enum(["creative", "professional", "user_perspective"]).optional().default("creative"),
  })).mutation(async ({ ctx: _ctx, input }) => {
    // 风格提示词：每种风格定义 4 个固定 section 标题
    const styleConfig = {
      creative: {
        role: "你是一个顶尖创意发散专家。风格要求：大胆创意发散、天马行空、注重新颖性和突破性。",
        sectionTitles: ["创意灵感", "具体玩法", "差异化亮点", "预期效果"],
        sectionHints: [
          "描述这个创意的来源和灵感触发点（不少于 60 字）",
          "用 1. 2. 3. 数字编号列出 2-3 个可落地玩法（每条不少于 30 字）",
          "说明与常规做法的差异优势（不少于 60 字）",
          "预估带来的价值和影响（不少于 50 字）",
        ],
      },
      professional: {
        role: "你是一位资深行业战略顾问与方案架构师。风格要求：严谨专业、逻辑清晰、结构化强，注重可行性与商业价值。",
        sectionTitles: ["背景与趋势", "核心策略", "预期收益", "潜在风险与应对"],
        sectionHints: [
          "描述行业背景与趋势（不少于 60 字）",
          "用 1. 2. 3. 数字编号列出 2-3 条核心策略（每条不少于 30 字）",
          "描述预期商业收益与关键指标（不少于 50 字）",
          "描述主要风险及对应方案（不少于 50 字）",
        ],
      },
      user_perspective: {
        role: "你是一个用户体验与需求洞察专家。风格要求：从用户视角出发，关注痛点、体验和情感共鸣。",
        sectionTitles: ["用户痛点", "体验方案", "情感连接", "预期效果"],
        sectionHints: [
          "描述目标用户在该维度的核心痛点和未满足需求（不少于 60 字）",
          "用 1. 2. 3. 数字编号列出 2-3 个面向用户体验的具体解决方案（每条不少于 30 字）",
          "分析该方案如何与用户建立情感共鸣（不少于 50 字）",
          "预估对用户价值和满意度的提升（不少于 50 字）",
        ],
      },
    } as const;

    const cfg = styleConfig[input.style];
    const sectionLines = cfg.sectionTitles
      .map((t, i) => `     [${t}] ${cfg.sectionHints[i]}`)
      .join("\n");

    // 纯文本结构化协议：用明确的行首标记分隔，LLM 更容易稳定输出
    const systemPrompt = `${cfg.role}

用户会输入一个关键词、一句话或一段描述，你需要进行多维度分析。请严格按以下纯文本格式输出，每行一个字段，禁止使用 JSON、禁止使用 Markdown 符号（*、#、-、>、反引号等），全部使用中文。

=== 输出格式模板（务必严格遵守，每行以规定标记开头）===

<方向>方向标题（简洁有力的中文）
<概要>一句话概括该方向的核心价值
${cfg.sectionTitles.map(t => `<${t}>该层次内容（可多行，换行继续写；遇到下一个<标记>才结束）`).join("\n")}
<标签>标签1、标签2、标签3

<方向>第二个方向标题
<概要>...
（重复上述 section 和 标签）

（至少输出 5 个 <方向> 块）

=== 案例参考 ===
<案例>案例名称
<做法>具体做法描述
<关联>与当前主题的关联分析
<链接>https://example.com

（至少 2 个案例块）

=== 方案框架 ===
<目标>总目标概述
<阶段>第一阶段名称
<任务>任务1
<任务>任务2
<阶段>第二阶段名称
<任务>任务1

=== section 内容要求 ===
${sectionLines}

=== 重要约束 ===
1. 每个 <标记> 必须独占一行起始位置，标记后紧跟内容（无空格）。
2. section 的内容可换行，直到遇到下一个 <标记> 为止。
3. 全部中文，禁止英文、禁止 JSON、禁止 Markdown 符号。
4. 内容里如需列举，使用「1. 」「2. 」「3. 」数字编号，每项独立一行。
5. 不要输出任何其他解释文字，直接按格式开始。`;

    const llmRes = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input.prompt },
      ],
    });

    const raw = llmRes.choices[0]?.message?.content || "";
    const rawText = typeof raw === "string" ? raw : JSON.stringify(raw);
    const cleanedRaw = rawText
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/```[\s\S]*?```/g, m => m.replace(/```(?:\w+)?/g, ""))
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/\uFFFD/g, "")
      .trim();

    /** 去除字符串值中可能残留的 Markdown 装饰符与零宽字符 */
    const polish = (s: string): string =>
      s
        .replace(/\*{1,3}([^*\n]+)\*{1,3}/g, "$1")
        .replace(/^#{1,6}\s+/gm, "")
        .replace(/^\s*[-•·]\s+/gm, "")
        .replace(/`([^`\n]+)`/g, "$1")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    /** 解析纯文本协议：识别 <标记>内容，section 标题来自配置 */
    const parseStructured = (text: string) => {
      const allSectionTitles = new Set<string>([
        ...cfg.sectionTitles,
        "方向", "概要", "标签", "案例", "做法", "关联", "链接", "目标", "阶段", "任务",
      ]);
      // 按行解析：每行如以 < 开头且能匹配已知标记，则开启新字段
      const lines = text.split(/\r?\n/);
      type Event = { tag: string; value: string };
      const events: Event[] = [];
      let cur: Event | null = null;
      const tagRe = /^<([^<>\s]+)>\s*(.*)$/;
      for (const ln of lines) {
        const m = ln.match(tagRe);
        if (m && allSectionTitles.has(m[1])) {
          if (cur) events.push({ tag: cur.tag, value: cur.value.trim() });
          cur = { tag: m[1], value: m[2] };
        } else if (cur) {
          cur.value += (cur.value ? "\n" : "") + ln;
        }
      }
      if (cur) events.push({ tag: cur.tag, value: cur.value.trim() });

      type Branch = { id: string; title: string; summary: string; sections: { title: string; content: string }[]; tags: string[] };
      type Case = { title: string; desc: string; relevance: string; url: string };
      const branches: Branch[] = [];
      const cases: Case[] = [];
      let goal = "";
      const phases: { name: string; tasks: string[] }[] = [];

      let curBranch: Branch | null = null;
      let curCase: Case | null = null;
      let curPhase: { name: string; tasks: string[] } | null = null;

      const flushBranch = () => {
        if (curBranch && (curBranch.title || curBranch.sections.length)) {
          branches.push(curBranch);
        }
        curBranch = null;
      };
      const flushCase = () => {
        if (curCase && (curCase.title || curCase.desc)) cases.push(curCase);
        curCase = null;
      };
      const flushPhase = () => {
        if (curPhase && (curPhase.name || curPhase.tasks.length)) phases.push(curPhase);
        curPhase = null;
      };

      for (const ev of events) {
        const val = polish(ev.value);
        switch (ev.tag) {
          case "方向":
            flushBranch(); flushCase(); flushPhase();
            curBranch = { id: `branch_${branches.length + 1}`, title: val, summary: "", sections: [], tags: [] };
            break;
          case "概要":
            if (curBranch) curBranch.summary = val;
            break;
          case "标签":
            if (curBranch) {
              curBranch.tags = val.split(/[、,，\s]+/).map(t => t.trim()).filter(Boolean).slice(0, 5);
            }
            break;
          case "案例":
            flushBranch(); flushCase(); flushPhase();
            curCase = { title: val, desc: "", relevance: "", url: "" };
            break;
          case "做法":
            if (curCase) curCase.desc = val;
            break;
          case "关联":
            if (curCase) curCase.relevance = val;
            break;
          case "链接":
            if (curCase) {
              const m = val.match(/https?:\/\/\S+/);
              if (m) curCase.url = m[0];
            }
            break;
          case "目标":
            flushBranch(); flushCase(); flushPhase();
            goal = val;
            break;
          case "阶段":
            flushBranch(); flushCase(); flushPhase();
            curPhase = { name: val, tasks: [] };
            break;
          case "任务":
            if (curPhase) curPhase.tasks.push(val);
            break;
          default:
            // section 标题（属于 cfg.sectionTitles）
            if (curBranch && (cfg.sectionTitles as readonly string[]).includes(ev.tag)) {
              curBranch.sections.push({ title: ev.tag, content: val });
            }
        }
      }
      flushBranch(); flushCase(); flushPhase();

      return {
        branches,
        cases,
        framework: { goal, phases },
      };
    };

    /** 当完全解析失败时：剥离所有标记符号，输出可读纯文本 */
    const buildFallback = (text: string) => {
      const cleaned = polish(
        text
          .replace(/<\/?[^>]{1,20}>/g, "\n")
          .replace(/[{}\[\]]/g, " ")
          .replace(/\s{2,}/g, " ")
      );
      return {
        branches: [{
          id: "branch_1",
          title: "AI 输出解析失败",
          summary: "模型未按规范格式返回，以下为原始回复清洗后的摘要，可重新发起生成。",
          sections: [{ title: "原文摘要", content: cleaned.slice(0, 1200) || "无可用内容" }],
          tags: ["解析失败"],
        }],
        cases: [],
        framework: { goal: "", phases: [] },
      };
    };

    const structured = parseStructured(cleanedRaw);
    if (structured.branches.length > 0) {
      return { success: true, data: structured };
    }

    // 兼容：如果模型仍然返回 JSON，也尝试解析一次
    try {
      const first = cleanedRaw.indexOf("{");
      const last = cleanedRaw.lastIndexOf("}");
      if (first >= 0 && last > first) {
        const parsed = JSON.parse(cleanedRaw.slice(first, last + 1));
        if (parsed && Array.isArray(parsed.branches) && parsed.branches.length > 0) {
          const branches = parsed.branches.map((b: any, i: number) => ({
            id: b?.id || `branch_${i + 1}`,
            title: polish(String(b?.title || `方向 ${i + 1}`)),
            summary: polish(String(b?.summary || "")),
            sections: Array.isArray(b?.sections)
              ? b.sections.map((s: any) => ({
                  title: polish(String(s?.title || "")).replace(/[「」]/g, ""),
                  content: polish(String(s?.content || "")),
                })).filter((s: any) => s.title || s.content)
              : [],
            tags: Array.isArray(b?.tags) ? b.tags.map((t: any) => polish(String(t))).filter(Boolean) : [],
          }));
          return {
            success: true,
            data: {
              branches,
              cases: Array.isArray(parsed.cases)
                ? parsed.cases.map((c: any) => ({
                    title: polish(String(c?.title || "")),
                    desc: polish(String(c?.desc || "")),
                    relevance: polish(String(c?.relevance || "")),
                    url: String(c?.url || ""),
                  }))
                : [],
              framework: parsed.framework && typeof parsed.framework === "object"
                ? {
                    goal: polish(String(parsed.framework.goal || "")),
                    phases: Array.isArray(parsed.framework.phases)
                      ? parsed.framework.phases.map((p: any) => ({
                          name: polish(String(p?.name || "")),
                          tasks: Array.isArray(p?.tasks) ? p.tasks.map((t: any) => polish(String(t))).filter(Boolean) : [],
                        }))
                      : [],
                  }
                : { goal: "", phases: [] },
            },
          };
        }
      }
    } catch { /* ignore */ }

    return { success: true, data: buildFallback(cleanedRaw) };
  }),

  // ─── AI Continue Writing ──────────────────────────────────────────────────
  aiContinueWrite: protectedProcedure.input(z.object({
    ideaId: z.number(),
    existingContent: z.string(),
    instruction: z.string().optional().default("请继续展开这个观点"),
    style: z.enum(["creative", "professional", "user_perspective"]).optional().default("creative"),
  })).mutation(async ({ ctx, input }) => {
    const stylePromptMap: Record<string, string> = {
      creative: `你是一个专业的内容续写助手。续写风格：大胆创意发散、天马行空、注重新颖性。
基于用户已有的内容，按照用户的指令进行续写或结构化补全。

续写结构要求：
1. 续写内容须有清晰的层次结构，使用数字编号（1. 2. 3.）组织要点
2. 每个要点包含简短的小标题（用「」括起来），后接具体展开内容
3. 段落之间用空行分隔，每段聚焦一个创意方向
4. 确保续写内容有价值、可落地，避免空泛描述

重要格式约束：
1. 全部使用中文输出，禁止出现英文单词和英文缩写（品牌专有名除外）
2. 禁止使用任何 Markdown 格式符号（禁止 *、**、#、-（行首列表符）、>、\` 等）
3. 使用「」代替引号强调，使用数字编号代替列表
4. 不要重复已有内容，不要输出 JSON`,
      professional: `你是一位资深行业分析师与方案撰写专家。续写风格：严谨专业、结构化强、逻辑清晰。

续写结构要求：
1. 层次分明：使用数字编号（1. 2. 3.）和子编号（1.1 1.2）组织内容
2. 每个要点用「」括起小标题，后接详细分析
3. 论证充分：每个观点须附带论据或数据支撑，形成「观点、论据、结论」闭环
4. 段落清晰：避免大段文字堆砌，每段聚焦一个要点，段间用空行分隔
5. 可操作性：建议和方案须具体可执行，包含明确步骤

重要格式约束：
1. 全部使用中文输出，禁止出现英文单词和英文缩写（品牌专有名除外）
2. 禁止使用任何 Markdown 格式符号（禁止 *、**、#、-（行首列表符）、>、\` 等）
3. 使用「」代替引号强调，使用数字编号代替列表
4. 不要重复已有内容，不要输出 JSON`,
      user_perspective: `你是一个用户体验与需求洞察专家。续写风格：用户视角，关注痛点、体验和情感共鸣。
基于用户已有的内容，按照用户的指令进行续写或结构化补全。

续写结构要求：
1. 续写内容须从用户真实场景出发，使用数字编号（1. 2. 3.）组织要点
2. 每个要点包含简短的小标题（用「」括起来），后接具体展开内容
3. 段落之间用空行分隔，关注用户情感共鸣和体验细节
4. 确保续写内容有用户价值洞察，避免空泛描述

重要格式约束：
1. 全部使用中文输出，禁止出现英文单词和英文缩写（品牌专有名除外）
2. 禁止使用任何 Markdown 格式符号（禁止 *、**、#、-（行首列表符）、>、\` 等）
3. 使用「」代替引号强调，使用数字编号代替列表
4. 不要重复已有内容，不要输出 JSON`,
    };
    const llmRes = await invokeLLM({
      messages: [
        {
          role: "system",
          content: stylePromptMap[input.style],
        },
        { role: "user", content: `已有内容：\n${input.existingContent}\n\n指令：${input.instruction}` },
      ],
    });
    const raw = llmRes.choices[0]?.message?.content || "";
    let text = (typeof raw === "string" ? raw : JSON.stringify(raw)).replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    // 后处理：清除 LLM 可能仍然输出的 Markdown 格式符号和乱码
    text = text
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")   // 移除 *加粗/斜体*
      .replace(/^#{1,6}\s+/gm, "")                 // 移除 # 标题符号
      .replace(/`([^`]+)`/g, "$1")                  // 移除反引号包裹
      .replace(/\*{1,3}/g, "")                      // 移除残留的独立星号
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "") // 移除控制字符
      .replace(/\uFFFD/g, "");                      // 移除 Unicode 替换字符
    return { text };
  }),

  // ─── AI Review: evaluate a plan from multiple perspectives ────────────────
  aiReview: protectedProcedure.input(z.object({
    ideaId: z.number(),
    content: z.string().min(1),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const idea = db
      ? (await db.select().from(ideas).where(eq(ideas.id, input.ideaId)))[0]
      : demoStore.getIdea(ctx.user.id, input.ideaId);

    const llmRes = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一个资深方案评审专家。请从以下三个维度对方案进行评审：
1. 业务逻辑：方案的商业可行性、市场竞争力
2. 用户体验：目标用户的痛点匹配度、交互体验
3. 落地可行性：技术难度、资源需求、时间成本

严格用以下 JSON 格式回复：
{"dimensions":[{"name":"业务逻辑","score":8,"feedback":"评价内容","suggestions":["建议1"]},{"name":"用户体验","score":7,"feedback":"评价内容","suggestions":["建议1"]},{"name":"落地可行性","score":6,"feedback":"评价内容","suggestions":["建议1"]}],"overallScore":7,"summary":"总体评价","actionItems":["行动项1","行动项2"]}`
        },
        { role: "user", content: `方案标题：${idea?.title || "未命名"}\n\n方案内容：\n${input.content}` },
      ],
    });
    const raw = llmRes.choices[0]?.message?.content || "{}";
    let jsonStr = typeof raw === "string" ? raw : JSON.stringify(raw);
    jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1").trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    try {
      return JSON.parse(jsonStr);
    } catch {
      return { dimensions: [], overallScore: 0, summary: "AI 评审解析失败，请重试", actionItems: [] };
    }
  }),

  // ─── AI Convert action items to todos ─────────────────────────────────────
  aiConvertToTodos: protectedProcedure.input(z.object({
    ideaId: z.number(),
    actionItems: z.array(z.string()),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    const created: { id: number; title: string }[] = [];
    for (const item of input.actionItems) {
      if (!db) {
        const id = demoStore.createTodoForIdea(ctx.user.id, input.ideaId, item);
        created.push({ id, title: item });
      } else {
        const [result] = await db.insert(todos).values({
          userId: ctx.user.id,
          title: item,
          priority: "medium",
          sourceType: "idea",
          sourceId: input.ideaId,
        });
        created.push({ id: (result as any).insertId, title: item });
      }
    }
    return { created };
  }),

  // ─── AI Save to Knowledge ─────────────────────────────────────────────────
  aiSaveToKnowledge: protectedProcedure.input(z.object({
    ideaId: z.number(),
    title: z.string().min(1),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return { success: true, articleId: 0 };
    const [result] = await db.insert(knowledgeArticles).values({
      userId: ctx.user.id,
      title: input.title,
      content: input.content,
      tags: input.tags || ["AI创意"],
      category: "AI创意",
      version: 1,
      sourceType: "idea",
    });
    return { success: true, articleId: (result as any).insertId };
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
            {
              role: "system",
              content: `你是一位资深用户研究分析专家。请对访谈内容进行深度结构化分析。

分析要求：
1. 从访谈内容中提炼出关键问题（至少 3 个，最多 6 个）
2. 每个问题须从以下四个维度进行结构化分析：
   「问题主题」——用一句话概括该问题的核心
   「问题描述」——详细描述该问题的具体表现和背景（不少于 50 字）
   「造成影响」——分析该问题对用户体验、业务目标或效率的具体影响
   「用户原声」——从访谈内容中提取最能代表该问题的用户原始表述（如无明确原声则根据上下文合理推断）
3. 同时提取人群标签、痛点总结和设计解决方案

严格格式约束：
1. 所有输出必须是纯中文（品牌专有名除外）
2. 禁止使用任何 Markdown 格式符号（禁止 *、**、#、-（行首列表符）、>、\` 等）
3. 使用「」表示强调

严格用以下 JSON 格式回复：
{"issues":[{"topic":"问题主题一句话","description":"问题详细描述","impact":"造成的影响分析","quote":"用户原声引用"}],"audienceLabels":["人群标签1","人群标签2"],"painPoints":["痛点总结1","痛点总结2"],"designSolutions":["设计方案建议1","设计方案建议2"]}`,
            },
            {
              role: "user",
              content: `访谈主题：${iv.title}\n受访者：${iv.interviewee || "未知"}\n\n访谈内容：\n${iv.content || "（无内容）"}`,
            },
          ],
        });
        const raw = llmRes.choices[0]?.message?.content || "{}";
        let jsonStr = typeof raw === "string" ? raw : JSON.stringify(raw);
        jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1").trim();
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];
        // Fix common LLM JSON issues
        jsonStr = jsonStr
          .replace(/,\s*([}\]])/g, "$1")
          .replace(/[\x00-\x1f]/g, (ch) => ch === "\n" || ch === "\r" || ch === "\t" ? ch : "");
        let parsed: any;
        try {
          parsed = JSON.parse(jsonStr);
        } catch {
          console.warn("[interviews.analyze] JSON.parse failed, attempting repair. Raw snippet:", jsonStr.slice(0, 300));
          try {
            const repaired = jsonStr.replace(/'/g, '"').replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":').replace(/,\s*([}\]])/g, "$1");
            parsed = JSON.parse(repaired);
          } catch {
            console.error("[interviews.analyze] JSON repair also failed, using fallback");
            parsed = { issues: [], audienceLabels: [], painPoints: [] };
          }
        }

        // 清理 Markdown 符号
        const clean = (s: string) => s?.replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/`([^`]+)`/g, "$1").replace(/\*{1,3}/g, "") || "";
        const cleanedIssues = (parsed.issues || []).map((issue: any) => ({
          topic: clean(issue.topic || ""),
          description: clean(issue.description || ""),
          impact: clean(issue.impact || ""),
          quote: clean(issue.quote || ""),
        }));

        await db2.update(interviews).set({
          audienceLabels: (parsed.audienceLabels || []).map(clean),
          painPoints: (parsed.painPoints || []).map(clean),
          designSolutions: cleanedIssues,
          status: "done",
        }).where(eq(interviews.id, input.id));
      } catch (e) {
        console.error("[interviews.analyze] failed:", e);
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

  // ── 图片转提示词 ─────────────────────────────────────────────────────────────
  analyzeImage: protectedProcedure.input(z.object({
    imageBase64: z.string().min(1),
  })).mutation(async ({ input }) => {
    const llmRes = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一个专业的 AI 绘图提示词提取专家。用户会上传一张图片，请从图片中提取以下维度的信息，并输出一段干净、可直接复制用于 AI 绘图（如 Midjourney / Stable Diffusion）的英文提示词。

提取维度：
1. 主体（Subject）：图中核心对象
2. 风格（Style）：艺术/设计风格
3. 色彩（Color palette）：主色调和配色
4. 构图（Composition）：视角、布局
5. 光影（Lighting）：光源方向、明暗
6. 质感（Texture/Material）：表面材质
7. 细节描述（Details）：特殊细节元素

请用 JSON 格式回复，包含如下字段：
- prompt: 完整英文提示词（可直接用于AI绘图）
- summaryCn: 将以上所有维度整合为一段流畅的中文描述（80-150字，用于让用户快速理解图片整体画面）
- subject: 主体描述（中文）
- style: 风格描述（中文）
- colorPalette: 色彩描述（中文）
- composition: 构图描述（中文）
- lighting: 光影描述（中文）
- texture: 质感描述（中文）
- details: 细节描述（中文）`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "请分析这张图片并提取 AI 绘图提示词。" },
            { type: "image_url", image_url: { url: input.imageBase64 } },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "image_prompt_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              prompt: { type: "string" },
              summaryCn: { type: "string" },
              subject: { type: "string" },
              style: { type: "string" },
              colorPalette: { type: "string" },
              composition: { type: "string" },
              lighting: { type: "string" },
              texture: { type: "string" },
              details: { type: "string" },
            },
            required: ["prompt", "summaryCn", "subject", "style", "colorPalette", "composition", "lighting", "texture", "details"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = llmRes.choices[0]?.message?.content || "{}";
    let rawText = typeof raw === "string" ? raw : JSON.stringify(raw);
    rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const thinkStart = rawText.indexOf("<think>");
    if (thinkStart !== -1) rawText = rawText.slice(0, thinkStart).trim();
    const parsed = JSON.parse(rawText);
    return parsed;
  }),

  // ── 灵感发散 ─────────────────────────────────────────────────────────────────
  expandInspiration: protectedProcedure.input(z.object({
    prompt: z.string().min(1),
    mode: z.enum(["style", "composition", "mood", "all"]).default("all"),
  })).mutation(async ({ input }) => {
    const modeDesc: Record<string, string> = {
      style: "仅生成风格变体（赛博朋克、治愈系、复古、极简、波普、浮世绘等）",
      composition: "仅生成构图变体（特写、全景、俯拍、仰拍、对称、三分法等）",
      mood: "仅生成情绪/氛围变体（温暖、冷峻、梦幻、紧张、孤寂、欢快等）",
      all: "同时生成风格变体、构图变体、情绪/氛围变体三个维度",
    };

    const llmRes = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一个专业的 AI 绘图灵感发散助手。用户会给你一段 AI 绘图提示词，你需要基于这段提示词进行创意发散。

${modeDesc[input.mode]}

请生成 6-9 张独立的灵感卡片，每张卡片包含：
- title: 简短标题（中文，3-8字）
- category: 所属分类（"style" / "composition" / "mood"）
- prompt: 完整英文提示词（可直接用于AI绘图，在原始提示词基础上变体）
- promptCn: 完整中文提示词（将英文 prompt 翻译为流畅的中文描述，便于用户理解）
- description: 简短中文描述说明这个变体的特色（15-30字）

请用 JSON 格式回复。`
        },
        { role: "user", content: `基础提示词：${input.prompt}\n\n请生成灵感变体卡片。` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "inspiration_cards",
          strict: true,
          schema: {
            type: "object",
            properties: {
              cards: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    category: { type: "string" },
                    prompt: { type: "string" },
                    promptCn: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "category", "prompt", "promptCn", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["cards"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = llmRes.choices[0]?.message?.content || "{}";
    let rawText = typeof raw === "string" ? raw : JSON.stringify(raw);
    rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const thinkStart = rawText.indexOf("<think>");
    if (thinkStart !== -1) rawText = rawText.slice(0, thinkStart).trim();
    const parsed = JSON.parse(rawText);
    return parsed;
  }),

  // ── 自然语言意图灵感发散 ────────────────────────────────────────────────────
  chatExpand: protectedProcedure.input(z.object({
    basePrompt: z.string().min(1),
    userMessage: z.string().min(1),
  })).mutation(async ({ input }) => {
    const llmRes = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `你是一个专业的 AI 绘图灵感发散助手。用户有一段基础提示词，并会用自然语言告诉你想要的发散方向。
请理解用户意图，基于基础提示词生成 3-6 张灵感变体卡片。

每张卡片包含：
- title: 简短标题（中文，3-8字）
- category: 所属分类（"style" / "composition" / "mood"，根据用户意图自动判断最合适的分类）
- prompt: 完整英文提示词（可直接用于AI绘图）
- promptCn: 完整中文提示词（将英文 prompt 翻译为流畅的中文描述）
- description: 简短中文描述说明这个变体的特色（15-30字）

请用 JSON 格式回复。`
        },
        { role: "user", content: `基础提示词：${input.basePrompt}\n\n我的需求：${input.userMessage}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "chat_expand_cards",
          strict: true,
          schema: {
            type: "object",
            properties: {
              cards: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    category: { type: "string" },
                    prompt: { type: "string" },
                    promptCn: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "category", "prompt", "promptCn", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["cards"],
            additionalProperties: false,
          },
        },
      },
    });

    const raw = llmRes.choices[0]?.message?.content || "{}";
    let rawText = typeof raw === "string" ? raw : JSON.stringify(raw);
    rawText = rawText.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    const thinkIdx = rawText.indexOf("<think>");
    if (thinkIdx !== -1) rawText = rawText.slice(0, thinkIdx).trim();
    const parsed = JSON.parse(rawText);
    return parsed;
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

    // 设计评审必须使用视觉模型，覆盖用户可能配置的纯文本模型
    const storedConfig = demoStore.getModelConfig();
    const visionModel = (() => {
      const m = (storedConfig.model || "").toLowerCase();
      // 如果用户配置的已经是视觉模型则直接使用
      if (m.includes("vl") || m.includes("vision") || m.includes("4o") || m.includes("gpt-4") || m.includes("glm-4v")) {
        return storedConfig.model;
      }
      // 根据 API URL 推断合适的视觉模型
      const url = (storedConfig.apiUrl || "").toLowerCase();
      if (url.includes("dashscope") || url.includes("aliyun")) return "qwen-vl-max";
      if (url.includes("openai")) return "gpt-4o";
      if (url.includes("zhipu") || url.includes("bigmodel")) return "glm-4v-plus";
      return "qwen-vl-max"; // 默认
    })();
    const visionConfig = { model: visionModel };

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
      }, visionConfig).then((llmRes) => {
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
        }, visionConfig);

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
type BlindboxType = "case" | "knowledge" | "tip" | "trend";
type BlindboxItem = { type: BlindboxType; title: string; content: string; tags: string[]; source: string };
const BUILTIN_BLINDBOX: BlindboxItem[] = [
  // ─── B端设计 / 设计系统 ───────────────────────────────────────────────────
  { type: "tip", title: "B端设计黄金法则：信息密度与认知负荷", content: "B端产品用户是专业人士，他们需要高密度信息。但信息密度≠混乱堆砌。关键是建立清晰的视觉层级：主要信息→次要信息→辅助信息，让用户能快速扫描定位。配合 8pt 网格、统一行高与对齐基线，密度高也不杂乱。", tags: ["B端设计", "信息架构", "认知负荷"], source: "设计团队沉淀" },
  { type: "case", title: "Linear 的设计哲学：速度即设计", content: "Linear 将「速度」作为核心设计价值，界面极度精简，大量使用键盘快捷键，加载时间控制在 100ms 以内，状态切换无任何动画卡顿。这种对速度的执着让专业用户爱不释手，也证明了 B 端工具的设计可以非常优雅——高效本身就是一种美学。", tags: ["B端设计", "产品哲学", "案例分析"], source: "产品分析" },
  { type: "case", title: "Stripe Dashboard：把复杂金融做成可读的故事", content: "Stripe 用三件事把支付后台讲清楚：1）把抽象指标转成时序图与同环比卡片；2）用一致的状态色（成功绿、待处理黄、失败红）覆盖全产品；3）每张表格都自带可保存的过滤器。这套语义化数据可视让运营、财务、工程师能用同一个界面对话。", tags: ["B端设计", "数据可视化", "金融SaaS"], source: "产品分析" },
  { type: "case", title: "Figma 多人协作的细节：「在场感」如何被设计出来", content: "Figma 把协作者的光标、选区、命名头像同步到 16ms 级延迟，并用渐隐尾迹避免视觉打架；评论用气泡贴在像素位置而非画布外侧，让讨论锚定在真实对象上。「在场感」不是技术指标，而是被设计反复打磨出的体验语言。", tags: ["体验设计", "协作产品", "案例分析"], source: "产品分析" },
  { type: "tip", title: "B端表格设计的 7 条铁律", content: "1）首列固定且高对比；2）数字右对齐、文字左对齐、状态居中；3）行高至少 40px 留出可点击区；4）默认隐藏非核心列并提供列管理；5）大数据用虚拟滚动；6）排序与筛选状态可分享 URL；7）批量操作走顶部工具条而不是每行复选。", tags: ["B端设计", "表格", "可用性"], source: "设计规范" },
  { type: "tip", title: "B端表单设计：长表单不可怕，可怕的是没有节奏", content: "把超过 8 个字段的表单切成「分组+步骤」，每组聚焦一个心智模型；必填项用红星而非红框（避免错误提示前的视觉污染）；错误信息贴字段下方而不是顶部；离开页面前提示草稿保存。节奏感来自分组、提示、保存三件套。", tags: ["B端设计", "表单设计", "用户引导"], source: "设计团队沉淀" },
  { type: "knowledge", title: "设计 Token 的三层结构：原子、语义、组件", content: "成熟设计系统的 Token 通常分三层：原子 Token（color.blue.500）描述视觉值；语义 Token（color.text.primary）描述用途；组件 Token（button.primary.bg）绑定到具体组件。多主题和多品牌只需替换语义层映射即可，原子层和组件层稳定不动。", tags: ["设计系统", "Design Tokens", "B端设计"], source: "设计基础理论" },

  // ─── 体验设计 / 交互原理 ──────────────────────────────────────────────────
  { type: "knowledge", title: "Fitts 定律：为什么大按钮更好点击？", content: "Fitts 定律指出：点击目标所需时间与目标大小成反比，与距离成正比。这解释了为什么移动端按钮至少需要 44×44px，为什么 macOS 把菜单栏放在屏幕顶部边缘（无限远等价的「无限大」），也是为什么右键菜单优于深层导航。", tags: ["交互设计", "可用性", "HCI"], source: "HCI 研究" },
  { type: "knowledge", title: "Hick 定律：选项越多，决策越慢", content: "Hick 定律：决策时间随选项数量的对数增长。这意味着不是越多功能越好——10 个选项的菜单比 5 个慢约 60%。解决方案：分组、默认值、最近使用、搜索。优秀产品都在「藏起来又找得到」之间寻找平衡。", tags: ["交互设计", "决策心理学"], source: "HCI 研究" },
  { type: "knowledge", title: "格式塔原理：大脑如何感知设计", content: "格式塔心理学的核心原理：相近的元素被认为是一组（接近律）、相似的元素被认为是一组（相似律）、封闭的形状更容易被识别（封闭律）、连续的线条优于分散点（连续律）。掌握这些原理能让你的设计更符合直觉。", tags: ["视觉设计", "心理学"], source: "设计基础理论" },
  { type: "knowledge", title: "Doherty 阈值：400ms 是体验的生死线", content: "IBM 研究发现：交互响应在 400ms 以内时，用户能进入「心流」状态；超过这个阈值，注意力就会断裂。这就是为什么按钮点击要立即反馈、为什么列表加载要骨架屏、为什么搜索框要 debounce 而不是 throttle。400ms 不是性能指标，是体验阈值。", tags: ["交互设计", "性能体验"], source: "HCI 研究" },
  { type: "knowledge", title: "为什么圆角让人感觉更友好？", content: "神经科学研究表明，人类大脑对尖角有潜意识的警惕反应（可能是进化中识别危险物体的本能）。圆角触发更放松、友好的感知。这也是为什么现代 UI 普遍采用圆角——它降低了视觉紧张感，让产品显得更「可亲近」。", tags: ["视觉设计", "神经科学"], source: "认知科学研究" },
  { type: "tip", title: "微交互的 4 个组成部分", content: "Dan Saffer 在《微交互》中提出：每一个微交互都包含触发器（Trigger）、规则（Rules）、反馈（Feedback）、循环与模式（Loops & Modes）。点赞按钮、下拉刷新、保存提示——这些看似微小的动作，决定了产品是「能用」还是「好用」。", tags: ["交互设计", "微交互"], source: "设计基础理论" },
  { type: "tip", title: "空状态设计：不要浪费这个机会", content: "空状态是用户首次使用功能时看到的界面。好的空状态应该：1）解释这个功能是什么；2）告诉用户如何开始；3）提供一个明确的 CTA；4）配一张能传达情绪的插画。空状态不是「没东西」，是引导用户上手的绝佳机会。", tags: ["UI 设计", "用户引导"], source: "设计团队沉淀" },
  { type: "tip", title: "对比度不只是无障碍要求", content: "WCAG 要求正文文字对比度至少 4.5:1，大文字 3:1。但好的对比度设计远不止于此——它能提升可读性、建立视觉层级、在各种光线环境下保持可用性。推荐工具：Colour Contrast Analyser、Stark、APCA（下一代对比度算法）。", tags: ["无障碍", "视觉设计"], source: "设计规范" },
  { type: "knowledge", title: "Peak-End 法则：用户只记得峰值与结尾", content: "诺贝尔奖得主 Kahneman 发现：人对一段体验的记忆，主要由「最强烈瞬间」和「结束时」决定，过程中的平均感受影响很小。所以好设计要懂得「制造峰值」（惊喜动效、彩蛋、社交时刻）和「优雅结尾」（成功页、感谢语、一键分享）。", tags: ["体验设计", "心理学"], source: "行为经济学" },

  // ─── AI 设计 / AI 原生产品 ────────────────────────────────────────────────
  { type: "trend", title: "AI 原生产品的「Prompt-as-UI」范式", content: "传统 GUI 让用户「点」，AI 原生产品让用户「说」。Linear、Notion、Raycast 都在把命令面板（Cmd+K）升级为自然语言入口：用户描述意图，AI 拆解为操作流。这种范式下，UI 的角色从「展示控件」变成「展示进度与结果」，设计重心向对话流和确认机制迁移。", tags: ["AI 设计", "产品趋势", "对话式 UI"], source: "AI 产品观察" },
  { type: "trend", title: "AI 时代的设计师新角色：Prompt 体验设计师", content: "AI 产品里，提示词工程不再只是技术活，而是体验设计的核心环节。设计师需要为不同场景设计「提示模板」、为模糊请求设计「澄清反问」、为不确定结果设计「置信度展示」。GitHub Copilot Chat、Cursor 的命令面板都体现了这个新工种的价值。", tags: ["AI 设计", "Prompt Engineering", "新角色"], source: "AI 产品观察" },
  { type: "tip", title: "AI 输出的不确定性如何在 UI 中表达？", content: "AI 不像传统软件给确定答案，UI 必须诚实表达「不确定」：1）流式输出让用户感知思考过程；2）多方案并列让用户挑选；3）置信度标签（高/中/低）；4）「我不确定」的明确表达；5）「重新生成」按钮永远在显眼位置。诚实是 AI 体验的底色。", tags: ["AI 设计", "不确定性 UI"], source: "AI 产品观察" },
  { type: "case", title: "Notion AI 的「按需召唤」哲学", content: "Notion AI 没有把 AI 做成一个常驻聊天框，而是嵌在编辑器里——选中文字按空格唤起、用 /ai 触发命令、在表格里作为公式调用。AI 不抢主导权，只在用户明确需要时出现。这种「轻 AI 嵌入」让产品没有 AI 也能用，有 AI 时如虎添翼。", tags: ["AI 设计", "案例分析", "嵌入式 AI"], source: "产品分析" },
  { type: "case", title: "Cursor 与 GitHub Copilot：AI 编程工具的两条路", content: "Copilot 走「灰色幽灵补全」路线，把 AI 藏在编辑器自动补全里；Cursor 走「Cmd+K 召唤」路线，让 AI 成为可对话的协作者。两者反映了 AI 介入工作流的两种模型：「无感增强」与「主动协作」。设计师选哪条路，取决于任务的可预测性和用户的专业度。", tags: ["AI 设计", "案例分析", "AI 编程"], source: "产品分析" },
  { type: "tip", title: "设计 AI 产品的 3 条避坑指南", content: "1）不要把 AI 包装成万能助手——用户期望越高失望越大，明确告诉用户它能做什么；2）不要让 AI 默默改用户内容——任何修改都需要 diff 视图和「接受/拒绝」；3）不要让加载圈替代解释——用「正在分析需求…正在生成…正在校对…」的步骤化文案降低焦虑。", tags: ["AI 设计", "最佳实践"], source: "设计团队沉淀" },
  { type: "trend", title: "多模态 AI 让「截图即需求」成为现实", content: "GPT-4V、Claude 3、Gemini 都能看懂截图。这意味着设计沟通的最小单元从「文字描述」变成「截图+一句话」：贴一张竞品截图说「学这个但更克制」，AI 直接产出风格一致的设计稿。设计工具的未来入口可能是一个粘贴框，不再是图层面板。", tags: ["AI 趋势", "多模态", "设计工具"], source: "AI 资讯" },

  // ─── AI 资讯 / 行业趋势 ───────────────────────────────────────────────────
  { type: "trend", title: "Anthropic 的 Artifacts：让 AI 输出可交互", content: "Claude 推出的 Artifacts 让 AI 不再只输出文字，而是渲染成可交互的卡片、代码沙盒、SVG、流程图。它代表了一个趋势：AI 输出的载体从「文字流」升级为「可操作对象」。这对 UI 设计师意味着——AI 产品的画布将比聊天气泡丰富 100 倍。", tags: ["AI 资讯", "Anthropic", "交互输出"], source: "AI 资讯" },
  { type: "trend", title: "AI Agent 时代的「任务可观测性」需求暴涨", content: "AutoGPT、Devin 这类 Agent 产品让 AI 能自主跑几十步任务。用户最大的痛点不是「能不能做」，而是「在干什么」「卡在哪」。能否提供良好的执行轨迹可视化、断点续跑、人类介入接管，是 Agent 产品体验的胜负手。这是设计师最大的新机会之一。", tags: ["AI 资讯", "AI Agent", "可观测性"], source: "AI 资讯" },
  { type: "trend", title: "OpenAI Canvas：聊天框已不够用", content: "ChatGPT 推出 Canvas 模式，把长文档、代码、图表抽出聊天流，放进右侧画布并支持局部编辑。这宣告了「线性对话流」作为 AI 主交互的局限——复杂任务需要双栏、可编辑、版本历史的工作区。设计语言正在从聊天回归到 IDE 隐喻。", tags: ["AI 资讯", "OpenAI", "交互范式"], source: "AI 资讯" },
  { type: "trend", title: "Vercel v0 与 Galileo：自然语言生成 UI 走向生产", content: "v0、Galileo、Subframe 这类工具把「描述一个 UI」直接变成 React 代码或 Figma 文件。它们的共同设计模式：1）多版本并列让用户挑选；2）每个组件可独立 refine；3）输出代码而非图片，便于工程接力。设计的下游工序正在被 AI 重新洗牌。", tags: ["AI 资讯", "AI 生成 UI"], source: "AI 资讯" },
  { type: "trend", title: "Apple Intelligence 的「克制」式 AI 整合", content: "Apple 把 AI 拆成无数个具体场景能力（重写、总结、智能回复、消息优先级），而不是做一个大模型聊天框。这是另一种 AI 设计哲学——让 AI 隐入工作流，让用户在不知不觉中受益，而非时刻意识到「我在用 AI」。", tags: ["AI 资讯", "Apple", "嵌入式 AI"], source: "AI 资讯" },
  { type: "trend", title: "Perplexity 的「答案优先」颠覆搜索范式", content: "Perplexity 把搜索引擎重新定义为「答案引擎」：直接给结论，把链接作为引用脚注。这个转变挑战了 Google 二十年的「十条蓝链接」范式。对设计师的启示：当 AI 能直接给答案时，「索引界面」让位于「结果界面」，所有信息架构都需要重写。", tags: ["AI 资讯", "搜索体验", "范式革新"], source: "AI 资讯" },

  // ─── 有趣的体验设计案例 ───────────────────────────────────────────────────
  { type: "case", title: "Duolingo 的「负罪感设计」：那只猫头鹰为什么这么烦？", content: "Duolingo 用极致的拟人化推送（哭泣的多儿、威胁的多儿、绝望的多儿）创造了一种「不学就内疚」的情绪绑定。这违反了「不要打扰用户」的传统教条，却带来惊人留存。它证明：恰当的情绪冲突，比理性提醒更有效。这是行为设计的暗黑艺术。", tags: ["有趣案例", "情感设计", "行为设计"], source: "产品分析" },
  { type: "case", title: "Apple Watch 的呼吸 App：用动效教你深呼吸", content: "打开「正念」中的呼吸提醒，屏幕上一组花瓣会随呼吸节奏舒展和收缩。没有文字、没有计时器，纯粹的视觉节律就能引导你进入冥想状态。这是「形式即功能」的极致——动效本身就是产品的全部价值。", tags: ["有趣案例", "动效设计", "情感设计"], source: "产品分析" },
  { type: "case", title: "Stripe 404 页：错误页也能讲品牌故事", content: "Stripe 的 404 页面是一只折纸独角兽配一句「这条路你走错了，但风景还不错」。错误页不是技术异常的展示，而是品牌建立情绪连接的最后一公里。Slack、GitHub、Pinterest 都把错误页做成了「值得截图」的体验。", tags: ["有趣案例", "404 设计", "品牌体验"], source: "产品分析" },
  { type: "case", title: "Spotify Wrapped：年终总结如何成为社交事件", content: "Spotify Wrapped 每年 12 月引爆社交媒体的核心设计：1）极强烈的视觉风格（每年大变）；2）个性化叙事（你的全年听歌画像）；3）一键分享卡片；4）排行榜社交比较。它证明：数据可视化的最高境界是变成一年一度的「文化仪式」。", tags: ["有趣案例", "数据可视化", "社交设计"], source: "产品分析" },
  { type: "case", title: "Headspace 的呼吸引导：把医疗级体验做成日常", content: "Headspace 把临床冥想训练简化为「跟着圆圈呼吸」「听一段动画故事」「跟读咒语」。它把原本严肃的心理治疗包装成可爱的童话——动画风格、温柔配音、卡通角色。这是「医疗体验日常化」的范本：专业内容用童心传达。", tags: ["有趣案例", "情感设计", "健康产品"], source: "产品分析" },
  { type: "case", title: "Things 3 的彩蛋：完成最后一个任务时", content: "在 Cultured Code 的 Things 3 里，当你勾掉一个清单的最后一个 todo，整个清单会优雅淡出，并播放一段「啵」的轻快音效。没有花哨弹窗，没有「恭喜你！」的对话，只有一个让人会心一笑的瞬间。这就是优秀微交互的样子——克制、精准、令人记住。", tags: ["有趣案例", "微交互", "情感设计"], source: "产品分析" },
  { type: "case", title: "GitHub 贡献热力图：把代码量变成绿油油的草坪", content: "GitHub 把开发者每日提交数渲染成一年的绿色方格——颜色越深，提交越多。这个设计把「写代码」这件抽象的事变成了可视化的「养花」「种草」。开发者社区甚至因此衍生出「不要断 streak」的文化。最简单的可视化，催生了最强的行为驱动力。", tags: ["有趣案例", "数据可视化", "行为驱动"], source: "产品分析" },
  { type: "case", title: "Notion 的拖拽魔法：万物皆可移动", content: "Notion 把「拖拽」做成了一种核心交互语言：拖块到任何位置、拖文件成附件、拖卡片改状态、拖列改顺序。每次拖拽都有清晰的落点提示和即时反馈。这种「物理化」的操作让数字内容像积木一样可玩，也是它能从笔记软件长成多用途工具的关键。", tags: ["有趣案例", "拖拽交互", "产品设计"], source: "产品分析" },

  // ─── 色彩 / 心理学 / 通用 ─────────────────────────────────────────────────
  { type: "knowledge", title: "为什么蓝色是最受欢迎的颜色？", content: "研究表明，全球约 40% 的人最喜欢蓝色。这与人类进化有关——蓝色天空和清洁水源是安全的信号。这也是为什么金融、医疗、科技公司（Facebook、Twitter、LinkedIn、Salesforce）都偏爱蓝色：它在视觉上自带「可信赖」属性。", tags: ["色彩心理学", "设计原理"], source: "色彩研究所" },
  { type: "knowledge", title: "「红色 CTA」的迷思：颜色不是关键，对比度才是", content: "经典 A/B 测试常见红色按钮转化更高，但真相不是「红色更好」，而是「红色与周围对比度更高」。HubSpot 在白底页面上测试时红色赢，但在红色品牌色页面上输给了绿色。结论：CTA 的颜色应该是页面里最突出的「异色」，而不是固定某一种颜色。", tags: ["色彩心理学", "转化优化"], source: "A/B 测试研究" },
  { type: "tip", title: "设计评审前必做的 5 件事", content: "1）明确评审目标（视觉/交互/业务？）；2）准备每个设计决策的理由；3）标注尚未解决的问题，主动暴露不确定性；4）准备 1-2 个备选方案；5）提前 24 小时发送设计稿，让评审者带着问题来。充分准备让评审从「打分」变成「共创」。", tags: ["设计流程", "协作"], source: "设计团队沉淀" },
  { type: "tip", title: "设计交付的「最后一公里」", content: "设计稿不是终点，工程实现才是。优秀的设计交付应包含：1）标注稿（间距、字号、颜色 token）；2）交互说明（边界状态、动效曲线、时长）；3）异常用例（空、错、加载、超长文本）；4）切图与 SVG；5）与开发的 1v1 走查。少了任何一项，都会在线上被打回原形。", tags: ["设计流程", "设计交付"], source: "设计团队沉淀" },
  { type: "knowledge", title: "Jakob 定律：用户期望你跟别人一样", content: "尼尔森实验室提出：用户大部分时间在使用其他产品，他们期望你的产品和那些产品一样工作。这是为什么购物车永远在右上角、设置永远在头像下、汉堡菜单永远在左上。「创新交互」往往败给「熟悉的便利」，除非你能提供 10 倍优势。", tags: ["交互设计", "可用性"], source: "HCI 研究" },
  { type: "knowledge", title: "60-30-10 配色法则", content: "经典室内设计配色法则：主色 60%（背景与大块面）、辅色 30%（次要区块）、强调色 10%（CTA 与重点提示）。这个比例能让画面有节奏不杂乱。在 UI 里通常是：白/浅灰 60% + 深灰文字 30% + 品牌色 10%。", tags: ["视觉设计", "配色"], source: "设计基础理论" },
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
