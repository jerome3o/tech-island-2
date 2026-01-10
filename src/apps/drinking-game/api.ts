import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Game prompts and challenges
const challenges = [
  "Take a sip if you've ever stalked your ex on social media",
  "Whoever has the most unread emails drinks",
  "Take a drink if you've ever pretended to be busy to avoid someone",
  "Person who woke up latest today drinks",
  "Take a sip if you've ever lied about reading a book you haven't",
  "Whoever has more apps on their phone drinks",
  "Take a drink if you've ever ghosted someone",
  "Person with the most recent embarrassing photo in their camera roll drinks",
  "Take a sip if you've ever sent a text to the wrong person",
  "Whoever has been to more countries drinks",
];

const neverHaveIEver = [
  "Never have I ever... pretended to know a song I'd never heard",
  "Never have I ever... stalked someone I went on one date with",
  "Never have I ever... lied about my age",
  "Never have I ever... fake laughed at a terrible joke",
  "Never have I ever... texted an ex at 2am",
  "Never have I ever... pretended to be sick to get out of plans",
  "Never have I ever... looked through someone's phone without asking",
  "Never have I ever... Instagram stalked someone for over an hour",
  "Never have I ever... said 'I'm 5 minutes away' when I haven't left yet",
  "Never have I ever... lied about having plans to avoid hanging out",
];

const wouldYouRather = [
  { a: "Give up coffee forever", b: "Give up alcohol forever" },
  { a: "Always know when someone is lying", b: "Always get away with lying" },
  { a: "Have to sing everything you say", b: "Have to dance everywhere you go" },
  { a: "Read minds but can't turn it off", b: "Be invisible but only when no one is looking" },
  { a: "Fight one horse-sized duck", b: "Fight 100 duck-sized horses" },
  { a: "Always be 10 minutes late", b: "Always be 20 minutes early" },
  { a: "Have unlimited free flights", b: "Never have to pay for food again" },
  { a: "Be able to speak to animals", b: "Be able to speak all human languages" },
];

const truthOrDare = {
  truths: [
    "What's the most embarrassing thing in your search history?",
    "Who's the last person you stalked on social media?",
    "What's a secret you've never told anyone?",
    "What's the worst thing you've ever done on a date?",
    "What's your most irrational fear?",
    "What's the longest you've gone without showering?",
    "What's a lie you've told that you still feel guilty about?",
    "Who here would you least want to be stuck on a desert island with?",
  ],
  dares: [
    "Text your 5th contact 'I have something important to tell you...' and don't reply for 5 minutes",
    "Do your best impression of Kellum (or the other player)",
    "Let the other person post whatever they want on your Instagram story",
    "Speak in an accent for the next 3 rounds",
    "Do 20 pushups or take 3 drinks",
    "Call a friend and try to convince them you've joined a cult",
    "Show the most embarrassing photo in your camera roll",
    "Send a risky text to your crush (or take 3 drinks)",
  ],
};

const specialChallenges = [
  {
    title: "🎯 Staring Contest",
    description: "First person to blink drinks. Loser takes 2 sips.",
  },
  {
    title: "📱 Phone Roulette",
    description: "Close your eyes and open a random app. If it's social media, drink.",
  },
  {
    title: "🎤 Freestyle Rap",
    description: "Everyone tries to rap about the other person. Worst rapper drinks.",
  },
  {
    title: "🤔 Category Game",
    description: "Pick a category (pizza toppings, countries, etc.). Take turns naming items. First to hesitate drinks.",
  },
  {
    title: "🎭 Accent Challenge",
    description: "Both try the same accent. Worst one drinks.",
  },
  {
    title: "🔢 Math Battle",
    description: "Someone asks a multiplication question (7x8, etc.). Slower person drinks.",
  },
];

// Get a random challenge
app.get('/api/challenge', (c) => {
  const challenge = challenges[Math.floor(Math.random() * challenges.length)];
  return c.json({ challenge });
});

// Get a random "Never Have I Ever"
app.get('/api/never-have-i-ever', (c) => {
  const prompt = neverHaveIEver[Math.floor(Math.random() * neverHaveIEver.length)];
  return c.json({ prompt });
});

// Get a random "Would You Rather"
app.get('/api/would-you-rather', (c) => {
  const question = wouldYouRather[Math.floor(Math.random() * wouldYouRather.length)];
  return c.json(question);
});

// Get a random "Truth or Dare"
app.get('/api/truth-or-dare/:type', (c) => {
  const type = c.req.param('type') as 'truth' | 'dare';
  const options = type === 'truth' ? truthOrDare.truths : truthOrDare.dares;
  const prompt = options[Math.floor(Math.random() * options.length)];
  return c.json({ prompt });
});

// Get a special challenge
app.get('/api/special-challenge', (c) => {
  const challenge = specialChallenges[Math.floor(Math.random() * specialChallenges.length)];
  return c.json(challenge);
});

// Get personalized roast (using Claude)
app.post('/api/roast', async (c) => {
  const { targetName } = await c.req.json();
  const claude = c.get('claude');

  try {
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Generate a funny, lighthearted roast/drinking challenge for someone named ${targetName}. Make it playful and silly, not mean. Format: "Hey ${targetName}, [funny challenge]". Keep it under 40 words.`
      }]
    });

    const roast = response.content[0].type === 'text' ? response.content[0].text : '';
    return c.json({ roast });
  } catch (error) {
    return c.json({ roast: `Hey ${targetName}, take a drink because Claude is too drunk to roast you right now! 🍺` });
  }
});

export default app;
