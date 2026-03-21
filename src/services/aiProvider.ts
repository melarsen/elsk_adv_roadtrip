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
  // 1. Sjekk AI Studio bruker-nøkkel (valgt i dialog)
  // 2. Sjekk AI Studio system-nøkkel
  // 3. Sjekk standard Vite miljøvariabel (for Vercel/GitHub)
  const apiKey = 
    process.env.API_KEY || 
    process.env.GEMINI_API_KEY || 
    (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY);
  
  if (!apiKey || apiKey === "AI Studio Free Tier") {
    throw new Error("API-nøkkel mangler. Vennligst sett VITE_GEMINI_API_KEY i Vercel eller velg en nøkkel i AI Studio.");
  }
  
  return new GoogleGenAI({ apiKey });
};

export const isUserKeySelected = (): boolean => {
  return !!(process.env.API_KEY || (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY));
};

export const hasActiveApiKey = async (): Promise<boolean> => {
  // Sjekk om vi har en nøkkel fra miljøvariabler (Vercel eller AI Studio)
  if (process.env.API_KEY) return true;
  if (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) return true;

  // Sjekk systemnøkkelen i AI Studio
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
    alert("API-nøkkelvelgeren er ikke tilgjengelig i dette miljøet.");
  }
};
