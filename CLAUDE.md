# Towerhouse Apps Platform

> **For AI Agents**: This file is your guide to working in this codebase. Read it fully before making changes.

## Meta Instructions for Agents

**IMPORTANT**: If you make meaningful changes to this codebase that would affect how other agents work here, update this file. This includes:
- Adding new apps or features
- Changing the project structure
- Adding new libraries or patterns
- Modifying how routing, auth, or middleware works
- Adding new environment variables or secrets

Do NOT update this file for:
- Bug fixes that don't change patterns
- Minor UI tweaks
- Routine maintenance

This repo is designed for "fire and forget" agents - you may be one of many agents working here in parallel. Keep this doc accurate so others can orient quickly.

---

## Architecture Overview

- **Runtime**: Cloudflare Workers (single worker, multi-app routing)
- **Frontend**: Static assets served from `public/`, with per-app UI in `public/{app-name}/`
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: Cloudflare Access (users authenticated via email OTP or Google)
- **Domain**: Protected via Cloudflare Access (workers.dev URL is disabled)
- **Framework**: Hono (lightweight, fast, Workers-native)
- **CI/CD**: GitHub Actions - auto-deploys on push to main

## How to Add a New App

### 1. Create the app folder structure

```bash
# Create API
mkdir -p src/apps/{your-app-name}
cp src/apps/_template/api.ts src/apps/{your-app-name}/api.ts

# Create UI
mkdir -p public/{your-app-name}
cp src/apps/_template/ui/index.html public/{your-app-name}/index.html
```

### 2. Implement your API routes

Edit `src/apps/{your-app-name}/api.ts`:

```typescript
import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Your routes - these will be mounted at /{your-app-name}/api/*
app.get('/api/items', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const items = await db.prepare('SELECT * FROM items WHERE user_id = ?').bind(user.id).all();
  return c.json(items.results);
});

// Example: Use Claude API
app.post('/api/generate', async (c) => {
  const { prompt } = await c.req.json();
  const claude = c.get('claude');
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }]
  });
  return c.json({ response: response.content[0].text });
});

export default app;
```

### 3. Register your app in the router

Edit `src/index.ts`:

```typescript
import yourApp from './apps/your-app-name/api';

// In the app routes section:
app.route('/your-app-name', yourApp);
```

### 4. Create your UI

Edit `public/{your-app-name}/index.html`. The UI should:
- Call your API at `/{your-app-name}/api/*`
- Be a single HTML file with inline CSS/JS (keeps things simple)
- Include a back link to `/` for navigation

### 5. Add to the apps list

Edit `src/apps/home/api.ts` and add your app to the `apps` array:

```typescript
{
  id: 'your-app-name',
  name: 'Your App Name',
  description: 'What it does',
  path: '/your-app-name',
  icon: '🚀'  // Pick an emoji
}
```

### 6. Add database migrations (if needed)

Create `migrations/XXXX_{description}.sql` (number sequentially).

Migrations run automatically on deploy via GitHub Actions.

## Available Helpers

### Authentication (`src/lib/auth.ts`)

User is automatically available in all `/api/*` and `/*/api/*` routes:

```typescript
const user = c.get('user');
// user.email - User's email address
// user.id - Unique user ID (hash of email)
// user.name - Display name (from email)
```

### Database (`src/lib/db.ts`)

D1 is available on `c.env.DB`:

```typescript
// Query
const result = await c.env.DB.prepare('SELECT * FROM table WHERE id = ?').bind(id).first();

// Insert
await c.env.DB.prepare('INSERT INTO table (col) VALUES (?)').bind(value).run();

// Batch
await c.env.DB.batch([
  c.env.DB.prepare('INSERT INTO table (col) VALUES (?)').bind('a'),
  c.env.DB.prepare('INSERT INTO table (col) VALUES (?)').bind('b'),
]);
```

### Claude API (`src/lib/claude.ts`)

Anthropic client available via middleware:

```typescript
const claude = c.get('claude');
const response = await claude.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

Also available: `generateText()` and `generateStructured()` helpers.

### Push Notifications (`src/lib/push.ts`)

```typescript
import { sendPushNotification, getSubscription } from '@/lib/push';

const subscription = await getSubscription(c.env.DB, userId);
if (subscription) {
  await sendPushNotification(c.env, subscription, {
    title: 'Notification',
    body: 'Something happened!',
    url: '/your-app-name/'
  });
}
```

## Project Structure

```
├── CLAUDE.md                     # This file (for AI agents)
├── README.md                     # For humans
├── wrangler.toml                 # Cloudflare Workers config
├── package.json
├── tsconfig.json
├── migrations/                   # D1 database migrations
│   └── 0001_initial.sql
├── public/                       # Static assets (served automatically)
│   ├── index.html                # Home page
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service worker
│   ├── icons/
│   └── {app-name}/               # Per-app UI files
│       └── index.html
├── src/
│   ├── index.ts                  # Main worker entry + routing
│   ├── types.ts                  # Shared TypeScript types
│   ├── lib/
│   │   ├── auth.ts               # Cloudflare Access auth
│   │   ├── db.ts                 # D1 database helpers
│   │   ├── claude.ts             # Anthropic API wrapper
│   │   └── push.ts               # Push notification helpers
│   └── apps/
│       ├── _template/            # Copy this for new apps
│       ├── home/                 # Landing page API
│       └── hello/                # Example app
└── .github/workflows/
    ├── setup.yml                 # One-time infra setup
    └── deploy.yml                # Auto-deploy on push
```

## Development

```bash
npm install                    # Install deps
npm run dev                    # Local development
npm run typecheck              # Check types
npm run deploy                 # Manual deploy (usually just push to main)
```

## CI/CD & Secrets

Deployment is automatic via GitHub Actions on push to `main`.

**GitHub Secrets required:**
- `CLOUDFLARE_API_TOKEN` - API token with Workers + D1 permissions
- `CLOUDFLARE_ACCOUNT_ID` - Your Cloudflare account ID
- `ANTHROPIC_API_KEY` - Anthropic API key
- `VAPID_PUBLIC_KEY` - For push notifications
- `VAPID_PRIVATE_KEY` - For push notifications
- `APP_URL` - The app URL (e.g., `https://app.towerhouse.london`)

**Generate VAPID keys locally:**
```bash
npm run generate-vapid
```

## Current Apps

| App | Path | Description |
|-----|------|-------------|
| Home | `/` | App launcher, user info, notification setup |
| Splits | `/splits` | Splitwise clone - expense sharing with groups, balances, settlements |
| Chat | `/chat` | Shared group chat for all users (polls every 2s) |
| Hello | `/hello` | Example app with greeting, AI greeting, visit counter |

## Notes for Agents

- **Middleware**: Auth and Claude middleware apply to `/api/*` AND `/*/api/*` routes
- **Static files**: Put UI in `public/{app}/index.html`, not in `src/apps/{app}/ui/`
- **workers.dev disabled**: Only the custom domain works (protected by Cloudflare Access)
- **Observability**: Logging is enabled - check Cloudflare dashboard for logs
- **TypeScript**: Always run `npm run typecheck` before committing
