#!/usr/bin/env node
/**
 * Apply 24px gap between sections and 0px top/bottom padding
 * - Add space-y-6 wrapper (gap-6 = 24px)
 * - Add py-0 to sections
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

  // Fix common page wrapper patterns
  // pattern: <div className="something-page ...">
  // Add space-y-6 to flex containers
  const pageWrapperPattern = /className="([^"]*(?:page|container)[^"]*)"(?!\s*space-y)/g;
  if (pageWrapperPattern.test(content)) {
    content = content.replace(/className="([^"]*(?:page|container)[^"]*)"/g, (match, classes) => {
      if (!classes.includes('space-y') && (classes.includes('flex') || classes.includes('-page') || classes.includes('container'))) {
        return `className="${classes} space-y-6"`;
      }
      return match;
    });
    modified = true;
  }

  // Remove py- classes (except py-0) from section-like divs
  const sectionPattern = /className="([^"]*(?:section|drawer|panel)[^"]*)"/g;
  if (sectionPattern.test(content)) {
    content = content.replace(/className="([^"]*(?:section|drawer|panel)[^"]*)"/g, (match, classes) => {
      // Remove py-1 through py-12 but keep other classes
      let newClasses = classes.replace(/\s*py-[1-9][0-2]?(?=\s|")/g, '');
      // Add py-0 if not already there
      if (!newClasses.includes('py-0')) {
        newClasses = newClasses.trim() + ' py-0';
      }
      return `className="${newClasses}"`;
    });
    modified = true;
  }

  // Fix section divs that have padding inline styles
  // Convert to className with py-0
  content = content.replace(/style=\{\{\s*padding[YTop|Bottom]*:\s*['"][^'"]*['"][^}]*\}\}/g, (match) => {
    // Extract other styles if they exist
    const otherStyles = match.match(/(?!padding)[a-z]+\s*:\s*['"][^'"]*['"]/g);
    if (otherStyles && otherStyles.length > 0) {
      return 'className="py-0"';
    }
    return 'className="py-0"';
  });

  // Remove mt- and mb- classes between sections (except when needed for spacing)
  content = content.replace(/\s+(mt|mb)-[1-9][0-2]?(?=\s)/g, '');

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
console.log(`\n✅ Applied 24px section spacing to ${fixed} files`);
