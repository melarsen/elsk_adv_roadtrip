import React from 'react';
import { TripPlan } from '../services/geminiService';

export default function InteractiveMap({ plan }: { plan: TripPlan }) {
  // Collect all points of interest, hotels, and route points
  const allPoints: { lat: number; lng: number; name: string }[] = [];
  
  plan.days.forEach((day) => {
    // Add start of day
    allPoints.push({ ...day.startCoords, name: `Start Dag ${day.day}` });
    
    // Add POIs
    day.pois.forEach(poi => {
      allPoints.push({ ...poi.coordinates, name: poi.name });
    });
    
    // Add Hotels
    day.accommodations.forEach(acc => {
      allPoints.push({ ...acc.coordinates, name: acc.name });
    });
    
    // Add end of day
    allPoints.push({ ...day.endCoords, name: `Slutt Dag ${day.day}` });
  });

  // Build the directions URL for embedding
  // Format: https://maps.google.com/maps?saddr=START&daddr=POINT1+to:POINT2+to:END&output=embed
  if (allPoints.length === 0) return null;

  const start = allPoints[0];
  const end = allPoints[allPoints.length - 1];
  const intermediate = allPoints.slice(1, -1);

  const saddr = `${start.lat},${start.lng}`;
  const daddr = intermediate.length > 0 
    ? intermediate.map(p => `${p.lat},${p.lng}`).join('+to:') + `+to:${end.lat},${end.lng}`
    : `${end.lat},${end.lng}`;

  const embedUrl = `https://maps.google.com/maps?saddr=${saddr}&daddr=${daddr}&t=&z=6&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="h-[600px] w-full rounded-3xl overflow-hidden shadow-inner border border-slate-200 bg-slate-100 relative">
      <iframe
        title="Reisekart"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        src={embedUrl}
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="absolute bottom-4 right-4 z-10 flex gap-2">
        <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg text-[10px] font-medium text-slate-500 border border-slate-100">
          {allPoints.length} stoppesteder inkludert
        </div>
        <a 
          href={plan.googleMapsLink} 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-romantic-600 px-4 py-2 rounded-full shadow-lg text-xs font-bold text-white flex items-center gap-2 hover:bg-romantic-700 transition-colors"
        >
          Åpne i Google Maps App
        </a>
      </div>
    </div>
  );
}
