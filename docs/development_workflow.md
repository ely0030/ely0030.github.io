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
3. Starts the Astro development server

The development server runs at `http://localhost:4321` by default.

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