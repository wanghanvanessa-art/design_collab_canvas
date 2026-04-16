import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Settings2, X, ChevronDown, ChevronUp, ExternalLink, Loader2, CheckCircle } from "lucide-react";

interface Provider {
  id: string;
  name: string;
  desc: string;
  apiUrl: string;
  defaultModel: string;
  keyUrl: string;
  keyPlaceholder: string;
}

const PROVIDERS: Provider[] = [
  {
    id: "openai",
    name: "OpenAI GPT-4o",
    desc: "推荐，最强视觉解析",
    apiUrl: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-4o",
    keyUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-...",
  },
  {
    id: "qwen",
    name: "通义千问",
    desc: "国内好用且性价比高",
    apiUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen-vl-max",
    keyUrl: "https://bailian.console.aliyun.com/",
    keyPlaceholder: "sk-...",
  },
  {
    id: "glm",
    name: "智谱 GLM-4V",
    desc: "中文理解极其优秀",
    apiUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-4v-plus",
    keyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    keyPlaceholder: "填入您的 API Key",
  },
  {
    id: "gemini",
    name: "Gemini 2.5 Flash",
    desc: "免费额度多，多模态强",
    apiUrl: "https://forge.manus.im/v1/chat/completions",
    defaultModel: "gemini-2.5-flash",
    keyUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza...",
  },
  {
    id: "custom",
    name: "自定义",
    desc: "OpenAI 兼容接口",
    apiUrl: "",
    defaultModel: "",
    keyUrl: "",
    keyPlaceholder: "填入您的 API Key",
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModelConfigDialog({ open, onOpenChange }: Props) {
  const [selectedId, setSelectedId] = useState("qwen");
  const [apiKey, setApiKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [maxTokens, setMaxTokens] = useState("32768");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: config } = trpc.system.getModelConfig.useQuery(undefined, { enabled: open });
  const utils = trpc.useUtils();

  const saveConfig = trpc.system.setModelConfig.useMutation({
    onSuccess: () => {
      toast.success("配置已保存");
      utils.system.getModelConfig.invalidate();
      onOpenChange(false);
    },
    onError: (err) => toast.error(err.message || "保存失败"),
  });

  const testConnection = trpc.system.testModelConnection.useMutation({
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) toast.success("连接测试成功");
      else toast.error(data.message || "连接测试失败");
    },
    onError: (err) => {
      setTestResult({ success: false, message: err.message || "连接测试失败" });
      toast.error(err.message || "连接测试失败");
    },
  });

  const selectedProvider = PROVIDERS.find(p => p.id === selectedId)!;

  useEffect(() => {
    if (config) {
      setApiKey(config.apiKey || "");
      setCustomApiUrl(config.apiUrl || "");
      setCustomModel(config.model || "");
      setMaxTokens(String(config.maxTokens || 32768));
    }
  }, [config]);

  const handleSelectProvider = (id: string) => {
    setSelectedId(id);
    setTestResult(null);
    const p = PROVIDERS.find(pr => pr.id === id)!;
    if (id !== "custom") {
      setCustomApiUrl(p.apiUrl);
      setCustomModel(p.defaultModel);
    }
  };

  const getEffectiveApiUrl = () => {
    if (customApiUrl) return customApiUrl;
    return selectedProvider.apiUrl;
  };

  const getEffectiveModel = () => {
    if (customModel) return customModel;
    return selectedProvider.defaultModel;
  };

  const handleTest = () => {
    if (!apiKey.trim()) { toast.error("请先填写 API Key"); return; }
    setTesting(true);
    setTestResult(null);
    testConnection.mutate(
      { apiKey: apiKey.trim(), apiUrl: getEffectiveApiUrl(), model: getEffectiveModel() },
      { onSettled: () => setTesting(false) }
    );
  };

  const handleSave = () => {
    if (!apiKey.trim()) { toast.error("请填写 API Key"); return; }
    if (!getEffectiveApiUrl().trim()) { toast.error("请填写 API 地址"); return; }
    if (!getEffectiveModel().trim()) { toast.error("请填写模型名称"); return; }
    const tokens = parseInt(maxTokens);
    if (isNaN(tokens) || tokens < 1024 || tokens > 128000) {
      toast.error("最大 Token 必须在 1024 - 128000 之间");
      return;
    }
    saveConfig.mutate({
      apiKey: apiKey.trim(),
      apiUrl: getEffectiveApiUrl().trim(),
      model: getEffectiveModel().trim(),
      maxTokens: tokens,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-7 pt-7 pb-5 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold">
            <Settings2 className="w-5 h-5 text-muted-foreground" />
            引擎与 API 配置
          </DialogTitle>
        </DialogHeader>

        <div className="px-7 py-6 space-y-6">
          {/* Provider Selector */}
          <div className="grid grid-cols-5 gap-3">
            {PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectProvider(p.id)}
                className={cn(
                  "p-4 rounded-2xl border-2 text-left transition-all",
                  selectedId === p.id
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/30"
                )}
              >
                <p className="font-semibold text-sm leading-snug">{p.name}</p>
                <p className={cn(
                  "text-xs mt-1 leading-tight",
                  selectedId === p.id ? "text-background/70" : "text-muted-foreground"
                )}>{p.desc}</p>
              </button>
            ))}
          </div>

          {/* API Key Input */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold flex items-center gap-1">
                填入您的 API Key
                <span className="text-red-500">*</span>
              </label>
              {selectedProvider.keyUrl && (
                <a
                  href={selectedProvider.keyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1 transition-colors"
                >
                  去获取 Key
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
            <div className="relative">
              <Input
                type="password"
                placeholder={selectedProvider.keyPlaceholder}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestResult(null); }}
                className="rounded-xl pr-10 font-mono text-sm h-12 bg-muted/30 border-border/60"
              />
              {apiKey && (
                <button
                  onClick={() => { setApiKey(""); setTestResult(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Security Notice */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <p className="text-xs text-muted-foreground">
                安全承诺：API Key 仅储存于本地，不会上传至任何服务器。
              </p>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={cn(
              "flex items-center gap-2 px-4 py-3 rounded-xl text-sm",
              testResult.success
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                : "bg-red-50 text-red-700 border border-red-100"
            )}>
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{testResult.success ? "连接成功！API 可正常使用" : "连接失败：" + testResult.message}</span>
            </div>
          )}

          {/* Advanced Settings */}
          <div className="border border-border rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors text-left"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings2 className="w-4 h-4" />
              高级设置 / 自定义模型（可选）
              {showAdvanced
                ? <ChevronUp className="w-4 h-4 ml-auto" />
                : <ChevronDown className="w-4 h-4 ml-auto" />
              }
            </button>
            {showAdvanced && (
              <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border bg-muted/10">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">API 端点 URL</label>
                  <Input
                    placeholder="https://api.openai.com/v1/chat/completions"
                    value={customApiUrl}
                    onChange={(e) => setCustomApiUrl(e.target.value)}
                    className="rounded-xl font-mono text-xs h-9"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">模型名称</label>
                    <Input
                      placeholder={selectedProvider.defaultModel || "model-name"}
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      className="rounded-xl text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">最大 Token</label>
                    <Input
                      type="number"
                      placeholder="32768"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(e.target.value)}
                      min={1024}
                      max={128000}
                      className="rounded-xl text-xs h-9"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 pb-7 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !apiKey}
            className="rounded-xl gap-2"
          >
            {testing && <Loader2 className="w-4 h-4 animate-spin" />}
            测试连接
          </Button>
          <Button
            onClick={handleSave}
            disabled={saveConfig.isPending || !apiKey}
            className="rounded-xl bg-foreground text-background hover:bg-foreground/90 px-8 gap-2"
          >
            {saveConfig.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            保存并关闭
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}