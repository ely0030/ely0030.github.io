# Blueprint: Access Control System

## Overview

Build on the authentication layer to implement fine-grained permissions, audit logging, and device management. This ensures not just WHO can access, but WHAT they can do and tracks everything for security.

## Current Gap

With basic auth, everyone who logs in has full admin access. We need:
- Role-based permissions
- Action-specific authorization  
- Complete audit trail
- Device/IP management

## Implementation Plan

### 1. Role-Based Access Control (RBAC)

#### Define Roles
```javascript
const ROLES = {
  ADMIN: 'admin',      // Full access
  EDITOR: 'editor',    // Create/edit own posts only
  VIEWER: 'viewer',    // Read-only access
  GUEST: 'guest'       // Public posts only
};

const PERMISSIONS = {
  CREATE_POST: ['admin', 'editor'],
  EDIT_ANY_POST: ['admin'],
  EDIT_OWN_POST: ['admin', 'editor'],
  DELETE_ANY_POST: ['admin'],
  DELETE_OWN_POST: ['admin', 'editor'],
  VIEW_PRIVATE: ['admin', 'editor'],
  VIEW_PUBLIC: ['admin', 'editor', 'viewer', 'guest'],
  MANAGE_USERS: ['admin']
};
```

#### Enhanced JWT Payload
```javascript
// When creating token
const accessToken = jwt.sign({
  username: 'john_doe',
  role: 'editor',
  permissions: PERMISSIONS[user.role],
  deviceId: generateDeviceId(req),
  ip: req.ip
}, JWT_SECRET, { expiresIn: '15m' });
```

#### Permission Middleware
```javascript
function authorize(requiredPermission) {
  return (req, res, next) => {
    const userRole = req.user.role;
    const allowedRoles = PERMISSIONS[requiredPermission];
    
    if (!allowedRoles.includes(userRole)) {
      auditLog.warn('Unauthorized access attempt', {
        user: req.user.username,
        permission: requiredPermission,
        ip: req.ip
      });
      
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: requiredPermission 
      });
    }
    
    next();
  };
}

// Usage
app.post('/api/save-blog-post', 
  authenticateToken, 
  authorize('CREATE_POST'),
  async (req, res) => {
    // Handler code
  }
);
```

### 2. Ownership-Based Access

#### Track Post Ownership
```javascript
// In frontmatter
---
title: "My Private Thoughts"
author: "john_doe"
authorId: "usr_123456"
created: 2024-01-20T10:00:00Z
lastModifiedBy: "john_doe"
private: true
---
```

#### Ownership Middleware
```javascript
async function checkOwnership(req, res, next) {
  const { filename } = req.body;
  const post = await loadBlogPost(filename);
  
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }
  
  // Admin can edit anything
  if (req.user.role === 'admin') {
    next();
    return;
  }
  
  // Check ownership
  if (post.authorId !== req.user.id) {
    auditLog.warn('Attempted to edit post without ownership', {
      user: req.user.username,
      post: filename,
      owner: post.authorId
    });
    
    return res.status(403).json({ 
      error: 'You can only edit your own posts' 
    });
  }
  
  next();
}
```

### 3. Comprehensive Audit Logging

#### Audit Log Structure
```javascript
// audit-logger.js
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const auditLogger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/audit-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

// Log all actions
function logAction(action, details) {
  auditLogger.info({
    timestamp: new Date().toISOString(),
    action,
    user: details.user,
    ip: details.ip,
    deviceId: details.deviceId,
    target: details.target,
    result: details.result,
    metadata: details.metadata
  });
}
```

#### Integrate with All Endpoints
```javascript
app.post('/api/save-blog-post', authenticateToken, authorize('CREATE_POST'), async (req, res) => {
  const { filename, content } = req.body;
  
  try {
    await saveBlogPost(filename, content);
    
    logAction('SAVE_POST', {
      user: req.user.username,
      ip: req.ip,
      deviceId: req.user.deviceId,
      target: filename,
      result: 'success',
      metadata: {
        contentLength: content.length,
        isNew: !existingPost
      }
    });
    
    res.json({ success: true });
  } catch (error) {
    logAction('SAVE_POST', {
      user: req.user.username,
      ip: req.ip,
      deviceId: req.user.deviceId,
      target: filename,
      result: 'failure',
      metadata: { error: error.message }
    });
    
    res.status(500).json({ error: 'Save failed' });
  }
});
```

### 4. Device & IP Management

#### Device Fingerprinting
```javascript
function generateDeviceId(req) {
  const components = [
    req.headers['user-agent'],
    req.headers['accept-language'],
    req.headers['accept-encoding'],
    // Don't use IP in fingerprint (changes on networks)
  ];
  
  return crypto
    .createHash('sha256')
    .update(components.join('|'))
    .digest('hex')
    .substring(0, 16);
}
```

#### Trusted Device System
```javascript
// Store trusted devices
const trustedDevices = new Map(); // In production, use database

function trustDevice(userId, deviceId, deviceName) {
  if (!trustedDevices.has(userId)) {
    trustedDevices.set(userId, new Set());
  }
  
  trustedDevices.get(userId).add({
    id: deviceId,
    name: deviceName,
    trustedAt: new Date(),
    lastSeen: new Date()
  });
}

// Check if device is trusted
function isTrustedDevice(userId, deviceId) {
  const userDevices = trustedDevices.get(userId);
  if (!userDevices) return false;
  
  return Array.from(userDevices).some(d => d.id === deviceId);
}

// Enhanced auth with device check
app.post('/api/login', async (req, res) => {
  const { password, trustDevice } = req.body;
  const deviceId = generateDeviceId(req);
  
  // ... password validation ...
  
  // Check if device is trusted
  const trusted = isTrustedDevice('admin', deviceId);
  
  if (!trusted && !trustDevice) {
    // Send verification email/SMS
    return res.json({ 
      requiresVerification: true,
      deviceId 
    });
  }
  
  if (trustDevice) {
    trustDevice('admin', deviceId, req.headers['user-agent']);
  }
  
  // Generate tokens...
});
```

#### IP Whitelisting
```javascript
// Configurable IP whitelist
const ALLOWED_IPS = process.env.ALLOWED_IPS?.split(',') || [];
const ALLOWED_NETWORKS = ['192.168.1.0/24', '10.0.0.0/8']; // Local networks

function ipWhitelistMiddleware(req, res, next) {
  const clientIp = req.ip;
  
  // Check exact IP match
  if (ALLOWED_IPS.includes(clientIp)) {
    return next();
  }
  
  // Check network ranges
  if (isIpInNetworks(clientIp, ALLOWED_NETWORKS)) {
    return next();
  }
  
  logAction('BLOCKED_IP', {
    ip: clientIp,
    path: req.path
  });
  
  res.status(403).json({ error: 'Access denied from this IP' });
}

// Apply to sensitive routes
app.use('/api/delete-blog-post', ipWhitelistMiddleware);
```

### 5. Session Management

#### Active Session Tracking
```javascript
const activeSessions = new Map();

function createSession(userId, token, deviceId) {
  const sessionId = crypto.randomBytes(16).toString('hex');
  
  activeSessions.set(sessionId, {
    userId,
    token,
    deviceId,
    createdAt: new Date(),
    lastActivity: new Date(),
    ip: req.ip
  });
  
  return sessionId;
}

// List active sessions
app.get('/api/sessions', authenticateToken, authorize('MANAGE_USERS'), (req, res) => {
  const userSessions = Array.from(activeSessions.values())
    .filter(s => s.userId === req.user.id)
    .map(s => ({
      deviceId: s.deviceId,
      lastActivity: s.lastActivity,
      ip: s.ip
    }));
    
  res.json({ sessions: userSessions });
});

// Revoke specific session
app.post('/api/revoke-session', authenticateToken, (req, res) => {
  const { sessionId } = req.body;
  
  if (activeSessions.delete(sessionId)) {
    logAction('SESSION_REVOKED', {
      user: req.user.username,
      sessionId
    });
    
    res.json({ success: true });
  }
});
```

### 6. Access Control UI

#### Permission Dashboard
```html
<!-- Add to notepad.astro -->
<div id="access-control-panel" class="admin-panel">
  <h3>Access Control</h3>
  
  <div class="current-user">
    <strong>Logged in as:</strong> <span id="current-username"></span>
    <br>
    <strong>Role:</strong> <span id="current-role"></span>
    <br>
    <strong>Permissions:</strong>
    <ul id="current-permissions"></ul>
  </div>
  
  <div class="active-sessions">
    <h4>Active Sessions</h4>
    <ul id="session-list"></ul>
  </div>
  
  <div class="audit-preview">
    <h4>Recent Activity</h4>
    <ul id="recent-activity"></ul>
  </div>
</div>
```

#### Permission Checks in UI
```javascript
// Show/hide UI elements based on permissions
function updateUIPermissions() {
  const user = authManager.getCurrentUser();
  
  // Hide delete buttons for non-admins
  if (!user.permissions.includes('DELETE_ANY_POST')) {
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.style.display = 'none';
    });
  }
  
  // Disable edit on others' posts
  document.querySelectorAll('.post-item').forEach(item => {
    const author = item.dataset.author;
    if (author !== user.username && !user.permissions.includes('EDIT_ANY_POST')) {
      item.querySelector('.edit-btn').disabled = true;
    }
  });
}
```

## Security Considerations

### Principle of Least Privilege
- Users get minimum permissions needed
- Admins should use editor accounts for daily work
- Regular permission audits

### Defense in Depth
- Multiple layers of checking
- Server-side validation even if UI hides options
- Log both successes and failures

### Monitoring & Alerts
```javascript
// Alert on suspicious activity
function checkSuspiciousActivity(auditLog) {
  // Multiple failed auth attempts
  const failedLogins = auditLog.filter(
    log => log.action === 'LOGIN_FAILED' && 
    log.timestamp > Date.now() - 300000 // Last 5 mins
  );
  
  if (failedLogins.length > 5) {
    sendAlert('Multiple failed login attempts detected');
  }
  
  // Unusual access patterns
  const nightAccess = auditLog.filter(
    log => new Date(log.timestamp).getHours() < 6
  );
  
  if (nightAccess.length > 0) {
    sendAlert('Unusual access time detected');
  }
}
```

## Testing Plan

1. **Unit Tests**: Each permission combination
2. **Integration Tests**: Full auth flow with roles
3. **Security Tests**: Try to bypass permissions
4. **Audit Tests**: Verify all actions logged
5. **Performance Tests**: Impact of permission checks

## Migration Steps

1. Add role field to existing auth
2. Default all users to 'editor' role
3. Implement permission checks
4. Add audit logging
5. Enable device management
6. Roll out gradually with feature flags

## Next Steps

- Implement data encryption for truly sensitive content
- Add two-factor authentication
- Create admin UI for managing users/roles
- Set up automated security monitoring