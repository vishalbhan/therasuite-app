// Debug the service role key to understand its structure
import dotenv from 'dotenv';

dotenv.config();

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Service Role Key Analysis:');
console.log('Length:', serviceKey.length);
console.log('Starts with eyJ:', serviceKey.startsWith('eyJ'));
console.log('First 20 chars:', serviceKey.substring(0, 20));

// Try to decode JWT header to understand its structure
try {
  const parts = serviceKey.split('.');
  console.log('JWT Parts:', parts.length);
  
  if (parts.length >= 2) {
    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    
    console.log('JWT Header:', header);
    console.log('JWT Payload (role):', payload.role);
    console.log('JWT Payload (iss):', payload.iss);
  }
} catch (e) {
  console.log('Could not decode JWT:', e.message);
}