#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workerPath = path.join(process.cwd(), '.open-next', 'worker.js');

console.log('Patching worker to export Durable Objects...');

let workerContent = fs.readFileSync(workerPath, 'utf8');

if (!workerContent.includes('export { Sandbox }')) {
  const sandboxExport = `
import { Sandbox } from '@cloudflare/sandbox';
export { Sandbox };
`;

  workerContent += sandboxExport;
  fs.writeFileSync(workerPath, workerContent);
  console.log('✓ Added Sandbox Durable Object export');
} else {
  console.log('✓ Sandbox already exported');
}

console.log('Worker patching complete!');