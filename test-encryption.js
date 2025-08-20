// Test script to debug the encryption process
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Environment variables:');
console.log('VITE_SUPABASE_URL:', supabaseUrl);
console.log('Service key present:', !!supabaseServiceKey);
console.log('Service key length:', supabaseServiceKey?.length);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test basic Supabase connection
async function testConnection() {
  console.log('\n🔗 Testing Supabase connection...');
  
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
    
    console.log('✅ Connection successful');
    return true;
  } catch (error) {
    console.error('❌ Connection test error:', error);
    return false;
  }
}

// Test the encryption function directly
async function testEncryptionFunction() {
  console.log('\n🔐 Testing encryption function...');
  
  try {
    console.log('Calling encrypt-client-data function...');
    const { data, error } = await supabase.functions.invoke('encrypt-client-data', {
      body: { 
        action: 'encrypt', 
        data: { 
          name: 'Test Client',
          email: 'test@example.com'
        }
      }
    });
    
    console.log('Function response:', { data, error });
    
    if (error) {
      console.error('❌ Encryption function error:', error);
      return false;
    }
    
    if (!data || !data.success) {
      console.error('❌ Encryption function returned failure:', data);
      return false;
    }
    
    console.log('✅ Encryption function working');
    console.log('Encrypted data:', data.data);
    return true;
  } catch (error) {
    console.error('❌ Encryption function network error:', error);
    return false;
  }
}

// Test decryption
async function testDecryptionFunction(encryptedData) {
  console.log('\n🔓 Testing decryption function...');
  
  try {
    console.log('Calling decrypt function...');
    const { data, error } = await supabase.functions.invoke('encrypt-client-data', {
      body: { 
        action: 'decrypt', 
        data: encryptedData
      }
    });
    
    console.log('Decryption response:', { data, error });
    
    if (error) {
      console.error('❌ Decryption function error:', error);
      return false;
    }
    
    if (!data || !data.success) {
      console.error('❌ Decryption function returned failure:', data);
      return false;
    }
    
    console.log('✅ Decryption function working');
    console.log('Decrypted data:', data.data);
    return true;
  } catch (error) {
    console.error('❌ Decryption function network error:', error);
    return false;
  }
}

// Main test function
async function main() {
  console.log('🧪 TheraSuite Encryption Test Suite');
  console.log('====================================');
  
  let testsPassed = 0;
  let totalTests = 0;
  
  // Test 1: Connection
  totalTests++;
  if (await testConnection()) {
    testsPassed++;
  }
  
  // Test 2: Encryption function
  totalTests++;
  let encryptedResult = null;
  if (await testEncryptionFunction()) {
    testsPassed++;
    
    // Get the encrypted data for decryption test
    try {
      const { data } = await supabase.functions.invoke('encrypt-client-data', {
        body: { 
          action: 'encrypt', 
          data: { 
            name: 'Test Client',
            email: 'test@example.com'
          }
        }
      });
      encryptedResult = data?.data;
    } catch (e) {
      console.log('Could not get encrypted data for decryption test');
    }
  }
  
  // Test 3: Decryption function (if encryption worked)
  if (encryptedResult) {
    totalTests++;
    if (await testDecryptionFunction(encryptedResult)) {
      testsPassed++;
    }
  }
  
  console.log('\n📊 Test Results:');
  console.log(`✅ Passed: ${testsPassed}/${totalTests} tests`);
  
  if (testsPassed === totalTests) {
    console.log('\n🎉 All tests passed! Your encryption setup is working correctly.');
    console.log('You can now run: npm run encrypt-existing-data');
  } else {
    console.log('\n⚠️  Some tests failed. Please fix the issues above before running the migration.');
  }
}

main().catch(console.error);