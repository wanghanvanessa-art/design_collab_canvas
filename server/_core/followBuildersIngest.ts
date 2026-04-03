import { knowledgeArticles } from "../../drizzle/schema";
import { getDb, getOrCreateGuestUser } from "../db";
import { demoStore } from "./inMemoryStore";
import { ENV } from "./env";
import { invokeLLM } from "./llm";

const FEED_X =
  "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json";
const FEED_PODCASTS =
  "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json";
const FEED_BLOGS =
  "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-blogs.json";

const MAX_TWEETS = 120;
const PODCAST_TRANSCRIPT_CAP = 4500;
const MAX_PODCASTS = 12;

type CompactTweet = {
  kind: "tweet";
  author: string;
  handle: string;
  text: string;
  url: string;
  createdAt: string;
};

type CompactPodcast = {
  kind: "podcast";
  show: string;
  title: string;
  url: string;
  publishedAt: string;
  transcriptExcerpt: string;
};

type CompactBlog = {
  kind: "blog";
  source: string;
  title: string;
  url: string;
  excerpt: string;
};

type CompactItem = CompactTweet | CompactPodcast | CompactBlog;

async function fetchJSON(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  return res.json();
}

function buildCompactPayload(feedX: any, feedPodcasts: any, feedBlogs: any): CompactItem[] {
  const items: CompactItem[] = [];
  let tweetCount = 0;
  for (const builder of feedX?.x ?? []) {
    for (const t of builder?.tweets ?? []) {
      if (tweetCount >= MAX_TWEETS) break;
      items.push({
        kind: "tweet",
        author: builder.name ?? "",
        handle: builder.handle ?? "",
        text: String(t.text ?? "").slice(0, 2000),
        url: t.url ?? "",
        createdAt: t.createdAt ?? "",
      });
      tweetCount++;
    }
    if (tweetCount >= MAX_TWEETS) break;
  }

  let pc = 0;
  for (const p of feedPodcasts?.podcasts ?? []) {
    if (pc >= MAX_PODCASTS) break;
    const tr = String(p.transcript ?? "");
    items.push({
      kind: "podcast",
      show: p.name ?? "",
      title: p.title ?? "",
      url: p.url ?? "",
      publishedAt: p.publishedAt ?? "",
      transcriptExcerpt: tr.slice(0, PODCAST_TRANSCRIPT_CAP),
    });
    pc++;
  }

  for (const b of feedBlogs?.blogs ?? []) {
    items.push({
      kind: "blog",
      source: b.sourceName ?? b.name ?? "blog",
      title: b.title ?? "",
      url: b.url ?? "",
      excerpt: String(b.excerpt ?? b.summary ?? b.content ?? "").slice(0, 4000),
    });
  }

  return items;
}

const digestSchema = {
  name: "follow_builders_digest",
  strict: true,
  schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        minItems: 10,
        maxItems: 10,
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            content: { type: "string" },
            sourceUrl: { type: "string" },
            tags: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 5,
            },
          },
          required: ["title", "content", "sourceUrl", "tags"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
} as const;

export async function resolveIngestUserId(): Promise<number> {
  if (ENV.knowledgeIngestUserId != null && ENV.knowledgeIngestUserId > 0) {
    return ENV.knowledgeIngestUserId;
  }
  const u = await getOrCreateGuestUser();
  return u.id;
}

export async function runFollowBuildersIngest(): Promise<{ created: number; errors?: string[] }> {
  const errors: string[] = [];
  if (!ENV.forgeApiKey?.trim()) {
    errors.push(
      "未配置 BUILT_IN_FORGE_API_KEY：无法调用 LLM 生成摘要。请在 .env 中配置后执行 npm run ingest:follow-builders，或先在知识库页「新建条目」手动添加内容。",
    );
    return { created: 0, errors };
  }
  const [feedX, feedPodcasts, feedBlogs] = await Promise.all([
    fetchJSON(FEED_X) as Promise<any>,
    fetchJSON(FEED_PODCASTS) as Promise<any>,
    fetchJSON(FEED_BLOGS) as Promise<any>,
  ]);

  const compact = buildCompactPayload(feedX, feedPodcasts, feedBlogs);
  if (compact.length === 0) {
    errors.push("聚合 feed 为空，请稍后再试");
    return { created: 0, errors };
  }

  const userId = await resolveIngestUserId();
  const feedMeta = {
    generatedAt: feedX?.generatedAt ?? feedPodcasts?.generatedAt ?? null,
    compactStats: {
      items: compact.length,
      kinds: compact.reduce(
        (acc, x) => {
          acc[x.kind] = (acc[x.kind] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    },
  };

  const llmRes = await invokeLLM({
    messages: [
      {
        role: "system",
        content:
          "你是 AI 产品与行业研究编辑。根据给定的 follow-builders 数据源（顶尖 AI builder 的 X 动态、播客、官方博客），选出恰好 10 条对「AI 产品、模型应用、创业与工程实践」最有价值的信息。每条输出为中文：标题精炼有力；正文用 Markdown，含摘要与可执行洞见，并注明信息类型（如 动态/播客/博客）。必须严格基于素材，不可编造事实；若某条来自推文可简述背景。tags 用简短中文关键词。",
      },
      {
        role: "user",
        content: `元数据：${JSON.stringify(feedMeta)}\n\n原始素材（JSON 数组）：${JSON.stringify(compact)}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: digestSchema,
    },
  });

  const raw = llmRes.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(typeof raw === "string" ? raw : JSON.stringify(raw)) as {
    items: Array<{ title: string; content: string; sourceUrl: string; tags: string[] }>;
  };

  const list = parsed.items?.length === 10 ? parsed.items : null;
  if (!list) {
    errors.push("模型未返回 10 条有效条目");
    return { created: 0, errors };
  }

  const category = "AI 行业速递";
  const baseTags = ["follow-builders", "自动采集"];

  const db = await getDb();
  let created = 0;

  if (!db) {
    for (const item of list) {
      demoStore.createKnowledge(userId, {
        title: item.title.slice(0, 500),
        content: item.content,
        tags: Array.from(new Set([...baseTags, ...item.tags])),
        category,
        sourceType: "follow_builders",
      });
      created++;
    }
    return { created, errors: errors.length ? errors : undefined };
  }

  for (const item of list) {
    await db.insert(knowledgeArticles).values({
      userId,
      title: item.title.slice(0, 500),
      content: item.content,
      tags: Array.from(new Set([...baseTags, ...item.tags])),
      category,
      version: 1,
      sourceType: "follow_builders",
    });
    created++;
  }

  return { created, errors: errors.length ? errors : undefined };
}
