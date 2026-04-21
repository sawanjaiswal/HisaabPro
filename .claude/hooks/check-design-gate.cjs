#!/usr/bin/env node

/**
 * check-design-gate.js — Mechanical gate for /hp-design skill invocation.
 *
 * Usage: node check-design-gate.js <file-path>
 * Exit 0 = allow, 2 = block (with stderr message).
 *
 * Called from ~/.claude/hooks/pre-tool-gate.sh for Write/Edit to UI files.
 * Reads gating rules from .claude/design-system.config.cjs (SSOT).
 *
 * Logic:
 *   1. Check if file path matches gatedPathPatterns (UI files).
 *   2. Check if file path matches exemptPathPatterns (tests/stories/config) → allow.
 *   3. Check if .claude/design-session-active exists and mtime < ttlMinutes ago → allow.
 *   4. Check that an approved plan file exists and is fresh → allow.
 *   5. Otherwise → block.
 *
 * Skill's Phase 0 writes the marker file (touch). Marker auto-expires.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = '/Users/sawanjaiswal/Projects/HisaabPro';

let config;
try {
  config = require(path.join(PROJECT_ROOT, '.claude', 'design-system.config.cjs'));
} catch (err) {
  process.exit(0); // fail open on infra errors
}

const { SESSION_GATE } = config;
if (!SESSION_GATE) process.exit(0);

const rawPath = process.argv[2] || '';
if (!rawPath) process.exit(0);

const relPath = rawPath.startsWith(PROJECT_ROOT + '/')
  ? rawPath.slice(PROJECT_ROOT.length + 1)
  : rawPath.replace(/^\.\//, '');

const isGated = SESSION_GATE.gatedPathPatterns.some((re) => re.test(relPath));
if (!isGated) process.exit(0);

const isExempt = SESSION_GATE.exemptPathPatterns.some((re) => re.test(relPath));
if (isExempt) process.exit(0);

// ── Check 1: session marker (proof /hp-design was invoked) ──────────────
const markerPath = path.join(PROJECT_ROOT, SESSION_GATE.markerFile);
let markerStat;
try {
  markerStat = fs.statSync(markerPath);
} catch {
  markerStat = null;
}

const ttlMs = (SESSION_GATE.ttlMinutes || 60) * 60 * 1000;
const now = Date.now();
const markerFresh = markerStat && (now - markerStat.mtimeMs) < ttlMs;

if (!markerFresh) {
  const reason = markerStat ? 'expired (older than TTL)' : 'not found';
  process.stderr.write(
    `ERROR [design-gate]: UI file '${relPath}' cannot be written without /hp-design skill invocation.\n` +
    `  Marker: ${SESSION_GATE.markerFile} (${reason})\n` +
    `  TTL: ${SESSION_GATE.ttlMinutes} minutes\n` +
    `  Fix: Invoke /hp-design (or /design) in this session. Skill's Phase 0 will touch the marker.\n` +
    `  Override (break-glass): touch '${markerPath}' (bypasses the gate for ${SESSION_GATE.ttlMinutes} min).\n` +
    `  Config: .claude/design-system.config.cjs → SESSION_GATE\n`
  );
  process.exit(2);
}

// ── Check 2: approved plan file (proof Phase 1 + Phase 2 completed) ─────
if (SESSION_GATE.planFile) {
  const planPath = path.join(PROJECT_ROOT, SESSION_GATE.planFile);
  let planStat;
  try {
    planStat = fs.statSync(planPath);
  } catch {
    planStat = null;
  }

  const planTtlMs = (SESSION_GATE.planTtlMinutes || SESSION_GATE.ttlMinutes || 60) * 60 * 1000;
  const planFresh = planStat && (now - planStat.mtimeMs) < planTtlMs;

  if (!planFresh) {
    const reason = planStat ? 'expired (older than TTL)' : 'not found';
    process.stderr.write(
      `ERROR [design-gate]: UI file '${relPath}' needs an approved plan before write.\n` +
      `  Plan: ${SESSION_GATE.planFile} (${reason})\n` +
      `  TTL: ${SESSION_GATE.planTtlMinutes} minutes\n` +
      `  Fix: Complete /hp-design Phase 1 (ANALYZE) + Phase 2 (PLAN). Skill writes the plan.\n` +
      `  Config: .claude/design-system.config.cjs → SESSION_GATE.planFile\n`
    );
    process.exit(2);
  }

  const required = SESSION_GATE.requiredPlanStatus || 'approved';
  const content = fs.readFileSync(planPath, 'utf-8');
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
  const statusLine = fm && fm[1].match(/^status:\s*([^\s#]+)/m);
  const status = statusLine ? statusLine[1].trim() : '';

  if (status !== required) {
    process.stderr.write(
      `ERROR [design-gate]: UI file '${relPath}' — plan not approved.\n` +
      `  Plan file: ${SESSION_GATE.planFile}\n` +
      `  Current status: ${status || '(none)'} — required: ${required}\n` +
      `  Fix: Finish /hp-design Phase 2 (user approves checklist). Skill flips status → approved.\n` +
      `  Override (break-glass): set 'status: approved' in the plan frontmatter manually.\n`
    );
    process.exit(2);
  }
}

process.exit(0);
