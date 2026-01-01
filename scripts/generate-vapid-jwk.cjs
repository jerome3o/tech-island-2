#!/usr/bin/env node

/**
 * Generate VAPID keys in JWK format for Web Push
 *
 * This generates:
 * - Public key (base64url format)
 * - Private key (JWK JSON format)
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

// Export as JWK
const publicJwk = crypto.createPublicKey({
  key: publicKey,
  format: 'der',
  type: 'spki'
}).export({ format: 'jwk' });

const privateJwk = crypto.createPrivateKey({
  key: privateKey,
  format: 'der',
  type: 'pkcs8'
}).export({ format: 'jwk' });

// The public key in base64url format (for client-side)
const publicKeyBase64Url = base64UrlEncode(publicKey);

// The private key as JWK JSON string (for server-side)
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
console.log('='.repeat(70));
console.log('\n');
