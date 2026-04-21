#!/usr/bin/env node
/**
 * Comprehensive design system fix script
 * Fixes all inline styles to use design tokens
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontSizeMap = {
  '0.5rem': 'var(--fs-xs)',
  '0.5625rem': 'var(--fs-xs)',
  '0.625rem': 'var(--fs-xs)',
  '0.694rem': 'var(--fs-xs)',
  '0.75rem': 'var(--fs-xs)',
  '0.8125rem': 'var(--fs-xs)',
  '0.833rem': 'var(--fs-sm)',
  '0.875rem': 'var(--fs-sm)',
  '0.9375rem': 'var(--fs-df)',
  '1rem': 'var(--fs-base)',
  '1.0625rem': 'var(--fs-base)',
  '1.125rem': 'var(--fs-base)',
  '1.25rem': 'var(--fs-lg)',
  '1.375rem': 'var(--fs-lg)',
  '1.5rem': 'var(--fs-lg)',
  '1.75rem': 'var(--fs-xl)',
  '1.875rem': 'var(--fs-xl)',
  '2rem': 'var(--fs-2xl)',
  '2.25rem': 'var(--fs-2xl)',
  '2.5rem': 'var(--fs-2xl)',
  '3rem': 'var(--fs-5xl)',
};

const pxFontSizeMap = {
  '8px': 'var(--fs-xs)',
  '10px': 'var(--fs-xs)',
  '11px': 'var(--fs-xs)',
  '12px': 'var(--fs-xs)',
  '13px': 'var(--fs-xs)',
  '14px': 'var(--fs-sm)',
  '15px': 'var(--fs-df)',
  '16px': 'var(--fs-base)',
  '17px': 'var(--fs-base)',
  '18px': 'var(--fs-base)',
  '20px': 'var(--fs-lg)',
  '22px': 'var(--fs-lg)',
  '24px': 'var(--fs-lg)',
  '28px': 'var(--fs-xl)',
  '30px': 'var(--fs-xl)',
  '32px': 'var(--fs-2xl)',
  '36px': 'var(--fs-2xl)',
  '40px': 'var(--fs-2xl)',
  '48px': 'var(--fs-5xl)',
};

const spacingMap = {
  '2px': 'px-0.5',
  '4px': 'px-1',
  '6px': 'px-1.5',
  '8px': 'px-2',
  '12px': 'px-3',
  '16px': 'px-4',
  '20px': 'px-5',
  '24px': 'px-6',
};

function getAllTsxFiles(dir) {
  let files = [];
  try {
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
  } catch (e) {
    // ignore
  }
  return files;
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let modified = false;

  // Fix font sizes (rem values)
  Object.entries(fontSizeMap).forEach(([oldVal, newVal]) => {
    const escapedOld = oldVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`fontSize\\s*:\\s*['"]${escapedOld}['"]`, 'g'),
      new RegExp(`fontSize:\\s*['"]${escapedOld}['"]`, 'g'),
    ];
    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, `fontSize: '${newVal}'`);
        modified = true;
      }
    });
  });

  // Fix font sizes (px values)
  Object.entries(pxFontSizeMap).forEach(([oldVal, newVal]) => {
    const escapedOld = oldVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`fontSize\\s*:\\s*['"]${escapedOld}['"]`, 'g'),
      new RegExp(`fontSize:\\s*['"]${escapedOld}['"]`, 'g'),
    ];
    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        content = content.replace(pattern, `fontSize: '${newVal}'`);
        modified = true;
      }
    });
  });

  // Replace style={{ display: 'flex' }} patterns with className
  const flexDisplayPatterns = [
    [/style=\{\{\s*display:\s*['"]flex['"]\s*(?:,\s*)?flex[Dd]irection:\s*['"]column['"]\s*\}\}/g, 'className="flex flex-col"'],
    [/style=\{\{\s*display:\s*['"]flex['"]\s*(?:,\s*)?flex[Dd]irection:\s*['"]row['"]\s*\}\}/g, 'className="flex flex-row"'],
    [/style=\{\{\s*display:\s*['"]flex['"]\s*(?:,\s*)?justifyContent:\s*['"]center['"]\s*\}\}/g, 'className="flex justify-center"'],
    [/style=\{\{\s*display:\s*['"]flex['"]\s*(?:,\s*)?justifyContent:\s*['"]space-between['"]\s*\}\}/g, 'className="flex justify-between"'],
    [/style=\{\{\s*display:\s*['"]flex['"]\s*(?:,\s*)?alignItems:\s*['"]center['"]\s*\}\}/g, 'className="flex items-center"'],
    [/style=\{\{\s*display:\s*['"]flex['"]\s*\}\}/g, 'className="flex"'],
  ];

  flexDisplayPatterns.forEach(([pattern, replacement]) => {
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

// Execute
const srcDir = path.join(__dirname, '..', 'src');
const allFiles = getAllTsxFiles(srcDir);

let fixed = 0;
const fixedFiles = [];

allFiles.forEach(filePath => {
  if (fixFile(filePath)) {
    fixed++;
    fixedFiles.push(path.relative(process.cwd(), filePath));
  }
});

fixedFiles.sort().forEach(f => console.log(`✓ ${f}`));
console.log(`\n✅ Fixed ${fixed} additional files`);
