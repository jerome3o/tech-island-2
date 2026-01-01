import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Home page API - returns list of available apps
app.get('/api/apps', (c) => {
  const apps = [
    {
      id: 'hello',
      name: 'Hello World',
      description: 'A simple example app',
      path: '/hello',
      icon: '👋'
    }
    // Add new apps here as they're created
  ];

  return c.json({ apps });
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
