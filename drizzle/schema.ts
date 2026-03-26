import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  float,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Meetings (会议语音转核心思路) ──────────────────────────────────────────
export const meetings = mysqlTable("meetings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  audioUrl: text("audioUrl"),
  transcript: text("transcript"),
  summary: text("summary"),
  keyInsights: json("keyInsights").$type<string[]>(),
  // 结构化会议纪要：发言人+时间戳+内容段落
  structuredMinutes: json("structuredMinutes").$type<{speaker: string; timestamp: string; content: string; isConclusion?: boolean}[]>(),
  // AI 洞察：风险/行动/决策
  aiInsights: json("aiInsights").$type<{type: 'risk'|'action'|'decision'; content: string}[]>(),
  duration: int("duration"), // 录音时长（秒）
  attendees: json("attendees").$type<string[]>(),
  status: mysqlEnum("status", ["uploading", "transcribing", "analyzing", "done", "error"]).default("uploading").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Meeting = typeof meetings.$inferSelect;

// ─── MeetingComments (会议评论) ───────────────────────────────────────────────
export const meetingComments = mysqlTable("meeting_comments", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 100 }),
  content: text("content").notNull(),
  parentId: int("parentId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MeetingComment = typeof meetingComments.$inferSelect;

// ─── Todos (待办事项) ────────────────────────────────────────────────────────
export const todos = mysqlTable("todos", {
  id: int("id").autoincrement().primaryKey(),
  meetingId: int("meetingId"),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["high", "medium", "low"]).default("medium").notNull(),
  assignee: varchar("assignee", { length: 255 }),
  dueDate: varchar("dueDate", { length: 10 }),
  completed: boolean("completed").default(false).notNull(),
  sourceType: mysqlEnum("sourceType", ["meeting", "manual", "idea"]).default("manual").notNull(),
  sourceId: int("sourceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Todo = typeof todos.$inferSelect;

// ─── Ideas (开放式想法落地页) ────────────────────────────────────────────────
export const ideas = mysqlTable("ideas", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  tags: json("tags").$type<string[]>(),
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  likesCount: int("likesCount").default(0).notNull(),
  commentsCount: int("commentsCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Idea = typeof ideas.$inferSelect;

// ─── IdeaComments (想法评论) ─────────────────────────────────────────────────
export const ideaComments = mysqlTable("idea_comments", {
  id: int("id").autoincrement().primaryKey(),
  ideaId: int("ideaId").notNull(),
  userId: int("userId").notNull(),
  content: text("content").notNull(),
  parentId: int("parentId"), // for nested replies
  replyToUser: varchar("replyToUser", { length: 100 }), // @mention
  emoji: varchar("emoji", { length: 10 }), // reaction emoji
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IdeaComment = typeof ideaComments.$inferSelect;

// ─── IdeaVersions (想法版本历史) ─────────────────────────────────────────────
export const ideaVersions = mysqlTable("idea_versions", {
  id: int("id").autoincrement().primaryKey(),
  ideaId: int("ideaId").notNull(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  modules: json("modules").$type<{id: string; title: string; content: string}[]>(),
  versionNum: int("versionNum").default(1).notNull(),
  changeNote: varchar("changeNote", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IdeaVersion = typeof ideaVersions.$inferSelect;

// ─── IdeaReactions (情绪反馈) ────────────────────────────────────────────────
export const ideaReactions = mysqlTable("idea_reactions", {
  id: int("id").autoincrement().primaryKey(),
  ideaId: int("ideaId").notNull(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["useful", "discuss", "question"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IdeaReaction = typeof ideaReactions.$inferSelect;

// ─── Interviews (用户访谈全流程管理) ─────────────────────────────────────────
export const interviews = mysqlTable("interviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  interviewee: varchar("interviewee", { length: 255 }),
  date: varchar("date", { length: 10 }),
  content: text("content"),
  audienceLabels: json("audienceLabels").$type<string[]>(),
  painPoints: json("painPoints").$type<string[]>(),
  designSolutions: json("designSolutions").$type<string[]>(),
  status: mysqlEnum("status", ["draft", "analyzing", "done"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Interview = typeof interviews.$inferSelect;

// ─── KnowledgeArticles (设计调研知识库) ──────────────────────────────────────
export const knowledgeArticles = mysqlTable("knowledge_articles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  tags: json("tags").$type<string[]>(),
  version: int("version").default(1).notNull(),
  parentId: int("parentId"),
  category: varchar("category", { length: 100 }),
  collaborators: json("collaborators").$type<number[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type KnowledgeArticle = typeof knowledgeArticles.$inferSelect;

// ─── InspirationItems (设计灵感碰撞墙) ───────────────────────────────────────
export const inspirationItems = mysqlTable("inspiration_items", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  boardId: int("boardId"),
  type: mysqlEnum("type", ["text", "image", "link", "screenshot"]).default("text").notNull(),
  title: varchar("title", { length: 500 }),
  content: text("content"),
  imageUrl: text("imageUrl"),
  url: text("url"),
  posX: float("posX").default(0),
  posY: float("posY").default(0),
  width: float("width").default(200),
  height: float("height").default(150),
  styleTags: json("styleTags").$type<string[]>(),
  linkedTodoId: int("linkedTodoId"),
  linkedInterviewId: int("linkedInterviewId"),
  color: varchar("color", { length: 20 }).default("#ffffff"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InspirationItem = typeof inspirationItems.$inferSelect;

// ─── InspirationBoards (灵感画布) ────────────────────────────────────────────
export const inspirationBoards = mysqlTable("inspiration_boards", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InspirationBoard = typeof inspirationBoards.$inferSelect;

// ─── DesignReviews (设计方案智能评审) ────────────────────────────────────────
export const designReviews = mysqlTable("design_reviews", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  designUrl: text("designUrl").notNull(),
  version: int("version").default(1).notNull(),
  parentId: int("parentId"),
  businessLogicScore: float("businessLogicScore"),
  interactionScore: float("interactionScore"),
  accessibilityScore: float("accessibilityScore"),
  overallScore: float("overallScore"),
  reviewComments: json("reviewComments").$type<{dimension: string; score: number; comment: string}[]>(),
  suggestions: json("suggestions").$type<string[]>(),
  status: mysqlEnum("status", ["uploading", "reviewing", "done", "error"]).default("uploading").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DesignReview = typeof designReviews.$inferSelect;

// ─── InspirationBlindbox (灵感盲盒内容库) ────────────────────────────────────
export const blindboxItems = mysqlTable("blindbox_items", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["case", "knowledge", "tip", "quote"]).default("knowledge").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  imageUrl: text("imageUrl"),
  source: varchar("source", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type BlindboxItem = typeof blindboxItems.$inferSelect;

// ─── Activities (团队动态时间线) ──────────────────────────────────────────────
export const activities = mysqlTable("activities", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 100 }),
  type: mysqlEnum("type", ["todo_done", "idea_posted", "review_passed", "interview_added", "knowledge_added", "inspiration_added"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  detail: text("detail"),
  refId: int("refId"),
  refType: varchar("refType", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = typeof activities.$inferInsert;

// ─── KnowledgeComments (知识库评论) ──────────────────────────────────────────
export const knowledgeComments = mysqlTable("knowledge_comments", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 100 }),
  content: text("content").notNull(),
  parentId: int("parentId"),
  emoji: varchar("emoji", { length: 10 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KnowledgeComment = typeof knowledgeComments.$inferSelect;

// ─── KnowledgeFavorites (知识库收藏) ─────────────────────────────────────────
export const knowledgeFavorites = mysqlTable("knowledge_favorites", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KnowledgeFavorite = typeof knowledgeFavorites.$inferSelect;

// ─── KnowledgeViews (知识库浏览记录) ─────────────────────────────────────────
export const knowledgeViews = mysqlTable("knowledge_views", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull(),
  userId: int("userId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KnowledgeView = typeof knowledgeViews.$inferSelect;

// ─── KnowledgeTags (团队共维护标签库) ────────────────────────────────────────
export const knowledgeTags = mysqlTable("knowledge_tags", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  usageCount: int("usageCount").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KnowledgeTag = typeof knowledgeTags.$inferSelect;
