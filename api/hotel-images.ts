const BLOCKED_IMAGE_PATTERNS = [
  /logo/i,
  /icon/i,
  /avatar/i,
  /sprite/i,
  /placeholder/i,
  /favicon/i,
  /badge/i,
];

function getQueryParam(url: string, key: string) {
  const parsedUrl = new URL(url, 'http://localhost');
  return parsedUrl.searchParams.get(key);
}

function normalizeImageUrl(candidate: string, baseUrl: string) {
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.startsWith('data:')) {
    return null;
  }

  try {
    const absoluteUrl = new URL(trimmed, baseUrl);
    if (!['http:', 'https:'].includes(absoluteUrl.protocol)) {
      return null;
    }

    return absoluteUrl.toString();
  } catch {
    return null;
  }
}

function isRelevantImage(url: string) {
  return !BLOCKED_IMAGE_PATTERNS.some((pattern) => pattern.test(url));
}

function extractMetaImages(html: string, baseUrl: string) {
  const matches = [...html.matchAll(/<meta[^>]+(?:property|name|itemprop)=["'](?:og:image|twitter:image|og:image:url|image)["'][^>]+content=["']([^"']+)["'][^>]*>/gi)];
  return matches
    .map((match) => normalizeImageUrl(match[1], baseUrl))
    .filter((url): url is string => Boolean(url) && isRelevantImage(url));
}

function extractJsonLdImages(html: string, baseUrl: string) {
  const scriptMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const images: string[] = [];

  for (const match of scriptMatches) {
    try {
      const parsed = JSON.parse(match[1]);
      const entries = Array.isArray(parsed) ? parsed : [parsed];
      for (const entry of entries) {
        const rawImages = Array.isArray(entry?.image) ? entry.image : [entry?.image];
        for (const rawImage of rawImages) {
          if (typeof rawImage !== 'string') {
            continue;
          }
          const normalized = normalizeImageUrl(rawImage, baseUrl);
          if (normalized && isRelevantImage(normalized)) {
            images.push(normalized);
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return images;
}

function extractImgTagImages(html: string, baseUrl: string) {
  const matches = [...html.matchAll(/<img[^>]+(?:src|data-src|data-lazy-src|data-original|data-image)=["']([^"']+)["'][^>]*>/gi)];
  return matches
    .map((match) => normalizeImageUrl(match[1], baseUrl))
    .filter((url): url is string => Boolean(url) && isRelevantImage(url));
}

function extractSrcsetImages(html: string, baseUrl: string) {
  const matches = [...html.matchAll(/<img[^>]+(?:srcset|data-srcset)=["']([^"']+)["'][^>]*>/gi)];
  const imageCandidates: string[] = [];

  for (const match of matches) {
    const srcset = match[1];
    const urls = srcset
      .split(',')
      .map((entry) => entry.trim().split(/\s+/)[0])
      .filter(Boolean);

    imageCandidates.push(...urls);
  }

  return imageCandidates
    .map((candidate) => normalizeImageUrl(candidate, baseUrl))
    .filter((url): url is string => Boolean(url) && isRelevantImage(url));
}

function extractPictureSourceImages(html: string, baseUrl: string) {
  const pictureBlocks = [...html.matchAll(/<picture[^>]*>([\s\S]*?)<\/picture>/gi)];
  const imageCandidates: string[] = [];

  for (const block of pictureBlocks) {
    const pictureHtml = block[1];
    const sourceMatches = [...pictureHtml.matchAll(/<source[^>]+(?:srcset|data-srcset)=["']([^"']+)["'][^>]*>/gi)];

    for (const sourceMatch of sourceMatches) {
      const srcset = sourceMatch[1];
      const urls = srcset
        .split(',')
        .map((entry) => entry.trim().split(/\s+/)[0])
        .filter(Boolean);

      imageCandidates.push(...urls);
    }
  }

  return imageCandidates
    .map((candidate) => normalizeImageUrl(candidate, baseUrl))
    .filter((url): url is string => Boolean(url) && isRelevantImage(url));
}

function extractBackgroundImages(html: string, baseUrl: string) {
  const urlCandidates: string[] = [];

  const inlineStyleMatches = [...html.matchAll(/style=["']([^"']+)["']/gi)];
  for (const styleMatch of inlineStyleMatches) {
    const styleValue = styleMatch[1];
    const bgMatches = [...styleValue.matchAll(/background(?:-image)?\s*:\s*url\(([^)]+)\)/gi)];
    for (const bgMatch of bgMatches) {
      urlCandidates.push(bgMatch[1].trim().replace(/^['"]|['"]$/g, ''));
    }
  }

  const styleBlockMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  for (const blockMatch of styleBlockMatches) {
    const css = blockMatch[1];
    const bgMatches = [...css.matchAll(/background(?:-image)?\s*:\s*url\(([^)]+)\)/gi)];
    for (const bgMatch of bgMatches) {
      urlCandidates.push(bgMatch[1].trim().replace(/^['"]|['"]$/g, ''));
    }
  }

  return urlCandidates
    .map((candidate) => normalizeImageUrl(candidate, baseUrl))
    .filter((url): url is string => Boolean(url) && isRelevantImage(url));
}

function rankImages(images: string[]) {
  return images.sort((a, b) => {
    const score = (url: string) => {
      let value = 0;
      if (/room|suite|hotel|property|gallery|photo/i.test(url)) value += 4;
      if (/hero|cover|main|featured/i.test(url)) value += 2;
      if (/\b(1200|1600|1920|2048)\b/.test(url)) value += 1;
      return value;
    };
    return score(b) - score(a);
  });
}

function uniqueImages(images: string[]) {
  const deduplicated = images.filter((image, index) => images.indexOf(image) === index);
  return rankImages(deduplicated).slice(0, 6);
}

async function extractImagesFromUrl(targetUrl: string) {
  const response = await fetch(targetUrl, {
    headers: {
      'user-agent': 'ELSK Roadtrip Image Extractor/1.0',
      'accept-language': 'en-US,en;q=0.8',
    },
    redirect: 'follow',
  });

  if (!response.ok) {
    return { images: [], response, error: `Could not fetch website (${response.status})` };
  }

  const html = await response.text();
  const resolvedUrl = response.url || targetUrl;
  const images = uniqueImages([
    ...extractMetaImages(html, resolvedUrl),
    ...extractJsonLdImages(html, resolvedUrl),
    ...extractSrcsetImages(html, resolvedUrl),
    ...extractPictureSourceImages(html, resolvedUrl),
    ...extractBackgroundImages(html, resolvedUrl),
    ...extractImgTagImages(html, resolvedUrl),
  ]);

  return { images, response, error: null };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const websiteUrl = getQueryParam(req.url || '', 'url');
  if (!websiteUrl) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  let parsedWebsiteUrl: URL;
  try {
    parsedWebsiteUrl = new URL(websiteUrl);
  } catch {
    res.status(400).json({ error: 'Invalid url parameter' });
    return;
  }

  if (!['http:', 'https:'].includes(parsedWebsiteUrl.protocol)) {
    res.status(400).json({ error: 'Unsupported URL protocol' });
    return;
  }

  try {
    const primary = await extractImagesFromUrl(parsedWebsiteUrl.toString());
    let images = primary.images;

    if (images.length === 0) {
      const rootUrl = `${parsedWebsiteUrl.protocol}//${parsedWebsiteUrl.host}/`;
      if (rootUrl !== parsedWebsiteUrl.toString()) {
        const fallback = await extractImagesFromUrl(rootUrl);
        images = fallback.images;
      }
    }

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200');
    res.status(200).json({ images: images.slice(0, 4) });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected image lookup error',
    });
  }
}