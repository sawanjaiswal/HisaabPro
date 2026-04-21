#!/usr/bin/env node
/**
 * Add space-y-6 (24px gap) wrapper to page containers
 * Ensures 24px gap between major sections
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      } else if (item.endsWith('.tsx') && !item.endsWith('.test.tsx') && item.endsWith('Page.tsx')) {
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

  // Add space-y-6 to flex page containers that don't already have it
  // Look for: className="...page..." with display flex
  content = content.replace(
    /className="([^"]*(?:page|container)[^"]*)"(?![\s\S]*space-y-6)/g,
    (match, classes) => {
      // Only add if it contains 'flex' or 'space-y' is not present and it's a page/container
      if ((classes.includes('flex') || classes.includes('-page') || classes.includes('container')) && !classes.includes('space-y')) {
        // Add space-y-6 if not already present
        return `className="${classes} space-y-6"`;
      }
      return match;
    }
  );

  // For pages without explicit flex, wrap section content in space-y-6
  // This is more conservative - only for pages with multiple major divs

  if (modified !== (content !== originalContent)) {
    modified = true;
  }

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
console.log(`\n✅ Added space-y-6 gap wrapper to ${fixed} page containers`);
