# Blueprint: Authentication Layer

## Overview

Implement server-side authentication to protect blog editing functions. This is the most critical security enhancement - without it, anyone on your network can modify your private thoughts.

## Current Vulnerability

```javascript
// Current blog-save-server.js - NO AUTH!
app.post('/api/save-blog-post', async (req, res) => {
  // Anyone can call this!
  const { filename, content } = req.body;
  await fs.writeFile(filePath, content, 'utf8');
});
```

## Implementation Plan

### Option 1: JWT Authentication (Recommended)

#### Why JWT?
- Stateless - no server sessions needed
- Works well with static site architecture
- Can include role/permission data
- Industry standard

#### Implementation Steps

1. **Install Dependencies**
```bash
npm install jsonwebtoken bcryptjs express-rate-limit
```

2. **Create Auth Middleware**
```javascript
// auth-middleware.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-key';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

module.exports = { authenticateToken, JWT_SECRET };
```

3. **Add Login Endpoint**
```javascript
// In blog-save-server.js
const bcrypt = require('bcryptjs');
const { authenticateToken, JWT_SECRET } = require('./auth-middleware');

// Store hashed password (in production, use database)
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('your-strong-password', 10);

app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  // Verify password
  const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Generate tokens
  const accessToken = jwt.sign(
    { username: 'admin', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  const refreshToken = jwt.sign(
    { username: 'admin', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ 
    accessToken, 
    refreshToken,
    expiresIn: 900 // 15 minutes
  });
});

// Protect all API routes
app.use('/api/save-blog-post', authenticateToken);
app.use('/api/delete-blog-post', authenticateToken);
```

4. **Add Token Refresh**
```javascript
app.post('/api/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  jwt.verify(refreshToken, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const accessToken = jwt.sign(
      { username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken });
  });
});
```

5. **Update Notepad Client**
```javascript
// In notepad.astro
class AuthManager {
  constructor() {
    this.accessToken = localStorage.getItem('access_token');
    this.refreshToken = localStorage.getItem('refresh_token');
    this.tokenExpiry = localStorage.getItem('token_expiry');
  }

  async login(password) {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    if (!response.ok) {
      throw new Error('Invalid password');
    }

    const { accessToken, refreshToken, expiresIn } = await response.json();
    
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiry = Date.now() + (expiresIn * 1000);
    
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('token_expiry', this.tokenExpiry);
  }

  async getHeaders() {
    // Check if token needs refresh
    if (Date.now() > this.tokenExpiry - 60000) { // Refresh 1 min before expiry
      await this.refreshAccessToken();
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.accessToken}`
    };
  }

  async refreshAccessToken() {
    const response = await fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    if (!response.ok) {
      // Refresh failed, need to login again
      this.logout();
      throw new Error('Session expired. Please login again.');
    }

    const { accessToken } = await response.json();
    this.accessToken = accessToken;
    this.tokenExpiry = Date.now() + (15 * 60 * 1000); // 15 minutes
    
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('token_expiry', this.tokenExpiry);
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expiry');
  }
}

// Update save functions to use auth
async function saveBlogPost(filename, content) {
  const headers = await authManager.getHeaders();
  
  const response = await fetch('/api/save-blog-post', {
    method: 'POST',
    headers,
    body: JSON.stringify({ filename, content })
  });

  if (response.status === 401 || response.status === 403) {
    // Show login prompt
    showLoginModal();
    return;
  }

  // ... rest of save logic
}
```

### Option 2: Session-Based Auth (Simpler)

If JWT seems complex, use express-session:

```javascript
const session = require('express-session');

app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: true, // HTTPS only
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Simple auth middleware
function requireAuth(req, res, next) {
  if (!req.session.authenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  
  if (await bcrypt.compare(password, ADMIN_PASSWORD_HASH)) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Protect routes
app.use('/api/save-blog-post', requireAuth);
app.use('/api/delete-blog-post', requireAuth);
```

## Security Considerations

### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later.'
});

app.use('/api/login', loginLimiter);
```

### Environment Variables
```bash
# .env file (don't commit!)
JWT_SECRET=your-very-long-random-string
ADMIN_PASSWORD=your-strong-password
SESSION_SECRET=another-random-string
```

### Password Requirements
- Minimum 12 characters
- Mix of upper/lower/numbers/symbols
- Consider using a passphrase
- Never hardcode in source

## UI Implementation

### Login Modal
```html
<!-- Add to notepad.astro -->
<div id="auth-modal" class="modal" style="display: none;">
  <div class="modal-content">
    <h2>Authentication Required</h2>
    <p>Enter your password to edit blog posts:</p>
    <input type="password" id="auth-password" placeholder="Password">
    <button onclick="handleLogin()">Login</button>
    <div id="auth-error" class="error"></div>
  </div>
</div>

<style>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2em;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
}
</style>
```

### Auto-Logout
```javascript
// Auto logout after inactivity
let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    authManager.logout();
    showLoginModal();
  }, 30 * 60 * 1000); // 30 minutes
}

// Reset on any user activity
document.addEventListener('click', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);
```

## Testing

### Unit Tests
```javascript
// test-auth.js
const request = require('supertest');
const app = require('./blog-save-server');

describe('Authentication', () => {
  test('Blocks unauthenticated requests', async () => {
    const res = await request(app)
      .post('/api/save-blog-post')
      .send({ filename: 'test.md', content: 'test' });
    
    expect(res.status).toBe(401);
  });

  test('Allows authenticated requests', async () => {
    // First login
    const loginRes = await request(app)
      .post('/api/login')
      .send({ password: 'correct-password' });
    
    const { accessToken } = loginRes.body;

    // Then make authenticated request
    const res = await request(app)
      .post('/api/save-blog-post')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ filename: 'test.md', content: 'test' });
    
    expect(res.status).toBe(200);
  });
});
```

### Security Testing
1. Try accessing API without token
2. Test with expired token
3. Verify rate limiting works
4. Check for timing attacks on login
5. Ensure tokens expire properly

## Migration Plan

1. **Deploy auth version alongside current**
2. **Test thoroughly on staging**
3. **Add backward compatibility mode**
4. **Gradually migrate users**
5. **Remove old endpoints after verification**

## Performance Impact

- JWT validation: ~1ms per request
- Bcrypt password check: ~100ms (by design)
- Token refresh: ~5ms
- Minimal impact on user experience

## Next Steps

After authentication is working:
1. Implement access control (roles)
2. Add audit logging
3. Consider 2FA for extra security
4. Add password reset mechanism