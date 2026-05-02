import { supabase, isSupabaseConfigured } from './supabaseClient';

const localHistoryKey = 'elsk_trip_history_v1';
const localUserIdKey = 'elsk_user_id_v1';

export interface TripHistoryItem {
  id: string;
  createdAt: string;
  userId: string;
  start: string;
  destination: string;
  summary: string;
  googleMapsLink: string;
  pdfUrl: string;
}

function parseLocalHistory(json: string | null): TripHistoryItem[] {
  if (!json) return [];

  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

export function getOrCreateUserId() {
  const current = localStorage.getItem(localUserIdKey);
  if (current) return current;

  const generated = crypto.randomUUID();
  localStorage.setItem(localUserIdKey, generated);
  return generated;
}

export function getLocalTripHistory(): TripHistoryItem[] {
  const history = parseLocalHistory(localStorage.getItem(localHistoryKey));
  return [...history].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function saveLocalTripHistory(item: TripHistoryItem) {
  const history = getLocalTripHistory();
  history.unshift(item);
  localStorage.setItem(localHistoryKey, JSON.stringify(history.slice(0, 100)));
}

export async function saveTripHistoryToSupabase(item: TripHistoryItem) {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const { error } = await supabase.from('roadtrip_history').insert({
    id: item.id,
    created_at: item.createdAt,
    user_id: item.userId,
    start: item.start,
    destination: item.destination,
    summary: item.summary,
    google_maps_link: item.googleMapsLink,
    pdf_url: item.pdfUrl,
  });

  if (error) {
    throw new Error(`Could not save trip history row: ${error.message}`);
  }
}

export async function getAdminTripHistory(limit = 200): Promise<TripHistoryItem[]> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase
    .from('roadtrip_history')
    .select('id, created_at, user_id, start, destination, summary, google_maps_link, pdf_url')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Could not load admin trip history: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    userId: row.user_id,
    start: row.start,
    destination: row.destination,
    summary: row.summary,
    googleMapsLink: row.google_maps_link,
    pdfUrl: row.pdf_url,
  }));
}
