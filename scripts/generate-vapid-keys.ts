/**
 * Generate VAPID keys for Web Push notifications.
 *
 * Run with: npm run generate-vapid
 *
 * Then set the keys as secrets:
 *   wrangler secret put VAPID_PUBLIC_KEY
 *   wrangler secret put VAPID_PRIVATE_KEY
 */

import webPush from 'web-push';

const vapidKeys = webPush.generateVAPIDKeys();

console.log('\n🔑 VAPID Keys Generated\n');
console.log('Public Key:');
console.log(vapidKeys.publicKey);
console.log('\nPrivate Key:');
console.log(vapidKeys.privateKey);
console.log('\n📋 Next steps:');
console.log('1. Copy the public key and run:');
console.log('   wrangler secret put VAPID_PUBLIC_KEY');
console.log('   (paste the public key when prompted)\n');
console.log('2. Copy the private key and run:');
console.log('   wrangler secret put VAPID_PRIVATE_KEY');
console.log('   (paste the private key when prompted)\n');
