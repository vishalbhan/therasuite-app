// Test the encryption function directly using fetch to better understand the 500 error
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testEncryptionDirect() {
  console.log('🧪 Testing encryption function directly...');
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/encrypt-client-data`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'encrypt',
        data: {
          name: 'Test Client',
          email: 'test@example.com'
        }
      })
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('Response body:', responseText);
    
    if (!response.ok) {
      console.log('❌ Function returned non-200 status');
      
      // Try to parse as JSON to get error details
      try {
        const errorData = JSON.parse(responseText);
        console.log('Error details:', errorData);
      } catch (e) {
        console.log('Could not parse error response as JSON');
      }
      
      return false;
    }
    
    // Try to parse successful response
    try {
      const data = JSON.parse(responseText);
      console.log('✅ Function successful:', data);
      return true;
    } catch (e) {
      console.log('❌ Could not parse successful response as JSON');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Network error:', error);
    return false;
  }
}

testEncryptionDirect();