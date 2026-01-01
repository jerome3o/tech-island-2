import Anthropic from '@anthropic-ai/sdk';
import type { Context, Next } from 'hono';
import type { AppContext } from '../types';

/**
 * Middleware to inject an Anthropic client into the context.
 */
export async function claudeMiddleware(c: Context<AppContext>, next: Next) {
  const client = new Anthropic({
    apiKey: c.env.ANTHROPIC_API_KEY
  });

  c.set('claude', client);
  return next();
}

/**
 * Get the Claude client from context.
 */
export function getClaude(c: Context<AppContext>): Anthropic {
  return c.get('claude');
}

/**
 * Simple helper for common text generation use case.
 */
export async function generateText(
  claude: Anthropic,
  prompt: string,
  options: {
    model?: string;
    maxTokens?: number;
    system?: string;
  } = {}
): Promise<string> {
  const response = await claude.messages.create({
    model: options.model ?? 'claude-sonnet-4-20250514',
    max_tokens: options.maxTokens ?? 1024,
    system: options.system,
    messages: [{ role: 'user', content: prompt }]
  });

  const textBlock = response.content.find(block => block.type === 'text');
  return textBlock?.text ?? '';
}

/**
 * Helper for structured output using tool use.
 */
export async function generateStructured<T>(
  claude: Anthropic,
  prompt: string,
  schema: {
    name: string;
    description: string;
    input_schema: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  },
  options: {
    model?: string;
    maxTokens?: number;
    system?: string;
  } = {}
): Promise<T | null> {
  const response = await claude.messages.create({
    model: options.model ?? 'claude-sonnet-4-20250514',
    max_tokens: options.maxTokens ?? 1024,
    system: options.system,
    messages: [{ role: 'user', content: prompt }],
    tools: [{
      name: schema.name,
      description: schema.description,
      input_schema: schema.input_schema
    }],
    tool_choice: { type: 'tool', name: schema.name }
  });

  const toolUse = response.content.find(block => block.type === 'tool_use');
  if (toolUse && toolUse.type === 'tool_use') {
    return toolUse.input as T;
  }

  return null;
}
