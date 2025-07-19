# Blueprint: Data Encryption

## Overview

Implement encryption for blog posts at rest and in transit, ensuring that even if someone gains access to the files or database, they cannot read your private thoughts without the encryption keys.

## Current Vulnerability

```markdown
# Current storage - PLAIN TEXT!
src/content/blog/my-private-diary.md:
---
title: "My Deepest Secrets"
private: true
---

Today I discovered that... [COMPLETELY VISIBLE TO ANYONE WITH FILE ACCESS]
```

## Encryption Strategy

### Three Levels of Encryption

1. **Level 1: Server-Side Encryption** (Good)
   - Posts encrypted on disk
   - Server has the key
   - Protects against file system access

2. **Level 2: User-Key Encryption** (Better)
   - Encrypted with user's password-derived key
   - Server never sees plaintext
   - Each user has their own key

3. **Level 3: End-to-End Encryption** (Best)
   - Client-side encryption in browser
   - Zero-knowledge architecture
   - Not even server admin can read

## Implementation Plan

### Level 1: Server-Side Encryption

#### 1. Install Crypto Dependencies
```bash
npm install crypto-js dotenv
```

#### 2. Encryption Service
```javascript
// encryption-service.js
const CryptoJS = require('crypto-js');
const fs = require('fs').promises;
const path = require('path');

class EncryptionService {
  constructor() {
    // In production, use key management service
    this.masterKey = process.env.ENCRYPTION_KEY || this.generateKey();
    this.algorithm = 'AES-256-GCM';
  }

  generateKey() {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  encrypt(plaintext, metadata = {}) {
    // Generate IV for each encryption
    const iv = CryptoJS.lib.WordArray.random(128/8);
    
    // Encrypt the content
    const encrypted = CryptoJS.AES.encrypt(plaintext, this.masterKey, {
      iv: iv,
      mode: CryptoJS.mode.GCM,
      padding: CryptoJS.pad.Pkcs7
    });

    // Return encrypted object
    return {
      encrypted: encrypted.toString(),
      iv: iv.toString(),
      algorithm: this.algorithm,
      metadata: this.encryptMetadata(metadata),
      version: 1
    };
  }

  decrypt(encryptedData) {
    try {
      const decrypted = CryptoJS.AES.decrypt(
        encryptedData.encrypted, 
        this.masterKey,
        {
          iv: CryptoJS.enc.Hex.parse(encryptedData.iv),
          mode: CryptoJS.mode.GCM,
          padding: CryptoJS.pad.Pkcs7
        }
      );

      return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Unable to decrypt content');
    }
  }

  encryptMetadata(metadata) {
    // Encrypt sensitive metadata separately
    return CryptoJS.AES.encrypt(
      JSON.stringify(metadata), 
      this.masterKey
    ).toString();
  }

  decryptMetadata(encryptedMetadata) {
    const decrypted = CryptoJS.AES.decrypt(encryptedMetadata, this.masterKey);
    return JSON.parse(decrypted.toString(CryptoJS.enc.Utf8));
  }
}

module.exports = new EncryptionService();
```

#### 3. Encrypted File Storage
```javascript
// encrypted-storage.js
const encryption = require('./encryption-service');

class EncryptedStorage {
  async savePost(filename, content, metadata) {
    // Separate frontmatter from content
    const { frontmatter, body } = this.parseMarkdown(content);
    
    // Determine if encryption needed
    if (frontmatter.private || frontmatter.encrypted) {
      // Encrypt the body
      const encryptedData = encryption.encrypt(body, {
        title: frontmatter.title,
        author: frontmatter.author,
        timestamp: new Date().toISOString()
      });

      // Create new content with encrypted marker
      const encryptedContent = this.buildEncryptedMarkdown(
        frontmatter,
        encryptedData
      );

      // Save encrypted file
      await fs.writeFile(
        path.join(BLOG_DIR, filename),
        encryptedContent,
        'utf8'
      );

      // Log encryption event
      auditLog.info('Post encrypted', { filename, size: body.length });
    } else {
      // Save as normal for public posts
      await fs.writeFile(
        path.join(BLOG_DIR, filename),
        content,
        'utf8'
      );
    }
  }

  async loadPost(filename) {
    const content = await fs.readFile(
      path.join(BLOG_DIR, filename),
      'utf8'
    );

    const { frontmatter, body } = this.parseMarkdown(content);

    // Check if encrypted
    if (frontmatter.encrypted) {
      try {
        const encryptedData = JSON.parse(body);
        const decrypted = encryption.decrypt(encryptedData);
        
        return this.buildMarkdown(frontmatter, decrypted);
      } catch (error) {
        throw new Error('Failed to decrypt post');
      }
    }

    return content;
  }

  buildEncryptedMarkdown(frontmatter, encryptedData) {
    return `---
${Object.entries({ ...frontmatter, encrypted: true })
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}
---

${JSON.stringify(encryptedData, null, 2)}`;
  }
}
```

### Level 2: User-Key Encryption

#### Password-Derived Keys
```javascript
// user-encryption.js
class UserEncryption {
  // Derive encryption key from password
  async deriveKey(password, salt) {
    const iterations = 100000;
    const keyLength = 256;
    
    return CryptoJS.PBKDF2(password, salt, {
      keySize: keyLength/32,
      iterations: iterations,
      hasher: CryptoJS.algo.SHA256
    }).toString();
  }

  async encryptWithUserKey(content, password, userId) {
    // Get or generate salt for user
    const salt = await this.getUserSalt(userId);
    
    // Derive key from password
    const key = await this.deriveKey(password, salt);
    
    // Encrypt content
    const iv = CryptoJS.lib.WordArray.random(128/8);
    const encrypted = CryptoJS.AES.encrypt(content, key, {
      iv: iv,
      mode: CryptoJS.mode.GCM
    });

    return {
      encrypted: encrypted.toString(),
      iv: iv.toString(),
      salt: salt,
      userId: userId,
      algorithm: 'AES-256-GCM-PBKDF2'
    };
  }

  async getUserSalt(userId) {
    // Store salts separately from encrypted data
    const saltFile = path.join(SALT_DIR, `${userId}.salt`);
    
    try {
      return await fs.readFile(saltFile, 'utf8');
    } catch (error) {
      // Generate new salt for user
      const salt = CryptoJS.lib.WordArray.random(256/8).toString();
      await fs.writeFile(saltFile, salt, 'utf8');
      return salt;
    }
  }
}
```

#### Encrypted Headers Only
```javascript
// For better performance, encrypt only sensitive parts
function selectiveEncryption(post) {
  const publicData = {
    title: post.title,
    date: post.date,
    category: post.category,
    encrypted: true
  };

  const privateData = {
    content: post.content,
    privateMeta: post.privateMeta
  };

  return {
    ...publicData,
    encryptedContent: encrypt(JSON.stringify(privateData))
  };
}
```

### Level 3: End-to-End Encryption

#### Client-Side Encryption
```javascript
// In notepad.astro - runs in browser
class ClientEncryption {
  constructor() {
    this.key = null;
  }

  async initialize(password) {
    // Derive key in browser
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    this.key = await crypto.subtle.importKey(
      'raw',
      data,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // Derive actual encryption key
    const salt = await this.getSalt();
    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      this.key,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptContent(plaintext) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      this.encryptionKey,
      data
    );

    // Convert to base64 for storage
    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
      clientEncrypted: true
    };
  }

  async decryptContent(encryptedData) {
    const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);
    const iv = this.base64ToArrayBuffer(encryptedData.iv);
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      this.encryptionKey,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  // Helper methods
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    return btoa(String.fromCharCode.apply(null, bytes));
  }

  base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Usage in save function
async function saveEncryptedPost(title, content) {
  if (!clientEncryption.isInitialized()) {
    await showPasswordPrompt();
  }

  // Encrypt on client
  const encrypted = await clientEncryption.encryptContent(content);
  
  // Send encrypted data to server
  // Server stores but cannot read
  await fetch('/api/save-blog-post', {
    method: 'POST',
    headers: await authManager.getHeaders(),
    body: JSON.stringify({
      filename: `${title}.md`,
      content: JSON.stringify(encrypted),
      metadata: {
        clientEncrypted: true,
        algorithm: 'AES-GCM-WebCrypto'
      }
    })
  });
}
```

### Key Management

#### Key Rotation
```javascript
class KeyRotation {
  async rotateKeys() {
    console.log('Starting key rotation...');
    
    // Generate new key
    const newKey = this.generateNewKey();
    
    // Re-encrypt all posts
    const posts = await this.getAllEncryptedPosts();
    
    for (const post of posts) {
      // Decrypt with old key
      const decrypted = await this.decrypt(post, this.oldKey);
      
      // Encrypt with new key
      const reencrypted = await this.encrypt(decrypted, newKey);
      
      // Save with new encryption
      await this.savePost(post.filename, reencrypted);
      
      // Log rotation
      auditLog.info('Key rotation', { 
        file: post.filename,
        oldKeyId: this.oldKey.id,
        newKeyId: newKey.id 
      });
    }

    // Update key in secure storage
    await this.updateMasterKey(newKey);
    
    console.log('Key rotation complete');
  }
}
```

#### Secure Key Storage
```javascript
// Use environment variables in production
// Consider:
// - AWS KMS
// - HashiCorp Vault  
// - Azure Key Vault
// - Hardware Security Module (HSM)

// For development
require('dotenv').config();

const KEY_CONFIG = {
  master: process.env.MASTER_ENCRYPTION_KEY,
  rotation: process.env.KEY_ROTATION_SCHEDULE || '90d',
  backup: process.env.BACKUP_KEY_LOCATION
};
```

### Encrypted Backups

```javascript
class EncryptedBackup {
  async createBackup(password) {
    const timestamp = new Date().toISOString();
    const backupData = {
      timestamp,
      posts: [],
      metadata: {}
    };

    // Collect all posts
    const posts = await this.getAllPosts();
    
    for (const post of posts) {
      backupData.posts.push({
        filename: post.filename,
        content: post.content,
        encrypted: post.encrypted
      });
    }

    // Encrypt entire backup
    const backupKey = await this.deriveKey(password, timestamp);
    const encryptedBackup = await this.encrypt(
      JSON.stringify(backupData),
      backupKey
    );

    // Save backup
    const backupPath = path.join(
      BACKUP_DIR,
      `backup-${timestamp}.enc`
    );
    
    await fs.writeFile(backupPath, encryptedBackup, 'utf8');
    
    return backupPath;
  }

  async restoreBackup(backupPath, password) {
    const encryptedData = await fs.readFile(backupPath, 'utf8');
    
    // Extract timestamp from filename for salt
    const timestamp = path.basename(backupPath)
      .replace('backup-', '')
      .replace('.enc', '');
    
    const backupKey = await this.deriveKey(password, timestamp);
    const decrypted = await this.decrypt(encryptedData, backupKey);
    
    const backupData = JSON.parse(decrypted);
    
    // Restore posts
    for (const post of backupData.posts) {
      await this.restorePost(post);
    }
    
    return backupData.posts.length;
  }
}
```

## Security Considerations

### Encryption Best Practices
1. **Never log plaintext**: Only log encrypted data or metadata
2. **Use authenticated encryption**: AES-GCM prevents tampering
3. **Unique IV per encryption**: Never reuse initialization vectors
4. **Secure random generation**: Use crypto-safe random
5. **Key stretching**: PBKDF2 with 100k+ iterations

### Performance Optimization
```javascript
// Cache decrypted content in memory (with timeout)
class DecryptionCache {
  constructor(ttl = 300000) { // 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  clear() {
    // Clear on logout or lock
    this.cache.clear();
  }
}
```

### UI Integration

```javascript
// Show encryption status in notepad
function displayEncryptionStatus(post) {
  const statusEl = document.getElementById('encryption-status');
  
  if (post.encrypted) {
    statusEl.innerHTML = `
      <span class="encrypted-badge">
        🔒 Encrypted (${post.algorithm})
      </span>
    `;
  } else {
    statusEl.innerHTML = `
      <span class="unencrypted-warning">
        ⚠️ Not encrypted
        <button onclick="encryptThisPost()">Encrypt</button>
      </span>
    `;
  }
}
```

## Testing Plan

1. **Encryption/Decryption**: Verify round-trip works
2. **Key Derivation**: Consistent keys from passwords
3. **Performance**: Measure impact on save/load
4. **Migration**: Test encrypting existing posts
5. **Recovery**: Test backup/restore process

## Migration Strategy

1. **Gradual Rollout**
   - Add encryption capability
   - Mark new private posts as encrypted
   - Provide tool to encrypt existing posts
   - Monitor performance

2. **Backward Compatibility**
   - Support both encrypted and plain posts
   - Detect format automatically
   - Provide migration warnings

## Next Steps

- Implement input validation to prevent encrypted data corruption
- Add network security hardening
- Create private thoughts mode with enhanced encryption
- Consider hardware token support for key storage