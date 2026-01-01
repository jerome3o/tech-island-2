export interface SM2Result {
  interval: number; // days until next review
  repetitions: number;
  easinessFactor: number;
  dueDate: Date;
}

export interface SM2Input {
  quality: number; // 0-3: Again, Hard, Good, Easy
  repetitions: number;
  previousInterval: number;
  previousEaseFactor: number;
}

/**
 * SM-2 Algorithm implementation (Anki-style)
 * @param input Current card state and review quality
 * @returns Updated card state
 */
export function calculateSM2(input: SM2Input): SM2Result {
  const { quality, repetitions, previousInterval, previousEaseFactor } = input;

  let newEaseFactor = previousEaseFactor;
  let newRepetitions = repetitions;
  let newInterval = previousInterval;

  // Update easiness factor (only for quality >= 2)
  if (quality >= 2) {
    newEaseFactor = Math.max(
      1.3,
      previousEaseFactor + (0.1 - (3 - quality) * (0.08 + (3 - quality) * 0.02))
    );
  }

  // Calculate interval based on quality
  if (quality === 0) {
    // Again - restart
    newRepetitions = 0;
    newInterval = 1; // 1 day (or 10 minutes for same-day review)
  } else if (quality === 1) {
    // Hard - same interval but don't increase repetitions
    newInterval = Math.max(1, Math.floor(previousInterval * 1.2));
  } else if (quality === 2) {
    // Good - standard progression
    newRepetitions = repetitions + 1;
    if (newRepetitions === 1) {
      newInterval = 1;
    } else if (newRepetitions === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(previousInterval * newEaseFactor);
    }
  } else if (quality === 3) {
    // Easy - accelerated progression
    newRepetitions = repetitions + 1;
    if (newRepetitions === 1) {
      newInterval = 4;
    } else {
      newInterval = Math.round(previousInterval * newEaseFactor * 1.3);
    }
  }

  // Calculate due date
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + newInterval);

  return {
    interval: newInterval,
    repetitions: newRepetitions,
    easinessFactor: newEaseFactor,
    dueDate,
  };
}
