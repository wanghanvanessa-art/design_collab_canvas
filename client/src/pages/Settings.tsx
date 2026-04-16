import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/BackButton";
import { Settings as SettingsIcon, Key, Globe, Braces, Gauge, Save, PlayCircle, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function Settings() {
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("https://forge.manus.im/v1/chat/completions");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [maxTokens, setMaxTokens] = useState("32768");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: config, isLoading } = trpc.system.getModelConfig.useQuery();
  const utils = trpc.useUtils();

  const saveConfig = trpc.system.setModelConfig.useMutation({
    onSuccess: () => {
      toast.success("配置已保存");
      utils.system.getModelConfig.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "保存失败");
    },
  });

  const testConnection = trpc.system.testModelConnection.useMutation({
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        toast.success("连接测试成功");
      } else {
        toast.error(data.message || "连接测试失败");
      }
    },
    onError: (err) => {
      setTestResult({ success: false, message: err.message || "连接测试失败" });
      toast.error(err.message || "连接测试失败");
    },
  });

  useEffect(() => {
    if (config) {
      setApiKey(config.apiKey || "");
      setApiUrl(config.apiUrl || "https://forge.manus.im/v1/chat/completions");
      setModel(config.model || "gemini-2.5-flash");
      setMaxTokens(String(config.maxTokens || 32768));
    }
  }, [config]);

  const handleSave = () => {
    if (!apiKey.trim()) {
      toast.error("请输入 API Key");
      return;
    }
    if (!apiUrl.trim()) {
      toast.error("请输入 API URL");
      return;
    }
    if (!model.trim()) {
      toast.error("请输入模型名称");
      return;
    }
    const tokens = parseInt(maxTokens);
    if (isNaN(tokens) || tokens < 1024 || tokens > 128000) {
      toast.error("最大 Token 必须在 1024 - 128000 之间");
      return;
    }

    saveConfig.mutate({
      apiKey: apiKey.trim(),
      apiUrl: apiUrl.trim(),
      model: model.trim(),
      maxTokens: tokens,
    });
  };

  const handleTest = () => {
    if (!apiKey.trim()) {
      toast.error("请输入 API Key");
      return;
    }
    if (!apiUrl.trim()) {
      toast.error("请输入 API URL");
      return;
    }
    if (!model.trim()) {
      toast.error("请输入模型名称");
      return;
    }

    setTesting(true);
    setTestResult(null);
    testConnection.mutate({
      apiKey: apiKey.trim(),
      apiUrl: apiUrl.trim(),
      model: model.trim(),
    }, {
      onSettled: () => {
        setTesting(false);
      }
    });
  };

  const handleResetDefaults = () => {
    setApiKey("");
    setApiUrl("https://forge.manus.im/v1/chat/completions");
    setModel("gemini-2.5-flash");
    setMaxTokens("32768");
    setTestResult(null);
    toast.info("已恢复默认配置");
  };

  return (
    <div className="pb-8 max-w-4xl mx-auto">
      <BackButton />
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-700">系统设置</h1>
          <p className="text-muted-foreground text-sm">配置系统参数与 AI 模型</p>
        </div>
      </div>

      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="ai" className="gap-2">
            <Braces className="w-4 h-4" />
            AI 模型配置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-600" />
                API 配置
              </CardTitle>
              <CardDescription>
                配置用于 AI 评审、会议分析等功能的大语言模型 API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-muted-foreground" />
                      API Key
                    </Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="sk-..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      您的 API Key 仅存储在本地浏览器中，不会上传到服务器
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apiUrl" className="flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      API 端点 URL
                    </Label>
                    <Input
                      id="apiUrl"
                      placeholder="https://api.openai.com/v1/chat/completions"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      支持 OpenAI 兼容的 API 端点
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="model" className="flex items-center gap-1.5">
                        <Braces className="w-3.5 h-3.5 text-muted-foreground" />
                        模型名称
                      </Label>
                      <Input
                        id="model"
                        placeholder="gemini-2.5-flash"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxTokens" className="flex items-center gap-1.5">
                        <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                        最大 Token
                      </Label>
                      <Input
                        id="maxTokens"
                        type="number"
                        placeholder="32768"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(e.target.value)}
                        min={1024}
                        max={128000}
                      />
                    </div>
                  </div>

                  {testResult && (
                    <div className={cn(
                      "p-4 rounded-xl flex items-start gap-3",
                      testResult.success ? "bg-emerald-50 border border-emerald-100" : "bg-red-50 border border-red-100"
                    )}>
                      {testResult.success ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p className={cn(
                          "text-sm font-medium",
                          testResult.success ? "text-emerald-800" : "text-red-800"
                        )}>
                          {testResult.success ? "连接成功" : "连接失败"}
                        </p>
                        <p className={cn(
                          "text-xs mt-1",
                          testResult.success ? "text-emerald-700" : "text-red-700"
                        )}>
                          {testResult.message}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleResetDefaults}
                disabled={saveConfig.isPending || testing}
              >
                恢复默认
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={saveConfig.isPending || testing || isLoading}
                  className="gap-2"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  测试连接
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saveConfig.isPending || testing || isLoading}
                  className="gap-2"
                >
                  {saveConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  保存配置
                </Button>
              </div>
            </CardFooter>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>支持的模型</CardTitle>
              <CardDescription>
                推荐使用支持多模态的模型以获得最佳的设计稿评审效果
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                  <p className="text-sm font-medium text-indigo-900">✅ 最佳选择</p>
                  <p className="text-xs text-indigo-700 mt-1">gemini-2.5-flash (推荐，免费，多模态，支持图片分析)</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <p className="text-sm font-medium">GPT-4o / GPT-4o-mini (支持多模态，OpenAI)</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <p className="text-sm font-medium">Claude 3 Opus / Sonnet (支持多模态，Anthropic)</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <p className="text-sm font-medium">通义千问 Qwen-VL / 千问2.5 (阿里，支持多模态)</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <p className="text-sm font-medium">文心一言 ERNIE 4.0 (百度，支持多模态)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}