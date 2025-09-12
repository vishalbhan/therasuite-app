#!/usr/bin/env node

import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔑 Generating VAPID keys for push notifications...\n');

try {
  const vapidKeys = webpush.generateVAPIDKeys();
  
  console.log('✅ VAPID keys generated successfully!\n');
  
  console.log('Public Key:');
  console.log(vapidKeys.publicKey);
  console.log('\nPrivate Key:');
  console.log(vapidKeys.privateKey);
  
  console.log('\n📝 Add these to your .env file:');
  console.log('=====================================');
  console.log(`VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
  console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
  console.log('VAPID_SUBJECT=mailto:your-email@domain.com');
  console.log('=====================================\n');
  
  // Optionally write to a file
  const envTemplate = `# Push Notification VAPID Keys
VITE_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_SUBJECT=mailto:your-email@domain.com

# Remember to also add these to your Supabase Edge Functions environment variables!
`;

  const outputPath = path.join(__dirname, '..', 'vapid-keys.env');
  fs.writeFileSync(outputPath, envTemplate);
  
  console.log(`💾 Keys also saved to: ${outputPath}`);
  console.log('⚠️  Remember to update VAPID_SUBJECT with your actual email address');
  console.log('🔒 Keep your private key secret - never commit it to version control');
  
} catch (error) {
  console.error('❌ Error generating VAPID keys:', error.message);
  process.exit(1);
}