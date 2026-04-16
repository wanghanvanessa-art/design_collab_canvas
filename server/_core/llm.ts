import { ENV } from "./env";
import { demoStore } from "./inMemoryStore";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

// ────────────────────────────────────────────────────────────────────────────
// Utilities
// ────────────────────────────────────────────────────────────────────────────

/**
 * Recursively strip every key whose value is `undefined` or `null`
 * so the JSON body sent to the provider contains zero stray fields.
 */
function stripEmpty(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripEmpty);
  if (obj !== null && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v !== undefined && v !== null) out[k] = stripEmpty(v);
    }
    return out;
  }
  return obj;
}

/** Hard upper-bound for max_tokens — must be high enough for design-review JSON output. */
const MAX_TOKENS_CAP = 16384;

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

// ────────────────────────────────────────────────────────────────────────────
// Content / Message normalisation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Normalise one content part.
 *  – image_url: keep ONLY `url`, drop `detail` (OpenAI-specific, 400 on ZhiPu / Qwen).
 *  – file_url : keep ONLY `url` + `mime_type` if present.
 */
const normalizeContentPart = (
  part: MessageContent
): Record<string, unknown> => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }
  if (part.type === "text") {
    return { type: "text", text: part.text };
  }
  if (part.type === "image_url") {
    // ★ Only keep `url` — never send `detail`
    return { type: "image_url", image_url: { url: part.image_url.url } };
  }
  if (part.type === "file_url") {
    const fu: Record<string, string> = { url: part.file_url.url };
    if (part.file_url.mime_type) fu.mime_type = part.file_url.mime_type;
    return { type: "file_url", file_url: fu };
  }
  throw new Error("Unsupported message content part");
};

/**
 * Build a plain-object message ready for JSON serialisation.
 * – Never includes `name` / `tool_call_id` when they are empty.
 */
const normalizeMessage = (message: Message): Record<string, unknown> => {
  const { role, name, tool_call_id } = message;

  // tool / function roles → flatten content to a string
  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(p => (typeof p === "string" ? p : JSON.stringify(p)))
      .join("\n");
    const msg: Record<string, unknown> = { role, content };
    if (name) msg.name = name;
    if (tool_call_id) msg.tool_call_id = tool_call_id;
    return msg;
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // Single text part → collapse to a plain string for maximum compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    const msg: Record<string, unknown> = { role, content: (contentParts[0] as any).text };
    if (name) msg.name = name;
    return msg;
  }

  const msg: Record<string, unknown> = { role, content: contentParts };
  if (name) msg.name = name;
  return msg;
};

// ────────────────────────────────────────────────────────────────────────────
// Tool-choice helpers
// ────────────────────────────────────────────────────────────────────────────

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;
  if (toolChoice === "none" || toolChoice === "auto") return toolChoice;
  if (toolChoice === "required") {
    if (!tools || tools.length === 0)
      throw new Error("tool_choice 'required' but no tools configured");
    if (tools.length > 1)
      throw new Error("tool_choice 'required' needs exactly one tool or explicit name");
    return { type: "function", function: { name: tools[0].function.name } };
  }
  if ("name" in toolChoice) {
    return { type: "function", function: { name: toolChoice.name } };
  }
  return toolChoice;
};

// ────────────────────────────────────────────────────────────────────────────
// API URL / key helpers
// ────────────────────────────────────────────────────────────────────────────

const resolveApiUrl = () =>
  ENV.forgeApiUrl && ENV.forgeApiUrl.trim().length > 0
    ? `${ENV.forgeApiUrl.replace(/\/$/, "")}/v1/chat/completions`
    : "https://forge.manus.im/v1/chat/completions";

// ────────────────────────────────────────────────────────────────────────────
// Response-format helpers
// ────────────────────────────────────────────────────────────────────────────

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }
  const schema = outputSchema || output_schema;
  if (!schema) return undefined;
  if (!schema.name || !schema.schema)
    throw new Error("outputSchema requires both name and schema");
  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

// ────────────────────────────────────────────────────────────────────────────
// invokeLLM — the single entry-point for every LLM call in the app
// ────────────────────────────────────────────────────────────────────────────

export async function invokeLLM(
  params: InvokeParams,
  customConfig?: { apiKey?: string; apiUrl?: string; model?: string; maxTokens?: number },
): Promise<InvokeResult> {
  /* ── 1. Resolve effective config ─────────────────────────────────────── */
  const storedConfig = demoStore.getModelConfig();
  const config = {
    apiKey:  customConfig?.apiKey  || storedConfig.apiKey  || ENV.forgeApiKey,
    apiUrl:  customConfig?.apiUrl  || storedConfig.apiUrl  || resolveApiUrl(),
    model:   customConfig?.model   || storedConfig.model   || "qwen-vl-max",
    maxTokens: customConfig?.maxTokens || storedConfig.maxTokens || 32768,
  };

  if (!config.apiKey) {
    throw new Error("未配置 API Key，请先点击「模型配置」按钮填写有效的 API Key 后再发起评审。");
  }

  // Validate the API URL is reachable
  if (!config.apiUrl || config.apiUrl.trim().length === 0) {
    throw new Error("未配置 API 端点地址，请在「模型配置」中设置正确的 API URL。");
  }

  const {
    messages, tools,
    toolChoice, tool_choice,
    outputSchema, output_schema,
    responseFormat, response_format,
    maxTokens, max_tokens,
  } = params;

  /* ── 2. Build payload ────────────────────────────────────────────────── */
  const payload: Record<string, unknown> = {
    model: config.model,
    messages: messages.map(normalizeMessage),
  };

  // tools / tool_choice — only when tools exist
  if (tools && tools.length > 0) {
    payload.tools = tools;
    const tc = normalizeToolChoice(toolChoice || tool_choice, tools);
    if (tc) payload.tool_choice = tc;
  }

  // ★ max_tokens — hard-cap at MAX_TOKENS_CAP (16384) for all providers
  const rawMax = maxTokens || max_tokens || config.maxTokens;
  payload.max_tokens = Math.min(rawMax, MAX_TOKENS_CAP);

  // response_format (optional)
  const fmt = normalizeResponseFormat({ responseFormat, response_format, outputSchema, output_schema });
  if (fmt) payload.response_format = fmt;

  /* ── 3. Final sanitisation: strip every undefined / null value ────── */
  const cleanPayload = stripEmpty(payload) as Record<string, unknown>;

  /* ── 4. Debug log (no secrets, truncated) ────────────────────────── */
  const msgSummary = (cleanPayload.messages as any[])?.map((m: any) => {
    if (typeof m.content === "string") return `${m.role}:text(${m.content.length}ch)`;
    if (Array.isArray(m.content)) {
      const parts = m.content.map((p: any) => {
        if (p.type === "text") return `text(${p.text?.length}ch)`;
        if (p.type === "image_url") return `img(${p.image_url?.url?.slice(0, 40)}…)`;
        return p.type;
      });
      return `${m.role}:[${parts.join(",")}]`;
    }
    return `${m.role}:?`;
  });
  console.log(
    `[invokeLLM] → ${config.apiUrl}  model=${config.model}  max_tokens=${cleanPayload.max_tokens}  msgs=${JSON.stringify(msgSummary)}`,
  );

  /* ── 5. HTTP request ─────────────────────────────────────────────── */
  let response: Response;
  try {
    response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(cleanPayload),
    });
  } catch (fetchErr: any) {
    throw new Error(
      `LLM 网络连接失败: ${fetchErr?.message || "fetch failed"}。请检查 API URL 是否正确: ${config.apiUrl}`,
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[invokeLLM] ✗ ${response.status}: ${errorText.slice(0, 500)}`);
    throw new Error(
      `LLM 调用失败 (${response.status}): ${errorText.slice(0, 200)}。请检查 API Key 和模型名称是否正确。`,
    );
  }

  /* ── 6. Parse & validate response ────────────────────────────────── */
  const json = await response.json();
  if (!json?.choices?.length) {
    console.error("[invokeLLM] Unexpected body:", JSON.stringify(json).slice(0, 500));
    throw new Error("LLM 返回结果为空（无 choices）。该模型可能不支持当前请求格式，请尝试更换模型。");
  }

  return json as InvokeResult;
}