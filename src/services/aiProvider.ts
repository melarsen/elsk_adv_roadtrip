import { GoogleGenAI } from "@google/genai";

const LAST_WORKING_GEMINI_KEY_LABEL = 'elsk:last-working-gemini-key-label';

export type AIClientWithSource = {
  client: GoogleGenAI;
  sourceLabel: string;
};

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export const getAIClient = () => {
  // 1. Check AI Studio user key (selected in dialog)
  // 2. Check AI Studio system key
  // 3. Check prioritized Vite environment variables (for Vercel/GitHub)
  const apiKey = 
    process.env.API_KEY || 
    process.env.GEMINI_API_KEY || 
    (import.meta.env && (
      import.meta.env.VITE_GEMINI_API_KEY_1 ||
      import.meta.env.VITE_GEMINI_API_KEY_2 ||
      import.meta.env.VITE_GEMINI_API_KEY_3 ||
      import.meta.env.VITE_GEMINI_API_KEY_4 ||
      import.meta.env.VITE_GEMINI_API_KEY_5 ||
      import.meta.env.VITE_GEMINI_API_KEY
    ));
  
  if (!apiKey || apiKey === "AI Studio Free Tier") {
    throw new Error("API key is missing. Please set VITE_GEMINI_API_KEY_1 (or _2/_3/_4/_5) in Vercel or choose a key in AI Studio.");
  }
  
  return new GoogleGenAI({ apiKey });
};

function getLastWorkingGeminiKeyLabel() {
  try {
    return window.localStorage.getItem(LAST_WORKING_GEMINI_KEY_LABEL) || '';
  } catch {
    return '';
  }
}

export function setLastWorkingGeminiKeyLabel(sourceLabel: string) {
  if (!sourceLabel.startsWith('VITE_GEMINI_API_KEY')) {
    return;
  }

  try {
    window.localStorage.setItem(LAST_WORKING_GEMINI_KEY_LABEL, sourceLabel);
  } catch {
    // Ignore storage failures and continue with deterministic default ordering.
  }
}

function rotateEntriesFromLastSuccess<T extends { sourceLabel: string }>(entries: T[]) {
  const lastWorkingSourceLabel = getLastWorkingGeminiKeyLabel();
  if (!lastWorkingSourceLabel) {
    return entries;
  }

  const startIndex = entries.findIndex((entry) => entry.sourceLabel === lastWorkingSourceLabel);
  if (startIndex <= 0) {
    return entries;
  }

  return [...entries.slice(startIndex), ...entries.slice(0, startIndex)];
}

export const getAIClientsWithFallback = () => {
  const clients: AIClientWithSource[] = [];
  const envKeys = [
    { sourceLabel: 'VITE_GEMINI_API_KEY_1', apiKey: import.meta.env?.VITE_GEMINI_API_KEY_1 },
    { sourceLabel: 'VITE_GEMINI_API_KEY_2', apiKey: import.meta.env?.VITE_GEMINI_API_KEY_2 },
    { sourceLabel: 'VITE_GEMINI_API_KEY_3', apiKey: import.meta.env?.VITE_GEMINI_API_KEY_3 },
    { sourceLabel: 'VITE_GEMINI_API_KEY_4', apiKey: import.meta.env?.VITE_GEMINI_API_KEY_4 },
    { sourceLabel: 'VITE_GEMINI_API_KEY_5', apiKey: import.meta.env?.VITE_GEMINI_API_KEY_5 },
    { sourceLabel: 'VITE_GEMINI_API_KEY', apiKey: import.meta.env?.VITE_GEMINI_API_KEY },
  ]
    .filter((entry): entry is { sourceLabel: string; apiKey: string } => !!entry.apiKey && entry.apiKey !== "AI Studio Free Tier")
    .filter((entry, index, allEntries) => allEntries.findIndex((candidate) => candidate.apiKey === entry.apiKey) === index);

  rotateEntriesFromLastSuccess(envKeys).forEach(({ apiKey, sourceLabel }) => {
    clients.push({ client: new GoogleGenAI({ apiKey }), sourceLabel });
  });

  // Preserve legacy behavior as final fallback for AI Studio/system key setups.
  try {
    clients.push({ client: getAIClient(), sourceLabel: 'legacy-fallback' });
  } catch {
    // Ignore; missing key is handled by caller if no client succeeds.
  }

  return clients;
};

export const isUserKeySelected = (): boolean => {
  return !!(
    process.env.API_KEY ||
    (import.meta.env && (
      import.meta.env.VITE_GEMINI_API_KEY_1 ||
      import.meta.env.VITE_GEMINI_API_KEY_2 ||
      import.meta.env.VITE_GEMINI_API_KEY_3 ||
      import.meta.env.VITE_GEMINI_API_KEY_4 ||
      import.meta.env.VITE_GEMINI_API_KEY_5 ||
      import.meta.env.VITE_GEMINI_API_KEY
    ))
  );
};

export const hasActiveApiKey = async (): Promise<boolean> => {
  // Check whether we have a key from environment variables (Vercel or AI Studio)
  if (process.env.API_KEY) return true;
  if (
    import.meta.env && (
      import.meta.env.VITE_GEMINI_API_KEY_1 ||
      import.meta.env.VITE_GEMINI_API_KEY_2 ||
      import.meta.env.VITE_GEMINI_API_KEY_3 ||
      import.meta.env.VITE_GEMINI_API_KEY_4 ||
      import.meta.env.VITE_GEMINI_API_KEY_5 ||
      import.meta.env.VITE_GEMINI_API_KEY
    )
  ) {
    return true;
  }

  // Check system key in AI Studio
  const systemKey = process.env.GEMINI_API_KEY;
  if (systemKey && systemKey !== "AI Studio Free Tier") {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      if (selected) return true;
    }
    return true; 
  }
  
  if (window.aistudio) {
    return await window.aistudio.hasSelectedApiKey();
  }
  
  return false;
};

export const openApiKeySelector = async () => {
  if (window.aistudio) {
    await window.aistudio.openSelectKey();
  } else {
    alert("The API key selector is not available in this environment.");
  }
};
