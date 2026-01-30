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

// Generate unique tournament ID
function generateTournamentId(): string {
  return `tourn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

// ============================================
// Tournament API Endpoints
// ============================================

// List active tournaments (lobby or active)
app.get('/api/tournaments', async (c) => {
  const db = c.env.DB;

  const tournaments = await db.prepare(`
    SELECT
      t.id,
      t.state,
      t.target_score,
      t.timer_seconds,
      t.created_at,
      t.created_by,
      COUNT(DISTINCT tp.user_id) as player_count
    FROM boggle_tournaments t
    LEFT JOIN boggle_tournament_players tp ON t.id = tp.tournament_id
    WHERE t.state IN ('lobby', 'active')
    GROUP BY t.id
    ORDER BY t.created_at DESC
    LIMIT 20
  `).all();

  return c.json({ tournaments: tournaments.results });
});

// Create new tournament
app.post('/api/tournaments', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const { targetScore = 100, timerSeconds = 120 } = await c.req.json();

  const tournamentId = generateTournamentId();
  const now = Date.now();

  await db.batch([
    db.prepare(`
      INSERT INTO boggle_tournaments (id, state, target_score, timer_seconds, created_at, created_by, last_activity_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(tournamentId, 'lobby', targetScore, timerSeconds, now, user.id, now),

    db.prepare(`
      INSERT INTO boggle_tournament_players (tournament_id, user_id, total_score, ready, joined_at)
      VALUES (?, ?, 0, 0, ?)
    `).bind(tournamentId, user.id, now),
  ]);

  return c.json({ tournamentId });
});

// Join tournament
app.post('/api/tournaments/:id/join', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const tournamentId = c.req.param('id');

  // Check tournament exists and is in lobby
  const tournament = await db.prepare(`
    SELECT state FROM boggle_tournaments WHERE id = ?
  `).bind(tournamentId).first();

  if (!tournament) {
    return c.json({ error: 'Tournament not found' }, 404);
  }

  if (tournament.state !== 'lobby') {
    return c.json({ error: 'Tournament already started' }, 400);
  }

  // Check if already joined
  const existing = await db.prepare(`
    SELECT 1 FROM boggle_tournament_players WHERE tournament_id = ? AND user_id = ?
  `).bind(tournamentId, user.id).first();

  if (existing) {
    return c.json({ message: 'Already joined' });
  }

  // Join tournament
  await db.prepare(`
    INSERT INTO boggle_tournament_players (tournament_id, user_id, total_score, ready, joined_at)
    VALUES (?, ?, 0, 0, ?)
  `).bind(tournamentId, user.id, Date.now()).run();

  return c.json({ message: 'Joined successfully' });
});

// Leave tournament (lobby only)
app.post('/api/tournaments/:id/leave', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const tournamentId = c.req.param('id');

  // Only allow leaving lobby tournaments
  const tournament = await db.prepare(`
    SELECT state FROM boggle_tournaments WHERE id = ?
  `).bind(tournamentId).first();

  if (!tournament) {
    return c.json({ error: 'Tournament not found' }, 404);
  }

  if (tournament.state !== 'lobby') {
    return c.json({ error: 'Cannot leave active tournament' }, 400);
  }

  // Remove player
  await db.prepare(`
    DELETE FROM boggle_tournament_players WHERE tournament_id = ? AND user_id = ?
  `).bind(tournamentId, user.id).run();

  // Check if any players left
  const remainingPlayers = await db.prepare(`
    SELECT COUNT(*) as count FROM boggle_tournament_players WHERE tournament_id = ?
  `).bind(tournamentId).first();

  // If no players, delete tournament
  if (remainingPlayers && remainingPlayers.count === 0) {
    await db.prepare(`
      DELETE FROM boggle_tournaments WHERE id = ?
    `).bind(tournamentId).run();
  }

  return c.json({ message: 'Left tournament' });
});

// Start tournament
app.post('/api/tournaments/:id/start', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const tournamentId = c.req.param('id');

  // Check if user is creator
  const tournament = await db.prepare(`
    SELECT created_by, state, timer_seconds FROM boggle_tournaments WHERE id = ?
  `).bind(tournamentId).first();

  if (!tournament) {
    return c.json({ error: 'Tournament not found' }, 404);
  }

  if (tournament.created_by !== user.id) {
    return c.json({ error: 'Only creator can start tournament' }, 403);
  }

  if (tournament.state !== 'lobby') {
    return c.json({ error: 'Tournament already started' }, 400);
  }

  // Get all players
  const players = await db.prepare(`
    SELECT user_id FROM boggle_tournament_players WHERE tournament_id = ?
  `).bind(tournamentId).all();

  // Create first game
  const gameId = generateGameId();
  const board = generateBoard();
  const now = Date.now();

  await db.batch([
    // Create the game
    db.prepare(`
      INSERT INTO boggle_games (id, state, board, timer_seconds, created_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(gameId, 'lobby', JSON.stringify(board), tournament.timer_seconds, now, user.id),

    // Add all tournament players to the game
    ...((players.results as any[]).map(p =>
      db.prepare(`
        INSERT INTO boggle_players (game_id, user_id, score, joined_at)
        VALUES (?, ?, 0, ?)
      `).bind(gameId, p.user_id, now)
    )),

    // Link game to tournament
    db.prepare(`
      INSERT INTO boggle_tournament_games (tournament_id, game_id, game_number)
      VALUES (?, ?, 1)
    `).bind(tournamentId, gameId),

    // Update tournament state
    db.prepare(`
      UPDATE boggle_tournaments
      SET state = 'active', current_game_id = ?, last_activity_at = ?
      WHERE id = ?
    `).bind(gameId, now, tournamentId),

    // Mark all players as not ready (for between-game readiness)
    db.prepare(`
      UPDATE boggle_tournament_players SET ready = 0 WHERE tournament_id = ?
    `).bind(tournamentId),

    // Start the game immediately
    db.prepare(`
      UPDATE boggle_games SET state = 'playing', start_time = ? WHERE id = ?
    `).bind(now, gameId),
  ]);

  return c.json({ message: 'Tournament started', gameId });
});

// Get tournament state (for polling)
app.get('/api/tournaments/:id/state', async (c) => {
  const db = c.env.DB;
  const tournamentId = c.req.param('id');
  const now = Date.now();

  // Get tournament info
  const tournament = await db.prepare(`
    SELECT * FROM boggle_tournaments WHERE id = ?
  `).bind(tournamentId).first();

  if (!tournament) {
    return c.json({ error: 'Tournament not found' }, 404);
  }

  // Get tournament players with scores and aliases
  const players = await db.prepare(`
    SELECT
      tp.user_id,
      tp.total_score,
      tp.ready,
      u.alias,
      u.email
    FROM boggle_tournament_players tp
    LEFT JOIN users u ON tp.user_id = u.id
    WHERE tp.tournament_id = ?
    ORDER BY tp.total_score DESC, tp.joined_at ASC
  `).bind(tournamentId).all();

  // Get all games in this tournament
  const tournamentGames = await db.prepare(`
    SELECT
      tg.game_id,
      tg.game_number,
      g.state as game_state,
      g.created_at
    FROM boggle_tournament_games tg
    JOIN boggle_games g ON tg.game_id = g.id
    WHERE tg.tournament_id = ?
    ORDER BY tg.game_number ASC
  `).bind(tournamentId).all();

  let currentGameState: any = null;
  let betweenGames = false;
  let needsNewGame = false;

  // If tournament is active, check current game state
  if (tournament.state === 'active' && tournament.current_game_id) {
    // Get current game state using existing endpoint logic
    const gameResponse = await fetch(`${c.env.APP_URL || ''}/boggle/api/games/${tournament.current_game_id}/state`, {
      headers: c.req.raw.headers
    });

    if (gameResponse.ok) {
      currentGameState = await gameResponse.json();

      // Check if game just finished
      if (currentGameState.game.state === 'finished') {
        // Update player scores in tournament
        for (const player of currentGameState.players as any[]) {
          await db.prepare(`
            UPDATE boggle_tournament_players
            SET total_score = total_score + ?
            WHERE tournament_id = ? AND user_id = ?
          `).bind(player.score, tournamentId, player.user_id).run();
        }

        // Update last activity
        await db.prepare(`
          UPDATE boggle_tournaments SET last_activity_at = ? WHERE id = ?
        `).bind(now, tournamentId).run();

        // Refresh player scores
        const updatedPlayers = await db.prepare(`
          SELECT
            tp.user_id,
            tp.total_score,
            tp.ready,
            u.alias,
            u.email
          FROM boggle_tournament_players tp
          LEFT JOIN users u ON tp.user_id = u.id
          WHERE tp.tournament_id = ?
          ORDER BY tp.total_score DESC, tp.joined_at ASC
        `).bind(tournamentId).all();
        players.results = updatedPlayers.results;

        // Check if someone won
        const leader = players.results[0] as any;
        if (leader && leader.total_score >= (tournament.target_score as number)) {
          // Tournament finished!
          await db.prepare(`
            UPDATE boggle_tournaments
            SET state = 'finished', winner_id = ?, finished_at = ?
            WHERE id = ? AND state = 'active'
          `).bind(leader.user_id, now, tournamentId).run();
          tournament.state = 'finished';
          tournament.winner_id = leader.user_id;
          tournament.finished_at = now;

          // Send ntfy notification about tournament completion
          const winnerName = leader.alias || leader.email?.split('@')[0] || 'Unknown';
          const gamesPlayed = tournamentGames.results.length;

          const playerScores = (players.results as any[])
            .map((p: any, index: number) => {
              const name = p.alias || p.email?.split('@')[0] || 'Unknown';
              const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
              return `${medal} ${name}: ${p.total_score} pts`;
            })
            .join('\n');

          const message = `🏆 ${winnerName} wins the tournament with ${leader.total_score} points!\n\n` +
                         `🎮 Games played: ${gamesPlayed}\n` +
                         `🎯 Target score: ${tournament.target_score}\n\n` +
                         `📊 Final Standings:\n${playerScores}`;

          sendNtfyNotification(c.env, {
            title: '🏆 Boggle Tournament Complete!',
            message,
            priority: 'high',
            tags: ['tournament', 'boggle', 'winner'],
            click: `${c.env.APP_URL}/boggle/?tournament=${tournamentId}`,
          }).catch(err => console.error('Failed to send ntfy notification:', err));
        } else {
          // No winner yet, we're between games
          betweenGames = true;

          // Reset ready status for all players (they need to ready up again)
          // But only if we haven't already done this for this game
          const allReady = (players.results as any[]).every(p => p.ready === 1);
          if (!allReady) {
            // Check if all players are ready for next game
            const readyCount = (players.results as any[]).filter(p => p.ready === 1).length;
            const totalPlayers = players.results.length;

            if (readyCount === totalPlayers && totalPlayers > 0) {
              needsNewGame = true;
            }
          } else {
            needsNewGame = true;
          }
        }
      }
    }
  }

  // Create new game if all players are ready
  if (needsNewGame && tournament.state === 'active') {
    const gameId = generateGameId();
    const board = generateBoard();
    const gameNumber = tournamentGames.results.length + 1;

    const playersList = players.results as any[];

    await db.batch([
      // Create the game
      db.prepare(`
        INSERT INTO boggle_games (id, state, board, timer_seconds, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(gameId, 'playing', JSON.stringify(board), tournament.timer_seconds, now, tournament.created_by),

      // Add all tournament players to the game
      ...(playersList.map(p =>
        db.prepare(`
          INSERT INTO boggle_players (game_id, user_id, score, joined_at)
          VALUES (?, ?, 0, ?)
        `).bind(gameId, p.user_id, now)
      )),

      // Link game to tournament
      db.prepare(`
        INSERT INTO boggle_tournament_games (tournament_id, game_id, game_number)
        VALUES (?, ?, ?)
      `).bind(tournamentId, gameId, gameNumber),

      // Update tournament
      db.prepare(`
        UPDATE boggle_tournaments
        SET current_game_id = ?, last_activity_at = ?
        WHERE id = ?
      `).bind(gameId, now, tournamentId),

      // Reset ready status
      db.prepare(`
        UPDATE boggle_tournament_players SET ready = 0 WHERE tournament_id = ?
      `).bind(tournamentId),

      // Start the game
      db.prepare(`
        UPDATE boggle_games SET start_time = ? WHERE id = ?
      `).bind(now, gameId),
    ]);

    // Update current game state
    tournament.current_game_id = gameId;
    betweenGames = false;

    // Fetch new game state
    const newGameResponse = await fetch(`${c.env.APP_URL || ''}/boggle/api/games/${gameId}/state`, {
      headers: c.req.raw.headers
    });
    if (newGameResponse.ok) {
      currentGameState = await newGameResponse.json();
    }

    // Refresh tournament games list
    const refreshedGames = await db.prepare(`
      SELECT
        tg.game_id,
        tg.game_number,
        g.state as game_state,
        g.created_at
      FROM boggle_tournament_games tg
      JOIN boggle_games g ON tg.game_id = g.id
      WHERE tg.tournament_id = ?
      ORDER BY tg.game_number ASC
    `).bind(tournamentId).all();
    tournamentGames.results = refreshedGames.results;
  }

  return c.json({
    tournament: {
      id: tournament.id,
      state: tournament.state,
      targetScore: tournament.target_score,
      timerSeconds: tournament.timer_seconds,
      createdBy: tournament.created_by,
      createdAt: tournament.created_at,
      winnerId: tournament.winner_id,
      finishedAt: tournament.finished_at,
      currentGameId: tournament.current_game_id
    },
    players: players.results,
    games: tournamentGames.results,
    currentGame: currentGameState,
    betweenGames
  });
});

// Ready up for next game
app.post('/api/tournaments/:id/ready', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');
  const tournamentId = c.req.param('id');

  // Check tournament exists and is active
  const tournament = await db.prepare(`
    SELECT state FROM boggle_tournaments WHERE id = ?
  `).bind(tournamentId).first();

  if (!tournament) {
    return c.json({ error: 'Tournament not found' }, 404);
  }

  if (tournament.state !== 'active') {
    return c.json({ error: 'Tournament not active' }, 400);
  }

  // Check if player is in tournament
  const player = await db.prepare(`
    SELECT ready FROM boggle_tournament_players WHERE tournament_id = ? AND user_id = ?
  `).bind(tournamentId, user.id).first();

  if (!player) {
    return c.json({ error: 'Not in this tournament' }, 403);
  }

  // Toggle ready status
  const newReady = player.ready === 1 ? 0 : 1;
  await db.prepare(`
    UPDATE boggle_tournament_players SET ready = ? WHERE tournament_id = ? AND user_id = ?
  `).bind(newReady, tournamentId, user.id).run();

  // Update last activity
  await db.prepare(`
    UPDATE boggle_tournaments SET last_activity_at = ? WHERE id = ?
  `).bind(Date.now(), tournamentId).run();

  return c.json({ ready: newReady === 1 });
});

// Get tournament history for current user
app.get('/api/tournament-history', async (c) => {
  const db = c.env.DB;
  const user = c.get('user');

  // Get finished tournaments where user participated
  const tournaments = await db.prepare(`
    SELECT
      t.id,
      t.target_score,
      t.timer_seconds,
      t.created_at,
      t.finished_at,
      t.winner_id,
      COUNT(DISTINCT tp.user_id) as player_count,
      COUNT(DISTINCT tg.game_id) as games_played
    FROM boggle_tournaments t
    INNER JOIN boggle_tournament_players tp ON t.id = tp.tournament_id
    LEFT JOIN boggle_tournament_games tg ON t.id = tg.tournament_id
    WHERE t.state = 'finished'
      AND t.id IN (
        SELECT tournament_id FROM boggle_tournament_players WHERE user_id = ?
      )
    GROUP BY t.id
    ORDER BY t.finished_at DESC
    LIMIT 50
  `).bind(user.id).all();

  // For each tournament, get the winner info
  const tournamentsWithWinners = await Promise.all(
    (tournaments.results as any[]).map(async (tournament) => {
      let winner = null;
      if (tournament.winner_id) {
        const winnerPlayer = await db.prepare(`
          SELECT
            tp.user_id,
            tp.total_score,
            u.alias,
            u.email
          FROM boggle_tournament_players tp
          LEFT JOIN users u ON tp.user_id = u.id
          WHERE tp.tournament_id = ? AND tp.user_id = ?
        `).bind(tournament.id, tournament.winner_id).first();
        winner = winnerPlayer;
      }

      return {
        ...tournament,
        winner
      };
    })
  );

  return c.json({ tournaments: tournamentsWithWinners });
});

// Get tournament summary (detailed results)
app.get('/api/tournaments/:id/summary', async (c) => {
  const db = c.env.DB;
  const tournamentId = c.req.param('id');

  // Get tournament info
  const tournament = await db.prepare(`
    SELECT * FROM boggle_tournaments WHERE id = ?
  `).bind(tournamentId).first();

  if (!tournament) {
    return c.json({ error: 'Tournament not found' }, 404);
  }

  // Get players with final scores
  const players = await db.prepare(`
    SELECT
      tp.user_id,
      tp.total_score,
      u.alias,
      u.email
    FROM boggle_tournament_players tp
    LEFT JOIN users u ON tp.user_id = u.id
    WHERE tp.tournament_id = ?
    ORDER BY tp.total_score DESC, tp.joined_at ASC
  `).bind(tournamentId).all();

  // Get all games with their results
  const games = await db.prepare(`
    SELECT
      tg.game_id,
      tg.game_number,
      g.state as game_state,
      g.created_at,
      g.start_time,
      g.timer_seconds
    FROM boggle_tournament_games tg
    JOIN boggle_games g ON tg.game_id = g.id
    WHERE tg.tournament_id = ?
    ORDER BY tg.game_number ASC
  `).bind(tournamentId).all();

  // Get scores for each game
  const gamesWithScores = await Promise.all(
    (games.results as any[]).map(async (game) => {
      const scores = await db.prepare(`
        SELECT
          bp.user_id,
          bp.score,
          u.alias,
          u.email
        FROM boggle_players bp
        LEFT JOIN users u ON bp.user_id = u.id
        WHERE bp.game_id = ?
        ORDER BY bp.score DESC
      `).bind(game.game_id).all();

      return {
        ...game,
        scores: scores.results
      };
    })
  );

  return c.json({
    tournament: {
      id: tournament.id,
      state: tournament.state,
      targetScore: tournament.target_score,
      timerSeconds: tournament.timer_seconds,
      createdAt: tournament.created_at,
      finishedAt: tournament.finished_at,
      winnerId: tournament.winner_id
    },
    players: players.results,
    games: gamesWithScores
  });
});

export default app;
