import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { getDb } from "./db";
import {
  meetings, todos, ideas, ideaComments, interviews,
  knowledgeArticles, inspirationItems, designReviews, blindboxItems
} from "../drizzle/schema";
import { eq, and, like, or, desc, isNull } from "drizzle-orm";

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
    dueDate: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(todos).values({
      userId: ctx.user.id,
      title: input.title,
      priority: input.priority,
      assignee: input.assignee || null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
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
    if (!db) return [];
    return db.select().from(ideas).where(eq(ideas.userId, ctx.user.id)).orderBy(desc(ideas.createdAt));
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const [idea] = await db.select().from(ideas).where(and(eq(ideas.id, input.id), eq(ideas.userId, ctx.user.id)));
    return idea || null;
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    content: z.string().min(1),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
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
    if (!db) return [];
    return db.select().from(ideaComments).where(eq(ideaComments.ideaId, input.ideaId)).orderBy(desc(ideaComments.createdAt));
  }),

  addComment: protectedProcedure.input(z.object({
    ideaId: z.number(),
    content: z.string().min(1),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
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

  export: protectedProcedure.input(z.object({
    id: z.number(),
    format: z.enum(["pdf", "word", "blog", "markdown"]),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, input.id));
    if (!idea) throw new Error("Idea not found");

    const comments = await db.select().from(ideaComments).where(eq(ideaComments.ideaId, input.id));

    let content = "";
    if (input.format === "markdown" || input.format === "blog") {
      content = `# ${idea.title}\n\n${idea.content}\n\n---\n\n## 评论 (${comments.length})\n\n${comments.map(c => `> ${c.content}`).join("\n\n")}`;
    } else {
      content = `${idea.title}\n\n${idea.content}\n\n评论 (${comments.length}):\n${comments.map(c => `- ${c.content}`).join("\n")}`;
    }

    return { title: idea.title, content, format: input.format === "word" ? "docx" : input.format };
  }),
});

// ─── Interviews Router ────────────────────────────────────────────────────────
const interviewsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(interviews).where(eq(interviews.userId, ctx.user.id)).orderBy(desc(interviews.createdAt));
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const [iv] = await db.select().from(interviews).where(and(eq(interviews.id, input.id), eq(interviews.userId, ctx.user.id)));
    return iv || null;
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    interviewee: z.string().optional(),
    content: z.string().optional(),
    date: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.insert(interviews).values({
      userId: ctx.user.id,
      title: input.title,
      interviewee: input.interviewee || null,
      content: input.content || null,
      date: input.date ? new Date(input.date) : null,
      status: "draft",
    });
    return { success: true };
  }),

  analyze: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
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
    if (!db) return null;
    const [article] = await db.select().from(knowledgeArticles).where(eq(knowledgeArticles.id, input.id));
    return article || null;
  }),

  versions: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
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
    if (!db) throw new Error("DB unavailable");
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
    if (!db) throw new Error("DB unavailable");
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
    return { success: true };
  }),
});

// ─── Inspiration Router ───────────────────────────────────────────────────────
const inspirationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
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
    if (!db) throw new Error("DB unavailable");
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
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.update(inspirationItems).set({ posX: input.posX, posY: input.posY }).where(and(eq(inspirationItems.id, input.id), eq(inspirationItems.userId, ctx.user.id)));
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    await db.delete(inspirationItems).where(and(eq(inspirationItems.id, input.id), eq(inspirationItems.userId, ctx.user.id)));
    return { success: true };
  }),

  generateTags: protectedProcedure.input(z.object({})).mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
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
    if (!db) return [];
    return db.select().from(designReviews).where(and(eq(designReviews.userId, ctx.user.id), isNull(designReviews.parentId))).orderBy(desc(designReviews.createdAt));
  }),

  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return null;
    const [review] = await db.select().from(designReviews).where(eq(designReviews.id, input.id));
    return review || null;
  }),

  versions: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) return [];
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
    designUrl: z.string().url(),
  })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const [result] = await db.insert(designReviews).values({
      userId: ctx.user.id,
      title: input.title,
      designUrl: input.designUrl,
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
            { role: "system", content: "你是一个专业的B端产品设计评审专家。请从多个维度评审设计方案，给出专业评分和改进建议。请用JSON格式回复。" },
            { role: "user", content: `设计方案标题：${input.title}\n设计稿URL：${input.designUrl}\n\n请从以下维度进行评审：\n1. B端业务逻辑合理性(businessLogicScore, 0-100)\n2. 交互一致性(interactionScore, 0-100)\n3. 无障碍性Accessibility(accessibilityScore, 0-100)\n\n并提供：\n- 每个维度的详细评审意见(reviewComments)\n- 综合优化建议列表(suggestions)\n- 综合评分(overallScore, 0-100)` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "design_review",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  businessLogicScore: { type: "number" },
                  interactionScore: { type: "number" },
                  accessibilityScore: { type: "number" },
                  overallScore: { type: "number" },
                  reviewComments: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        dimension: { type: "string" },
                        score: { type: "number" },
                        comment: { type: "string" },
                      },
                      required: ["dimension", "score", "comment"],
                      additionalProperties: false,
                    },
                  },
                  suggestions: { type: "array", items: { type: "string" } },
                },
                required: ["businessLogicScore", "interactionScore", "accessibilityScore", "overallScore", "reviewComments", "suggestions"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = llmRes.choices[0]?.message?.content || "{}";
        const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));

        await db2.update(designReviews).set({
          businessLogicScore: parsed.businessLogicScore,
          interactionScore: parsed.interactionScore,
          accessibilityScore: parsed.accessibilityScore,
          overallScore: parsed.overallScore,
          reviewComments: parsed.reviewComments || [],
          suggestions: parsed.suggestions || [],
          status: "done",
        }).where(eq(designReviews.id, reviewId));
      } catch {
        const db3 = await getDb();
        if (db3) await db3.update(designReviews).set({ status: "error" }).where(eq(designReviews.id, reviewId));
      }
    })();

    return { id: reviewId };
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
});

export type AppRouter = typeof appRouter;
