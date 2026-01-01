import type { Env } from '../types';

export interface NtfyNotification {
  title: string;
  message: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'max';
  tags?: string[];
  click?: string; // URL to open when notification is clicked
}

/**
 * Send a notification to ntfy.sh
 * @param env Environment bindings (must include NTFY_DEBUG_TOPIC)
 * @param notification The notification to send
 * @returns Promise that resolves when notification is sent
 */
export async function sendNtfyNotification(
  env: Env,
  notification: NtfyNotification
): Promise<void> {
  const topic = env.NTFY_DEBUG_TOPIC;

  if (!topic) {
    console.warn('NTFY_DEBUG_TOPIC not configured, skipping notification');
    return;
  }

  const url = `https://ntfy.sh/${topic}`;
  console.log(`Sending ntfy notification to ${url}:`, notification.title);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Title': notification.title,
        'Priority': notification.priority || 'default',
        ...(notification.tags && { 'Tags': notification.tags.join(',') }),
        ...(notification.click && { 'Click': notification.click }),
      },
      body: notification.message,
    });

    if (!response.ok) {
      console.error('Failed to send ntfy notification:', response.status, await response.text());
    } else {
      console.log('Successfully sent ntfy notification:', notification.title);
    }
  } catch (error) {
    console.error('Error sending ntfy notification:', error);
  }
}
