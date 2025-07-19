#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Auto-converts literature markdown files with multiple newlines to <br> tags
 * Processes all files in drafts folder and moves them to blog folder
 */

const DRAFTS_DIR = path.join(__dirname, '../../src/content/drafts');
const BLOG_DIR = path.join(__dirname, '../../src/content/blog');

function generateFrontmatter(content, filename) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  
  // If no frontmatter at all, create one from scratch
  if (!frontmatterMatch) {
    // Try to extract title from first heading or filename
    const firstHeadingMatch = content.match(/^#\s+(.+)$/m);
    const title = firstHeadingMatch ? firstHeadingMatch[1] : filename.replace('.md', '').replace(/-/g, ' ');
    
    // Get first paragraph for description
    const firstParaMatch = content.match(/^(?!#)(.{1,150})/m);
    const description = firstParaMatch ? firstParaMatch[1].trim().replace(/\n/g, ' ') : title;
    
    const frontmatter = `---
title: "${title}"
description: "${description}"
pubDate: ${new Date().toISOString().split('T')[0]}
pageType: literature
---\n\n`;
    
    return { content: frontmatter + content, generated: true };
  }
  
  // If frontmatter exists, check what's missing and add it
  let frontmatterContent = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length);
  let modified = false;
  
  // Add missing title
  if (!/title:/.test(frontmatterContent)) {
    const firstHeadingMatch = body.match(/^#\s+(.+)$/m);
    const title = firstHeadingMatch ? firstHeadingMatch[1] : filename.replace('.md', '').replace(/-/g, ' ');
    frontmatterContent += `\ntitle: "${title}"`;
    modified = true;
  }
  
  // Add missing description
  if (!/description:/.test(frontmatterContent)) {
    const firstParaMatch = body.match(/^(?!#)(.{1,150})/m);
    const titleMatch = frontmatterContent.match(/title:\s*"?(.+?)"?$/m);
    const description = firstParaMatch ? firstParaMatch[1].trim().replace(/\n/g, ' ') : 
                       titleMatch ? titleMatch[1] : filename.replace('.md', '');
    frontmatterContent += `\ndescription: "${description}"`;
    modified = true;
  }
  
  // Add missing pubDate
  if (!/pubDate:/.test(frontmatterContent)) {
    frontmatterContent += `\npubDate: ${new Date().toISOString().split('T')[0]}`;
    modified = true;
  }
  
  // Add pageType if missing and it looks like a literature piece
  if (!/pageType:/.test(frontmatterContent)) {
    // Simple heuristic: if it has line breaks or poetic structure, assume literature
    const hasLineBreaks = body.includes('\n\n\n') || body.includes('<br>');
    if (hasLineBreaks) {
      frontmatterContent += `\npageType: literature`;
      modified = true;
    }
  }
  
  if (modified) {
    return { content: `---\n${frontmatterContent}\n---` + body, generated: true };
  }
  
  return { content, generated: false };
}

function convertNewlines(content) {
  // Check if it's a literature page
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { converted: false, content };
  }
  
  const frontmatterContent = frontmatterMatch[1];
  if (!frontmatterContent.includes('pageType: literature')) {
    return { converted: false, content };
  }
  
  // Split content into frontmatter and body
  const frontmatter = frontmatterMatch[0];
  const body = content.slice(frontmatter.length);
  
  // Convert multiple newlines to <br> tags
  // This regex finds 3 or more consecutive newlines
  const convertedBody = body.replace(/\n{3,}/g, (match) => {
    const newlineCount = match.length;
    // Keep two newlines for paragraph break, convert the rest to <br>
    const brCount = newlineCount - 2;
    return '\n\n' + '<br>'.repeat(brCount) + '\n';
  });
  
  return { 
    converted: true, 
    content: frontmatter + convertedBody 
  };
}

async function processFiles() {
  try {
    // Ensure directories exist
    if (!fs.existsSync(DRAFTS_DIR)) {
      fs.mkdirSync(DRAFTS_DIR, { recursive: true });
      console.log('Created drafts directory');
    }
    
    // Get all markdown files from drafts
    const files = fs.readdirSync(DRAFTS_DIR)
      .filter(file => file.endsWith('.md'));
    
    if (files.length === 0) {
      console.log('No markdown files found in drafts folder');
      return;
    }
    
    console.log(`Found ${files.length} markdown file(s) to process`);
    
    for (const file of files) {
      const sourcePath = path.join(DRAFTS_DIR, file);
      const destPath = path.join(BLOG_DIR, file);
      
      console.log(`\nProcessing: ${file}`);
      
      // Read the file
      let content = fs.readFileSync(sourcePath, 'utf-8');
      
      // Generate/fix frontmatter if needed
      const { content: contentWithFrontmatter, generated } = generateFrontmatter(content, file);
      content = contentWithFrontmatter;
      
      if (generated) {
        console.log(`  ✓ Generated/fixed frontmatter`);
      }
      
      // Convert if it's a literature page
      const { converted, content: processedContent } = convertNewlines(content);
      
      if (converted) {
        console.log(`  ✓ Converted newlines for literature page`);
      } else {
        console.log(`  - Not a literature page, copying as-is`);
      }
      
      // Write to blog directory
      fs.writeFileSync(destPath, processedContent, 'utf-8');
      console.log(`  ✓ Moved to blog directory`);
      
      // Remove from drafts
      fs.unlinkSync(sourcePath);
      console.log(`  ✓ Removed from drafts`);
    }
    
    console.log(`\n✅ Successfully processed ${files.length} file(s)`);
    
  } catch (error) {
    console.error('Error processing files:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  processFiles();
}

export { processFiles };