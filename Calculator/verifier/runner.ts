// Subprocess runner — the ONLY impure part of the verifier.
// Shells to `claude -p --model <m>` so the model is a swappable flag and we ride
// existing Claude Code auth (no ANTHROPIC_API_KEY to manage).
// See Calculator/decisions/ADR-001.

import { spawn } from 'node:child_process';

export type ModelRunner = (model: string, prompt: string) => Promise<string>;

export const claudeRunner: ModelRunner = (model, prompt) =>
  new Promise((resolve, reject) => {
    const child = spawn('claude', ['-p', '--model', model], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude -p exited ${code}: ${stderr.trim()}`));
        return;
      }
      resolve(stdout);
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
