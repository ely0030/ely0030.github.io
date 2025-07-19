// Authentication patch for notepad.astro
// Add this code to your notepad to enable authentication

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('blog_auth_token');
    this.isAuthenticated = !!this.token;
  }

  async login(password) {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        this.token = data.token;
        this.isAuthenticated = true;
        localStorage.setItem('blog_auth_token', this.token);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  logout() {
    this.token = null;
    this.isAuthenticated = false;
    localStorage.removeItem('blog_auth_token');
  }

  getAuthHeaders() {
    if (!this.token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${this.token}`
    };
  }
}

// Create global auth manager
const authManager = new AuthManager();

// Login modal HTML (add to notepad.astro)
const loginModalHTML = `
<div id="auth-modal" class="auth-modal" style="display: none;">
  <div class="auth-modal-content">
    <h2>🔒 Authentication Required</h2>
    <p>Enter your password to edit blog posts:</p>
    <input type="password" id="auth-password" placeholder="Password" autocomplete="current-password">
    <button id="auth-login-btn">Login</button>
    <div id="auth-error" class="auth-error"></div>
  </div>
</div>
`;

// Login modal CSS (add to notepad.astro style section)
const loginModalCSS = `
.auth-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.auth-modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.auth-modal-content h2 {
  margin: 0 0 1rem 0;
  color: #333;
}

.auth-modal-content input {
  width: 100%;
  padding: 0.75rem;
  margin: 0.5rem 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.auth-modal-content button {
  width: 100%;
  padding: 0.75rem;
  background: #ff8c00;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.auth-modal-content button:hover {
  background: #ff7700;
}

.auth-error {
  color: #d32f2f;
  margin-top: 0.5rem;
  font-size: 14px;
  text-align: center;
}

/* Add logout button to main UI */
.auth-status {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 100;
}

.auth-status button {
  padding: 0.5rem 1rem;
  background: #666;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
`;

// Modified save function with authentication
async function saveToAPI(blogPostId, title, content, metadata) {
  try {
    // Check if authenticated
    if (!authManager.isAuthenticated) {
      showLoginModal();
      return { success: false, error: 'Authentication required' };
    }

    const response = await fetch('/api/save-blog-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authManager.getAuthHeaders()
      },
      body: JSON.stringify({
        filename: blogPostId,
        content: content
      })
    });

    if (response.status === 401 || response.status === 403) {
      // Token expired or invalid
      authManager.logout();
      showLoginModal();
      return { success: false, error: 'Please login again' };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Save error:', error);
    return { success: false, error: error.message };
  }
}

// Modified delete function with authentication
async function deleteFromAPI(blogPostId) {
  try {
    if (!authManager.isAuthenticated) {
      showLoginModal();
      return { success: false, error: 'Authentication required' };
    }

    const response = await fetch('/api/delete-blog-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authManager.getAuthHeaders()
      },
      body: JSON.stringify({
        filename: blogPostId
      })
    });

    if (response.status === 401 || response.status === 403) {
      authManager.logout();
      showLoginModal();
      return { success: false, error: 'Please login again' };
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Delete error:', error);
    return { success: false, error: error.message };
  }
}

// Show login modal
function showLoginModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('auth-password').focus();
  }
}

// Hide login modal
function hideLoginModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.style.display = 'none';
    document.getElementById('auth-password').value = '';
    document.getElementById('auth-error').textContent = '';
  }
}

// Handle login
async function handleLogin() {
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  const loginBtn = document.getElementById('auth-login-btn');

  if (!password) {
    errorEl.textContent = 'Please enter a password';
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';
  errorEl.textContent = '';

  const result = await authManager.login(password);

  if (result.success) {
    hideLoginModal();
    updateAuthStatus();
    // Retry any pending operations
    if (window.pendingAuthOperation) {
      window.pendingAuthOperation();
      window.pendingAuthOperation = null;
    }
  } else {
    errorEl.textContent = result.error || 'Login failed';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Login';
  }
}

// Update auth status in UI
function updateAuthStatus() {
  const statusEl = document.querySelector('.auth-status');
  if (statusEl) {
    if (authManager.isAuthenticated) {
      statusEl.innerHTML = '<button onclick="handleLogout()">Logout</button>';
    } else {
      statusEl.innerHTML = '<button onclick="showLoginModal()">Login</button>';
    }
  }
}

// Handle logout
function handleLogout() {
  authManager.logout();
  updateAuthStatus();
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', () => {
  // Add login modal to page
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = loginModalHTML;
  document.body.appendChild(modalContainer.firstElementChild);

  // Add auth status to page
  const statusContainer = document.createElement('div');
  statusContainer.className = 'auth-status';
  document.body.appendChild(statusContainer);
  updateAuthStatus();

  // Setup event listeners
  document.getElementById('auth-login-btn').addEventListener('click', handleLogin);
  document.getElementById('auth-password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Close modal on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.getElementById('auth-modal').style.display !== 'none') {
      hideLoginModal();
    }
  });
});

// Export for use in notepad
window.authManager = authManager;
window.showLoginModal = showLoginModal;
window.handleLogout = handleLogout;