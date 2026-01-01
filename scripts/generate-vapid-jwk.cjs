#!/usr/bin/env node

/**
 * Generate VAPID keys in the correct format for Web Push
 *
 * This generates:
 * - Public key: raw uncompressed EC point (65 bytes, base64url encoded)
 * - Private key: JWK JSON format
 */

const crypto = require('crypto');

function base64UrlEncode(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate ECDSA P-256 key pair
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
  namedCurve: 'prime256v1', // P-256
  publicKeyEncoding: {
    type: 'spki',
    format: 'der'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'der'
  }
});

// Export private key as JWK
const privateJwk = crypto.createPrivateKey({
  key: privateKey,
  format: 'der',
  type: 'pkcs8'
}).export({ format: 'jwk' });

// Export public key as JWK to get x and y coordinates
const publicJwk = crypto.createPublicKey({
  key: publicKey,
  format: 'der',
  type: 'spki'
}).export({ format: 'jwk' });

// Convert x and y from base64url to Buffer
const xBuffer = Buffer.from(publicJwk.x, 'base64url');
const yBuffer = Buffer.from(publicJwk.y, 'base64url');

// Create uncompressed point format: 0x04 + x + y
const uncompressedPoint = Buffer.concat([
  Buffer.from([0x04]), // Uncompressed point indicator
  xBuffer,
  yBuffer
]);

// The public key in base64url format (for client-side subscription)
const publicKeyBase64Url = base64UrlEncode(uncompressedPoint);

// The private key as JWK JSON string (for server-side signing)
const privateKeyJwkString = JSON.stringify(privateJwk);

console.log('\n='.repeat(70));
console.log('VAPID Keys Generated Successfully!');
console.log('='.repeat(70));
console.log('\nAdd these to your GitHub Secrets:\n');

console.log('VAPID_PUBLIC_KEY:');
console.log('-'.repeat(70));
console.log(publicKeyBase64Url);
console.log('-'.repeat(70));

console.log('\nVAPID_PRIVATE_KEY:');
console.log('-'.repeat(70));
console.log(privateKeyJwkString);
console.log('-'.repeat(70));

console.log('\nCopy each value (without the dashes) to the corresponding GitHub secret.');
console.log('Make sure to update BOTH secrets before deploying.');
console.log('='.repeat(70));
console.log('\n');
