import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Home page API - returns list of available apps
app.get('/api/apps', (c) => {
  const apps = [
    {
      id: 'game-counters',
      name: 'Game Counters',
      description: 'Score trackers for darts, 500, scrabble & more',
      path: '/game-counters',
      icon: '🎯'
    },
    {
      id: 'party-games',
      name: 'Party Games',
      description: 'Fun party games with challenges and roasts',
      path: '/party-games',
      icon: '🎉'
    },
    {
      id: 'candle-wax',
      name: 'Candle Wax',
      description: 'Physics game - tilt to control melting wax',
      path: '/candle-wax',
      icon: '🕯️'
    },
    {
      id: 'paint',
      name: 'Paint Studio',
      description: 'Create artwork, share it, and get AI critiques',
      path: '/paint',
      icon: '🎨'
    },
    {
      id: 'hot-takes',
      name: 'Hot Takes',
      description: 'Share controversial opinions and argue in the comments',
      path: '/hot-takes',
      icon: '🔥'
    },
    {
      id: 'flashcards',
      name: 'Chinese Flashcards',
      description: 'Learn Chinese with spaced repetition',
      path: '/flashcards',
      icon: '🀄'
    },
    {
      id: 'feature-requests',
      name: 'Feature Requests',
      description: 'Share ideas and vote on new features',
      path: '/feature-requests',
      icon: '💡'
    },
    {
      id: 'bebo',
      name: 'Bebo',
      description: 'Social profiles, wall posts, and daily luvs',
      path: '/bebo',
      icon: '💜'
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
