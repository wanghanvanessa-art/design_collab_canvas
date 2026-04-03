const ingestUid = process.env.KNOWLEDGE_INGEST_USER_ID;
export const ENV = {
  appId: process.env.VITE_APP_ID ?? "design-collab-canvas",
  cookieSecret: process.env.JWT_SECRET ?? "design-collab-canvas-dev-secret-2024",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  /** POST /api/ingest/follow-builders 使用的共享密钥 */
  knowledgeIngestSecret: process.env.KNOWLEDGE_INGEST_SECRET ?? "",
  /** 写入知识库的用户 ID；不设则使用本地访客账号 */
  knowledgeIngestUserId:
    ingestUid && /^\d+$/.test(ingestUid) ? parseInt(ingestUid, 10) : undefined,
};
