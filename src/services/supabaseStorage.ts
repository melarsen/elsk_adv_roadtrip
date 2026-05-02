import { supabase, isSupabaseConfigured } from './supabaseClient';

const defaultBucket = 'trip-pdfs';

function buildStoragePath(userId: string, fileName: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const randomPart = crypto.randomUUID();
  return `${userId}/${timestamp}-${randomPart}-${fileName}`;
}

export async function uploadTripPdfToSupabase(blob: Blob, fileName: string, userId: string): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  const bucket = import.meta.env.VITE_SUPABASE_PDF_BUCKET || defaultBucket;
  const path = buildStoragePath(userId, fileName);

  const { error } = await supabase.storage.from(bucket).upload(path, blob, {
    contentType: 'application/pdf',
    upsert: false,
  });

  if (error) {
    throw new Error(`Could not upload PDF to Supabase Storage: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
