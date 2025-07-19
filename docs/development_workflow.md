# Development Workflow

This document describes the development scripts and workflows available in this Astro blog.

## Development Server

### Standard Development Command

```bash
npm run dev
```

This runs the `run-dev.sh` script which:
1. Loads NVM (Node Version Manager)
2. Switches to Node.js version 18.17.1
3. **Auto-converts** literature files from `drafts/` folder
4. **Starts blog save API** server on port 4322 (background)
5. Starts the Astro development server on port 4321

**SECURITY UPDATE (2025-01-19)**: For authenticated editing, use:
```bash
# Create .env file first:
echo "BLOG_AUTH_PASSWORD=your-strong-password" > .env

# Then modify run-dev.sh to use secure server:
# Change: node blog-save-server.js &
# To: node blog-save-server-secure.js &
```

### Direct Astro Commands

```bash
npm run astro -- --help  # Get help with Astro CLI
npm run astro add        # Add integrations
npm run astro check      # Check for TypeScript errors
```

## Building and Deployment

### Local Build

```bash
npm run build
```

Builds the static site to the `./dist/` directory.

### Preview Build

```bash
npm run preview
```

Serves the built site from `./dist/` for local preview before deployment.

### Host Script

A convenience script is provided for building and serving locally:

```bash
./host.sh
```

This script:
1. Builds the site with `npm run build`
2. Serves the built site using `npx serve dist`

### Network Hosting

**For network access from other devices:**

```bash
./host-network.sh           # Linux/Mac
powershell host-network.ps1 # Windows
```

This:
1. Detects local IP address
2. Starts blog save API on all interfaces (0.0.0.0:4322)
3. Starts Astro dev on all interfaces (0.0.0.0:4321)
4. Shows URLs for network access

**HTTPS hosting** (after cert generation):
```bash
./host-network-https.sh     # Linux/Mac  
start-https-server.bat      # Windows
```

## Deployment Configuration

### Netlify

The site is configured for Netlify deployment with `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  node_version = "20.3.0"
```

### GitHub Pages

The site is configured with:
- Site URL: `https://ely0030.github.io`
- Base path: `/`

## Node Version Requirements

- Minimum Node.js version: 18.17.1 (specified in engines field)
- Development uses: 18.17.1 (via NVM in run-dev.sh)
- Netlify uses: 20.3.0 (specified in netlify.toml)

## TypeScript Configuration

The project uses strict TypeScript checking:
- Extends Astro's strict configuration
- Enables `strictNullChecks`
- Includes all files except `dist/`

## Environment Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Ensure NVM is installed for automatic Node version switching

3. Run development server:
   ```bash
   npm run dev
   ```

## Security Configuration (2025-01-19)

### Authentication for Blog Editing

To protect against unauthorized edits (e.g., from compromised IoT devices):

1. **Create `.env` file**:
   ```bash
   BLOG_AUTH_PASSWORD=your-very-strong-password-here
   ```

2. **Use secure server** - Edit startup scripts to use `blog-save-server-secure.js`

3. **Add auth to notepad** - See `notepad-auth-patch.js`

**Critical locations**:
- Auth server: `blog-save-server-secure.js:21-27` (password setup)
- Rate limiting: `blog-save-server-secure.js:30-47` (5 attempts/15min)
- Path validation: `blog-save-server-secure.js:94-101,142-149` (prevents escaping blog dir)

See `SECURITY-SETUP.md` for complete setup instructions.