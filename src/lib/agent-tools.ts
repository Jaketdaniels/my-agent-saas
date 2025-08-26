import { z } from 'zod';

export const tools = {
  executeCode: {
    description: "Execute Python or JavaScript code",
    parameters: z.object({
      code: z.string(),
      language: z.enum(['python', 'javascript']).default('python')
    })
  },

  analyzeData: {
    description: "Analyze data from uploaded files",
    parameters: z.object({
      operation: z.string(),
      fileData: z.string().optional()
    })
  },

  generateChart: {
    description: "Generate charts and visualizations",
    parameters: z.object({
      chartType: z.enum(['bar', 'line', 'scatter', 'pie']),
      data: z.string(),
      title: z.string().optional()
    })
  }
};
