import { getAIClientsWithFallback } from "./aiProvider";

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
  const aiClients = getAIClientsWithFallback();
  if (aiClients.length === 0) {
    throw new Error("API key is missing. Please set VITE_GEMINI_API_KEY_1 (or _2/_3).");
  }
  
  // Use gemini-flash-latest for broad compatibility with free-tier keys.
  const modelName = "gemini-flash-latest";
  
  const prompt = `
    You are an expert road trip planner for couples. Plan a road trip from "${req.start}" to "${req.destination}"${req.waypoints ? ` via "${req.waypoints}"` : ""}.
    
    Criteria:
    - Driving time per day: about ${req.hoursPerDay} hours.
    - Travelers: A couple, age ${req.age}.
    - Interests: ${req.interests}.
    ${req.waypoints ? `- Important: The route MUST pass through these places: ${req.waypoints}.` : ""}
    - Style: A mix of main roads and scenic backroads.
    - Budget: Nice places that are not overly expensive.

    For each day:
    1. Describe the route.
    2. Suggest 2-6 attractions/stops (POIs) that match the couple's age and interests. Explain why each is romantic or interesting for them. Include exact GPS coordinates and a VERIFIED link to an official website or Wikipedia page.
    3. Suggest 2-4 accommodations at the end of the day. For each place include:
       - Name and location.
       - Price estimate for a double room (local currency or NOK).
       - A description of nearby walkable surroundings.
       - Why it is especially recommended.
       - Source (e.g. Booking.com, Hotels.com, Airbnb).
       - Exact GPS coordinates.
       - A VERIFIED link to an official site, booking page, or Wikipedia page.
       - Include 2-4 image URLs (use https://picsum.photos/seed/{random}/800/600).
    4. Include start and end coordinates for that day's driving segment.

    Important: Use your built-in knowledge of geography and travel destinations to find real places, routes, and coordinates.
    Return the response as a JSON object with the following structure:
    {
      "summary": "A short romantic summary of the trip",
      "days": [
        {
          "day": 1,
          "route": "Route description",
          "startCoords": {"lat": 0, "lng": 0},
          "endCoords": {"lat": 0, "lng": 0},
          "pois": [{"name": "...", "description": "...", "whyForCouple": "...", "location": "...", "coordinates": {"lat": 0, "lng": 0}, "websiteUrl": "..."}],
          "accommodations": [{"name": "...", "images": ["url1", "url2"], "priceEstimate": "...", "description": "...", "whyRecommended": "...", "source": "...", "location": "...", "coordinates": {"lat": 0, "lng": 0}, "websiteUrl": "..."}]
        }
      ],
      "googleMapsLink": "A combined Google Maps link for the full route"
    }
  `;

  let lastError: any = null;

  for (let i = 0; i < aiClients.length; i++) {
    const ai = aiClients[i];
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      if (!response.text) {
        throw new Error("The model did not return any text. Please try again.");
      }

      // Extract JSON from potential markdown blocks
      const text = response.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;

      return JSON.parse(jsonStr);
    } catch (e: any) {
      lastError = e;
      const message = String(e?.message || "");
      const isLikelyAuthFailure =
        message.includes("API_KEY_INVALID") ||
        message.includes("PERMISSION_DENIED") ||
        message.includes("401") ||
        message.includes("403");

      const hasNextClient = i < aiClients.length - 1;
      if (isLikelyAuthFailure && hasNextClient) {
        continue;
      }
      break;
    }
  }

  console.error("Gemini API Error:", lastError);
  if (String(lastError?.message || "").includes("API_KEY_INVALID")) {
    throw new Error("All configured Gemini keys failed. Please verify VITE_GEMINI_API_KEY_1, _2, and _3.");
  }

  throw new Error(`Could not generate the trip plan: ${lastError?.message || "Unknown error"}`);
}
