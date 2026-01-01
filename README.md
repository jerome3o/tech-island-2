# Towerhouse Apps

A personal app platform built on Cloudflare Workers. Deploy small web apps quickly with built-in auth, database, and AI capabilities.

## What is this?

This is a "launch pad" for quickly building and deploying small web applications. The infrastructure (auth, database, hosting, CI/CD) is already set up - you just add your app logic.

**Key features:**
- **Auth**: Cloudflare Access handles login (email OTP or Google)
- **Database**: Cloudflare D1 (SQLite) for persistence
- **AI**: Anthropic Claude API pre-configured
- **PWA**: Works offline, installable on mobile
- **Push notifications**: Built-in support
- **CI/CD**: Push to main → auto-deploy

## How it works

1. Apps live in `src/apps/{name}/` (API) and `public/{name}/` (UI)
2. Each app gets its own route: `app.towerhouse.london/{name}`
3. Push to `main` triggers automatic deployment
4. All users are authenticated via Cloudflare Access

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: [Hono](https://hono.dev/) (fast, lightweight)
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: Cloudflare Access (Zero Trust)
- **AI**: Anthropic Claude API
- **CI/CD**: GitHub Actions

## For AI Agents

This repo is designed to be worked on by AI coding agents (like Claude Code). See [CLAUDE.md](./CLAUDE.md) for agent-specific instructions on how to add apps and work with the codebase.

## Development

```bash
npm install          # Install dependencies
npm run dev          # Run locally
npm run typecheck    # Check TypeScript
```

## Deployment

Deployment is automatic - just push to `main`.

For initial setup, see the GitHub Actions workflow files in `.github/workflows/`.

## Current Apps

- **Home** (`/`) - App launcher and settings
- **Hello** (`/hello`) - Example app demonstrating the platform features

## License

Private project.
