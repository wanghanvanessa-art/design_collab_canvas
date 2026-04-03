/**
 * 开发环境：当当前用户知识库为空时自动写入示例条目，便于联调 UI（非生产生效）。
 */
export const DEV_KNOWLEDGE_SAMPLES: Array<{
  title: string;
  content: string;
  tags: string[];
  category: string;
  sourceType: string;
}> = [
  {
    title: "知识库使用说明（示例）",
    content:
      "这是一条 **自动生成的示例条目**，仅在本地开发且你的知识库为空时出现。\n\n" +
      "- 点击 **新建条目** 可手动添加内容。\n" +
      "- 配置 `.env` 中的 `BUILT_IN_FORGE_API_KEY` 后，可运行 `npm run ingest:follow-builders` 拉取 AI 行业摘要。\n" +
      "- 若已连接数据库，示例条目会写入当前登录用户（或访客）名下。",
    tags: ["示例", "入门"],
    category: "站内说明",
    sourceType: "dev_seed",
  },
  {
    title: "设计调研：B 端表单可用性检查清单（示例）",
    content:
      "## 核心维度\n\n" +
      "1. **标签与占位**：必填有明确标识；占位文案不替代标签。\n" +
      "2. **错误与帮助**：错误就近展示；复杂字段提供说明或示例。\n" +
      "3. **步骤与进度**：长表单分步或进度条，避免迷失。\n\n" +
      "> 可将此条替换为你们业务的真实规范链接或截图说明。",
    tags: ["B端", "表单", "可用性"],
    category: "设计规范",
    sourceType: "dev_seed",
  },
  {
    title: "会议转待办：如何写好一条可执行待办（示例）",
    content:
      "好的待办通常包含：**动作 + 对象 + 截止时间（可选）+ 责任人（可选）**。\n\n" +
      "示例：`「在 4/5 前由 @张三 输出登录页空状态插画 3 稿」`。\n\n" +
      "避免「优化一下体验」这类无法验收的表述。",
    tags: ["待办", "协作"],
    category: "工作方法",
    sourceType: "dev_seed",
  },
];
