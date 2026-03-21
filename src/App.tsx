/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Heart, Users, Search, Navigation, Hotel, Camera, ExternalLink, Loader2, ChevronRight, ChevronDown, Map as MapIcon, Mail, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateTripPlan, TripPlan, TripRequest } from './services/geminiService';
import { hasActiveApiKey, openApiKeySelector, isUserKeySelected } from './services/aiProvider';
import InteractiveMap from './components/InteractiveMap';
import ChatBot from './components/ChatBot';
import clsx from 'clsx';
import { Analytics } from "@vercel/analytics/next"

export default function App() {
  const [loading, setLoading] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      const active = await hasActiveApiKey();
      const userSelected = isUserKeySelected();
      // Vis banner hvis ingen nøkkel er aktiv, ELLER hvis vi bruker systemnøkkelen (valgfritt, men hjelper i delte apper)
      setHasKey(active && userSelected);
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    await openApiKeySelector();
    setHasKey(true); // Anta suksess etter å ha åpnet dialogen
  };

  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const loadingMessages = [
    "Bygger reiseplan...",
    "Optimaliserer kjørerute...",
    "Leter etter interessante severdigheter...",
    "Henter hotellforslag...",
    "Gjør klar din spesielle plan..."
  ];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setLoadingMessageIndex(0);
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [formData, setFormData] = useState<TripRequest>({
    start: 'Halden, Norway',
    destination: 'Termoli, Italia',
    waypoints: '',
    hoursPerDay: 7,
    age: '45',
    interests: 'romantisk, natur'
  });

  const handleSendEmail = () => {
    if (!plan) return;

    const subject = encodeURIComponent(`Vår Reiseplan: ${formData.start} til ${formData.destination}`);
    
    let bodyText = `Hei!\n\nHer er reiseplanen vår generert av ELSK Roadtrip:\n\n`;
    bodyText += `Oppsummering: ${plan.summary}\n\n`;
    
    plan.days.forEach(day => {
      bodyText += `DAG ${day.day}: ${day.route}\n`;
      bodyText += `Severdigheter:\n`;
      day.pois.forEach(poi => {
        bodyText += `- ${poi.name}: ${poi.description} (Lenke: ${poi.websiteUrl || 'N/A'})\n`;
      });
      bodyText += `Overnatting:\n`;
      day.accommodations.forEach(acc => {
        bodyText += `- ${acc.name}: ${acc.priceEstimate} (Lenke: ${acc.websiteUrl || 'N/A'})\n`;
      });
      bodyText += `\n`;
    });

    if (plan.googleMapsLink) {
      bodyText += `Se hele ruten på Google Maps: ${plan.googleMapsLink}\n\n`;
    }

    bodyText += `God tur!\nSendt fra ELSK Roadtrip`;

    const mailtoLink = `mailto:?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
    window.location.href = mailtoLink;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Sjekk nøkkel på nytt før innsending
    const active = await hasActiveApiKey();
    if (!active) {
      await handleSelectKey();
      return;
    }

    setLoading(true);
    try {
      const result = await generateTripPlan(formData);
      setPlan(result);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Noe gikk galt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20">
      {/* API Key Banner */}
      <AnimatePresence>
        {hasKey === false && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-50 border-b border-amber-200 py-3 px-4 text-center sticky top-0 z-50"
          >
            <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-2">
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <p className="text-amber-800 text-sm font-medium">
                  For best resultat og for å unngå begrensninger, vennligst velg din egen (gratis) API-nøkkel.
                </p>
                <button 
                  onClick={handleSelectKey}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold py-1.5 px-4 rounded-full transition-colors shadow-sm"
                >
                  Velg API-nøkkel
                </button>
              </div>
              <p className="text-amber-700 text-[11px]">
                Hvis listen er tom: Gå til <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="underline font-bold">AI Studio</a>, klikk "Get API key" og opprett en nøkkel først.
              </p>
            </div>
            <button 
              onClick={() => setHasKey(true)} 
              className="absolute right-4 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-600 transition-colors"
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <header className="relative h-[40vh] flex items-center justify-center overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1920" 
          alt="Scenic Road" 
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative z-10 text-center px-4">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-serif text-white mb-4"
          >
            ELSK Roadtrip
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-white/90 font-light tracking-wide"
          >
            Planlegg den perfekte bilturen for deg og din kjære
          </motion.p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 -mt-20 relative z-20">
        {/* Search Form */}
        <section className="glass-card p-8 mb-12">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <MapPin size={16} className="text-romantic-500" /> Startsted
              </label>
              <input 
                type="text" 
                placeholder="Halden, Norway"
                className="input-field"
                required
                value={formData.start}
                onChange={e => setFormData({...formData, start: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <Navigation size={16} className="text-romantic-500" /> Destinasjon
              </label>
              <input 
                type="text" 
                placeholder="Termoli, Italia"
                className="input-field"
                required
                value={formData.destination}
                onChange={e => setFormData({...formData, destination: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <MapIcon size={16} className="text-romantic-500" /> Viapunkter (valgfritt)
              </label>
              <input 
                type="text" 
                placeholder="f.eks. Berlin, München"
                className="input-field"
                value={formData.waypoints}
                onChange={e => setFormData({...formData, waypoints: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <Clock size={16} className="text-romantic-500" /> Kjøretimer per dag
              </label>
              <input 
                type="number" 
                min="1" 
                max="15"
                className="input-field"
                value={formData.hoursPerDay}
                onChange={e => setFormData({...formData, hoursPerDay: parseInt(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <Users size={16} className="text-romantic-500" /> Alder (valgfritt)
              </label>
              <input 
                type="text" 
                placeholder="45"
                className="input-field"
                value={formData.age}
                onChange={e => setFormData({...formData, age: e.target.value})}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                <Heart size={16} className="text-romantic-500" /> Interesser
              </label>
              <input 
                type="text" 
                placeholder="romantisk, natur"
                className="input-field"
                value={formData.interests}
                onChange={e => setFormData({...formData, interests: e.target.value})}
              />
            </div>
            <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 mt-6 w-full">
              <div className="hidden md:block" />
              <button 
                type="submit" 
                disabled={loading}
                className="btn-primary flex items-center justify-center gap-2 text-lg min-w-[220px]"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Search size={20} />
                )}
                Lag Reiseplan
              </button>

              <div className="h-8 flex items-center justify-center md:justify-start md:pl-6 min-w-[320px]">
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.p
                      key={loadingMessageIndex}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="text-romantic-600 font-medium italic whitespace-nowrap"
                    >
                      {loadingMessages[loadingMessageIndex]}
                    </motion.p>
                  ) : plan ? (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-emerald-600 font-semibold flex items-center gap-2 whitespace-nowrap"
                    >
                      <ChevronDown className="animate-bounce" size={18} />
                      Scroll ned for din personlige reiseplan
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </form>
        </section>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {plan && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-serif text-slate-800">Deres Reiseplan</h2>
                <p className="text-lg text-slate-600 max-w-2xl mx-auto italic">
                  "{plan.summary}"
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  {plan.googleMapsLink && (
                    <a 
                      href={plan.googleMapsLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-romantic-600 hover:text-romantic-700 font-medium underline underline-offset-4"
                    >
                      Se hele ruten i Google Maps <ExternalLink size={16} />
                    </a>
                  )}
                  <button 
                    onClick={handleSendEmail}
                    className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 font-medium underline underline-offset-4"
                  >
                    Send som e-post <Mail size={16} />
                  </button>
                </div>
              </div>

              {/* ChatBot Context */}
              <ChatBot plan={plan} />

              {/* Interactive Map Section */}
              <section className="space-y-4">
                <div className="glass-card p-4">
                  <div className="flex items-center justify-between mb-4 px-4 pt-2">
                    <div className="flex items-center gap-2">
                      <MapIcon className="text-romantic-500" />
                      <h3 className="text-xl font-serif text-slate-800">Reisekart</h3>
                    </div>
                    {plan.googleMapsLink && (
                      <a 
                        href={plan.googleMapsLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
                      >
                        Åpne i Google Maps <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                  <InteractiveMap plan={plan} />
                </div>
              </section>

              {/* Detailed Itinerary */}
              <div className="space-y-16">
                {plan.days.map((day, idx) => (
                  <section key={idx} className="space-y-8">
                    <div className="flex items-center gap-4 border-b border-romantic-200 pb-4">
                      <div className="w-12 h-12 rounded-full bg-romantic-600 flex items-center justify-center text-white text-2xl font-serif">
                        {day.day}
                      </div>
                      <div>
                        <h3 className="text-3xl font-serif text-slate-800">Dag {day.day}</h3>
                        <p className="text-slate-500 font-medium">{day.route}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                      {/* POIs for the day */}
                      <div className="space-y-6">
                        <h4 className="text-xl font-serif text-slate-700 flex items-center gap-2 border-l-4 border-blue-400 pl-4">
                          <Camera size={20} className="text-blue-500" /> Severdigheter & Stoppesteder
                        </h4>
                        <div className="space-y-4">
                          {day.pois.map((poi: any, i: number) => (
                            <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                              <div className="flex justify-between items-start mb-2">
                                <h5 className="font-bold text-lg text-slate-800">{poi.name}</h5>
                                {poi.websiteUrl && (
                                  <a 
                                    href={poi.websiteUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-500 hover:text-blue-600"
                                    title="Besøk nettside"
                                  >
                                    <ExternalLink size={16} />
                                  </a>
                                )}
                              </div>
                              <p className="text-slate-600 text-sm mb-4">{poi.description}</p>
                              <div className="flex items-start gap-2 bg-blue-50 p-3 rounded-xl">
                                <Heart size={14} className="text-blue-500 mt-1 flex-shrink-0" />
                                <p className="text-blue-700 text-xs italic">"{poi.whyForCouple}"</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Accommodations for the day */}
                      <div className="space-y-6 bg-romantic-50/30 p-4 rounded-3xl -m-4">
                        <h4 className="text-xl font-serif text-slate-700 flex items-center gap-2 border-l-4 border-romantic-400 pl-4">
                          <Hotel size={20} className="text-romantic-500" /> Overnattingsforslag
                        </h4>
                        <div className="space-y-6">
                          {day.accommodations.map((acc: any, i: number) => (
                            <div key={i} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                              <div className="grid grid-cols-2 gap-1 h-40">
                                {acc.images?.slice(0, 2).map((img: string, imgIdx: number) => (
                                  <img 
                                    key={imgIdx} 
                                    src={img} 
                                    alt={acc.name} 
                                    className="w-full h-full object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                ))}
                              </div>
                              <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h5 className="font-bold text-lg text-slate-800">{acc.name}</h5>
                                      {acc.websiteUrl && (
                                        <a 
                                          href={acc.websiteUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-romantic-500 hover:text-romantic-600"
                                          title="Besøk nettside"
                                        >
                                          <ExternalLink size={14} />
                                        </a>
                                      )}
                                    </div>
                                    <p className="text-slate-500 text-xs flex items-center gap-1">
                                      <MapPin size={10} /> {acc.location}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-romantic-600 font-bold text-sm">{acc.priceEstimate}</p>
                                  </div>
                                </div>
                                <p className="text-slate-600 text-xs mb-4 line-clamp-2">{acc.description}</p>
                                <div className="bg-romantic-50 p-3 rounded-xl mb-4">
                                  <p className="text-romantic-700 text-xs italic">"{acc.whyRecommended}"</p>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>Kilde: {acc.source}</span>
                                  {acc.websiteUrl ? (
                                    <a 
                                      href={acc.websiteUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-romantic-600 font-semibold flex items-center gap-1 hover:underline"
                                    >
                                      Book nå <ChevronRight size={12} />
                                    </a>
                                  ) : (
                                    <button className="text-romantic-600 font-semibold flex items-center gap-1 opacity-50 cursor-not-allowed">
                                      Book nå <ChevronRight size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-20 py-12 border-t border-slate-100 bg-white/50">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4 text-romantic-500">
            <Heart size={20} fill="currentColor" />
            <span className="font-serif text-xl font-bold">ELSK Roadtrip</span>
          </div>
          <p className="text-slate-500 text-sm mb-6">
            Skapt med kjærlighet for par som elsker å utforske verden sammen.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button 
              onClick={handleSelectKey}
              className="text-slate-400 hover:text-romantic-500 text-xs flex items-center gap-1 transition-colors"
            >
              <ExternalLink size={12} /> Administrer API-nøkkel
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DayCard({ day }: { day: any }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="glass-card overflow-hidden">
      <div 
        className="bg-romantic-600 p-6 text-white flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl font-serif">
            {day.day}
          </div>
          <div>
            <h3 className="text-xl font-serif">Dag {day.day}</h3>
            <p className="text-white/80 text-sm">{day.route}</p>
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }}>
          <ChevronDown size={24} />
        </motion.div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="p-8 space-y-10"
          >
            {/* POIs */}
            <section>
              <h4 className="text-2xl font-serif text-slate-800 mb-6 flex items-center gap-2">
                <Camera className="text-romantic-500" /> Severdigheter & Stoppesteder
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {day.pois.map((poi: any, i: number) => (
                  <div key={i} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 hover:border-romantic-200 transition-colors">
                    <h5 className="font-bold text-lg text-slate-800 mb-2">{poi.name}</h5>
                    <p className="text-slate-600 text-sm mb-4">{poi.description}</p>
                    <div className="flex items-start gap-2 bg-romantic-50 p-3 rounded-xl">
                      <Heart size={14} className="text-romantic-500 mt-1 flex-shrink-0" />
                      <p className="text-romantic-700 text-xs italic">"{poi.whyForCouple}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Accommodations */}
            <section>
              <h4 className="text-2xl font-serif text-slate-800 mb-6 flex items-center gap-2">
                <Hotel className="text-romantic-500" /> Overnattingsforslag
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {day.accommodations.map((acc: any, i: number) => (
                  <div key={i} className="flex flex-col bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden group">
                    <div className="grid grid-cols-2 gap-1 h-48">
                      {acc.images?.slice(0, 4).map((img: string, imgIdx: number) => (
                        <img 
                          key={imgIdx} 
                          src={img} 
                          alt={acc.name} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ))}
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h5 className="font-bold text-xl text-slate-800">{acc.name}</h5>
                          <p className="text-slate-500 text-sm flex items-center gap-1">
                            <MapPin size={12} /> {acc.location}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-romantic-600 font-bold">{acc.priceEstimate}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">Prisestimat</p>
                        </div>
                      </div>
                      
                      <p className="text-slate-600 text-sm line-clamp-3">{acc.description}</p>
                      
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Hvorfor vi elsker det</p>
                        <p className="text-slate-700 text-sm italic">"{acc.whyRecommended}"</p>
                      </div>

                      <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Kilde: {acc.source}</span>
                        <button className="text-romantic-600 text-sm font-semibold flex items-center gap-1 hover:gap-2 transition-all">
                          Se tilgjengelighet <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
