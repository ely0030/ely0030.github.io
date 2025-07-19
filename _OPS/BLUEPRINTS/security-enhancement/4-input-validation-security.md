# Blueprint: Input Validation & Security Hardening

## Overview

Implement comprehensive input validation, sanitization, and security headers to prevent XSS, injection attacks, path traversal, and other common vulnerabilities. This is often the quickest security win.

## Current Vulnerabilities

### 1. Path Traversal Risk
```javascript
// CURRENT DANGER - Can write anywhere!
const filePath = path.join(blogPath, subdirectory, sanitized);
// What if subdirectory = "../../../etc/"?
```

### 2. No Content Sanitization
```javascript
// CURRENT - Raw HTML/JS can be injected
await fs.writeFile(filePath, content, 'utf8');
// What if content contains <script>alert('XSS')</script>?
```

### 3. No Rate Limiting
```javascript
// CURRENT - Can spam API
app.post('/api/save-blog-post', async (req, res) => {
  // No limits on requests per minute
});
```

## Implementation Plan

### 1. Path Traversal Prevention

```javascript
// path-validator.js
const path = require('path');

class PathValidator {
  constructor(baseDir) {
    this.baseDir = path.resolve(baseDir);
  }

  // Validate and sanitize file paths
  validatePath(userPath) {
    // Remove any null bytes
    const cleaned = userPath.replace(/\0/g, '');
    
    // Resolve to absolute path
    const resolved = path.resolve(this.baseDir, cleaned);
    
    // Ensure it's within base directory
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error('Path traversal attempt detected');
    }
    
    // Additional checks
    const normalized = path.normalize(resolved);
    const relative = path.relative(this.baseDir, normalized);
    
    // Check for suspicious patterns
    if (relative.includes('..') || path.isAbsolute(relative)) {
      throw new Error('Invalid path');
    }
    
    return normalized;
  }

  // Validate filename
  validateFilename(filename) {
    // Allow only alphanumeric, dash, underscore, and .md extension
    const valid = /^[a-zA-Z0-9_-]+\.md$/.test(filename);
    
    if (!valid) {
      throw new Error('Invalid filename format');
    }
    
    // Check length
    if (filename.length > 255) {
      throw new Error('Filename too long');
    }
    
    // Prevent special names
    const reserved = ['con', 'prn', 'aux', 'nul', 'com1', 'lpt1'];
    const name = filename.toLowerCase().replace('.md', '');
    
    if (reserved.includes(name)) {
      throw new Error('Reserved filename');
    }
    
    return filename;
  }
}

// Usage in blog-save-server.js
const pathValidator = new PathValidator(BLOG_DIR);

app.post('/api/save-blog-post', async (req, res) => {
  try {
    const { filename, content, subdirectory } = req.body;
    
    // Validate filename
    const safeFilename = pathValidator.validateFilename(filename);
    
    // Validate path if subdirectory provided
    let safePath;
    if (subdirectory) {
      safePath = pathValidator.validatePath(
        path.join(subdirectory, safeFilename)
      );
    } else {
      safePath = path.join(BLOG_DIR, safeFilename);
    }
    
    // Now safe to save
    await fs.writeFile(safePath, content, 'utf8');
    
  } catch (error) {
    if (error.message.includes('traversal')) {
      // Log security event
      auditLog.warn('Path traversal attempt', {
        ip: req.ip,
        filename,
        subdirectory
      });
    }
    res.status(400).json({ error: error.message });
  }
});
```

### 2. Content Sanitization

```javascript
// content-sanitizer.js
const DOMPurify = require('isomorphic-dompurify');
const marked = require('marked');

class ContentSanitizer {
  constructor() {
    // Configure DOMPurify
    this.purifyConfig = {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'a', 'ul', 'ol', 'li', 'blockquote',
        'strong', 'em', 'code', 'pre', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'class',
        'id', 'data-*'
      ],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
    };
  }

  // Sanitize markdown content before saving
  sanitizeMarkdown(content) {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers
      /<iframe/i,
      /data:text\/html/i
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        throw new Error('Potentially malicious content detected');
      }
    }

    // Parse frontmatter separately
    const { frontmatter, body } = this.parseMarkdown(content);
    
    // Sanitize frontmatter values
    const sanitizedFrontmatter = this.sanitizeFrontmatter(frontmatter);
    
    // For markdown body, we'll sanitize after rendering
    // But remove obvious script tags
    const cleanBody = body
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '');

    return this.buildMarkdown(sanitizedFrontmatter, cleanBody);
  }

  // Sanitize frontmatter to prevent injection
  sanitizeFrontmatter(frontmatter) {
    const sanitized = {};
    
    for (const [key, value] of Object.entries(frontmatter)) {
      // Sanitize keys
      const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
      
      // Sanitize values based on type
      if (typeof value === 'string') {
        // Remove any HTML/script from string values
        sanitized[cleanKey] = DOMPurify.sanitize(value, {
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: []
        });
      } else if (Array.isArray(value)) {
        // Sanitize array elements
        sanitized[cleanKey] = value.map(item => 
          typeof item === 'string' 
            ? DOMPurify.sanitize(item, { ALLOWED_TAGS: [] })
            : item
        );
      } else {
        // Numbers, booleans, etc. are safe
        sanitized[cleanKey] = value;
      }
    }
    
    return sanitized;
  }

  // Sanitize HTML output (for rendering)
  sanitizeHTML(html) {
    return DOMPurify.sanitize(html, this.purifyConfig);
  }

  // Validate content size
  validateSize(content, maxSize = 1048576) { // 1MB default
    const size = Buffer.byteLength(content, 'utf8');
    
    if (size > maxSize) {
      throw new Error(`Content too large: ${size} bytes (max: ${maxSize})`);
    }
    
    return size;
  }
}

// Usage
const sanitizer = new ContentSanitizer();

app.post('/api/save-blog-post', async (req, res) => {
  try {
    const { filename, content } = req.body;
    
    // Validate size first
    sanitizer.validateSize(content);
    
    // Sanitize content
    const sanitizedContent = sanitizer.sanitizeMarkdown(content);
    
    // ... save sanitized content
    
  } catch (error) {
    if (error.message.includes('malicious')) {
      auditLog.warn('Malicious content blocked', {
        ip: req.ip,
        user: req.user?.username
      });
    }
    res.status(400).json({ error: error.message });
  }
});
```

### 3. Rate Limiting & DDOS Protection

```javascript
// rate-limiter.js
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const RedisStore = require('rate-limit-redis');

// Different limits for different endpoints
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 creates per window
  message: 'Too many posts created, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis for distributed systems
  // store: new RedisStore({ client: redisClient })
});

const saveLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 saves per minute
  message: 'Too many save requests',
  skip: (req) => req.user?.role === 'admin' // Skip for admins
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true // Don't count successful logins
});

// Progressive slow down for repeated requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 2, // Allow 2 requests per window at full speed
  delayMs: 500 // Add 500ms delay per request after delayAfter
});

// Apply limiters
app.post('/api/login', loginLimiter, authController.login);
app.post('/api/save-blog-post', saveLimiter, speedLimiter, saveController.save);
app.post('/api/create-post', createLimiter, createController.create);

// Global rate limit for all API routes
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100, // 100 requests per minute total
  standardHeaders: true
});

app.use('/api/', globalLimiter);
```

### 4. Security Headers

```javascript
// security-headers.js
const helmet = require('helmet');

// Configure Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Adjust as needed
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Additional security headers
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
});
```

### 5. Request Validation

```javascript
// request-validator.js
const { body, validationResult } = require('express-validator');

// Validation rules for blog posts
const validateBlogPost = [
  body('filename')
    .isString()
    .trim()
    .matches(/^[a-zA-Z0-9_-]+\.md$/)
    .isLength({ min: 1, max: 255 })
    .withMessage('Invalid filename'),
    
  body('content')
    .isString()
    .isLength({ min: 1, max: 1048576 }) // 1MB
    .withMessage('Content must be between 1 byte and 1MB'),
    
  body('subdirectory')
    .optional()
    .isString()
    .matches(/^[a-zA-Z0-9_\/-]+$/)
    .custom(value => !value.includes('..'))
    .withMessage('Invalid subdirectory')
];

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg
      }))
    });
  }
  
  next();
};

// Apply validation
app.post('/api/save-blog-post', 
  validateBlogPost,
  validate,
  saveController.save
);
```

### 6. File Upload Security

```javascript
// If implementing image uploads
const multer = require('multer');
const crypto = require('crypto');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate safe filename
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(16).toString('hex');
    cb(null, `${name}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow only specific image types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type'), false);
  }
  
  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  
  if (!allowedExts.includes(ext)) {
    return cb(new Error('Invalid file extension'), false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 10 // Max 10 files at once
  }
});

// Scan uploaded files
const scanFile = async (filepath) => {
  // Check magic bytes
  const buffer = await fs.readFile(filepath, { length: 12 });
  
  const signatures = {
    jpg: [0xFF, 0xD8, 0xFF],
    png: [0x89, 0x50, 0x4E, 0x47],
    gif: [0x47, 0x49, 0x46]
  };
  
  // Verify file signature matches extension
  // Implement virus scanning if needed
};
```

### 7. CORS Security

```javascript
// Strict CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://localhost:4321',
      `https://${process.env.LOCAL_IP}:4321`
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));
```

## Client-Side Security

```javascript
// In notepad.astro
class ClientSecurity {
  // Escape HTML for display
  escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Validate input before sending
  validateInput(data) {
    // Check for script tags
    if (/<script|javascript:/i.test(data.content)) {
      throw new Error('Scripts not allowed in content');
    }
    
    // Validate filename
    if (!/^[a-zA-Z0-9_-]+\.md$/.test(data.filename)) {
      throw new Error('Invalid filename format');
    }
    
    return true;
  }

  // Sanitize pasted content
  sanitizePaste(event) {
    event.preventDefault();
    
    const paste = event.clipboardData.getData('text');
    const cleaned = DOMPurify.sanitize(paste, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: []
    });
    
    document.execCommand('insertText', false, cleaned);
  }
}
```

## Security Monitoring

```javascript
// Monitor for suspicious patterns
class SecurityMonitor {
  constructor() {
    this.suspiciousPatterns = [
      /eval\(/i,
      /Function\(/i,
      /\.constructor\(/i,
      /__proto__/i,
      /document\.write/i
    ];
  }

  async analyzeThreat(content, context) {
    const threats = [];
    
    // Check patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(content)) {
        threats.push({
          type: 'suspicious_pattern',
          pattern: pattern.toString(),
          severity: 'high'
        });
      }
    }
    
    // Check for encoded payloads
    if (this.hasEncodedPayload(content)) {
      threats.push({
        type: 'encoded_payload',
        severity: 'medium'
      });
    }
    
    if (threats.length > 0) {
      await this.alertSecurity(threats, context);
    }
    
    return threats;
  }

  hasEncodedPayload(content) {
    // Check for base64 encoded scripts
    const base64Pattern = /[A-Za-z0-9+/]{40,}={0,2}/g;
    const matches = content.match(base64Pattern) || [];
    
    for (const match of matches) {
      try {
        const decoded = atob(match);
        if (/<script|javascript:/i.test(decoded)) {
          return true;
        }
      } catch (e) {
        // Not valid base64
      }
    }
    
    return false;
  }
}
```

## Testing Security

```javascript
// security-tests.js
describe('Security Tests', () => {
  test('Path traversal prevention', async () => {
    const attacks = [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32',
      'subfolder/../../../secret',
      'file.md/../../../etc'
    ];
    
    for (const attack of attacks) {
      const res = await request(app)
        .post('/api/save-blog-post')
        .send({ filename: 'test.md', subdirectory: attack });
        
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid');
    }
  });

  test('XSS prevention', async () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>'
    ];
    
    for (const payload of xssPayloads) {
      const res = await request(app)
        .post('/api/save-blog-post')
        .send({ 
          filename: 'test.md', 
          content: `# Test\n\n${payload}` 
        });
        
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('malicious');
    }
  });
});
```

## Next Steps

- Implement network security hardening
- Add private thoughts mode with enhanced validation
- Set up automated security scanning
- Create security dashboard for monitoring