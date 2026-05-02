import { TripPlan, TripRequest } from './geminiService';

type PdfDocument = import('jspdf').jsPDF;

const PAGE_HEIGHT = 297;
const PAGE_WIDTH = 210;
const MARGIN = 16;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;

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
  doc.link(x, cursorY - 4, width, 5, { url: safeUrl });
  doc.setDrawColor(0, 102, 204);
  doc.line(x, cursorY + 1, x + width, cursorY + 1);
  doc.setTextColor(45, 55, 72);

  return cursorY + LINE_HEIGHT;
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

  plan.days.forEach((day) => {
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
    day.accommodations.forEach((accommodation, index) => {
      y = writeWrappedText(
        doc,
        `${index + 1}. ${accommodation.name}${accommodation.location ? ` - ${accommodation.location}` : ''}${accommodation.priceEstimate ? ` (${accommodation.priceEstimate})` : ''}`,
        y,
      );
      y = writeWrappedText(doc, accommodation.description, y, { indent: 4, color: [82, 82, 91] });
      y = writeWrappedText(doc, `Why it fits: ${accommodation.whyRecommended}`, y, { indent: 4, color: [82, 82, 91] });
      y = writeWrappedText(doc, `Source: ${accommodation.source}`, y, { indent: 4, color: [82, 82, 91] });
      if (accommodation.websiteUrl) {
        y = writeLink(doc, `Hotel link: ${accommodation.name}`, accommodation.websiteUrl, y, 4);
      }
      y += 2;
    });

    y += 4;
  });

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