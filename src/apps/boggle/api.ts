import { Hono } from 'hono';
import type { AppContext } from '../../types';
import { sendNtfyNotification } from '../../lib/ntfy';

const app = new Hono<AppContext>();

// Classic Boggle dice (16 dice with 6 faces each)
const BOGGLE_DICE = [
  ['A', 'A', 'E', 'E', 'G', 'N'],
  ['A', 'B', 'B', 'J', 'O', 'O'],
  ['A', 'C', 'H', 'O', 'P', 'S'],
  ['A', 'F', 'F', 'K', 'P', 'S'],
  ['A', 'O', 'O', 'T', 'T', 'W'],
  ['C', 'I', 'M', 'O', 'T', 'U'],
  ['D', 'E', 'I', 'L', 'R', 'X'],
  ['D', 'E', 'L', 'R', 'V', 'Y'],
  ['D', 'I', 'S', 'T', 'T', 'Y'],
  ['E', 'E', 'G', 'H', 'N', 'W'],
  ['E', 'E', 'I', 'N', 'S', 'U'],
  ['E', 'H', 'R', 'T', 'V', 'W'],
  ['E', 'I', 'O', 'S', 'S', 'T'],
  ['E', 'L', 'R', 'T', 'T', 'Y'],
  ['H', 'I', 'M', 'N', 'QU', 'U'],
  ['H', 'L', 'N', 'N', 'R', 'Z'],
];

// Generate random Boggle board
function generateBoard(): string[] {
  const board: string[] = [];
  const shuffledDice = [...BOGGLE_DICE].sort(() => Math.random() - 0.5);

  for (const die of shuffledDice) {
    const randomFace = die[Math.floor(Math.random() * die.length)];
    board.push(randomFace);
  }

  return board;
}

// Get adjacent positions on 4x4 board
function getAdjacentPositions(pos: number): number[] {
  const row = Math.floor(pos / 4);
  const col = pos % 4;
  const adjacent: number[] = [];

  for (let r = Math.max(0, row - 1); r <= Math.min(3, row + 1); r++) {
    for (let c = Math.max(0, col - 1); c <= Math.min(3, col + 1); c++) {
      const adjPos = r * 4 + c;
      if (adjPos !== pos) {
        adjacent.push(adjPos);
      }
    }
  }

  return adjacent;
}

// Check if word can be formed on board
function canFormWord(word: string, board: string[]): boolean {
  const upperWord = word.toUpperCase();

  // Try starting from each position
  for (let startPos = 0; startPos < 16; startPos++) {
    if (searchWord(upperWord, board, startPos, new Set())) {
      return true;
    }
  }

  return false;
}

function searchWord(
  word: string,
  board: string[],
  pos: number,
  used: Set<number>
): boolean {
  if (word.length === 0) return true;
  if (used.has(pos)) return false;

  const letter = board[pos];

  // Handle 'QU' special case
  if (letter === 'QU') {
    if (!word.startsWith('QU')) return false;
    used.add(pos);
    const result = searchAdjacentPositions(word.slice(2), board, pos, used);
    used.delete(pos);
    return result;
  }

  if (!word.startsWith(letter)) return false;

  used.add(pos);
  const result = searchAdjacentPositions(word.slice(1), board, pos, used);
  used.delete(pos);
  return result;
}

function searchAdjacentPositions(
  remainingWord: string,
  board: string[],
  currentPos: number,
  used: Set<number>
): boolean {
  if (remainingWord.length === 0) return true;

  const adjacent = getAdjacentPositions(currentPos);
  for (const nextPos of adjacent) {
    if (searchWord(remainingWord, board, nextPos, used)) {
      return true;
    }
  }

  return false;
}

// Calculate points for word
function calculatePoints(word: string): number {
  const len = word.length;
  if (len < 3) return 0;
  if (len <= 4) return 1;
  if (len === 5) return 2;
  if (len === 6) return 3;
  if (len === 7) return 5;
  return 11; // 8+ letters
}

// Generate unique game ID
function generateGameId(): string {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// List active games (lobby or playing)
app.get('/api/games', async (c) => {
  const db = c.env.DB;

  const games = await db.prepare(`
    SELECT
      g.id,
      g.state,
      g.timer_seconds,
      g.start_time,
      g.created_at,
      g.created_by,
      COUNT(DISTINCT p.user_id) as player_count
    FROM boggle_games g
    LEFT JOIN boggle_players p ON g.id = p.game_id
    WHERE g.state IN ('lobby', 'playing')
    GROUP BY g.id
    ORDER BY g.created_at DESC
    LIMIT 20
  `).all();

  return c.json({ games: games.results });
});

// Create new game
app.post('/api/games', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { timerSeconds = 120 } = await c.req.json();

  const gameId = generateGameId();
  const board = generateBoard();
  const now = Date.now();

  await db.batch([
    db.prepare(`
      INSERT INTO boggle_games (id, state, board, timer_seconds, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(gameId, 'lobby', JSON.stringify(board), timerSeconds, now, user.id),

    db.prepare(`
      INSERT INTO boggle_players (game_id, user_id, score, joined_at)
      VALUES (?, ?, 0, ?)
    `).bind(gameId, user.id, now),
  ]);

  return c.json({ gameId });
});

// Join game
app.post('/api/games/:id/join', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const gameId = c.req.param('id');

  // Check game exists and is in lobby
  const game = await db.prepare(`
    SELECT state FROM boggle_games WHERE id = ?
  `).bind(gameId).first();

  if (!game) {
    return c.json({ error: 'Game not found' }, 404);
  }

  if (game.state !== 'lobby') {
    return c.json({ error: 'Game already started' }, 400);
  }

  // Check if already joined
  const existing = await db.prepare(`
    SELECT 1 FROM boggle_players WHERE game_id = ? AND user_id = ?
  `).bind(gameId, user.id).first();

  if (existing) {
    return c.json({ message: 'Already joined' });
  }

  // Join game
  await db.prepare(`
    INSERT INTO boggle_players (game_id, user_id, score, joined_at)
    VALUES (?, ?, 0, ?)
  `).bind(gameId, user.id, Date.now()).run();

  return c.json({ message: 'Joined successfully' });
});

// Start game
app.post('/api/games/:id/start', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const gameId = c.req.param('id');

  // Check if user is creator
  const game = await db.prepare(`
    SELECT created_by, state FROM boggle_games WHERE id = ?
  `).bind(gameId).first();

  if (!game) {
    return c.json({ error: 'Game not found' }, 404);
  }

  if (game.created_by !== user.id) {
    return c.json({ error: 'Only creator can start game' }, 403);
  }

  if (game.state !== 'lobby') {
    return c.json({ error: 'Game already started' }, 400);
  }

  // Start game
  const startTime = Date.now();
  await db.prepare(`
    UPDATE boggle_games
    SET state = 'playing', start_time = ?
    WHERE id = ?
  `).bind(startTime, gameId).run();

  return c.json({ message: 'Game started', startTime });
});

// Get game state (for polling)
app.get('/api/games/:id/state', async (c) => {
  const db = c.env.DB;
  const gameId = c.req.param('id');

  // Get game info
  const game = await db.prepare(`
    SELECT * FROM boggle_games WHERE id = ?
  `).bind(gameId).first();

  if (!game) {
    return c.json({ error: 'Game not found' }, 404);
  }

  // Get players with scores and aliases
  const players = await db.prepare(`
    SELECT
      p.user_id,
      p.score,
      u.alias,
      u.email
    FROM boggle_players p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.game_id = ?
    ORDER BY p.score DESC, p.joined_at ASC
  `).bind(gameId).all();

  // If game is finished or time's up, get all words
  let allWords = null;
  const now = Date.now();
  const timeUp = game.start_time && (now - (game.start_time as number)) >= ((game.timer_seconds as number) * 1000);

  // Check if we need to finish the game and calculate scores
  const needsScoring = timeUp && game.state === 'playing';

  if (needsScoring) {
    // Mark game as finished first to prevent race conditions
    await db.prepare(`
      UPDATE boggle_games SET state = 'finished' WHERE id = ? AND state = 'playing'
    `).bind(gameId).run();
    game.state = 'finished';
  }

  if (game.state === 'finished') {
    // Get all words found
    const wordsResult = await db.prepare(`
      SELECT word, user_id, points
      FROM boggle_words
      WHERE game_id = ?
      ORDER BY submitted_at ASC
    `).bind(gameId).all();

    // Only recalculate scores if we just finished (to avoid doing this on every poll)
    if (needsScoring) {
      // Calculate final scores (remove points for duplicate words)
      const wordCounts = new Map<string, number>();
      for (const w of wordsResult.results as any[]) {
        wordCounts.set(w.word, (wordCounts.get(w.word) || 0) + 1);
      }

      // Build final scores for all players (initialize with 0)
      const finalScores = new Map<string, number>();

      // Initialize all players to 0
      for (const p of players.results as any[]) {
        finalScores.set(p.user_id, 0);
      }

      // Add points for non-duplicate words
      for (const w of wordsResult.results as any[]) {
        const isDuplicate = wordCounts.get(w.word)! > 1;
        if (!isDuplicate) {
          const currentScore = finalScores.get(w.user_id) || 0;
          finalScores.set(w.user_id, currentScore + (w.points as number));
        }
      }

      // Update all player scores in database (batch update for efficiency)
      const updatePromises = [];
      for (const [userId, score] of finalScores) {
        updatePromises.push(
          db.prepare(`
            UPDATE boggle_players SET score = ? WHERE game_id = ? AND user_id = ?
          `).bind(score, gameId, userId).run()
        );
      }
      await Promise.all(updatePromises);

      // Refresh players data after updating scores
      const updatedPlayers = await db.prepare(`
        SELECT
          p.user_id,
          p.score,
          u.alias,
          u.email
        FROM boggle_players p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.game_id = ?
        ORDER BY p.score DESC, p.joined_at ASC
      `).bind(gameId).all();
      players.results = updatedPlayers.results;

      // Send ntfy notification about game completion
      const playersArray = updatedPlayers.results as any[];
      if (playersArray.length > 0) {
        const winner = playersArray[0];
        const winnerName = winner.alias || winner.email?.split('@')[0] || 'Unknown';

        // Build detailed player scores list
        const playerScores = playersArray
          .map((p: any, index: number) => {
            const name = p.alias || p.email?.split('@')[0] || 'Unknown';
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
            return `${medal} ${name}: ${p.score} pts`;
          })
          .join('\n');

        const playerCount = playersArray.length;
        const totalPoints = playersArray.reduce((sum: number, p: any) => sum + (p.score || 0), 0);

        const message = `🏆 ${winnerName} wins with ${winner.score} points!\n\n` +
                       `📊 Final Scores (${playerCount} player${playerCount !== 1 ? 's' : ''}):\n${playerScores}\n\n` +
                       `🎯 Total points scored: ${totalPoints}`;

        // Send notification (non-blocking)
        sendNtfyNotification(c.env, {
          title: '🎲 Boggle Game Finished!',
          message,
          priority: 'default',
          tags: ['game', 'boggle'],
          click: `${c.env.APP_URL}/boggle/?game=${gameId}`,
        }).catch(err => console.error('Failed to send ntfy notification:', err));
      }
    }

    // Build words list for display (always show, even on subsequent polls)
    const wordCounts = new Map<string, number>();
    for (const w of wordsResult.results as any[]) {
      wordCounts.set(w.word, (wordCounts.get(w.word) || 0) + 1);
    }

    const wordsByUser = new Map<string, any[]>();
    for (const w of wordsResult.results as any[]) {
      const isDuplicate = wordCounts.get(w.word)! > 1;
      const actualPoints = isDuplicate ? 0 : (w.points as number);

      if (!wordsByUser.has(w.user_id)) {
        wordsByUser.set(w.user_id, []);
      }
      wordsByUser.get(w.user_id)!.push({
        word: w.word,
        points: w.points,
        actualPoints,
        isDuplicate
      });
    }

    allWords = Array.from(wordsByUser.entries()).map(([userId, words]) => {
      const player = (players.results as any[]).find(p => p.user_id === userId);
      return {
        userId,
        words,
        finalScore: player?.score || 0
      };
    });
  }

  return c.json({
    game: {
      id: game.id,
      state: game.state,
      board: JSON.parse(game.board as string),
      timerSeconds: game.timer_seconds,
      startTime: game.start_time,
      createdBy: game.created_by
    },
    players: players.results,
    allWords,
    timeRemaining: game.start_time
      ? Math.max(0, ((game.timer_seconds as number) * 1000) - (now - (game.start_time as number)))
      : null
  });
});

// Submit word
app.post('/api/games/:id/submit', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const gameId = c.req.param('id');
  const { word } = await c.req.json();

  if (!word || typeof word !== 'string') {
    return c.json({ error: 'Invalid word' }, 400);
  }

  const upperWord = word.toUpperCase().trim();

  // Validate word length
  if (upperWord.length < 3) {
    return c.json({ error: 'Word must be at least 3 letters' }, 400);
  }

  // Get game
  const game = await db.prepare(`
    SELECT * FROM boggle_games WHERE id = ?
  `).bind(gameId).first();

  if (!game) {
    return c.json({ error: 'Game not found' }, 404);
  }

  if (game.state !== 'playing') {
    return c.json({ error: 'Game not in progress' }, 400);
  }

  // Check time
  const now = Date.now();
  const elapsed = now - (game.start_time as number);
  if (elapsed >= (game.timer_seconds as number) * 1000) {
    return c.json({ error: 'Time is up' }, 400);
  }

  // Check if player is in game
  const player = await db.prepare(`
    SELECT 1 FROM boggle_players WHERE game_id = ? AND user_id = ?
  `).bind(gameId, user.id).first();

  if (!player) {
    return c.json({ error: 'Not in this game' }, 403);
  }

  // Check if word already submitted by this player
  const existing = await db.prepare(`
    SELECT 1 FROM boggle_words WHERE game_id = ? AND user_id = ? AND word = ?
  `).bind(gameId, user.id, upperWord).first();

  if (existing) {
    return c.json({ error: 'Word already submitted' }, 400);
  }

  // Validate word is in dictionary
  const dictEntry = await db.prepare(`
    SELECT 1 FROM boggle_dictionary WHERE word = ?
  `).bind(upperWord).first();

  if (!dictEntry) {
    return c.json({ error: 'Not a valid word' }, 400);
  }

  // Validate word can be formed on board
  const board = JSON.parse(game.board as string);
  if (!canFormWord(upperWord, board)) {
    return c.json({ error: 'Cannot form word on board' }, 400);
  }

  // Calculate points
  const points = calculatePoints(upperWord);

  // Save word
  await db.prepare(`
    INSERT INTO boggle_words (game_id, user_id, word, points, submitted_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(gameId, user.id, upperWord, points, now).run();

  return c.json({
    message: 'Word accepted',
    word: upperWord,
    points
  });
});

// Leave game
app.post('/api/games/:id/leave', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const gameId = c.req.param('id');

  // Only allow leaving lobby games
  const game = await db.prepare(`
    SELECT state FROM boggle_games WHERE id = ?
  `).bind(gameId).first();

  if (!game) {
    return c.json({ error: 'Game not found' }, 404);
  }

  if (game.state !== 'lobby') {
    return c.json({ error: 'Cannot leave active game' }, 400);
  }

  // Remove player
  await db.prepare(`
    DELETE FROM boggle_players WHERE game_id = ? AND user_id = ?
  `).bind(gameId, user.id).run();

  // Check if any players left
  const remainingPlayers = await db.prepare(`
    SELECT COUNT(*) as count FROM boggle_players WHERE game_id = ?
  `).bind(gameId).first();

  // If no players, delete game
  if (remainingPlayers && remainingPlayers.count === 0) {
    await db.prepare(`
      DELETE FROM boggle_games WHERE id = ?
    `).bind(gameId).run();
  }

  return c.json({ message: 'Left game' });
});

// Get game history for current user
app.get('/api/history', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');

  // Get finished games where user participated
  const games = await db.prepare(`
    SELECT
      g.id,
      g.created_at,
      g.start_time,
      g.timer_seconds,
      COUNT(DISTINCT p.user_id) as player_count
    FROM boggle_games g
    INNER JOIN boggle_players p ON g.id = p.game_id
    WHERE g.state = 'finished'
      AND g.id IN (
        SELECT game_id FROM boggle_players WHERE user_id = ?
      )
    GROUP BY g.id
    ORDER BY g.created_at DESC
    LIMIT 50
  `).bind(user.id).all();

  // For each game, get the winner info
  const gamesWithWinners = await Promise.all(
    (games.results as any[]).map(async (game) => {
      const winner = await db.prepare(`
        SELECT
          p.user_id,
          p.score,
          u.alias,
          u.email
        FROM boggle_players p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.game_id = ?
        ORDER BY p.score DESC, p.joined_at ASC
        LIMIT 1
      `).bind(game.id).first();

      return {
        ...game,
        winner
      };
    })
  );

  return c.json({ games: gamesWithWinners });
});

export default app;
