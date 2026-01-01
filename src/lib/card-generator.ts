import type Anthropic from '@anthropic-ai/sdk';
import { generateStructured } from './claude';

interface CharacterBreakdown {
  character: string;
  pinyin: string;
  meaning: string;
}

interface ExampleSentence {
  chinese: string;
  english: string;
  pinyin: string;
}

export interface GeneratedCard {
  chinese: string;
  english: string;
  pinyin: string;
  breakdown: CharacterBreakdown[];
  exampleSentences: ExampleSentence[];
}

/**
 * Generate flashcards for Chinese learning using Claude API
 * @param claude Anthropic client
 * @param inputText Chinese text (word or phrase)
 * @returns Array of generated flashcard variations
 */
export async function generateFlashcards(
  claude: Anthropic,
  inputText: string
): Promise<GeneratedCard[]> {
  const prompt = `You are a Chinese language learning expert. Generate flashcards for learning Chinese.

Input: "${inputText}"

Rules:
1. If input is a single word (1-2 characters): Create 1 card with the word, meaning, pinyin, character breakdown, and 2-3 example sentences showing different contexts/usages
2. If input is a phrase (3+ characters): Create 2-4 cards with different variations:
   - Different formality levels (formal vs informal)
   - Alternative phrasings with similar meanings
   - Different contexts where the phrase is used

3. For each card provide:
   - Chinese characters (simplified Chinese)
   - English translation
   - Pinyin with tone marks using accents (e.g., nǐ hǎo, NOT ni3 hao3)
   - Character-by-character breakdown (each character's pinyin and individual meaning)
   - 2-3 example sentences using the word/phrase in context

Make cards useful for intermediate learners. Focus on practical, everyday usage.`;

  const schema = {
    name: 'generate_flashcards',
    description: 'Generate Chinese learning flashcards',
    input_schema: {
      type: 'object' as const,
      properties: {
        cards: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              chinese: {
                type: 'string',
                description: 'The Chinese characters for this card'
              },
              english: {
                type: 'string',
                description: 'English translation'
              },
              pinyin: {
                type: 'string',
                description: 'Pinyin with tone marks using accents (e.g., nǐ hǎo)'
              },
              breakdown: {
                type: 'array',
                description: 'Character-by-character breakdown',
                items: {
                  type: 'object',
                  properties: {
                    character: { type: 'string' },
                    pinyin: { type: 'string' },
                    meaning: { type: 'string' },
                  },
                  required: ['character', 'pinyin', 'meaning'],
                },
              },
              exampleSentences: {
                type: 'array',
                description: '2-3 example sentences using the word/phrase',
                items: {
                  type: 'object',
                  properties: {
                    chinese: { type: 'string' },
                    english: { type: 'string' },
                    pinyin: { type: 'string' },
                  },
                  required: ['chinese', 'english', 'pinyin'],
                },
              },
            },
            required: ['chinese', 'english', 'pinyin', 'breakdown', 'exampleSentences'],
          },
        },
      },
      required: ['cards'],
    },
  };

  const result = await generateStructured<{ cards: GeneratedCard[] }>(
    claude,
    prompt,
    schema,
    { maxTokens: 4096 }
  );

  return result?.cards || [];
}
