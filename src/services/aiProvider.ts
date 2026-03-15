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
  // Bruk API_KEY fra dialogen hvis valgt, ellers systemets GEMINI_API_KEY
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey || apiKey === "AI Studio Free Tier") {
    throw new Error("API-nøkkel mangler. Vennligst velg en nøkkel for å fortsette.");
  }
  
  return new GoogleGenAI({ apiKey });
};

export const isUserKeySelected = (): boolean => {
  return !!process.env.API_KEY;
};

export const hasActiveApiKey = async (): Promise<boolean> => {
  // Sjekk om brukeren har valgt en nøkkel via dialogen (API_KEY)
  if (process.env.API_KEY) return true;

  // Sjekk systemnøkkelen
  const systemKey = process.env.GEMINI_API_KEY;
  if (systemKey && systemKey !== "AI Studio Free Tier") {
    // Vi har en systemnøkkel, men vi sjekker også om plattformen sier vi har en valgt nøkkel
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      if (selected) return true;
    }
    // Hvis vi er i "shared" modus, vil vi ofte tvinge brukeren til å velge sin egen nøkkel
    // for å unngå kvotebegrensninger på systemnøkkelen.
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
