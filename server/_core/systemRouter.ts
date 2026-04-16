import { z } from "zod";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, protectedProcedure, router } from "./trpc";
import { demoStore } from "./inMemoryStore";
import { invokeLLM } from "./llm";

export const systemRouter = router({
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(() => ({
      ok: true,
    })),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),

  // Model configuration
  getModelConfig: protectedProcedure.query(async () => {
    return demoStore.getModelConfig();
  }),

  setModelConfig: protectedProcedure
    .input(z.object({
      apiKey: z.string().optional(),
      apiUrl: z.string().url().optional(),
      model: z.string().min(1).optional(),
      maxTokens: z.number().int().min(1024).max(128000).optional(),
    }))
    .mutation(async ({ input }) => {
      const config = demoStore.setModelConfig(input);
      return { success: true, config };
    }),

  testModelConnection: protectedProcedure
    .input(z.object({
      apiKey: z.string(),
      apiUrl: z.string().url(),
      model: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      try {
        // Test with the user-provided config
        await invokeLLM(
          {
            messages: [
              { role: "system", content: "You are a helpful assistant. Reply with only \"OK\"." },
              { role: "user", content: "Say OK" },
            ],
            maxTokens: 10,
          },
          { apiKey: input.apiKey, apiUrl: input.apiUrl, model: input.model }
        );
        return { success: true, message: "连接成功" };
      } catch (e: any) {
        return { success: false, message: e.message || "连接失败" };
      }
    }),
});
