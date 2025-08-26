import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { z } from 'zod';

// File validation schema with 5MB limit
const fileUploadSchema = z.object({
  files: z.array(
    z.object({
      name: z.string().min(1, "File name is required"),
      size: z.number().max(5 * 1024 * 1024, "File size must be less than 5MB"),
      type: z.string().min(1, "File type is required"),
    })
  ).min(1, "At least one file is required").max(10, "Maximum 10 files allowed"),
});

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    await requireApiAuth();

    // Parse form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid form data' },
        { status: 400 }
      );
    }

    // Extract files from form data
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate files
    const filesData = files.map(file => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    try {
      fileUploadSchema.parse({ files: filesData });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    // Process files for agent context
    const processedFiles = [];

    for (const file of files) {
      // Read file content
      const buffer = await file.arrayBuffer();
      const content = new TextDecoder().decode(buffer);

      // Store file metadata and content for agent context
      processedFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        content: file.type.startsWith('text/') || file.type.includes('json') ? content : null,
        base64: !file.type.startsWith('text/') && !file.type.includes('json') ?
          Buffer.from(buffer).toString('base64') : null,
      });
    }

    return NextResponse.json({
      success: true,
      files: processedFiles.map(f => ({
        name: f.name,
        type: f.type,
        size: f.size,
        processed: true,
      })),
      message: `Successfully processed ${processedFiles.length} file${processedFiles.length > 1 ? 's' : ''}`,
    });

  } catch (error) {
    console.error('File upload error:', error);

    // Handle specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      { error: 'File upload failed', details: errorMessage },
      { status: 500 }
    );
  }
}