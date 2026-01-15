# Tech Island (2)

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
- **Android App**: Native Android app built via TWA (Trusted Web Activity), auto-built in CI

## Android App

The PWA is wrapped in a native Android app using Trusted Web Activities (TWA). This provides:
- Proper push notification support on Android (PWA notifications are unreliable)
- Native app experience with app icon and launcher integration
- Better offline support

**Files**:
- `twa-manifest.json` - TWA configuration (package ID, host, icons, etc.)
- `.github/workflows/build-android.yml` - Builds APK on every push
- `ANDROID.md` - User-facing documentation for downloading and installing

**Building**: APKs are automatically built and available as GitHub Actions artifacts. See `ANDROID.md` for details.

## Design Principles

**MOBILE-FIRST**: All users access this app primarily on mobile devices. When building UIs:
- Design for mobile viewports first (320px-428px width)
- Test all layouts on mobile aspect ratios
- Use responsive grids that collapse to single column on small screens
- Ensure touch targets are at least 44x44px
- Prioritize readability on small screens (adequate font sizes, contrast)
- Avoid horizontal scrolling
- Use mobile-friendly patterns (bottom sheets, full-width cards, etc.)

Desktop layout is secondary - mobile experience is paramount.

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

### Debug Notifications (`src/lib/ntfy.ts`)

**IMPORTANT**: When adding new features, consider adding helpful debug notifications for key events. This helps with development and debugging.

```typescript
import { sendNtfyNotification } from '../../lib/ntfy';

// Send notification when something important happens
sendNtfyNotification(c.env, {
  title: '🎯 Your Feature Title',
  message: 'Description of what happened',
  priority: 'default', // min, low, default, high, max
  tags: ['feature-name', 'event-type'],
  click: `${c.env.APP_URL}/your-app-name/`, // Optional: URL to open on click
}).catch(err => console.error('Failed to send ntfy notification:', err));
```

Good events to notify on:
- Game completions (with winner and scores)
- Task completions or milestones
- Important state changes
- Errors or failures that need attention
- Background job completions

Notifications are sent to ntfy.sh and require `NTFY_DEBUG_TOPIC` to be configured. The function handles missing config gracefully (won't crash if not set).

## User Profiles: Bebo as Canonical Profile System

**IMPORTANT**: Bebo is the de facto profile system for all users across the entire application.

### What This Means

- **Bebo profiles are the canonical user profile** - all apps should reference Bebo for user information
- **Profile pictures**: Use Bebo profile pictures for avatars in chat, comments, wall posts, and any social features
- **User display names**: Prefer the user's alias from the `users` table or fallback to email
- **Home page integration**: The home page links to Bebo for profile viewing/editing

### How to Use Bebo Profiles in Your App

```typescript
// Get a user's Bebo profile picture
const profile = await c.env.DB
  .prepare('SELECT profile_pic_key FROM bebo_profiles WHERE user_id = ?')
  .bind(userId)
  .first();

if (profile?.profile_pic_key) {
  const profilePicUrl = `/bebo/images/${profile.profile_pic_key}`;
  // Use this URL in your UI
}

// Get user display name
const user = await c.env.DB
  .prepare('SELECT COALESCE(alias, email) as display_name FROM users WHERE id = ?')
  .bind(userId)
  .first();
```

### API Endpoints

- `GET /bebo/api/profile/:userId` - Get any user's Bebo profile (includes profile_pic_key, cover_photo_key, bio, luv_count, hidden)
- `PUT /bebo/api/profile` - Update your own profile
- `GET /bebo/images/:key` - Serve profile/cover images (authenticated)

### UI Integration

When displaying users in your app:
1. Fetch their Bebo profile to get `profile_pic_key`
2. Display image at `/bebo/images/${profile_pic_key}` or use fallback avatar
3. Use their alias (from `users` table) as display name
4. Link to `/bebo` to view full profile

See the home page (`public/index.html`) for a reference implementation.

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
│   │   ├── push.ts               # Push notification helpers
│   │   └── ntfy.ts               # Debug notifications via ntfy.sh
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
- `NTFY_DEBUG_TOPIC` - (Optional) ntfy.sh topic for debug notifications

**Generate VAPID keys locally:**
```bash
npm run generate-vapid
```

## Current Apps

| App | Path | Description |
|-----|------|-------------|
| Home | `/` | App launcher, user info, notification setup, links to Bebo profile |
| **Bebo** | `/bebo` | **Canonical user profile system** - profiles, wall posts, luvs (3/day), R2 image storage |
| Splits | `/splits` | Splitwise clone - expense sharing with groups, balances, settlements |
| Chat | `/chat` | Shared group chat for all users (polls every 2s) |
| Hello | `/hello` | Example app with greeting, AI greeting, visit counter |
| Boggle | `/boggle` | Multiplayer word game with real-time scoring and ntfy notifications |

**Note**: Bebo is the de facto profile system. All apps should use Bebo for user avatars and profile information.

## Notes for Agents

- **Middleware**: Auth and Claude middleware apply to `/api/*` AND `/*/api/*` routes
- **Static files**: Put UI in `public/{app}/index.html`, not in `src/apps/{app}/ui/`
- **workers.dev disabled**: Only the custom domain works (protected by Cloudflare Access)
- **Observability**: Logging is enabled - check Cloudflare dashboard for logs
- **TypeScript**: Always run `npm run typecheck` before committing
- **Debug notifications**: When adding new features, consider adding ntfy notifications for important events (see Debug Notifications section)
- **Follow-up PRs**: If your changes are complete and ready to merge, but additional work is identified that needs a follow-up PR, **do not create the PR yourself**. Instead, provide the user with a GitHub PR creation link (e.g., `https://github.com/owner/repo/compare/main...branch-name?expand=1`) so they can review and create it manually. This is because Claude Code Remote can only manage one PR per session.
