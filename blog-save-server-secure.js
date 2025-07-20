#!/usr/bin/env node

// Secure Express server for saving blog posts with authentication
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '10mb' }));

// SECURITY: Get password from environment or use a strong default
const AUTH_PASSWORD = process.env.BLOG_AUTH_PASSWORD || 'change-this-immediately-' + crypto.randomBytes(16).toString('hex');
const AUTH_TOKEN = crypto.createHash('sha256').update(AUTH_PASSWORD).digest('hex');

if (!process.env.BLOG_AUTH_PASSWORD) {
  console.warn('⚠️  WARNING: Using generated password. Set BLOG_AUTH_PASSWORD environment variable!');
  console.warn(`⚠️  Generated password: ${AUTH_PASSWORD}`);
  console.warn('⚠️  Save this password - you\'ll need it to edit posts!');
}

// Rate limiting to prevent brute force attacks
const loginAttempts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || [];
  
  // Remove old attempts
  const recentAttempts = attempts.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (recentAttempts.length >= MAX_ATTEMPTS) {
    return false;
  }
  
  recentAttempts.push(now);
  loginAttempts.set(ip, recentAttempts);
  return true;
}

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  
  if (token !== AUTH_TOKEN) {
    // Log failed attempt
    console.warn(`⚠️  Failed auth attempt from IP: ${req.ip}`);
    return res.status(403).json({ error: 'Invalid credentials' });
  }
  
  next();
}

// Enable CORS for development
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin.includes(':4321') || origin === 'http://localhost:4321')) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Login endpoint with rate limiting
app.post('/api/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  
  // Check rate limit
  if (!checkRateLimit(ip)) {
    console.warn(`🚫 Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({ 
      error: 'Too many login attempts. Please try again later.' 
    });
  }
  
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }
  
  if (password === AUTH_PASSWORD) {
    console.log(`✅ Successful login from IP: ${ip}`);
    
    // Set httpOnly cookie for site-wide auth
    res.cookie('blog_auth', AUTH_TOKEN, {
      httpOnly: true,
      secure: true, // Required for HTTPS
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.json({ 
      success: true,
      token: AUTH_TOKEN 
    });
  } else {
    console.warn(`❌ Failed login attempt from IP: ${ip}`);
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  // Clear the auth cookie
  res.clearCookie('blog_auth', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict'
  });
  
  console.log('✅ User logged out');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Handle preflight requests
app.options('/api/login', (req, res) => {
  res.sendStatus(200);
});

app.options('/api/logout', (req, res) => {
  res.sendStatus(200);
});

app.options('/api/save-blog-post', (req, res) => {
  res.sendStatus(200);
});

app.options('/api/delete-blog-post', (req, res) => {
  res.sendStatus(200);
});

// PROTECTED: Save blog post
app.post('/api/save-blog-post', authenticate, async (req, res) => {
  try {
    const { filename, content } = req.body;
    
    console.log(`📥 Authenticated save request for: ${filename}`);
    
    if (!filename || !content) {
      return res.status(400).json({ error: 'Missing filename or content' });
    }
    
    // Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('~')) {
      console.error('🚫 Path traversal attempt blocked');
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Ensure filename ends with .md
    const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
    
    // Handle subdirectories - split path and filename
    const pathParts = safeFilename.split('/');
    const actualFilename = pathParts.pop();
    const subdirectory = pathParts.join('/');
    
    // Sanitize only the filename part
    const sanitized = actualFilename.replace(/[^a-z0-9-_.]/gi, '-');
    
    // Save to blog folder
    const blogPath = path.join(__dirname, 'src', 'content', 'blog');
    let filePath;
    let displayName;
    
    if (subdirectory) {
      // Validate subdirectory
      const normalizedDir = path.normalize(subdirectory);
      if (normalizedDir.startsWith('..')) {
        return res.status(400).json({ error: 'Invalid directory' });
      }
      
      const dirPath = path.join(blogPath, subdirectory);
      await fs.mkdir(dirPath, { recursive: true });
      filePath = path.join(dirPath, sanitized);
      displayName = `${subdirectory}/${sanitized}`;
    } else {
      filePath = path.join(blogPath, sanitized);
      displayName = sanitized;
    }
    
    // Final path validation
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(blogPath)) {
      console.error('🚫 Path escape attempt blocked');
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Get original file stats if it exists
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
      console.log(`✅ Updated blog post: ${displayName}`);
    } else {
      console.log(`✅ Created new blog post: ${displayName}`);
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

// PROTECTED: Delete blog post
app.post('/api/delete-blog-post', authenticate, async (req, res) => {
  try {
    const { filename } = req.body;
    
    console.log(`🗑️  Authenticated delete request for: ${filename}`);
    
    if (!filename) {
      return res.status(400).json({ error: 'Missing filename' });
    }
    
    // Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('~')) {
      console.error('🚫 Path traversal attempt blocked');
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Ensure filename ends with .md
    const safeFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
    
    // Handle subdirectories
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
    
    // Final path validation
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(blogPath)) {
      console.error('🚫 Path escape attempt blocked');
      return res.status(400).json({ error: 'Invalid file path' });
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

// Health check endpoint (no auth required)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    secure: true,
    timestamp: new Date().toISOString()
  });
});

// Start the server
const PORT = process.env.PORT || 4322;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log('🔒 SECURE Blog Save API Started');
  console.log('=====================================');
  console.log(`📝 Running on http://${HOST}:${PORT}`);
  console.log(`🌐 Also accessible at http://localhost:${PORT}`);
  if (process.env.LOCAL_IP) {
    console.log(`📱 Network access: http://${process.env.LOCAL_IP}:${PORT}`);
  }
  console.log('');
  console.log('🔐 Authentication: ENABLED');
  console.log('🚦 Rate Limiting: ENABLED (5 attempts per 15 min)');
  console.log('🛡️  Path Traversal Protection: ENABLED');
  console.log('');
  if (!process.env.BLOG_AUTH_PASSWORD) {
    console.log('⚠️  IMPORTANT: Set BLOG_AUTH_PASSWORD in .env file!');
  }
  console.log('=====================================');
});