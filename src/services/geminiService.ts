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
  officialWebsiteUrl?: string;
  bookingComUrl?: string;
  hotelsComUrl?: string;
  imageSource?: string;
}

export interface POI {
  name: string;
  description: string;
  whyForCouple: string;
  location: string;
  coordinates: { lat: number; lng: number };
  websiteUrl?: string;
  imageUrl?: string;
  imageSource?: string;
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

const DISALLOWED_IMAGE_HOSTS = [
  'picsum.photos',
  'placehold.co',
  'via.placeholder.com',
  'placekitten.com',
  'dummyimage.com',
];

const BOOKING_DOMAINS = ['booking.com', 'www.booking.com'];
const HOTELS_DOMAINS = ['hotels.com', 'www.hotels.com'];

function getHostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isBookingSource(source: string) {
  return /booking/i.test(source);
}

function isHotelsSource(source: string) {
  return /hotels\.com/i.test(source);
}

function isBookingDirectHotelUrl(url: string) {
  const hostname = getHostname(url);
  if (!BOOKING_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    return false;
  }

  return /\/hotel\//i.test(url);
}

function isHotelsDirectHotelUrl(url: string) {
  const hostname = getHostname(url);
  if (!HOTELS_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    return false;
  }

  return /\/ho\d+|hotel-details|property-details/i.test(url);
}

function normalizeAccommodationWebsiteUrl(source: string, websiteUrl?: string) {
  const safeUrl = websiteUrl?.trim();
  if (!safeUrl) {
    return undefined;
  }

  const hostname = getHostname(safeUrl);
  const isBookingDomain = BOOKING_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  const isHotelsDomain = HOTELS_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));

  if (isBookingSource(source)) {
    if (isBookingDirectHotelUrl(safeUrl)) {
      return safeUrl;
    }

    // Fallback: allow official hotel website URL when Booking URL is not a verified direct property link.
    return isBookingDomain ? undefined : safeUrl;
  }

  if (isHotelsSource(source)) {
    if (isHotelsDirectHotelUrl(safeUrl)) {
      return safeUrl;
    }

    // Fallback: allow official hotel website URL when Hotels.com URL is not a verified direct property link.
    return isHotelsDomain ? undefined : safeUrl;
  }

  return safeUrl;
}

function normalizeBookingComUrl(url?: string) {
  const safeUrl = normalizeGeneralWebsiteUrl(url);
  if (!safeUrl) {
    return undefined;
  }

  const hostname = getHostname(safeUrl);
  const isBookingDomain = BOOKING_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  const isBookingSearchUrl = /booking\.com\/search\.html\?ss=/i.test(safeUrl);
  return (isBookingDomain && (isBookingDirectHotelUrl(safeUrl) || isBookingSearchUrl)) ? safeUrl : undefined;
}

function normalizeHotelsComUrl(url?: string) {
  const safeUrl = normalizeGeneralWebsiteUrl(url);
  if (!safeUrl) {
    return undefined;
  }

  const hostname = getHostname(safeUrl);
  const isHotelsDomain = HOTELS_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  const isHotelsSearchUrl = /hotels\.com\/Hotel-Search\?/i.test(safeUrl);
  return (isHotelsDomain && (isHotelsDirectHotelUrl(safeUrl) || isHotelsSearchUrl)) ? safeUrl : undefined;
}

function splitNameWords(name?: string) {
  return (name || '')
    .split(/[^A-Za-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
}

function getTwoLongestNameWords(name?: string) {
  const words = splitNameWords(name);
  return [...words]
    .sort((a, b) => b.length - a.length)
    .slice(0, 2);
}

export function extractCityAndCountry(location?: string) {
  const parts = (location || '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return { city: '', country: '' };
  }

  const city = parts.length > 1 ? parts[parts.length - 2] : parts[0];
  const country = parts.length > 1 ? parts[parts.length - 1] : '';
  return { city, country };
}

function buildHotelSearchQuery(name?: string, location?: string) {
  const { city, country } = extractCityAndCountry(location);
  const longestNameWords = getTwoLongestNameWords(name);

  const queryParts = [city, country, ...longestNameWords].filter((part) => part && part.trim().length > 0);
  return queryParts.join(' ').trim();
}

export function buildBookingSearchUrl(accommodation: Accommodation) {
  const query = buildHotelSearchQuery(accommodation.name, accommodation.location);
  if (!query) {
    return undefined;
  }

  return `https://www.booking.com/search.html?ss=${encodeURIComponent(query)}`;
}

export function buildHotelsSearchUrl(accommodation: Accommodation) {
  const query = buildHotelSearchQuery(accommodation.name, accommodation.location);
  if (!query) {
    return undefined;
  }

  const params = new URLSearchParams({
    destination: query,
    adults: '2',
    rooms: '1',
    sort: 'RECOMMENDED',
  });

  return `https://www.hotels.com/Hotel-Search?${params.toString()}`;
}

function normalizeGeneralWebsiteUrl(url?: string) {
  const safeUrl = url?.trim();
  if (!safeUrl) {
    return undefined;
  }

  try {
    const parsedUrl = new URL(safeUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return undefined;
    }

    return parsedUrl.toString();
  } catch {
    return undefined;
  }
}

function normalizeImageSource(value?: string) {
  const safeValue = value?.trim();
  return safeValue && safeValue.length > 0 ? safeValue : undefined;
}

function isSameHostname(urlA?: string, urlB?: string) {
  if (!urlA || !urlB) {
    return false;
  }

  return getHostname(urlA) === getHostname(urlB);
}

function getHotelImageSourceLabel(imageUrl: string, accommodation: Accommodation) {
  if (accommodation.officialWebsiteUrl && isSameHostname(imageUrl, accommodation.officialWebsiteUrl)) {
    return 'Official hotel website';
  }

  if (isBookingDirectHotelUrl(imageUrl)) {
    return 'Booking.com';
  }

  if (isHotelsDirectHotelUrl(imageUrl)) {
    return 'Hotels.com';
  }

  return 'Hotel website';
}

function isBookingOrHotelsLink(url?: string) {
  if (!url) {
    return false;
  }

  const hostname = getHostname(url);
  const isBookingDomain = BOOKING_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  const isHotelsDomain = HOTELS_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  return isBookingDomain || isHotelsDomain;
}

function normalizeAccommodationImages(images: unknown): string[] {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .filter((image): image is string => typeof image === 'string' && image.trim().length > 0)
    .map((image) => image.trim())
    .filter((image) => image.startsWith('https://') || image.startsWith('http://'))
    .filter((image) => {
      try {
        const hostname = new URL(image).hostname.toLowerCase();
        return !DISALLOWED_IMAGE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
      } catch {
        return false;
      }
    })
    .filter((image, index, allImages) => allImages.indexOf(image) === index)
    .slice(0, 4);
}

function normalizeTripPlan(plan: TripPlan): TripPlan {
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      pois: day.pois.map((poi) => ({
        ...poi,
        imageUrl: normalizeGeneralWebsiteUrl(poi.imageUrl),
        imageSource: normalizeImageSource(poi.imageSource),
      })),
      accommodations: day.accommodations.map((accommodation) => ({
        ...accommodation,
        officialWebsiteUrl: normalizeGeneralWebsiteUrl(accommodation.officialWebsiteUrl),
        websiteUrl: normalizeAccommodationWebsiteUrl(accommodation.source, accommodation.websiteUrl),
        bookingComUrl: buildBookingSearchUrl(accommodation),
        hotelsComUrl: buildHotelsSearchUrl(accommodation),
        images: normalizeAccommodationImages(accommodation.images),
        imageSource: normalizeImageSource(accommodation.imageSource),
      })),
    })),
  };
}

async function fetchHotelImagesFromWebsite(websiteUrl: string): Promise<string[]> {
  try {
    const response = await fetch(`/api/hotel-images?url=${encodeURIComponent(websiteUrl)}`);
    if (!response.ok) {
      return [];
    }

    const data = await response.json() as { images?: unknown };
    return normalizeAccommodationImages(data.images);
  } catch {
    return [];
  }
}

async function verifyBookingOrHotelsUrl(websiteUrl: string, source: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/verify-hotel-url?url=${encodeURIComponent(websiteUrl)}&source=${encodeURIComponent(source)}`);
    if (!response.ok) {
      return false;
    }

    const data = await response.json() as { isValid?: unknown };
    return Boolean(data.isValid);
  } catch {
    return false;
  }
}

async function verifyHotelWebsiteUrl(websiteUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/verify-hotel-url?url=${encodeURIComponent(websiteUrl)}&source=official`);
    if (!response.ok) {
      return false;
    }

    const data = await response.json() as { isValid?: unknown };
    return Boolean(data.isValid);
  } catch {
    return false;
  }
}

function getMainHotelWebsite(accommodation: Accommodation) {
  return accommodation.officialWebsiteUrl || accommodation.websiteUrl;
}

function extractWikipediaTitleFromUrl(url?: string) {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.toLowerCase().includes('wikipedia.org')) {
      return null;
    }

    const match = parsedUrl.pathname.match(/\/wiki\/(.+)$/i);
    if (!match?.[1]) {
      return null;
    }

    return decodeURIComponent(match[1]).replace(/_/g, ' ');
  } catch {
    return null;
  }
}

async function fetchWikipediaSummaryImage(title: string): Promise<string | null> {
  const safeTitle = title.trim();
  if (!safeTitle) {
    return null;
  }

  try {
    const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(safeTitle)}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json() as {
      originalimage?: { source?: string };
      thumbnail?: { source?: string };
    };

    const imageUrl = data.originalimage?.source || data.thumbnail?.source;
    return normalizeGeneralWebsiteUrl(imageUrl) ?? null;
  } catch {
    return null;
  }
}

async function enrichTripPlanPoiImages(plan: TripPlan): Promise<TripPlan> {
  const poiImageCache = new Map<string, Promise<string | null>>();

  const days = await Promise.all(
    plan.days.map(async (day) => {
      const pois = await Promise.all(
        day.pois.map(async (poi) => {
          if (poi.imageUrl) {
            return {
              ...poi,
              imageSource: poi.imageSource || 'Provided in trip data',
            };
          }

          const wikipediaTitle = extractWikipediaTitleFromUrl(poi.websiteUrl);
          const fallbackTitle = wikipediaTitle ?? poi.name;
          const cacheKey = fallbackTitle.toLowerCase();

          if (!poiImageCache.has(cacheKey)) {
            poiImageCache.set(cacheKey, fetchWikipediaSummaryImage(fallbackTitle));
          }

          const imageUrl = await poiImageCache.get(cacheKey)!;
          return {
            ...poi,
            imageUrl: imageUrl ?? undefined,
            imageSource: imageUrl ? 'Wikipedia' : poi.imageSource,
          };
        }),
      );

      return {
        ...day,
        pois,
      };
    }),
  );

  return {
    ...plan,
    days,
  };
}

async function enrichTripPlanHotelImages(plan: TripPlan): Promise<TripPlan> {
  const imageCache = new Map<string, Promise<string[]>>();
  const verificationCache = new Map<string, Promise<boolean>>();

  const days = await Promise.all(
    plan.days.map(async (day) => {
      const accommodations = await Promise.all(
        day.accommodations.map(async (accommodation) => {
          let officialWebsiteUrl = accommodation.officialWebsiteUrl;
          let effectiveWebsiteUrl = getMainHotelWebsite(accommodation);

          let bookingComUrl = accommodation.bookingComUrl;
          let hotelsComUrl = accommodation.hotelsComUrl;

          if (officialWebsiteUrl) {
            const verificationKey = `official|${officialWebsiteUrl}`;
            if (!verificationCache.has(verificationKey)) {
              verificationCache.set(verificationKey, verifyHotelWebsiteUrl(officialWebsiteUrl));
            }

            const isValidOfficial = await verificationCache.get(verificationKey)!;
            if (!isValidOfficial) {
              officialWebsiteUrl = undefined;
            }
          }

          if (bookingComUrl && !/booking\.com\/search\.html\?ss=/i.test(bookingComUrl)) {
            const verificationKey = `booking.com|${bookingComUrl}`;
            if (!verificationCache.has(verificationKey)) {
              verificationCache.set(verificationKey, verifyBookingOrHotelsUrl(bookingComUrl, 'booking.com'));
            }

            const isValid = await verificationCache.get(verificationKey)!;
            if (!isValid) {
              bookingComUrl = undefined;
            }
          }

          if (hotelsComUrl && !/hotels\.com\/Hotel-Search\?/i.test(hotelsComUrl)) {
            const verificationKey = `hotels.com|${hotelsComUrl}`;
            if (!verificationCache.has(verificationKey)) {
              verificationCache.set(verificationKey, verifyBookingOrHotelsUrl(hotelsComUrl, 'hotels.com'));
            }

            const isValid = await verificationCache.get(verificationKey)!;
            if (!isValid) {
              hotelsComUrl = undefined;
            }
          }

          if (isBookingOrHotelsLink(effectiveWebsiteUrl)) {
            const verificationKey = `${accommodation.source}|${effectiveWebsiteUrl}`;
            if (!verificationCache.has(verificationKey)) {
              verificationCache.set(verificationKey, verifyBookingOrHotelsUrl(effectiveWebsiteUrl!, accommodation.source));
            }

            const isValidBookingLink = await verificationCache.get(verificationKey)!;
            if (!isValidBookingLink) {
              effectiveWebsiteUrl = officialWebsiteUrl;
            }
          }

          if (!isBookingOrHotelsLink(effectiveWebsiteUrl) && effectiveWebsiteUrl) {
            const verificationKey = `main|${effectiveWebsiteUrl}`;
            if (!verificationCache.has(verificationKey)) {
              verificationCache.set(verificationKey, verifyHotelWebsiteUrl(effectiveWebsiteUrl));
            }

            const isValidMainWebsite = await verificationCache.get(verificationKey)!;
            if (!isValidMainWebsite) {
              effectiveWebsiteUrl = officialWebsiteUrl;
            }
          }

          if (!effectiveWebsiteUrl) {
            return {
              ...accommodation,
              officialWebsiteUrl,
              bookingComUrl,
              hotelsComUrl,
              imageSource: accommodation.images.length > 0 ? (accommodation.imageSource || 'Provided in trip data') : accommodation.imageSource,
            };
          }

          const shouldPreferWebsiteImages = isBookingDirectHotelUrl(effectiveWebsiteUrl) || isHotelsDirectHotelUrl(effectiveWebsiteUrl);
          if (!shouldPreferWebsiteImages && accommodation.images.length > 0) {
            return {
              ...accommodation,
              officialWebsiteUrl,
              websiteUrl: effectiveWebsiteUrl,
              bookingComUrl,
              hotelsComUrl,
              imageSource: accommodation.imageSource || 'Provided in trip data',
            };
          }

          const isBookingOrHotels = isBookingDirectHotelUrl(effectiveWebsiteUrl) || isHotelsDirectHotelUrl(effectiveWebsiteUrl);
          const imageSearchCandidates = isBookingOrHotels && accommodation.officialWebsiteUrl
            ? [accommodation.officialWebsiteUrl, effectiveWebsiteUrl]
            : [effectiveWebsiteUrl];

          let images: string[] = [];
          let selectedImageSourceUrl: string | null = null;
          for (const candidateUrl of imageSearchCandidates) {
            if (!imageCache.has(candidateUrl)) {
              imageCache.set(candidateUrl, fetchHotelImagesFromWebsite(candidateUrl));
            }

            images = await imageCache.get(candidateUrl)!;
            if (images.length > 0) {
              selectedImageSourceUrl = candidateUrl;
              break;
            }
          }

          return {
            ...accommodation,
            officialWebsiteUrl,
            websiteUrl: effectiveWebsiteUrl,
            bookingComUrl,
            hotelsComUrl,
            images,
            imageSource: selectedImageSourceUrl
              ? getHotelImageSourceLabel(selectedImageSourceUrl, accommodation)
              : accommodation.imageSource,
          };
        }),
      );

      return {
        ...day,
        accommodations,
      };
    }),
  );

  return {
    ...plan,
    days,
  };
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
      - websiteUrl should point to the official hotel webpage (main link shown in app).
      - Include officialWebsiteUrl as the official hotel homepage URL.
      - Include bookingComUrl and hotelsComUrl if available, but the app will generate generic search links when these are missing.
      - Do not return Booking/Hotels search results, homepages, map pages, or generic destination pages.
       - Do not generate or guess hotel image URLs.
       - Return images as an empty array [] (hotel images are resolved by the app from website URLs).
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
          "pois": [{"name": "...", "description": "...", "whyForCouple": "...", "location": "...", "coordinates": {"lat": 0, "lng": 0}, "websiteUrl": "...", "imageUrl": ""}],
          "accommodations": [{"name": "...", "images": [], "priceEstimate": "...", "description": "...", "whyRecommended": "...", "source": "...", "location": "...", "coordinates": {"lat": 0, "lng": 0}, "websiteUrl": "...", "officialWebsiteUrl": "...", "bookingComUrl": "...", "hotelsComUrl": "..."}]
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

      const normalizedPlan = normalizeTripPlan(JSON.parse(jsonStr));
      const withPoiImages = await enrichTripPlanPoiImages(normalizedPlan);
      return enrichTripPlanHotelImages(withPoiImages);
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
