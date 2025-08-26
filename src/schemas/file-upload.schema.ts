import { z } from "zod";

// File upload validation schema with 5MB limit
export const fileUploadSchema = z.object({
  files: z.array(
    z.object({
      name: z.string().min(1, "File name is required"),
      size: z.number().max(5 * 1024 * 1024, "File size must be less than 5MB"),
      type: z.string().min(1, "File type is required"),
    })
  ).min(1, "At least one file is required").max(10, "Maximum 10 files allowed"),
});

export type FileUploadSchema = z.infer<typeof fileUploadSchema>;