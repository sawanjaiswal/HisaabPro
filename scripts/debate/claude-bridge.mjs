#!/usr/bin/env node
/**
 * scripts/debate/claude-bridge.mjs
 *
 * Permanent Bidirectional Agent Bridge: Antigravity (AGV) <-> Claude Code.
 * 
 * Usage:
 *   node scripts/debate/claude-bridge.mjs <file-to-audit> [focus-prompt]
 *   node scripts/debate/claude-bridge.mjs --prompt "Your question here"
 * 
 * Flags:
 *   --output <path>    Specify destination markdown file for Claude's response.
 *   --audit <file>     Audit a specific file against codebase standards.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARGS = process.argv.slice(2);
const BRIDGE_DIR = path.resolve('.agent_debate');

if (!fs.existsSync(BRIDGE_DIR)) {
  fs.mkdirSync(BRIDGE_DIR, { recursive: true });
}

let targetFile = null;
let promptText = '';
let outputFile = path.join(BRIDGE_DIR, 'claude_audit_result.md');

for (let i = 0; i < ARGS.length; i++) {
  if (ARGS[i] === '--output' && ARGS[i + 1]) {
    outputFile = path.resolve(ARGS[++i]);
  } else if (ARGS[i] === '--prompt' && ARGS[i + 1]) {
    promptText = ARGS[++i];
  } else if (!targetFile && !ARGS[i].startsWith('--')) {
    targetFile = ARGS[i];
  }
}

if (!targetFile && !promptText) {
  console.log(`
Usage:
  node scripts/debate/claude-bridge.mjs <file-path> [instructions]
  node scripts/debate/claude-bridge.mjs --prompt "your question"
  `);
  process.exit(1);
}

let fileContent = '';
if (targetFile) {
  const resolved = path.resolve(targetFile);
  if (!fs.existsSync(resolved)) {
    console.error(`Error: File not found at ${resolved}`);
    process.exit(1);
  }
  fileContent = fs.readFileSync(resolved, 'utf8');
}

const systemPreamble = `You are Claude Code performing an adversarial technical audit and architecture debate in collaboration with Antigravity (AGV) in HisaabPro.
Review the provided plan with brutal honesty, rigorous technical precision, and zero corporate fluff.
Focus on:
1. Architectural purity: Is this true Level 6 SSOT or a surface patch? Does it eliminate the entire class of visual and behavioral drift?
2. Usability & edge cases: mobile 375px/320px viewport, touch targets (>=44px), keyboard navigation, focus states, clear button behavior, barcode scanner integration.
3. Performance & regressions: re-render overhead, debounced inputs, backwards compatibility with existing forms and pages.
4. Final verdict: Is this ready to build (APPROVED) or does it need changes (REVISE)? Provide specific counter-proposals if needed.`;

const fullPrompt = `${systemPreamble}

${targetFile ? `### FILE UNDER REVIEW: ${targetFile}\n\`\`\`markdown\n${fileContent}\n\`\`\`\n` : ''}
${promptText ? `### ADDITIONAL INSTRUCTIONS / CONTEXT:\n${promptText}` : ''}
`;

const tempPromptFile = path.join(BRIDGE_DIR, 'current_prompt.txt');
fs.writeFileSync(tempPromptFile, fullPrompt, 'utf8');

console.log(`[CLAUDE BRIDGE] Sending audit request to Claude Code...`);
if (targetFile) console.log(`[CLAUDE BRIDGE] Target File: ${targetFile}`);

try {
  const result = execSync(`cat "${tempPromptFile}" | claude -p -`, {
    maxBuffer: 20 * 1024 * 1024,
    encoding: 'utf8',
    cwd: process.cwd()
  });

  fs.writeFileSync(outputFile, result.trim(), 'utf8');
  console.log(`[CLAUDE BRIDGE] Response saved to: ${outputFile}\n`);
  console.log(result.trim());
} catch (error) {
  console.error('[CLAUDE BRIDGE] Execution error:', error.message);
  process.exit(1);
}
