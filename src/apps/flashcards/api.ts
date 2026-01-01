import { Hono } from 'hono';
import type { AppContext } from '../../types';
import { generateFlashcards } from '../../lib/card-generator';
import { calculateSM2 } from '../../lib/sm2';
import { generateChineseAudio, saveAudioToR2, getAudioFromR2, generateAudioKey } from '../../lib/tts';

const app = new Hono<AppContext>();

// ========================================
// Deck Management
// ========================================

// List all decks for current user
app.get('/api/decks', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const decks = await db
    .prepare(`
      SELECT
        d.*,
        COUNT(DISTINCT f.id) as card_count,
        COUNT(DISTINCT CASE WHEN f.due_date <= datetime('now') THEN f.id END) as due_count
      FROM flashcard_decks d
      LEFT JOIN flashcards f ON d.id = f.deck_id
      WHERE d.user_id = ?
      GROUP BY d.id
      ORDER BY d.updated_at DESC
    `)
    .bind(user.id)
    .all();

  return c.json(decks.results);
});

// Get deck details
app.get('/api/decks/:id', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const deckId = c.req.param('id');

  const deck = await db
    .prepare(`
      SELECT
        d.*,
        COUNT(DISTINCT f.id) as card_count,
        COUNT(DISTINCT CASE WHEN f.due_date <= datetime('now') THEN f.id END) as due_count
      FROM flashcard_decks d
      LEFT JOIN flashcards f ON d.id = f.deck_id
      WHERE d.id = ? AND d.user_id = ?
      GROUP BY d.id
    `)
    .bind(deckId, user.id)
    .first();

  if (!deck) {
    return c.json({ error: 'Deck not found' }, 404);
  }

  return c.json(deck);
});

// Create new deck
app.post('/api/decks', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const { name, description } = await c.req.json();

  if (!name || typeof name !== 'string') {
    return c.json({ error: 'Deck name is required' }, 400);
  }

  const result = await db
    .prepare('INSERT INTO flashcard_decks (user_id, name, description) VALUES (?, ?, ?)')
    .bind(user.id, name, description || null)
    .run();

  const deck = await db
    .prepare('SELECT * FROM flashcard_decks WHERE id = ?')
    .bind(result.meta.last_row_id)
    .first();

  return c.json(deck, 201);
});

// Update deck
app.put('/api/decks/:id', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const deckId = c.req.param('id');
  const { name, description } = await c.req.json();

  // Verify ownership
  const deck = await db
    .prepare('SELECT * FROM flashcard_decks WHERE id = ? AND user_id = ?')
    .bind(deckId, user.id)
    .first();

  if (!deck) {
    return c.json({ error: 'Deck not found' }, 404);
  }

  await db
    .prepare('UPDATE flashcard_decks SET name = ?, description = ?, updated_at = datetime("now") WHERE id = ?')
    .bind(name || deck.name, description !== undefined ? description : deck.description, deckId)
    .run();

  const updated = await db
    .prepare('SELECT * FROM flashcard_decks WHERE id = ?')
    .bind(deckId)
    .first();

  return c.json(updated);
});

// Delete deck
app.delete('/api/decks/:id', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const deckId = c.req.param('id');

  const deck = await db
    .prepare('SELECT * FROM flashcard_decks WHERE id = ? AND user_id = ?')
    .bind(deckId, user.id)
    .first();

  if (!deck) {
    return c.json({ error: 'Deck not found' }, 404);
  }

  await db
    .prepare('DELETE FROM flashcard_decks WHERE id = ?')
    .bind(deckId)
    .run();

  return c.json({ success: true });
});

// ========================================
// Card Generation Flow
// ========================================

// Start card generation session
app.post('/api/generate', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const claude = c.get('claude');
  const { deckId, inputText } = await c.req.json();

  if (!inputText || typeof inputText !== 'string') {
    return c.json({ error: 'Input text is required' }, 400);
  }

  // Verify deck ownership
  const deck = await db
    .prepare('SELECT * FROM flashcard_decks WHERE id = ? AND user_id = ?')
    .bind(deckId, user.id)
    .first();

  if (!deck) {
    return c.json({ error: 'Deck not found' }, 404);
  }

  try {
    // Generate cards using Claude
    const generatedCards = await generateFlashcards(claude, inputText);

    if (generatedCards.length === 0) {
      return c.json({ error: 'Failed to generate cards' }, 500);
    }

    // Create session
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    await db
      .prepare('INSERT INTO flashcard_generation_sessions (id, user_id, deck_id, input_text, expires_at) VALUES (?, ?, ?, ?, ?)')
      .bind(sessionId, user.id, deckId, inputText, expiresAt.toISOString())
      .run();

    // Store generated cards
    const insertStatements = generatedCards.map((card) =>
      db
        .prepare(`
          INSERT INTO flashcard_generated_cards
          (session_id, chinese, english, pinyin, breakdown, example_sentences)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          sessionId,
          card.chinese,
          card.english,
          card.pinyin,
          JSON.stringify(card.breakdown),
          JSON.stringify(card.exampleSentences)
        )
    );

    await db.batch(insertStatements);

    // Fetch stored cards
    const cards = await db
      .prepare('SELECT * FROM flashcard_generated_cards WHERE session_id = ?')
      .bind(sessionId)
      .all();

    return c.json({
      sessionId,
      cards: cards.results.map((card: any) => ({
        ...card,
        breakdown: JSON.parse(card.breakdown),
        exampleSentences: JSON.parse(card.example_sentences),
      })),
    });
  } catch (error) {
    console.error('Card generation error:', error);
    return c.json({ error: 'Failed to generate cards' }, 500);
  }
});

// Get generation session
app.get('/api/sessions/:sessionId', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const sessionId = c.req.param('sessionId');

  const session = await db
    .prepare('SELECT * FROM flashcard_generation_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, user.id)
    .first();

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const cards = await db
    .prepare('SELECT * FROM flashcard_generated_cards WHERE session_id = ?')
    .bind(sessionId)
    .all();

  return c.json({
    session,
    cards: cards.results.map((card: any) => ({
      ...card,
      breakdown: JSON.parse(card.breakdown),
      exampleSentences: JSON.parse(card.example_sentences),
    })),
  });
});

// Approve selected cards
app.post('/api/sessions/:sessionId/approve', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const sessionId = c.req.param('sessionId');
  const { cardIds } = await c.req.json();

  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    return c.json({ error: 'Card IDs array is required' }, 400);
  }

  // Verify session
  const session: any = await db
    .prepare('SELECT * FROM flashcard_generation_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, user.id)
    .first();

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  // Get selected cards
  const placeholders = cardIds.map(() => '?').join(',');
  const cards = await db
    .prepare(`SELECT * FROM flashcard_generated_cards WHERE id IN (${placeholders}) AND session_id = ?`)
    .bind(...cardIds, sessionId)
    .all();

  if (cards.results.length === 0) {
    return c.json({ error: 'No valid cards found' }, 400);
  }

  try {
    // Generate audio and create flashcards
    const createdCards = [];

    for (const cardRow of cards.results) {
      const card = cardRow as any;
      // Generate audio
      const audioBuffer = await generateChineseAudio(card.chinese);

      // Insert flashcard first to get ID
      const result = await db
        .prepare(`
          INSERT INTO flashcards
          (deck_id, user_id, chinese, english, pinyin, breakdown, example_sentences)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          session.deck_id,
          user.id,
          card.chinese,
          card.english,
          card.pinyin,
          card.breakdown,
          card.example_sentences
        )
        .run();

      const flashcardId = result.meta.last_row_id;
      const audioKey = generateAudioKey(user.id, flashcardId);

      // Save audio to R2
      await saveAudioToR2(c.env, audioKey, audioBuffer);

      // Update card with audio key
      await db
        .prepare('UPDATE flashcards SET audio_key = ? WHERE id = ?')
        .bind(audioKey, flashcardId)
        .run();

      const created = await db
        .prepare('SELECT * FROM flashcards WHERE id = ?')
        .bind(flashcardId)
        .first();

      createdCards.push(created);
    }

    // Mark session as completed
    await db
      .prepare('UPDATE flashcard_generation_sessions SET status = ? WHERE id = ?')
      .bind('completed', sessionId)
      .run();

    return c.json({
      approved: createdCards.length,
      cards: createdCards.map((card: any) => ({
        ...card,
        breakdown: JSON.parse(card.breakdown),
        exampleSentences: JSON.parse(card.example_sentences),
      })),
    });
  } catch (error) {
    console.error('Card approval error:', error);
    return c.json({ error: 'Failed to approve cards' }, 500);
  }
});

// Cancel session
app.delete('/api/sessions/:sessionId', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const sessionId = c.req.param('sessionId');

  const session = await db
    .prepare('SELECT * FROM flashcard_generation_sessions WHERE id = ? AND user_id = ?')
    .bind(sessionId, user.id)
    .first();

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  await db
    .prepare('UPDATE flashcard_generation_sessions SET status = ? WHERE id = ?')
    .bind('cancelled', sessionId)
    .run();

  return c.json({ success: true });
});

// ========================================
// Review System
// ========================================

// Get cards due for review
app.get('/api/decks/:deckId/due', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const deckId = c.req.param('deckId');

  // Verify deck ownership
  const deck = await db
    .prepare('SELECT * FROM flashcard_decks WHERE id = ? AND user_id = ?')
    .bind(deckId, user.id)
    .first();

  if (!deck) {
    return c.json({ error: 'Deck not found' }, 404);
  }

  const cards = await db
    .prepare(`
      SELECT * FROM flashcards
      WHERE deck_id = ? AND due_date <= datetime('now')
      ORDER BY due_date ASC
    `)
    .bind(deckId)
    .all();

  return c.json(
    cards.results.map((card: any) => ({
      ...card,
      breakdown: JSON.parse(card.breakdown),
      exampleSentences: JSON.parse(card.example_sentences),
    }))
  );
});

// Submit review
app.post('/api/cards/:cardId/review', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const cardId = c.req.param('cardId');
  const { quality, timeTakenMs } = await c.req.json();

  if (quality === undefined || quality < 0 || quality > 3) {
    return c.json({ error: 'Quality must be 0-3 (Again, Hard, Good, Easy)' }, 400);
  }

  // Verify card ownership
  const card: any = await db
    .prepare('SELECT * FROM flashcards WHERE id = ? AND user_id = ?')
    .bind(cardId, user.id)
    .first();

  if (!card) {
    return c.json({ error: 'Card not found' }, 404);
  }

  // Calculate new SM-2 values
  const sm2Result = calculateSM2({
    quality,
    repetitions: card.repetitions,
    previousInterval: card.interval,
    previousEaseFactor: card.easiness_factor,
  });

  // Update card
  await db
    .prepare(`
      UPDATE flashcards
      SET easiness_factor = ?, interval = ?, repetitions = ?, due_date = ?, last_reviewed_at = datetime('now')
      WHERE id = ?
    `)
    .bind(
      sm2Result.easinessFactor,
      sm2Result.interval,
      sm2Result.repetitions,
      sm2Result.dueDate.toISOString(),
      cardId
    )
    .run();

  // Save review history
  await db
    .prepare(`
      INSERT INTO flashcard_reviews
      (card_id, user_id, quality, time_taken_ms, easiness_factor, interval, repetitions)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      cardId,
      user.id,
      quality,
      timeTakenMs || null,
      sm2Result.easinessFactor,
      sm2Result.interval,
      sm2Result.repetitions
    )
    .run();

  return c.json({
    nextReview: sm2Result.dueDate.toISOString(),
    interval: sm2Result.interval,
    repetitions: sm2Result.repetitions,
    easinessFactor: sm2Result.easinessFactor,
  });
});

// ========================================
// Card Management
// ========================================

// List all cards in deck
app.get('/api/decks/:deckId/cards', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const deckId = c.req.param('deckId');

  // Verify deck ownership
  const deck = await db
    .prepare('SELECT * FROM flashcard_decks WHERE id = ? AND user_id = ?')
    .bind(deckId, user.id)
    .first();

  if (!deck) {
    return c.json({ error: 'Deck not found' }, 404);
  }

  const cards = await db
    .prepare('SELECT * FROM flashcards WHERE deck_id = ? ORDER BY created_at DESC')
    .bind(deckId)
    .all();

  return c.json(
    cards.results.map((card: any) => ({
      ...card,
      breakdown: JSON.parse(card.breakdown),
      exampleSentences: JSON.parse(card.example_sentences),
    }))
  );
});

// Get card details
app.get('/api/cards/:cardId', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const cardId = c.req.param('cardId');

  const card: any = await db
    .prepare('SELECT * FROM flashcards WHERE id = ? AND user_id = ?')
    .bind(cardId, user.id)
    .first();

  if (!card) {
    return c.json({ error: 'Card not found' }, 404);
  }

  return c.json({
    ...card,
    breakdown: JSON.parse(card.breakdown),
    exampleSentences: JSON.parse(card.example_sentences),
  });
});

// Delete card
app.delete('/api/cards/:cardId', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const cardId = c.req.param('cardId');

  const card = await db
    .prepare('SELECT * FROM flashcards WHERE id = ? AND user_id = ?')
    .bind(cardId, user.id)
    .first();

  if (!card) {
    return c.json({ error: 'Card not found' }, 404);
  }

  await db
    .prepare('DELETE FROM flashcards WHERE id = ?')
    .bind(cardId)
    .run();

  return c.json({ success: true });
});

// ========================================
// Audio Serving
// ========================================

// Serve audio from R2
app.get('/api/audio/:audioKey', async (c) => {
  const audioKey = c.req.param('audioKey');

  try {
    const audioBuffer = await getAudioFromR2(c.env, `audio/${audioKey}`);

    if (!audioBuffer) {
      return c.json({ error: 'Audio not found' }, 404);
    }

    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    });
  } catch (error) {
    console.error('Audio retrieval error:', error);
    return c.json({ error: 'Failed to retrieve audio' }, 500);
  }
});

// ========================================
// Statistics
// ========================================

// Get user statistics
app.get('/api/stats', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const stats = await db
    .prepare(`
      SELECT
        COUNT(DISTINCT d.id) as total_decks,
        COUNT(DISTINCT f.id) as total_cards,
        COUNT(DISTINCT CASE WHEN f.due_date <= datetime('now') THEN f.id END) as cards_due,
        COUNT(DISTINCT CASE WHEN DATE(r.reviewed_at) = DATE('now') THEN r.id END) as reviews_today,
        AVG(f.easiness_factor) as avg_easiness
      FROM flashcard_decks d
      LEFT JOIN flashcards f ON d.id = f.deck_id
      LEFT JOIN flashcard_reviews r ON f.id = r.card_id
      WHERE d.user_id = ?
    `)
    .bind(user.id)
    .first();

  return c.json(stats);
});

// Get deck statistics
app.get('/api/decks/:deckId/stats', async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const deckId = c.req.param('deckId');

  // Verify deck ownership
  const deck = await db
    .prepare('SELECT * FROM flashcard_decks WHERE id = ? AND user_id = ?')
    .bind(deckId, user.id)
    .first();

  if (!deck) {
    return c.json({ error: 'Deck not found' }, 404);
  }

  const stats = await db
    .prepare(`
      SELECT
        COUNT(DISTINCT f.id) as total_cards,
        COUNT(DISTINCT CASE WHEN f.due_date <= datetime('now') THEN f.id END) as cards_due,
        COUNT(DISTINCT CASE WHEN f.repetitions = 0 THEN f.id END) as new_cards,
        AVG(f.easiness_factor) as avg_easiness,
        COUNT(DISTINCT r.id) as total_reviews
      FROM flashcards f
      LEFT JOIN flashcard_reviews r ON f.id = r.card_id
      WHERE f.deck_id = ?
    `)
    .bind(deckId)
    .first();

  return c.json(stats);
});

export default app;
