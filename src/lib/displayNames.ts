/**
 * Display name generator using random adjective + noun combinations
 */

const adjectives = [
  'Happy', 'Clever', 'Brave', 'Swift', 'Mighty', 'Gentle', 'Wise', 'Cosmic',
  'Solar', 'Lunar', 'Electric', 'Magnetic', 'Quantum', 'Atomic', 'Stellar',
  'Crystal', 'Golden', 'Silver', 'Ruby', 'Emerald', 'Sapphire', 'Diamond',
  'Thunder', 'Lightning', 'Storm', 'Frost', 'Flame', 'Shadow', 'Light',
  'Ancient', 'Modern', 'Future', 'Mystic', 'Epic', 'Legendary', 'Noble',
  'Royal', 'Imperial', 'Cosmic', 'Astral', 'Celestial', 'Divine', 'Sacred',
  'Wild', 'Free', 'Bold', 'Fierce', 'Calm', 'Peaceful', 'Serene', 'Zen'
];

const nouns = [
  'Panda', 'Tiger', 'Dragon', 'Phoenix', 'Eagle', 'Wolf', 'Bear', 'Lion',
  'Falcon', 'Hawk', 'Raven', 'Owl', 'Fox', 'Deer', 'Shark', 'Whale',
  'Dolphin', 'Orca', 'Penguin', 'Turtle', 'Koala', 'Lynx', 'Jaguar',
  'Panther', 'Cheetah', 'Leopard', 'Cougar', 'Bobcat', 'Ocelot', 'Puma',
  'Ninja', 'Samurai', 'Warrior', 'Knight', 'Wizard', 'Sage', 'Oracle',
  'Titan', 'Giant', 'Champion', 'Hero', 'Legend', 'Master', 'Sensei',
  'Star', 'Comet', 'Meteor', 'Nebula', 'Galaxy', 'Planet', 'Moon'
];

/**
 * Generates a random display name in the format "Adjective Noun"
 */
export function generateDisplayName(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adjective} ${noun}`;
}

/**
 * Validates a display name
 * Must be 3-30 characters, alphanumeric with spaces allowed
 */
export function isValidDisplayName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 30) return false;
  // Allow letters, numbers, spaces, and common punctuation
  return /^[a-zA-Z0-9\s\-_]+$/.test(trimmed);
}

/**
 * Ensures a user has a display name (alias) in the database
 * If they don't have one, generates and saves it
 */
export async function ensureUserHasDisplayName(
  db: D1Database,
  userId: string,
  email: string
): Promise<string> {
  // Check if user exists and has an alias
  const user = await db.prepare(
    'SELECT alias FROM users WHERE id = ?'
  ).bind(userId).first<{ alias: string | null }>();

  if (user?.alias) {
    return user.alias;
  }

  // Generate a new display name
  const displayName = generateDisplayName();

  if (user) {
    // User exists but no alias - update
    await db.prepare(
      'UPDATE users SET alias = ? WHERE id = ?'
    ).bind(displayName, userId).run();
  } else {
    // User doesn't exist - create with alias
    await db.prepare(
      'INSERT INTO users (id, email, alias) VALUES (?, ?, ?)'
    ).bind(userId, email, displayName).run();
  }

  return displayName;
}
