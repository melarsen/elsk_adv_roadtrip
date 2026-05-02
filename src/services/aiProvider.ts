import { GoogleGenAI } from "@google/genai";

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
      import.meta.env.VITE_GEMINI_API_KEY
    ));
  
  if (!apiKey || apiKey === "AI Studio Free Tier") {
    throw new Error("API key is missing. Please set VITE_GEMINI_API_KEY_1 (or _2/_3) in Vercel or choose a key in AI Studio.");
  }
  
  return new GoogleGenAI({ apiKey });
};

export const getAIClientsWithFallback = () => {
  const clients: GoogleGenAI[] = [];
  const envKeys = [
    import.meta.env?.VITE_GEMINI_API_KEY_1,
    import.meta.env?.VITE_GEMINI_API_KEY_2,
    import.meta.env?.VITE_GEMINI_API_KEY_3,
    import.meta.env?.VITE_GEMINI_API_KEY,
  ].filter((k): k is string => !!k && k !== "AI Studio Free Tier");

  // Keep order deterministic and avoid creating duplicate clients for repeated keys.
  const uniqueKeys = Array.from(new Set(envKeys));
  uniqueKeys.forEach((apiKey) => {
    clients.push(new GoogleGenAI({ apiKey }));
  });

  // Preserve legacy behavior as final fallback for AI Studio/system key setups.
  try {
    clients.push(getAIClient());
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
