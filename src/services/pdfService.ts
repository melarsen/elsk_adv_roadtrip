import { TripPlan, TripRequest, extractCityAndCountry, buildBookingSearchUrl, buildHotelsSearchUrl } from './geminiService';

type PdfDocument = import('jspdf').jsPDF;

const PAGE_HEIGHT = 297;
const PAGE_WIDTH = 210;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;
const IMAGE_HEIGHT = 42;
const IMAGE_GAP = 4;
const IMAGE_SECTION_PADDING = 3;

type DataUrlImage = {
  dataUrl: string;
  format: 'JPEG' | 'PNG' | 'WEBP';
};

const APP_URL = 'https://elsk-adv-roadtrip.vercel.app/';
const FOOTER_TEXT = 'Created by ELSK Adventures - with love for unforgettable journeys.';
const FOOTER_COPYRIGHT = '© 2026 ELSK Adventures. All rights reserved.';

function sanitizeFilePart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'roadtrip';
}

function ensurePageSpace(doc: PdfDocument, y: number, neededHeight = LINE_HEIGHT * 2) {
  if (y + neededHeight <= PAGE_HEIGHT - MARGIN) {
    return y;
  }

  doc.addPage();
  return MARGIN;
}

function writeWrappedText(doc: PdfDocument, text: string, y: number, options?: { indent?: number; color?: [number, number, number] }) {
  const indent = options?.indent ?? 0;
  const lines = doc.splitTextToSize(text, CONTENT_WIDTH - indent);
  let cursorY = ensurePageSpace(doc, y, lines.length * LINE_HEIGHT);

  if (options?.color) {
    doc.setTextColor(...options.color);
  } else {
    doc.setTextColor(45, 55, 72);
  }

  doc.text(lines, MARGIN + indent, cursorY);
  return cursorY + lines.length * LINE_HEIGHT;
}

function writeLink(doc: PdfDocument, label: string, url: string, y: number, indent = 0) {
  const safeUrl = url?.trim();
  if (!safeUrl) {
    return y;
  }

  const cursorY = ensurePageSpace(doc, y, LINE_HEIGHT * 2);
  const x = MARGIN + indent;

  doc.setTextColor(0, 102, 204);
  doc.text(label, x, cursorY);
  const width = doc.getTextWidth(label);
  doc.link(x, cursorY - LINE_HEIGHT + 1, width, LINE_HEIGHT, { url: safeUrl });
  doc.setDrawColor(0, 102, 204);
  doc.line(x, cursorY + 1, x + width, cursorY + 1);
  doc.setTextColor(45, 55, 72);

  return cursorY + LINE_HEIGHT;
}

async function loadImageAsDataUrl(src: string): Promise<DataUrlImage | null> {
  const safeSrc = src?.trim();
  if (!safeSrc) {
    return null;
  }

  try {
    const response = await fetch(safeSrc);
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const format = blob.type.includes('png')
      ? 'PNG'
      : blob.type.includes('webp')
        ? 'WEBP'
        : 'JPEG';

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }

        reject(new Error('Could not read image data'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('Could not read image data'));
      reader.readAsDataURL(blob);
    });

    return { dataUrl, format };
  } catch {
    return null;
  }
}

async function writeImageRow(doc: PdfDocument, imageUrls: string[], y: number) {
  const images = (await Promise.all(imageUrls.map((url) => loadImageAsDataUrl(url)))).filter(
    (image): image is DataUrlImage => Boolean(image),
  );

  if (images.length === 0) {
    return y;
  }

  const limitedImages = images.slice(0, 2);
  const imageWidth = limitedImages.length === 1
    ? CONTENT_WIDTH
    : (CONTENT_WIDTH - IMAGE_GAP) / 2;
  let cursorY = ensurePageSpace(doc, y, IMAGE_HEIGHT + LINE_HEIGHT + IMAGE_SECTION_PADDING * 2);

  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(
    MARGIN,
    cursorY,
    CONTENT_WIDTH,
    IMAGE_HEIGHT + IMAGE_SECTION_PADDING * 2,
    2,
    2,
  );
  cursorY += IMAGE_SECTION_PADDING;

  limitedImages.forEach((image, index) => {
    const imageX = MARGIN + index * (imageWidth + IMAGE_GAP);
    doc.addImage(image.dataUrl, image.format, imageX, cursorY, imageWidth, IMAGE_HEIGHT, undefined, 'MEDIUM');
  });

  return cursorY + IMAGE_HEIGHT + LINE_HEIGHT;
}

function addPdfFooter(doc: PdfDocument) {
  const pageCount = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);

    const footerTop = PAGE_HEIGHT - 20;
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, footerTop - 4, PAGE_WIDTH - MARGIN, footerTop - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(FOOTER_TEXT, MARGIN, footerTop);
    doc.text(FOOTER_COPYRIGHT, MARGIN, footerTop + 5);

    doc.setTextColor(0, 102, 204);
    doc.text(APP_URL, MARGIN, footerTop + 10);
    const width = doc.getTextWidth(APP_URL);
    doc.link(MARGIN, footerTop + 6, width, LINE_HEIGHT, { url: APP_URL });
    doc.line(MARGIN, footerTop + 11, MARGIN + width, footerTop + 11);
  }

  doc.setTextColor(45, 55, 72);
}

export interface BuiltPdf {
  blob: Blob;
  fileName: string;
}

export async function buildTripPlanPdf(plan: TripPlan, request: TripRequest): Promise<BuiltPdf> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  doc.setProperties({
    title: `ELSK Roadtrip: ${request.start} to ${request.destination}`,
    subject: 'Roadtrip itinerary',
    author: 'ELSK Roadtrip',
    creator: 'ELSK Roadtrip',
    keywords: 'roadtrip, itinerary, pdf, travel',
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(145, 63, 84);
  doc.text('ELSK Roadtrip', MARGIN, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  y = writeWrappedText(doc, `${request.start} to ${request.destination}`, y, { color: [45, 55, 72] });
  y += 2;
  y = writeWrappedText(doc, plan.summary, y, { color: [82, 82, 91] });
  y += 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  y = ensurePageSpace(doc, y, LINE_HEIGHT * 3);
  doc.text('Trip settings', MARGIN, y);
  y += LINE_HEIGHT;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  y = writeWrappedText(doc, `Waypoints: ${request.waypoints || 'None'}`, y);
  y = writeWrappedText(doc, `Driving hours per day: ${request.hoursPerDay}`, y);
  y = writeWrappedText(doc, `Age: ${request.age || 'Not specified'}`, y);
  y = writeWrappedText(doc, `Interests: ${request.interests || 'Not specified'}`, y);
  y += 2;

  if (plan.googleMapsLink) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    y = ensurePageSpace(doc, y, LINE_HEIGHT * 2);
    doc.text('Trip links', MARGIN, y);
    y += LINE_HEIGHT;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    y = writeLink(doc, 'Open full route in Google Maps', plan.googleMapsLink, y);
    y += 2;
  }

  for (const day of plan.days) {
    y = ensurePageSpace(doc, y, LINE_HEIGHT * 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text(`Day ${day.day}`, MARGIN, y);
    y += LINE_HEIGHT;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    y = writeWrappedText(doc, day.route, y);
    y += 2;

    doc.setFont('helvetica', 'bold');
    y = ensurePageSpace(doc, y, LINE_HEIGHT * 2);
    doc.text('Attractions', MARGIN, y);
    y += LINE_HEIGHT;

    doc.setFont('helvetica', 'normal');
    day.pois.forEach((poi, index) => {
      y = writeWrappedText(doc, `${index + 1}. ${poi.name}${poi.location ? ` - ${poi.location}` : ''}`, y);
      y = writeWrappedText(doc, poi.description, y, { indent: 4, color: [82, 82, 91] });
      y = writeWrappedText(doc, `Why it fits: ${poi.whyForCouple}`, y, { indent: 4, color: [82, 82, 91] });
      if (poi.websiteUrl) {
        y = writeLink(doc, `Attraction link: ${poi.name}`, poi.websiteUrl, y, 4);
      }
      y += 2;
    });

    doc.setFont('helvetica', 'bold');
    y = ensurePageSpace(doc, y, LINE_HEIGHT * 2);
    doc.text('Accommodation', MARGIN, y);
    y += LINE_HEIGHT;

    doc.setFont('helvetica', 'normal');
    for (const [index, accommodation] of day.accommodations.entries()) {
      y = writeWrappedText(
        doc,
        `${index + 1}. ${accommodation.name}${accommodation.location ? ` - ${accommodation.location}` : ''}`,
        y,
      );
      if (accommodation.priceEstimate) {
        y = writeWrappedText(doc, accommodation.priceEstimate, y, { indent: 4, color: [148, 163, 184] });
      }
      y = await writeImageRow(doc, accommodation.images.slice(0, 2), y);
      y = writeWrappedText(doc, accommodation.description, y, { indent: 4, color: [82, 82, 91] });
      y = writeWrappedText(doc, `Why it fits: ${accommodation.whyRecommended}`, y, { indent: 4, color: [82, 82, 91] });
      y = writeLink(doc, `Search: ${accommodation.name}`, `https://www.google.com/search?q=${encodeURIComponent(accommodation.name || '')}`, y, 4);
      const bookingUrl = buildBookingSearchUrl(accommodation);
      if (bookingUrl) {
        y = writeLink(doc, 'Booking.com', bookingUrl, y, 4);
      }
      const hotelsUrl = buildHotelsSearchUrl(accommodation);
      if (hotelsUrl) {
        y = writeLink(doc, 'Hotels.com', hotelsUrl, y, 4);
      }
      y += 2;
    }

    const { city, country } = extractCityAndCountry(day.accommodations?.[0]?.location);
    if (city || country) {
      const q = ['hotel', city, country].filter(Boolean).join(' ');
      y = writeLink(doc, `Search other hotels in ${[city, country].filter(Boolean).join(', ')}`, `https://www.google.com/search?q=${encodeURIComponent(q)}`, y, 0);
    }

    y += 4;
  }

  addPdfFooter(doc);

  const fileName = `elsk-roadtrip-${sanitizeFilePart(request.start)}-to-${sanitizeFilePart(request.destination)}.pdf`;
  const blob = doc.output('blob');

  return { blob, fileName };
}

export function triggerPdfDownload(blob: Blob, fileName: string) {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(downloadUrl);
}

export async function downloadTripPlanPdf(plan: TripPlan, request: TripRequest) {
  const { blob, fileName } = await buildTripPlanPdf(plan, request);
  triggerPdfDownload(blob, fileName);
}