import { getAIClient } from "./aiProvider";

export interface TripRequest {
  start: string;
  destination: string;
  waypoints?: string;
  hoursPerDay: number;
  age: string;
  interests: string;
}

export interface Accommodation {
  name: string;
  images: string[];
  priceEstimate: string;
  description: string;
  whyRecommended: string;
  source: string;
  location: string;
  coordinates: { lat: number; lng: number };
  websiteUrl?: string;
}

export interface POI {
  name: string;
  description: string;
  whyForCouple: string;
  location: string;
  coordinates: { lat: number; lng: number };
  websiteUrl?: string;
}

export interface DayPlan {
  day: number;
  route: string;
  pois: POI[];
  accommodations: Accommodation[];
  startCoords: { lat: number; lng: number };
  endCoords: { lat: number; lng: number };
}

export interface TripPlan {
  summary: string;
  days: DayPlan[];
  googleMapsLink: string;
}

export async function generateTripPlan(req: TripRequest): Promise<TripPlan> {
  const ai = getAIClient();
  
  // Vi bruker gemini-flash-latest for best kompatibilitet med gratis-nøkler
  const modelName = "gemini-flash-latest";
  
  const prompt = `
    Du er en ekspert reiseplanlegger for kjærestepar. Planlegg en biltur fra "${req.start}" til "${req.destination}"${req.waypoints ? ` via "${req.waypoints}"` : ""}.
    
    Kriterier:
    - Kjøretid per dag: ca. ${req.hoursPerDay} timer.
    - Reisende: Et par, alder ${req.age}.
    - Interesser: ${req.interests}.
    ${req.waypoints ? `- Viktig: Ruten MÅ gå innom følgende steder: ${req.waypoints}.` : ""}
    - Stil: En blanding av hovedveier og naturskjønne sideveier.
    - Budsjett: Hyggelige steder som ikke er altfor kostbare.

    For hver dagsetappe:
    1. Beskriv ruten.
    2. Foreslå 2-6 severdigheter/stoppesteder (POI) som passer parets alder og interesser. Forklar hvorfor det er romantisk eller interessant for akkurat dem. Inkluder nøyaktige GPS-koordinater og en VERIFISERT lenke til deres offisielle nettside eller Wikipedia-side.
    3. Foreslå 2-4 overnattingssteder ved dagens slutt. For hvert sted:
       - Navn og lokasjon.
       - Prisestimat for dobbeltrom (i lokal valuta eller NOK).
       - Beskrivelse av omgivelsene i gangavstand.
       - Hvorfor det anbefales spesielt.
       - Kilde (f.eks. Booking.com, Hotels.com, Airbnb).
       - Nøyaktige GPS-koordinater.
       - En VERIFISERT lenke til deres offisielle nettside, Booking-side eller Wikipedia-side.
       - Inkluder 2-4 bilde-URL-er (bruk https://picsum.photos/seed/{random}/800/600).
    4. Inkluder start- og sluttkoordinater for selve kjøreetappen den dagen.

    Viktig: Bruk din innebygde kunnskap om geografi og reisemål for å finne faktiske steder, ruter og koordinater.
    Returner svaret som et JSON-objekt med følgende struktur:
    {
      "summary": "En kort romantisk oppsummering av turen",
      "days": [
        {
          "day": 1,
          "route": "Beskrivelse av ruten",
          "startCoords": {"lat": 0, "lng": 0},
          "endCoords": {"lat": 0, "lng": 0},
          "pois": [{"name": "...", "description": "...", "whyForCouple": "...", "location": "...", "coordinates": {"lat": 0, "lng": 0}, "websiteUrl": "..."}],
          "accommodations": [{"name": "...", "images": ["url1", "url2"], "priceEstimate": "...", "description": "...", "whyRecommended": "...", "source": "...", "location": "...", "coordinates": {"lat": 0, "lng": 0}, "websiteUrl": "..."}]
        }
      ],
      "googleMapsLink": "En samlet Google Maps-lenke for hele ruten"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (!response.text) {
      throw new Error("Modellen returnerte ikke noe tekst. Prøv igjen.");
    }

    // Extract JSON from potential markdown blocks
    const text = response.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;

    return JSON.parse(jsonStr);
  } catch (e: any) {
    console.error("Gemini API Error:", e);
    if (e.message?.includes("API_KEY_INVALID")) {
      throw new Error("Ugyldig API-nøkkel. Vennligst sjekk GEMINI_API i Secrets-panelet.");
    }
    throw new Error(`Kunne ikke generere reiseplanen: ${e.message || "Ukjent feil"}`);
  }
}
