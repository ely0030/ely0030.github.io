#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

/**
 * Converts multiple consecutive newlines in literature markdown files to <br> tags
 * Usage: node src/utils/convert-newlines.js <file-path>
 * Example: node src/utils/convert-newlines.js "src/content/blog/yin copy.md"
 */

function convertNewlines(filePath) {
  try {
    // Read the file
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if it's a literature page
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
      console.log('No frontmatter found in file');
      return;
    }
    
    const frontmatterContent = frontmatterMatch[1];
    if (!frontmatterContent.includes('pageType: literature')) {
      console.log('Not a literature page, skipping conversion');
      return;
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
    
    // Write the converted content back
    const newContent = frontmatter + convertedBody;
    
    // Create backup
    const backupPath = filePath + '.backup';
    fs.copyFileSync(filePath, backupPath);
    console.log(`Created backup at: ${backupPath}`);
    
    // Write the new content
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Converted ${filePath} successfully!`);
    console.log('Multiple newlines have been converted to <br> tags.');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Get file path from command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node src/utils/convert-newlines.js <file-path>');
  console.log('Example: node src/utils/convert-newlines.js "src/content/blog/yin copy.md"');
  process.exit(1);
}

const filePath = path.resolve(args[0]);
convertNewlines(filePath);