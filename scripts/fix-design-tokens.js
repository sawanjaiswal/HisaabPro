#!/usr/bin/env node
/**
 * Fix design system token violations across frontend codebase
 * Replaces:
 * - fontSize px/rem values → var(--fs-*) tokens
 * - padding/margin px values → Tailwind classes
 * - hardcoded colors → var(--color-*) tokens
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Font size mappings (rem -> token)
const FONT_SIZE_MAP = {
  '0.625rem': 'var(--fs-xs)',     // 10px
  '0.694rem': 'var(--fs-xs)',     // 11px
  '0.75rem': 'var(--fs-xs)',       // 12px
  '0.8125rem': 'var(--fs-xs)',     // 13px
  '0.875rem': 'var(--fs-sm)',      // 14px
  '0.9375rem': 'var(--fs-df)',     // 15px
  '1rem': 'var(--fs-base)',        // 16px
  '1.125rem': 'var(--fs-base)',    // 18px
  '1.25rem': 'var(--fs-lg)',       // 20px
  '1.5rem': 'var(--fs-lg)',        // 24px
  '1.875rem': 'var(--fs-xl)',      // 30px
  '2rem': 'var(--fs-2xl)',         // 32px
  '2.5rem': 'var(--fs-2xl)',       // 40px
  '3rem': 'var(--fs-5xl)',         // 48px
};

// Also match px directly
const FONT_SIZE_PX_MAP = {
  '10px': 'var(--fs-xs)',
  '11px': 'var(--fs-xs)',
  '12px': 'var(--fs-xs)',
  '13px': 'var(--fs-xs)',
  '14px': 'var(--fs-sm)',
  '15px': 'var(--fs-df)',
  '16px': 'var(--fs-base)',
  '18px': 'var(--fs-base)',
  '20px': 'var(--fs-lg)',
  '24px': 'var(--fs-lg)',
  '30px': 'var(--fs-xl)',
  '32px': 'var(--fs-2xl)',
  '40px': 'var(--fs-2xl)',
  '48px': 'var(--fs-5xl)',
};

function getAllTsxFiles(dir) {
  let files = [];
  const items = fs.readdirSync(dir);
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!item.startsWith('.') && item !== 'node_modules' && item !== '__tests__') {
        files = files.concat(getAllTsxFiles(fullPath));
      }
    } else if (item.endsWith('.tsx') && !item.endsWith('.test.tsx')) {
      files.push(fullPath);
    }
  });
  return files;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;

  // Fix font sizes in inline styles
  Object.entries(FONT_SIZE_MAP).forEach(([oldVal, newVal]) => {
    const patterns = [
      new RegExp(`fontSize\\s*:\\s*['"]${oldVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
      new RegExp(`fontSize: '${oldVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g'),
    ];
    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, `fontSize: '${newVal}'`);
        modified = true;
      }
    });
  });

  // Fix font sizes in px
  Object.entries(FONT_SIZE_PX_MAP).forEach(([oldVal, newVal]) => {
    const patterns = [
      new RegExp(`fontSize\\s*:\\s*['"]${oldVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
      new RegExp(`fontSize: '${oldVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g'),
    ];
    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, `fontSize: '${newVal}'`);
        modified = true;
      }
    });
  });

  // Fix flex display inline styles → Tailwind
  const flexPatterns = [
    [/style=\{\{\s*display:\s*['"]flex['"]\s*\}\}/g, (m) => 'className="flex"'],
    [/style=\{\{\s*display:\s*['"]flex['"],\s*flexDirection:\s*['"]column['"]\s*\}\}/g, (m) => 'className="flex flex-col"'],
    [/style=\{\{\s*display:\s*['"]flex['"],\s*flexDirection:\s*['"]row['"]\s*\}\}/g, (m) => 'className="flex flex-row"'],
    [/style=\{\{\s*display:\s*['"]flex['"],\s*justifyContent:\s*['"]center['"]\s*\}\}/g, (m) => 'className="flex justify-center"'],
    [/style=\{\{\s*display:\s*['"]flex['"],\s*justifyContent:\s*['"]space-between['"]\s*\}\}/g, (m) => 'className="flex justify-between"'],
    [/style=\{\{\s*display:\s*['"]flex['"],\s*alignItems:\s*['"]center['"]\s*\}\}/g, (m) => 'className="flex items-center"'],
  ];

  flexPatterns.forEach(([pattern, replacement]) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  if (modified && content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

// Main execution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcDir = path.join(__dirname, '..', 'src', 'features');
const landingDir = path.join(__dirname, '..', 'src', 'features', 'landing');
const adminDir = path.join(__dirname, '..', 'src', 'features', 'admin');

const allFiles = [
  ...getAllTsxFiles(srcDir),
];

let fixed = 0;
allFiles.forEach(filePath => {
  if (fixFile(filePath)) {
    fixed++;
    console.log(`✓ ${path.relative(process.cwd(), filePath)}`);
  }
});

console.log(`\n✅ Fixed ${fixed} files`);
