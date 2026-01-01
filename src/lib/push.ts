import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types';

/**
 * Push notification helpers.
 *
 * Web Push requires VAPID keys for authentication.
 * Generate them with: npm run generate-vapid
 */

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

/**
 * Save a push subscription for a user.
 */
export async function saveSubscription(
  db: D1Database,
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  await db.prepare(`
    INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT (user_id) DO UPDATE SET
      endpoint = excluded.endpoint,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      created_at = datetime('now')
  `).bind(
    userId,
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth
  ).run();
}

/**
 * Get a user's push subscription.
 */
export async function getSubscription(
  db: D1Database,
  userId: string
): Promise<PushSubscription | null> {
  const result = await db.prepare(`
    SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?
  `).bind(userId).first<{ endpoint: string; p256dh: string; auth: string }>();

  if (!result) return null;

  return {
    endpoint: result.endpoint,
    keys: {
      p256dh: result.p256dh,
      auth: result.auth
    }
  };
}

/**
 * Delete a user's push subscription.
 */
export async function deleteSubscription(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').bind(userId).run();
}

/**
 * Base64 URL encode/decode helpers
 */
function base64UrlEncode(buffer: ArrayBuffer | ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - str.length % 4) % 4);
  const base64 = str + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Create VAPID JWT token for authentication
 */
async function createVapidAuthToken(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  // JWT header
  const header = {
    typ: 'JWT',
    alg: 'ES256'
  };

  // JWT payload
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
    sub: 'mailto:admin@example.com' // Replace with your email
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)).buffer);
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)).buffer);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  // Import private key for signing
  // VAPID private keys might be in JWK format or raw bytes
  let jwk: any;

  try {
    // Try parsing as JSON first (in case it's already a JWK)
    jwk = JSON.parse(vapidPrivateKey);
    console.log('VAPID private key is in JWK format');
  } catch {
    // If not JSON, assume it's base64url-encoded raw bytes
    // For raw EC private keys, we need both the private scalar (d) and public point (x, y)
    // This is a limitation - raw format doesn't work without the public key
    throw new Error('VAPID private key must be in JWK format (not raw bytes). Please regenerate VAPID keys with JWK format.');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const encodedSignature = base64UrlEncode(signature);
  return `${unsignedToken}.${encodedSignature}`;
}

/**
 * Encrypt payload using aes128gcm (Web Push encryption standard)
 */
async function encryptPayload(
  payload: string,
  userPublicKey: string,
  userAuth: string
): Promise<{ body: ArrayBuffer; salt: string; publicKey: string }> {
  const payloadBuffer = new TextEncoder().encode(payload);
  const userPublicKeyBuffer = base64UrlDecode(userPublicKey);
  const userAuthBuffer = base64UrlDecode(userAuth);

  // Generate salt (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // Generate local key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  ) as CryptoKeyPair;

  // Export local public key
  const localPublicKey = await crypto.subtle.exportKey('raw', localKeyPair.publicKey) as ArrayBuffer;

  // Import user public key
  const importedUserPublicKey = await crypto.subtle.importKey(
    'raw',
    userPublicKeyBuffer,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Derive shared secret using ECDH
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: importedUserPublicKey } as any,
    localKeyPair.privateKey,
    256
  );

  // Derive encryption key using HKDF
  const prk = await crypto.subtle.importKey(
    'raw',
    userAuthBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const localPublicKeyBytes = new Uint8Array(localPublicKey);
  const context = new Uint8Array(
    1 + userPublicKeyBuffer.length + localPublicKeyBytes.byteLength
  );
  context.set([0], 0); // Label
  context.set(new Uint8Array(userPublicKeyBuffer), 1);
  context.set(localPublicKeyBytes, 1 + userPublicKeyBuffer.length);

  // Create encryption key
  const keyInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\x00');
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new Uint8Array(sharedSecret),
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const key = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(salt),
      info: keyInfo
    },
    keyMaterial,
    128
  );

  // Create nonce
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\x00');
  const nonce = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(salt),
      info: nonceInfo
    },
    keyMaterial,
    96
  );

  // Encrypt the payload
  const aesKey = await crypto.subtle.importKey(
    'raw',
    key,
    'AES-GCM',
    false,
    ['encrypt']
  );

  // Add padding delimiter (0x02 followed by padding)
  const paddedPayload = new Uint8Array(payloadBuffer.length + 2);
  paddedPayload.set(payloadBuffer, 0);
  paddedPayload.set([2, 0], payloadBuffer.length);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonce), tagLength: 128 },
    aesKey,
    paddedPayload
  );

  // Build aes128gcm format: salt + rs + idlen + keyid + ciphertext
  // See RFC 8188 for aes128gcm format
  const recordSize = 4096; // Standard record size
  const header = new Uint8Array(
    16 + // salt
    4 +  // record size
    1 +  // public key length
    new Uint8Array(localPublicKey).length // public key
  );

  let offset = 0;

  // Salt (16 bytes)
  header.set(salt, offset);
  offset += 16;

  // Record size (4 bytes, big-endian)
  const rsView = new DataView(header.buffer);
  rsView.setUint32(offset, recordSize, false); // false = big-endian
  offset += 4;

  // Public key length (1 byte)
  header.set([new Uint8Array(localPublicKey).length], offset);
  offset += 1;

  // Public key
  header.set(new Uint8Array(localPublicKey), offset);

  // Combine header + encrypted payload
  const result = new Uint8Array(header.length + encrypted.byteLength);
  result.set(header, 0);
  result.set(new Uint8Array(encrypted), header.length);

  return {
    body: result.buffer,
    salt: base64UrlEncode(salt.buffer),
    publicKey: base64UrlEncode(localPublicKey)
  };
}

export interface PushResult {
  success: boolean;
  statusCode?: number;
  statusText?: string;
  errorBody?: string;
  errorMessage?: string;
}

/**
 * Send a push notification using the Web Push protocol.
 */
export async function sendPushNotification(
  env: Env,
  subscription: PushSubscription,
  payload: NotificationPayload
): Promise<PushResult> {
  try {
    console.log('=== Push Notification Debug ===');
    console.log('Endpoint:', subscription.endpoint);
    console.log('Payload:', JSON.stringify(payload));

    // Create VAPID auth token
    console.log('Creating VAPID auth token...');
    const vapidToken = await createVapidAuthToken(
      subscription.endpoint,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );
    console.log('VAPID token created:', vapidToken.substring(0, 50) + '...');

    // Encrypt payload
    console.log('Encrypting payload...');
    const payloadString = JSON.stringify(payload);
    console.log('Payload string length:', payloadString.length);
    const encrypted = await encryptPayload(
      payloadString,
      subscription.keys.p256dh,
      subscription.keys.auth
    );
    console.log('Payload encrypted. Body size:', encrypted.body.byteLength);
    console.log('Salt:', encrypted.salt.substring(0, 20) + '...');
    console.log('Public key:', encrypted.publicKey.substring(0, 20) + '...');

    // Prepare headers
    const headers = {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Content-Length': encrypted.body.byteLength.toString(),
      'TTL': '86400',
      'Authorization': `vapid t=${vapidToken}, k=${env.VAPID_PUBLIC_KEY}`,
      'Crypto-Key': `p256ecdsa=${env.VAPID_PUBLIC_KEY}`,
    };

    console.log('Request headers:', JSON.stringify(headers, null, 2));

    // Send to push service
    console.log('Sending request to push service...');
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers,
      body: encrypted.body
    });

    console.log('Push service response:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Push notification failed!');
      console.error('Status:', response.status);
      console.error('Status text:', response.statusText);
      console.error('Error body:', errorText);
      console.error('Response headers:', JSON.stringify([...response.headers.entries()]));

      return {
        success: false,
        statusCode: response.status,
        statusText: response.statusText,
        errorBody: errorText
      };
    }

    console.log('✅ Push notification sent successfully!');
    return {
      success: true,
      statusCode: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    console.error('Failed to send push notification - exception thrown:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      return {
        success: false,
        errorMessage: error.message
      };
    }
    return {
      success: false,
      errorMessage: 'Unknown error occurred'
    };
  }
}

/**
 * Get all subscriptions for sending bulk notifications.
 */
export async function getAllSubscriptions(
  db: D1Database
): Promise<Array<{ userId: string; subscription: PushSubscription }>> {
  const results = await db.prepare(`
    SELECT user_id, endpoint, p256dh, auth FROM push_subscriptions
  `).all<{ user_id: string; endpoint: string; p256dh: string; auth: string }>();

  return results.results.map(row => ({
    userId: row.user_id,
    subscription: {
      endpoint: row.endpoint,
      keys: {
        p256dh: row.p256dh,
        auth: row.auth
      }
    }
  }));
}
