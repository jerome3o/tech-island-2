import { Hono } from 'hono';
import type { AppContext } from '../../types';
import { sendNtfyNotification } from '../../lib/ntfy';

const app = new Hono<AppContext>();

// Helper: Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Helper: Get daily word based on date (deterministic)
async function getDailyWord(db: D1Database, date: string): Promise<string> {
  // Use date as seed for consistent daily word
  const words = await db
    .prepare('SELECT word FROM herdle_words WHERE is_solution = 1 ORDER BY word')
    .all();

  if (!words.results || words.results.length === 0) {
    throw new Error('No words available');
  }

  // Convert date to number for index
  const dateNum = parseInt(date.replace(/-/g, ''), 10);
  const index = dateNum % words.results.length;

  return (words.results[index] as { word: string }).word;
}

// Helper: Check if word is valid
async function isValidWord(db: D1Database, word: string): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM herdle_words WHERE word = ?')
    .bind(word.toUpperCase())
    .first();

  return result !== null;
}

// Helper: Evaluate guess against target word
function evaluateGuess(guess: string, target: string): { letter: string; status: 'correct' | 'present' | 'absent' }[] {
  const result = [];
  const targetLetters = target.split('');
  const guessLetters = guess.split('');

  // Track which target letters have been matched
  const targetUsed = new Array(6).fill(false);
  const guessStatus = new Array(6).fill('absent');

  // First pass: mark correct positions
  for (let i = 0; i < 6; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      guessStatus[i] = 'correct';
      targetUsed[i] = true;
    }
  }

  // Second pass: mark present letters
  for (let i = 0; i < 6; i++) {
    if (guessStatus[i] === 'correct') continue;

    for (let j = 0; j < 6; j++) {
      if (!targetUsed[j] && guessLetters[i] === targetLetters[j]) {
        guessStatus[i] = 'present';
        targetUsed[j] = true;
        break;
      }
    }
  }

  // Build result
  for (let i = 0; i < 6; i++) {
    result.push({
      letter: guessLetters[i],
      status: guessStatus[i] as 'correct' | 'present' | 'absent'
    });
  }

  return result;
}

// Helper: Update user statistics
async function updateStats(
  db: D1Database,
  userId: string,
  won: boolean,
  attempts: number
): Promise<void> {
  const stats = await db
    .prepare('SELECT * FROM herdle_stats WHERE user_id = ?')
    .bind(userId)
    .first();

  if (!stats) {
    // Create new stats
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    if (won) {
      distribution[attempts as keyof typeof distribution] = 1;
    }

    await db
      .prepare(`
        INSERT INTO herdle_stats (user_id, games_played, games_won, current_streak, max_streak, guess_distribution)
        VALUES (?, 1, ?, ?, ?, ?)
      `)
      .bind(
        userId,
        won ? 1 : 0,
        won ? 1 : 0,
        won ? 1 : 0,
        JSON.stringify(distribution)
      )
      .run();
  } else {
    // Update existing stats
    const distribution = JSON.parse(stats.guess_distribution as string);
    if (won) {
      distribution[attempts] = (distribution[attempts] || 0) + 1;
    }

    const currentStreak = won ? (stats.current_streak as number) + 1 : 0;
    const maxStreak = Math.max(stats.max_streak as number, currentStreak);

    await db
      .prepare(`
        UPDATE herdle_stats
        SET games_played = games_played + 1,
            games_won = games_won + ?,
            current_streak = ?,
            max_streak = ?,
            guess_distribution = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `)
      .bind(
        won ? 1 : 0,
        currentStreak,
        maxStreak,
        JSON.stringify(distribution),
        userId
      )
      .run();
  }
}

// GET /api/game - Get or create today's game
app.get('/api/game', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const today = getTodayDate();

  // Check if game exists for today
  let game = await db
    .prepare('SELECT * FROM herdle_games WHERE user_id = ? AND game_date = ?')
    .bind(user.id, today)
    .first();

  if (!game) {
    // Create new game
    await db
      .prepare(`
        INSERT INTO herdle_games (user_id, game_date, guesses, completed, attempts_used)
        VALUES (?, ?, '[]', 0, 0)
      `)
      .bind(user.id, today)
      .run();

    game = await db
      .prepare('SELECT * FROM herdle_games WHERE user_id = ? AND game_date = ?')
      .bind(user.id, today)
      .first();
  }

  return c.json({
    gameDate: game!.game_date,
    guesses: JSON.parse(game!.guesses as string),
    completed: game!.completed,
    attemptsUsed: game!.attempts_used,
    maxAttempts: 6
  });
});

// POST /api/guess - Submit a guess
app.post('/api/guess', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const today = getTodayDate();
  const { guess } = await c.req.json();

  // Validate input
  if (!guess || typeof guess !== 'string' || guess.length !== 6) {
    return c.json({ error: 'Guess must be exactly 6 letters' }, 400);
  }

  const guessUpper = guess.toUpperCase();

  // Check if word is valid
  if (!(await isValidWord(db, guessUpper))) {
    return c.json({ error: 'Not a valid word' }, 400);
  }

  // Get current game
  const game = await db
    .prepare('SELECT * FROM herdle_games WHERE user_id = ? AND game_date = ?')
    .bind(user.id, today)
    .first();

  if (!game) {
    return c.json({ error: 'No game found for today' }, 404);
  }

  if (game.completed) {
    return c.json({ error: 'Game already completed' }, 400);
  }

  const guesses = JSON.parse(game.guesses as string);

  if (guesses.length >= 6) {
    return c.json({ error: 'Maximum attempts reached' }, 400);
  }

  // Get daily word
  const targetWord = await getDailyWord(db, today);

  // Evaluate guess
  const evaluation = evaluateGuess(guessUpper, targetWord);
  guesses.push({ word: guessUpper, evaluation });

  // Check if won
  const won = guessUpper === targetWord;
  const lost = !won && guesses.length >= 6;
  const completed = won || lost;

  // Update game
  await db
    .prepare(`
      UPDATE herdle_games
      SET guesses = ?,
          completed = ?,
          attempts_used = ?,
          completed_at = ?
      WHERE user_id = ? AND game_date = ?
    `)
    .bind(
      JSON.stringify(guesses),
      completed ? (won ? 1 : 2) : 0,
      guesses.length,
      completed ? new Date().toISOString() : null,
      user.id,
      today
    )
    .run();

  // Update stats if completed
  if (completed) {
    await updateStats(db, user.id, won, guesses.length);

    // Send notification
    const result = won ? `won in ${guesses.length} attempts! 🎉` : `didn't get it today 😢`;
    sendNtfyNotification(c.env, {
      title: `🔤 Herdle Complete`,
      message: `${user.name} ${result}`,
      priority: 'default',
      tags: ['herdle', 'game-complete'],
      click: `${c.env.APP_URL}/herdle/`
    }).catch(err => console.error('Failed to send ntfy notification:', err));
  }

  return c.json({
    evaluation,
    won,
    completed,
    attemptsUsed: guesses.length,
    targetWord: completed ? targetWord : null
  });
});

// GET /api/stats - Get user statistics
app.get('/api/stats', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const stats = await db
    .prepare('SELECT * FROM herdle_stats WHERE user_id = ?')
    .bind(user.id)
    .first();

  if (!stats) {
    return c.json({
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
      winPercentage: 0
    });
  }

  const gamesPlayed = stats.games_played as number;
  const gamesWon = stats.games_won as number;

  return c.json({
    gamesPlayed,
    gamesWon,
    currentStreak: stats.current_streak,
    maxStreak: stats.max_streak,
    guessDistribution: JSON.parse(stats.guess_distribution as string),
    winPercentage: gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0
  });
});

// GET /api/share - Get shareable result
app.get('/api/share', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const today = getTodayDate();

  const game = await db
    .prepare('SELECT * FROM herdle_games WHERE user_id = ? AND game_date = ?')
    .bind(user.id, today)
    .first();

  if (!game || !game.completed) {
    return c.json({ error: 'Game not completed' }, 400);
  }

  const guesses = JSON.parse(game.guesses as string);

  // Generate emoji grid
  const emojiMap = {
    correct: '🟩',
    present: '🟨',
    absent: '⬜'
  };

  const grid = guesses
    .map((guess: any) =>
      guess.evaluation
        .map((e: any) => emojiMap[e.status as keyof typeof emojiMap])
        .join('')
    )
    .join('\n');

  const result = game.completed === 1 ? `${guesses.length}/6` : 'X/6';

  const shareText = `Herdle ${today}\n${result}\n\n${grid}`;

  return c.json({ shareText });
});

export default app;
