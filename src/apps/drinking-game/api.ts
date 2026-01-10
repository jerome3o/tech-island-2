import { Hono } from 'hono';
import type { AppContext } from '../../types';

const app = new Hono<AppContext>();

// Game prompts and challenges - UNHINGED KIWI EDITION
const challenges = [
  "Take a drink if you've complained about London weather in the last 24 hours",
  "Whoever pays more rent drinks (spoiler: you both lose)",
  "Take a sip if you've pretended to understand cricket to fit in",
  "Drink if you've ever said 'yeah but have you BEEN to New Zealand?' in an argument",
  "Person who most recently cried about missing L&P drinks",
  "Take a drink if your visa stress has kept you awake at 3am",
  "Whoever has more unread messages from the family WhatsApp group drinks",
  "Drink if you've secretly judged someone for putting the milk in first",
  "Take a sip if you've ever pretended a £8 pint is 'reasonable'",
  "Whoever has been in London longer drinks (and questions their life choices)",
  "Take a drink if you've Googled 'flights to NZ' this week but can't afford them",
  "Person who most recently said 'sweet as' to a confused British person drinks",
  "Drink if you've had an existential crisis on the Northern Line at rush hour",
  "Take a sip if you still can't work out which coins are which",
  "Whoever misses NZ meat pies more drinks (both of you, obviously)",
  "Take a drink if you've ever romanticized Countdown in your head",
  "Drink if you've lied about 'loving London' to your parents",
  "Take a sip if you've considered selling a kidney to afford the Tube",
];

const neverHaveIEver = [
  "Never have I ever... seriously considered moving back to NZ because I'm broke and tired",
  "Never have I ever... faked a New Zealand accent to seem more interesting at a party",
  "Never have I ever... ghosted someone because they said Australia and New Zealand are 'basically the same'",
  "Never have I ever... cried on public transport in London",
  "Never have I ever... stalked an ex's new partner for more than an hour straight",
  "Never have I ever... pretended to like Marmite to avoid the Vegemite debate",
  "Never have I ever... missed a flight because I was too hungover",
  "Never have I ever... had a full meltdown over how much a meal deal costs here",
  "Never have I ever... lied to immigration about literally anything",
  "Never have I ever... hooked up with someone just because they had central heating",
  "Never have I ever... brought drugs through airport security (by accident or otherwise)",
  "Never have I ever... pretended to be from 'near Auckland' to avoid explaining where I'm actually from",
  "Never have I ever... had a quarter-life crisis in a Pret",
  "Never have I ever... thought about flying back to NZ just to see a GP for free",
  "Never have I ever... judged someone's flat viewing desperation level",
  "Never have I ever... created a finsta to stalk people without them knowing",
];

const wouldYouRather = [
  { a: "Live in a Zone 4 flat with a garden", b: "Live in a Zone 1 shoebox with mold" },
  { a: "Free flights to NZ forever but you can only stay 1 week", b: "Can't leave London for 5 years but rent is free" },
  { a: "Have to explain where New Zealand is on a map to everyone you meet", b: "Everyone thinks you're Australian forever" },
  { a: "London weather forever", b: "NZ prices forever" },
  { a: "Work visa stress for life", b: "Live in your parents' basement in NZ" },
  { a: "Only drink Fosters forever", b: "Never drink beer again" },
  { a: "Unlimited free Tube travel", b: "Unlimited free pints" },
  { a: "Everyone pronounces Maori words correctly", b: "Free Whittaker's chocolate for life" },
  { a: "Have a British accent but lose your Kiwi identity", b: "Keep your accent but everyone says 'say fish and chips' forever" },
  { a: "Your landlord is always reasonable", b: "Your commute is always under 15 minutes" },
  { a: "Pub closes at 11pm every night", b: "Pub is open 24/7 but £15 pints" },
  { a: "Boris Johnson moves in next door", b: "Your ex moves in next door" },
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
      model: 'claude-opus-4-5-20251101',
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

// Generate dynamic challenge with context
app.post('/api/generate-challenge', async (c) => {
  const { context, previousPrompts = [] } = await c.req.json();
  const claude = c.get('claude');

  try {
    let promptContent = `Generate a single unhinged, cynical drinking game challenge for a group of friends. Keep it under 25 words. Make it about comparison (who drinks) or confession (if you've done X, drink).

Context about the group: ${context}

Style examples:
- "Whoever pays more rent drinks"
- "Take a drink if you've complained about London weather today"
- "Person who most recently cried about missing home drinks"`;

    if (previousPrompts.length > 0) {
      promptContent += `\n\n⚠️ CRITICAL - You already used these challenges. DO NOT repeat similar topics or themes:
${previousPrompts.slice(0, 8).map(p => `- ${p}`).join('\n')}

AVOID any topics already mentioned above. Pick a COMPLETELY DIFFERENT subject: technology, food, childhood memories, work drama, dating fails, family dynamics, health, hobbies, social media, nightlife, transportation, shopping, etc. Be creative!`;
    }

    promptContent += '\n\nReturn ONLY the challenge text, nothing else. No quotes, no preamble.';

    const response = await claude.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: promptContent
      }]
    });

    const challenge = response.content[0].type === 'text' ? response.content[0].text.trim().replace(/^["']|["']$/g, '') : challenges[0];
    return c.json({ challenge });
  } catch (error) {
    const fallback = challenges[Math.floor(Math.random() * challenges.length)];
    return c.json({ challenge: fallback });
  }
});

// Generate dynamic "Never Have I Ever"
app.post('/api/generate-never-have-i-ever', async (c) => {
  const { context, previousPrompts = [] } = await c.req.json();
  const claude = c.get('claude');

  try {
    let promptContent = `Generate a single "Never have I ever..." statement for a drinking game. Make it unhinged, specific, and darkly funny. Keep it under 20 words.

Context about the group: ${context}

Style examples:
- "Never have I ever... cried on public transport"
- "Never have I ever... hooked up with someone just because they had central heating"
- "Never have I ever... seriously considered moving back home because I'm broke"`;

    if (previousPrompts.length > 0) {
      promptContent += `\n\n⚠️ CRITICAL - You already generated these. DO NOT create anything with similar themes or subjects:
${previousPrompts.slice(0, 8).map(p => `- ${p}`).join('\n')}

AVOID repeating any topics above. Explore NEW areas: embarrassing moments, questionable decisions, weird habits, social media behavior, relationship drama, work situations, travel mishaps, food crimes, childhood trauma, financial disasters, etc. Get creative!`;
    }

    promptContent += '\n\nReturn ONLY "Never have I ever... [statement]", nothing else.';

    const response = await claude.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: promptContent
      }]
    });

    const prompt = response.content[0].type === 'text' ? response.content[0].text.trim() : neverHaveIEver[0];
    return c.json({ prompt });
  } catch (error) {
    const fallback = neverHaveIEver[Math.floor(Math.random() * neverHaveIEver.length)];
    return c.json({ prompt: fallback });
  }
});

// Generate dynamic "Would You Rather"
app.post('/api/generate-would-you-rather', async (c) => {
  const { context, previousPrompts = [] } = await c.req.json();
  const claude = c.get('claude');

  try {
    let promptContent = `You are generating a "Would You Rather" question for a drinking game. Create two impossible/hilarious choices that force a difficult decision. Make it relevant, cynical, and specific to the group context.

Context about the group: ${context}

Examples of the style:
- Option A: "Live in a Zone 4 flat with a garden" / Option B: "Live in a Zone 1 shoebox with mold"
- Option A: "Work visa stress for life" / Option B: "Live in your parents' basement"`;

    if (previousPrompts.length > 0) {
      promptContent += `\n\n⚠️ CRITICAL REQUIREMENT - You have already generated these questions. You MUST NOT generate anything similar in theme, topic, or subject matter:
${previousPrompts.slice(0, 8).map(p => `- ${p}`).join('\n')}

DO NOT mention or reference:
- Any topics already covered above (housing, visas, money, relationships, etc. if they appear)
- Any similar dilemmas or trade-offs
- Any recycled concepts

Generate something COMPLETELY DIFFERENT. Explore new topics: food, technology, embarrassing situations, career choices, supernatural scenarios, pop culture, childhood, future, family, habits, possessions, abilities, etc. Be creative and original!`;
    }

    promptContent += '\n\nReturn ONLY valid JSON in this exact format: {"a": "first option", "b": "second option"}. Keep each option under 15 words. No other text.';

    const response = await claude.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: promptContent
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim();
    // Extract JSON if Claude added extra text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const question = JSON.parse(jsonStr);
    return c.json(question);
  } catch (error) {
    console.error('Would you rather generation error:', error);
    const fallback = wouldYouRather[Math.floor(Math.random() * wouldYouRather.length)];
    return c.json(fallback);
  }
});

// Generate dynamic Truth or Dare
app.post('/api/generate-truth-or-dare', async (c) => {
  const { context, type, previousPrompts = [] } = await c.req.json();
  const claude = c.get('claude');

  const typePrompt = type === 'truth'
    ? 'Generate a revealing, uncomfortable TRUTH question. Make it personal and juicy.'
    : 'Generate a ridiculous, slightly embarrassing DARE. Make it doable but hilarious.';

  try {
    let promptContent = `${typePrompt} Keep it under 25 words.

Context about the group: ${context}

Style examples for ${type}s:
${type === 'truth'
  ? '- "What\'s the most embarrassing thing in your search history?"\n- "Who here would you least want to be stuck with?"'
  : '- "Let the other person post whatever they want on your Instagram story"\n- "Text your 5th contact something risky"'
}`;

    if (previousPrompts.length > 0) {
      promptContent += `\n\n⚠️ CRITICAL - You already used these ${type}s. DO NOT repeat similar topics or approaches:
${previousPrompts.slice(0, 8).map(p => `- ${p}`).join('\n')}

AVOID any subjects already covered. For ${type === 'truth' ? 'truths, explore: secrets, regrets, crushes, lies, fears, guilty pleasures, opinions, confessions, weaknesses, judgments' : 'dares, try: physical challenges, social media stunts, phone pranks, impressions, singing, dancing, confessions to others, food challenges, weird tasks'}. Be original!`;
    }

    promptContent += `\n\nReturn ONLY the ${type} text, nothing else.`;

    const response = await claude.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: promptContent
      }]
    });

    const prompt = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    return c.json({ prompt });
  } catch (error) {
    const fallback = type === 'truth'
      ? truthOrDare.truths[Math.floor(Math.random() * truthOrDare.truths.length)]
      : truthOrDare.dares[Math.floor(Math.random() * truthOrDare.dares.length)];
    return c.json({ prompt: fallback });
  }
});

export default app;
