import { z } from "zod";

// Agent interpret request validation schema
export const agentInterpretSchema = z.object({
  message: z.string().optional(),
  code: z.string().optional(),
  language: z.enum(['python', 'javascript', 'typescript']).default('python'),
}).refine(
  (data) => data.message || data.code,
  {
    message: "Either message or code is required",
    path: ["message"],
  }
);

export type AgentInterpretSchema = z.infer<typeof agentInterpretSchema>;