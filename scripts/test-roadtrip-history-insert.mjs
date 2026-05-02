import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(repoRoot, '.env.local') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

const rowId = crypto.randomUUID();
const userId = `test-user-${Math.random().toString(36).slice(2, 10)}`;

const { error: insertError } = await supabase.from('roadtrip_history').insert({
  id: rowId,
  created_at: new Date().toISOString(),
  user_id: userId,
  start: 'Policy Test Start',
  destination: 'Policy Test Destination',
  summary: 'Table insert policy test',
  google_maps_link: 'https://maps.google.com/',
  pdf_url: 'https://example.com/fake.pdf',
});

if (insertError) {
  console.error('INSERT_FAILED', insertError.message);
  process.exit(1);
}

const { data, error: verifyError } = await supabase
  .from('roadtrip_history')
  .select('id,user_id')
  .eq('id', rowId)
  .single();

if (verifyError) {
  console.error('VERIFY_FAILED', verifyError.message);
  process.exit(1);
}

console.log('INSERT_OK', JSON.stringify(data));
