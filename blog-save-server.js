#!/usr/bin/env node

// Simple Express server for saving blog posts during development
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Enable CORS for development
app.use((req, res, next) => {
  // Allow requests from any origin on port 4321 (Astro dev server)
  const origin = req.headers.origin;
  if (origin && (origin.includes(':4321') || origin === 'http://localhost:4321')) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Handle preflight requests
app.options('/api/save-blog-post', (req, res) => {
  res.sendStatus(200);
});

app.options('/api/delete-blog-post', (req, res) => {
  res.sendStatus(200);
});

// API endpoint to save blog posts
app.post('/api/save-blog-post', async (req, res) => {
  try {
    const { filename, content } = req.body;
    
    console.log(`📥 Received save request for: ${filename}`);
    console.log(`📝 Content length: ${content ? content.length : 0} characters`);
    
    if (!filename || !content) {
      console.error('❌ Missing filename or content');
      return res.status(400).json({ error: 'Missing filename or content' });
    }
    
    // Ensure filename ends with .md
    const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
    
    // Handle subdirectories - split path and filename
    const pathParts = safeFilename.split('/');
    const actualFilename = pathParts.pop(); // Get the last part as filename
    const subdirectory = pathParts.join('/'); // Rest is subdirectory
    
    // Sanitize only the filename part, preserve directory structure
    const sanitized = actualFilename.replace(/[^a-z0-9-_.]/gi, '-');
    
    // Save to blog folder
    const blogPath = path.join(__dirname, 'src', 'content', 'blog');
    let filePath;
    let displayName;
    
    if (subdirectory) {
      // Create subdirectory if it doesn't exist
      const dirPath = path.join(blogPath, subdirectory);
      await fs.mkdir(dirPath, { recursive: true });
      filePath = path.join(dirPath, sanitized);
      displayName = `${subdirectory}/${sanitized}`;
    } else {
      filePath = path.join(blogPath, sanitized);
      displayName = sanitized;
    }
    
    // Get original file stats if it exists (for preserving timestamps)
    let originalStats = null;
    try {
      originalStats = await fs.stat(filePath);
    } catch (error) {
      // File doesn't exist yet, that's okay
    }
    
    // Write the file
    await fs.writeFile(filePath, content, 'utf8');
    
    // Preserve original timestamps if this was an update
    if (originalStats) {
      await fs.utimes(filePath, originalStats.atime, originalStats.mtime);
      console.log(`✅ Updated blog post: ${displayName} (timestamps preserved)`);
    } else {
      console.log(`✅ Created new blog post: ${displayName}`);
    }
    
    // Show first few lines of content for debugging
    const lines = content.split('\n');
    console.log(`📄 First 5 lines of saved content:`);
    lines.slice(0, 5).forEach((line, i) => {
      console.log(`   ${i + 1}: ${line}`);
    });
    if (lines.length > 5) {
      console.log(`   ... (${lines.length - 5} more lines)`);
    }
    
    res.json({ 
      success: true, 
      filename: displayName,
      message: `Blog post saved as ${displayName}`
    });
  } catch (error) {
    console.error('❌ Error saving blog post:', error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to delete blog posts
app.post('/api/delete-blog-post', async (req, res) => {
  try {
    const { filename } = req.body;
    
    console.log(`🗑️  Received delete request for: ${filename}`);
    
    if (!filename) {
      console.error('❌ Missing filename');
      return res.status(400).json({ error: 'Missing filename' });
    }
    
    // Ensure filename ends with .md
    const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
    
    // Handle subdirectories - split path and filename
    const pathParts = safeFilename.split('/');
    const actualFilename = pathParts.pop();
    const subdirectory = pathParts.join('/');
    
    // Sanitize only the filename part
    const sanitized = actualFilename.replace(/[^a-z0-9-_.]/gi, '-');
    
    // Build file path
    const blogPath = path.join(__dirname, 'src', 'content', 'blog');
    let filePath;
    let displayName;
    
    if (subdirectory) {
      filePath = path.join(blogPath, subdirectory, sanitized);
      displayName = `${subdirectory}/${sanitized}`;
    } else {
      filePath = path.join(blogPath, sanitized);
      displayName = sanitized;
    }
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      console.error(`❌ File not found: ${displayName}`);
      return res.status(404).json({ error: 'Blog post not found' });
    }
    
    // Delete the file
    await fs.unlink(filePath);
    
    console.log(`🗑️  Deleted blog post: ${displayName}`);
    
    res.json({ 
      success: true, 
      filename: displayName,
      message: `Blog post ${displayName} deleted successfully`
    });
  } catch (error) {
    console.error('❌ Error deleting blog post:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start the server
const PORT = 4322;
const HOST = '0.0.0.0'; // Listen on all network interfaces

app.listen(PORT, HOST, () => {
  console.log(`📝 Blog save API running on http://${HOST}:${PORT}`);
  console.log(`🌐 Also accessible at http://localhost:${PORT}`);
  if (process.env.LOCAL_IP) {
    console.log(`📱 Network access: http://${process.env.LOCAL_IP}:${PORT}`);
  }
  console.log('✨ Ready to save blog posts!');
});