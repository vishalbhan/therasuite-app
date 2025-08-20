// One-time script to encrypt existing client data
// Run this with: node encrypt-existing-data.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to check if a value is already encrypted
const isEncrypted = (value) => {
  return typeof value === 'string' && value.startsWith('enc:');
};

// Helper function to encrypt data using the Supabase function
const encryptData = async (data) => {
  try {
    const { data: result, error } = await supabase.functions.invoke('encrypt-client-data', {
      body: { action: 'encrypt', data }
    });
    
    if (error) {
      console.error('Encryption error:', error);
      return null;
    }
    
    return result;
  } catch (error) {
    console.error('Network error during encryption:', error);
    return null;
  }
};

async function encryptExistingClients() {
  console.log('🚀 Starting encryption of existing client data...');
  
  try {
    // Fetch all clients
    const { data: clients, error: fetchError } = await supabase
      .from('clients')
      .select('id, name, email, therapist_id');
    
    if (fetchError) {
      throw fetchError;
    }
    
    console.log(`📊 Found ${clients.length} clients to process`);
    
    let encrypted = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const client of clients) {
      console.log(`\n🔄 Processing client ${client.id}...`);
      
      // Check if already encrypted
      if (isEncrypted(client.name) && isEncrypted(client.email)) {
        console.log(`⏭️  Client ${client.id} already encrypted, skipping`);
        skipped++;
        continue;
      }
      
      // Prepare data for encryption
      const dataToEncrypt = {};
      
      if (!isEncrypted(client.name)) {
        dataToEncrypt.name = client.name;
      }
      
      if (!isEncrypted(client.email)) {
        dataToEncrypt.email = client.email;
      }
      
      // Skip if nothing to encrypt
      if (Object.keys(dataToEncrypt).length === 0) {
        console.log(`⏭️  Client ${client.id} has no data to encrypt, skipping`);
        skipped++;
        continue;
      }
      
      // Encrypt the data
      console.log(`🔐 Encrypting data for client ${client.id}...`);
      const encryptedData = await encryptData(dataToEncrypt);
      
      if (!encryptedData || !encryptedData.success) {
        console.log(`❌ Failed to encrypt data for client ${client.id}`);
        failed++;
        continue;
      }
      
      // Update the client with encrypted data
      const updateData = {};
      
      if (encryptedData.data.name) {
        updateData.name = encryptedData.data.name;
      }
      
      if (encryptedData.data.email) {
        updateData.email = encryptedData.data.email;
      }
      
      const { error: updateError } = await supabase
        .from('clients')
        .update(updateData)
        .eq('id', client.id);
      
      if (updateError) {
        console.log(`❌ Failed to update client ${client.id}:`, updateError.message);
        failed++;
        continue;
      }
      
      console.log(`✅ Successfully encrypted client ${client.id}`);
      encrypted++;
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🎉 Encryption process completed!');
    console.log(`📈 Results:`);
    console.log(`   - Encrypted: ${encrypted} clients`);
    console.log(`   - Skipped (already encrypted): ${skipped} clients`);
    console.log(`   - Failed: ${failed} clients`);
    
  } catch (error) {
    console.error('❌ Error during encryption process:', error);
  }
}

async function encryptExistingAppointments() {
  console.log('\n🚀 Starting encryption of existing appointment data...');
  
  try {
    // Fetch all appointments
    const { data: appointments, error: fetchError } = await supabase
      .from('appointments')
      .select('id, client_name, client_email, therapist_id');
    
    if (fetchError) {
      throw fetchError;
    }
    
    console.log(`📊 Found ${appointments.length} appointments to process`);
    
    let encrypted = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const appointment of appointments) {
      console.log(`\n🔄 Processing appointment ${appointment.id}...`);
      
      // Check if already encrypted
      if (isEncrypted(appointment.client_name) && isEncrypted(appointment.client_email)) {
        console.log(`⏭️  Appointment ${appointment.id} already encrypted, skipping`);
        skipped++;
        continue;
      }
      
      // Prepare data for encryption
      const dataToEncrypt = {};
      
      if (!isEncrypted(appointment.client_name)) {
        dataToEncrypt.name = appointment.client_name;
      }
      
      if (!isEncrypted(appointment.client_email)) {
        dataToEncrypt.email = appointment.client_email;
      }
      
      // Skip if nothing to encrypt
      if (Object.keys(dataToEncrypt).length === 0) {
        console.log(`⏭️  Appointment ${appointment.id} has no data to encrypt, skipping`);
        skipped++;
        continue;
      }
      
      // Encrypt the data
      console.log(`🔐 Encrypting data for appointment ${appointment.id}...`);
      const encryptedData = await encryptData(dataToEncrypt);
      
      if (!encryptedData || !encryptedData.success) {
        console.log(`❌ Failed to encrypt data for appointment ${appointment.id}`);
        failed++;
        continue;
      }
      
      // Update the appointment with encrypted data
      const updateData = {};
      
      if (encryptedData.data.name) {
        updateData.client_name = encryptedData.data.name;
      }
      
      if (encryptedData.data.email) {
        updateData.client_email = encryptedData.data.email;
      }
      
      const { error: updateError } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointment.id);
      
      if (updateError) {
        console.log(`❌ Failed to update appointment ${appointment.id}:`, updateError.message);
        failed++;
        continue;
      }
      
      console.log(`✅ Successfully encrypted appointment ${appointment.id}`);
      encrypted++;
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🎉 Appointment encryption process completed!');
    console.log(`📈 Results:`);
    console.log(`   - Encrypted: ${encrypted} appointments`);
    console.log(`   - Skipped (already encrypted): ${skipped} appointments`);
    console.log(`   - Failed: ${failed} appointments`);
    
  } catch (error) {
    console.error('❌ Error during appointment encryption process:', error);
  }
}

async function main() {
  console.log('🔒 TheraSuite Data Encryption Tool');
  console.log('==================================');
  
  // First encrypt clients
  await encryptExistingClients();
  
  // Then encrypt appointments
  await encryptExistingAppointments();
  
  console.log('\n✨ All encryption processes completed!');
  console.log('\n⚠️  Important: Please verify the encrypted data looks correct in your database');
  console.log('    and test your application thoroughly before proceeding with production use.');
}

// Run the migration
main().catch(console.error);