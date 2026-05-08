const BOOKING_DOMAINS = ['booking.com', 'www.booking.com'];
const HOTELS_DOMAINS = ['hotels.com', 'www.hotels.com'];

function getQueryParam(url: string, key: string) {
  const parsedUrl = new URL(url, 'http://localhost');
  return parsedUrl.searchParams.get(key);
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isDomainMatch(hostname: string, domains: string[]) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function isBookingDirectHotelUrl(url: string) {
  const hostname = getHostname(url);
  return isDomainMatch(hostname, BOOKING_DOMAINS) && /\/hotel\//i.test(url);
}

function isHotelsDirectHotelUrl(url: string) {
  const hostname = getHostname(url);
  return isDomainMatch(hostname, HOTELS_DOMAINS) && /\/ho\d+|hotel-details|property-details/i.test(url);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const websiteUrl = getQueryParam(req.url || '', 'url');
  const source = (getQueryParam(req.url || '', 'source') || '').toLowerCase();

  if (!websiteUrl) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  let parsedWebsiteUrl: URL;
  try {
    parsedWebsiteUrl = new URL(websiteUrl);
  } catch {
    res.status(400).json({ error: 'Invalid url parameter', isValid: false });
    return;
  }

  if (!['http:', 'https:'].includes(parsedWebsiteUrl.protocol)) {
    res.status(400).json({ error: 'Unsupported URL protocol', isValid: false });
    return;
  }

  try {
    const response = await fetch(parsedWebsiteUrl.toString(), {
      method: 'GET',
      headers: {
        'user-agent': 'ELSK Roadtrip Link Verifier/1.0',
        'accept-language': 'en-US,en;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      res.status(200).json({ isValid: false, finalUrl: response.url || parsedWebsiteUrl.toString() });
      return;
    }

    const finalUrl = response.url || parsedWebsiteUrl.toString();
    let isValid = true;

    if (source.includes('booking')) {
      isValid = isBookingDirectHotelUrl(finalUrl);
    } else if (source.includes('hotels.com')) {
      isValid = isHotelsDirectHotelUrl(finalUrl);
    }

    res.status(200).json({ isValid, finalUrl });
  } catch {
    res.status(200).json({ isValid: false, finalUrl: parsedWebsiteUrl.toString() });
  }
}