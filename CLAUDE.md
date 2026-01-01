# Towerhouse Apps Platform

This is a rapid application development platform deployed to Cloudflare Workers. It's designed so that Claude Code (or any AI agent) can quickly add new apps by following this guide.

## Architecture Overview

- **Runtime**: Cloudflare Workers (single worker, multi-app routing)
- **Frontend**: Static assets served from `public/`, with per-app UI in `src/apps/{app}/ui/`
- **Database**: Cloudflare D1 (SQLite)
- **Auth**: Cloudflare Access (users authenticated via email OTP or Google)
- **Domain**: `app.towerhouse.london`
- **Framework**: Hono (lightweight, fast, Workers-native)

## How to Add a New App

### 1. Create the app folder

```bash
cp -r src/apps/_template src/apps/{your-app-name}
```

### 2. Implement your API routes

Edit `src/apps/{your-app-name}/api.ts`:

```typescript
import { Hono } from 'hono';
import { AppContext } from '@/types';

const app = new Hono<AppContext>();

// Your routes here
app.get('/', (c) => c.json({ message: 'Hello from your app!' }));

// Example: Use the database
app.get('/items', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const items = await db.prepare('SELECT * FROM items WHERE user_id = ?').bind(user.id).all();
  return c.json(items.results);
});

// Example: Use Claude API
app.post('/generate', async (c) => {
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

Edit `src/index.ts` and add your app:

```typescript
import yourApp from './apps/your-app-name/api';

// In the routing section:
app.route('/your-app-name', yourApp);
```

### 4. Create your UI (optional)

Create `src/apps/{your-app-name}/ui/index.html`. This will be served at `/your-app-name/`.

The UI should:
- Fetch data from your API at `/your-app-name/api/*`
- Be a single HTML file (or use a simple build step if needed)
- Work as part of the PWA

### 5. Add database migrations (if needed)

Create a new migration file in `migrations/`:

```bash
touch migrations/XXXX_{description}.sql
```

Number it sequentially (e.g., `0002_add_flashcards.sql`).

Run migrations:
```bash
npm run db:migrate        # Local
npm run db:migrate:prod   # Production
```

## Available Helpers

### Authentication (`src/lib/auth.ts`)

The user is automatically available in all routes via Cloudflare Access JWT:

```typescript
const user = c.get('user');
// user.email - User's email address
// user.id - Unique user ID from CF Access
```

### Database (`src/lib/db.ts`)

D1 is available on `c.env.DB`:

```typescript
// Query
const result = await c.env.DB.prepare('SELECT * FROM table WHERE id = ?').bind(id).first();

// Insert
await c.env.DB.prepare('INSERT INTO table (col) VALUES (?)').bind(value).run();

// Batch operations
await c.env.DB.batch([
  c.env.DB.prepare('INSERT INTO table (col) VALUES (?)').bind('a'),
  c.env.DB.prepare('INSERT INTO table (col) VALUES (?)').bind('b'),
]);
```

### Claude API (`src/lib/claude.ts`)

An Anthropic client is available via middleware:

```typescript
const claude = c.get('claude');
const response = await claude.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### Push Notifications (`src/lib/push.ts`)

```typescript
import { sendPushNotification, getSubscription } from '@/lib/push';

// Send to a specific user
const subscription = await getSubscription(c.env.DB, userId);
if (subscription) {
  await sendPushNotification(c.env, subscription, {
    title: 'New notification',
    body: 'Something happened!',
    url: '/your-app-name/'
  });
}
```

## Project Structure

```
├── CLAUDE.md                     # This file
├── wrangler.toml                 # Cloudflare config
├── package.json
├── tsconfig.json
├── migrations/                   # D1 schema migrations
│   └── 0001_initial.sql
├── public/                       # Static assets
│   ├── manifest.json             # PWA manifest
│   ├── sw.js                     # Service worker
│   └── icons/
├── src/
│   ├── index.ts                  # Main worker entry point
│   ├── types.ts                  # Shared types
│   ├── lib/
│   │   ├── auth.ts               # Auth helpers
│   │   ├── db.ts                 # Database helpers
│   │   ├── claude.ts             # Anthropic API wrapper
│   │   └── push.ts               # Push notification helpers
│   └── apps/
│       ├── _template/            # Copy this to create a new app
│       │   ├── api.ts
│       │   └── ui/
│       │       └── index.html
│       ├── home/                 # Landing page / app launcher
│       └── hello/                # Example app
└── .github/
    └── workflows/
        └── deploy.yml            # CI/CD - auto-deploys on push to main
```

## Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Deploy
npm run deploy
```

## Secrets

These secrets must be set via `wrangler secret put`:

- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `VAPID_PUBLIC_KEY` - For push notifications (generate with `npm run generate-vapid`)
- `VAPID_PRIVATE_KEY` - For push notifications

## Initial Setup (one-time)

1. Create the D1 database:
   ```bash
   wrangler d1 create towerhouse-db
   ```
   Then update `wrangler.toml` with the database ID.

2. Run migrations:
   ```bash
   npm run db:migrate:prod
   ```

3. Set up Cloudflare Access:
   - Go to Cloudflare Zero Trust dashboard
   - Create an Access application for `app.towerhouse.london`
   - Add your friends' emails to the allowed list

4. Set secrets:
   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   npm run generate-vapid  # Follow the instructions to set VAPID keys
   ```

5. Deploy:
   ```bash
   npm run deploy
   ```
