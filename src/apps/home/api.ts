import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Home page API - returns list of available apps
app.get('/api/apps', (c) => {
  const apps = [
    {
      id: 'flashcards',
      name: 'Chinese Flashcards',
      description: 'Learn Chinese with spaced repetition',
      path: '/flashcards',
      icon: '🀄'
    },
    {
      id: 'boggle',
      name: 'Boggle',
      description: 'Multiplayer word game with real-time competition',
      path: '/boggle',
      icon: '🎲'
    },
    {
      id: 'splits',
      name: 'Splits',
      description: 'Split expenses with friends',
      path: '/splits',
      icon: '💸'
    },
    {
      id: 'chat',
      name: 'Chat',
      description: 'Group chat for everyone',
      path: '/chat',
      icon: '💬'
    },
    {
      id: 'hello',
      name: 'Hello World',
      description: 'A simple example app',
      path: '/hello',
      icon: '👋'
    }
  ];

  return c.json({ apps });
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
