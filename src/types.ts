import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type Anthropic from '@anthropic-ai/sdk';

export interface Env {
  DB: D1Database;
  ANTHROPIC_API_KEY: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  APP_URL: string;
  NTFY_DEBUG_TOPIC?: string;
  FLASHCARD_AUDIO: R2Bucket;
}

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Variables {
  user: User;
  claude: Anthropic;
}

export type AppContext = {
  Bindings: Env;
  Variables: Variables;
};
