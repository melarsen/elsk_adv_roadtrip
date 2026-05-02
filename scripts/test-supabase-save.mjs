import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const envPath = path.join(repoRoot, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Missing .env.local');
  process.exit(1);
}

dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const bucket = process.env.VITE_SUPABASE_PDF_BUCKET || 'roadtrip-pdfs';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const now = new Date().toISOString();
const userId = `test-user-${Math.random().toString(36).slice(2, 10)}`;
const rowId = crypto.randomUUID();
const fileName = `integration-test-${Date.now()}.pdf`;
const storagePath = `${userId}/${fileName}`;

// Minimal valid PDF bytes
const pdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 18 Tf 50 90 Td (Supabase PDF Test) Tj ET\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`;
const pdfBuffer = Buffer.from(pdfContent, 'utf8');

console.log('Uploading PDF to bucket...');
const { error: uploadError } = await supabase.storage
  .from(bucket)
  .upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: false,
  });

if (uploadError) {
  console.error('Upload failed:', uploadError.message);
  process.exit(1);
}

const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
const pdfUrl = publicData.publicUrl;

console.log('Inserting row into roadtrip_history...');
const { error: insertError } = await supabase.from('roadtrip_history').insert({
  id: rowId,
  created_at: now,
  user_id: userId,
  start: 'Integration Test Start',
  destination: 'Integration Test Destination',
  summary: 'Integration test row created by scripts/test-supabase-save.mjs',
  google_maps_link: 'https://maps.google.com/',
  pdf_url: pdfUrl,
});

if (insertError) {
  console.error('Insert failed:', insertError.message);
  process.exit(1);
}

const { data: verifyRow, error: verifyError } = await supabase
  .from('roadtrip_history')
  .select('id,user_id,pdf_url,created_at')
  .eq('id', rowId)
  .single();

if (verifyError) {
  console.error('Verify failed:', verifyError.message);
  process.exit(1);
}

console.log('SUCCESS');
console.log(JSON.stringify({
  rowId,
  userId,
  bucket,
  storagePath,
  pdfUrl,
  verifyRow,
}, null, 2));
