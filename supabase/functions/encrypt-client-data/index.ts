import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Encryption utilities using Web Crypto API
async function encryptData(plaintext: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plaintext)
  
  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  // Encrypt the data
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    data
  )
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  
  // Convert to base64 and add prefix to identify encrypted data
  return 'enc:' + btoa(String.fromCharCode(...combined))
}

async function decryptData(encryptedText: string, key: CryptoKey): Promise<string> {
  // Check if data is encrypted (has our prefix)
  if (!encryptedText.startsWith('enc:')) {
    return encryptedText // Return original if not encrypted
  }
  
  try {
    // Remove prefix and decode base64
    const base64Data = encryptedText.substring(4)
    const combined = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12)
    const encrypted = combined.slice(12)
    
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encrypted
    )
    
    // Convert back to string
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    console.error('Decryption error:', error)
    // Return original text if decryption fails (fallback for corrupted data)
    return encryptedText
  }
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const encryptionKeyHex = Deno.env.get('ENCRYPTION_KEY')
  if (!encryptionKeyHex) {
    throw new Error('ENCRYPTION_KEY environment variable not set')
  }
  
  // Convert hex string to ArrayBuffer
  const keyData = new Uint8Array(encryptionKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
  
  // Import the key for AES-GCM
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the JWT token
    const jwt = authHeader.replace('Bearer ', '')
    const expectedServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    // Check if it's the service role key directly or by JWT decoding
    let isServiceRoleKey = false;
    
    // First check if it matches the service role key directly
    if (jwt === expectedServiceKey) {
      isServiceRoleKey = true;
    } else {
      // Try to decode as JWT to check role
      try {
        const parts = jwt.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          isServiceRoleKey = payload.role === 'service_role';
        }
      } catch (e) {
        // If we can't decode it, treat it as a regular user token
      }
    }
    
    if (isServiceRoleKey) {
      // For service role key, skip user validation as it's an admin operation
    } else {
      // For user JWT tokens, validate normally
      const { data: user, error: authError } = await supabaseClient.auth.getUser(jwt)
      
      if (authError || !user) {
        throw new Error('Invalid authorization token')
      }
    }

    const { action, data: requestData } = await req.json()
    
    // Get encryption key
    const key = await getEncryptionKey()
    
    let responseData = {}

    switch (action) {
      case 'encrypt': {
        const { name, email } = requestData
        responseData = {
          name: await encryptData(name, key),
          email: await encryptData(email, key)
        }
        break
      }
      
      case 'decrypt': {
        const { name, email } = requestData
        responseData = {
          name: await decryptData(name, key),
          email: await decryptData(email, key)
        }
        break
      }
      
      case 'decrypt_single': {
        const { value } = requestData
        responseData = {
          value: await decryptData(value, key)
        }
        break
      }
      
      case 'encrypt_single': {
        const { value } = requestData
        responseData = {
          value: await encryptData(value, key)
        }
        break
      }
      
      default:
        throw new Error(`Unsupported action: ${action}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: responseData
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
      }
    )
  } catch (error) {
    console.error('Error in encrypt-client-data function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Encryption/decryption failed',
        details: error.message 
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
      }
    )
  }
})