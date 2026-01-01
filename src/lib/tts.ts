import type { Env } from '../types';

/**
 * Generate Chinese audio using Google Translate TTS (unofficial endpoint)
 * @param text Chinese text to convert to speech
 * @returns ArrayBuffer containing MP3 audio data
 */
export async function generateChineseAudio(text: string): Promise<ArrayBuffer> {
  // URL encode the text for use in query parameter
  const encodedText = encodeURIComponent(text);

  // Google Translate TTS endpoint
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=zh-CN&client=tw-ob&q=${encodedText}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status}`);
  }

  return response.arrayBuffer();
}

/**
 * Save audio buffer to R2 storage
 * @param env Environment containing R2 binding
 * @param key R2 object key
 * @param audioBuffer Audio data to store
 */
export async function saveAudioToR2(
  env: Env,
  key: string,
  audioBuffer: ArrayBuffer
): Promise<void> {
  await env.FLASHCARD_AUDIO.put(key, audioBuffer, {
    httpMetadata: {
      contentType: 'audio/mpeg',
    },
  });
}

/**
 * Retrieve audio from R2 storage
 * @param env Environment containing R2 binding
 * @param key R2 object key
 * @returns Audio buffer or null if not found
 */
export async function getAudioFromR2(
  env: Env,
  key: string
): Promise<ArrayBuffer | null> {
  const object = await env.FLASHCARD_AUDIO.get(key);
  if (!object) return null;
  return object.arrayBuffer();
}

/**
 * Generate a unique R2 key for audio storage
 * @param userId User ID
 * @param cardId Card ID (can be session card ID or final card ID)
 * @returns R2 object key
 */
export function generateAudioKey(userId: string, cardId: string | number): string {
  return `audio/${userId}/${cardId}.mp3`;
}
