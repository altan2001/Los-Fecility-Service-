import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  Loader2, 
  Maximize2, 
  CheckCircle2, 
  AlertCircle,
  Ruler,
  Square,
  Plus,
  ChevronRight,
  X
} from 'lucide-react';

interface Room {
  name: string;
  area: number; // m2
  perimeter: number; // lfm
  features: string[];
  box?: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  suggested_services?: {
    trade: string;
    service: string;
    unit: string;
    quantity: number;
  }[];
}

interface PlanAnalysisResult {
  rooms: Room[];
  summary: {
    totalArea: number;
    totalWallLength: number;
  };
}

interface PlanAnalyzerProps {
  onApplyResults: (results: PlanAnalysisResult) => void;
}

export default function PlanAnalyzer({ onApplyResults }: PlanAnalyzerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<PlanAnalysisResult | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [scaleReference, setScaleReference] = useState({ object: 'Tür', length: 0.88 });
  const [isCalibrating, setIsCalibrating] = useState(false);

  useEffect(() => {
    if (result) {
      setSelectedRooms(result.rooms.map((_, idx) => idx));
    }
  }, [result]);

  const toggleRoom = (idx: number) => {
    setSelectedRooms(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      setResult(null);
      setError(null);
      setIsCalibrating(true);
    }
  };

  const analyzePlan = async () => {
    if (!file) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      const base64Data = await base64Promise;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: file.type,
                  data: base64Data,
                },
              },
              {
                text: `Analysiere diesen Grundriss/Bauplan mit höchster Präzision. 
                Referenz für den Maßstab: Eine ${scaleReference.object} entspricht ca. ${scaleReference.length}m.
                
                Aufgaben:
                1. Identifiziere ALLE Räume (auch Flure, Bäder, Abstellräume).
                2. Gib für jeden Raum eine exakte Bounding Box im Format [ymin, xmin, ymax, xmax] an (normalisiert auf 0-1000).
                3. Berechne die Netto-Grundfläche (m²) und den Umfang (lfm) basierend auf der Maßstabsreferenz.
                4. Erkenne spezifische Bauelemente pro Raum:
                   - Anzahl und Typ der Fenster (z.B. "2x Standardfenster", "1x Bodentiefes Fenster")
                   - Anzahl der Türen
                   - Sanitärobjekte (Waschbecken, WC, Dusche, Badewanne)
                   - Heizkörper oder Fußbodenheizungs-Verteiler
                   - Steckdosen und Lichtauslässe (wo erkennbar)
                5. Schlage detaillierte Handwerksleistungen vor, die für diesen Raumtyp typisch sind (z.B. Fliesenleger für Bad, Parkett für Wohnzimmer).
                
                Gib das Ergebnis als valides JSON-Objekt zurück:
                {
                  "rooms": [
                    { 
                      "name": "Badezimmer", 
                      "area": 8.5, 
                      "perimeter": 12.0, 
                      "box": [200, 300, 400, 450],
                      "features": ["1 Fenster", "1 Dusche", "1 WC", "1 Waschbecken", "Fußbodenheizung"],
                      "suggested_services": [
                        { "trade": "Fliesenleger", "service": "Bodenfliesen verlegen", "unit": "m²", "quantity": 8.5 },
                        { "trade": "Fliesenleger", "service": "Wandfliesen (raumhoch)", "unit": "m²", "quantity": 30.0 },
                        { "trade": "Sanitär", "service": "Montage Dusche & Armaturen", "unit": "Stk", "quantity": 1 }
                      ]
                    }
                  ],
                  "summary": {
                    "totalArea": 120.5,
                    "totalWallLength": 85.0,
                    "detectedElements": {
                      "windows": 12,
                      "doors": 8,
                      "radiators": 6
                    }
                  }
                }
                Wichtig: Antworte NUR mit dem JSON-Objekt. Sei extrem präzise bei den Maßen.`,
              },
            ],
          },
        ],
      });

      const text = response.text;
      if (text) {
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedResult = JSON.parse(cleanText) as PlanAnalysisResult;
        setResult(parsedResult);
      }
    } catch (err) {
      console.error("Plan analysis error:", err);
      setError("Fehler bei der KI-Analyse. Bitte stellen Sie sicher, dass der Plan gut lesbar ist.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div id="plan-analyzer-container" className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
      <div id="plan-analyzer-header" className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary">
            <Maximize2 size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-brand-dark">KI-Planerkennung</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Automatisches Aufmaß aus Grundrissen</p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {!previewUrl ? (
          <label id="plan-upload-zone" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer hover:bg-slate-50 transition-all group">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-12 h-12 text-slate-300 group-hover:text-brand-primary transition-colors mb-4" />
              <p className="mb-2 text-sm text-slate-500 font-bold">Plan hochladen (PDF, PNG, JPG)</p>
              <p className="text-xs text-slate-400">Klicken oder Drag & Drop</p>
            </div>
            <input type="file" className="hidden" onChange={handleFileChange} accept="image/*,application/pdf" />
          </label>
        ) : (
          <div className="space-y-6">
            <div id="plan-preview-container" className="relative rounded-[2rem] overflow-hidden border border-slate-100 shadow-inner bg-slate-100 aspect-video group">
              <img src={previewUrl} alt="Plan Preview" className="w-full h-full object-contain" />
              
              {/* Bounding Box Overlays */}
              {result && result.rooms.map((room, idx) => {
                if (!room.box) return null;
                const [ymin, xmin, ymax, xmax] = room.box;
                const isSelected = selectedRooms.includes(idx);
                
                return (
                  <motion.div
                    key={`box-${idx}`}
                    initial={{ opacity: 0 }}
                    animate={{ 
                      opacity: 1,
                      scale: isSelected ? 1 : 0.98
                    }}
                    onClick={() => toggleRoom(idx)}
                    style={{
                      position: 'absolute',
                      top: `${ymin / 10}%`,
                      left: `${xmin / 10}%`,
                      width: `${(xmax - xmin) / 10}%`,
                      height: `${(ymax - ymin) / 10}%`,
                      zIndex: isSelected ? 20 : 10,
                      cursor: 'pointer',
                    }}
                    className="group/box"
                  >
                    {/* The Box Outline/Fill */}
                    <div 
                      className={`w-full h-full transition-all duration-300 rounded-sm flex flex-col items-center justify-center border-2 ${
                        isSelected 
                          ? 'bg-brand-primary/20 border-brand-primary shadow-[0_0_15px_rgba(242,125,38,0.3)]' 
                          : 'bg-slate-400/5 border-slate-400/30 hover:bg-slate-400/10 hover:border-slate-400/50'
                      }`}
                    >
                      {/* Room Label - Only visible when selected or hovered */}
                      <AnimatePresence>
                        {(isSelected || true) && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ 
                              opacity: isSelected ? 1 : 0,
                              scale: isSelected ? 1 : 0.8,
                              y: isSelected ? 0 : 5
                            }}
                            className={`pointer-events-none flex flex-col items-center gap-1 p-2 rounded-xl backdrop-blur-md shadow-xl border ${
                              isSelected 
                                ? 'bg-brand-dark/90 text-white border-brand-primary/50' 
                                : 'bg-white/90 text-slate-600 border-slate-200'
                            }`}
                          >
                            <span className="text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">
                              {room.name}
                            </span>
                            {isSelected && (
                              <div className="flex flex-col items-center gap-0.5 border-t border-white/10 pt-1 mt-1">
                                <span className="text-[8px] font-bold flex items-center gap-1">
                                  <Square size={8} /> {room.area.toFixed(1)} m²
                                </span>
                                <span className="text-[8px] font-bold flex items-center gap-1 opacity-70">
                                  <Ruler size={8} /> {room.perimeter.toFixed(1)} lfm
                                </span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Subtle indicator for non-selected rooms */}
                    {!isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/box:opacity-100 transition-opacity">
                        <div className="bg-white/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
                          <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{room.name}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              <button 
                onClick={() => { setPreviewUrl(null); setFile(null); setResult(null); }}
                className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm text-slate-600 rounded-full hover:bg-white transition-all shadow-lg"
              >
                <Plus className="rotate-45" size={20} />
              </button>
            </div>

            {isCalibrating && !result && !isAnalyzing && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-brand-primary/5 rounded-3xl border border-brand-primary/10 space-y-4"
              >
                <div className="flex items-center gap-2 text-brand-primary mb-2">
                  <Ruler size={20} />
                  <h4 className="font-black uppercase tracking-widest text-xs">Maßstab kalibrieren</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Referenz-Objekt</label>
                    <select 
                      value={scaleReference.object}
                      onChange={e => setScaleReference({...scaleReference, object: e.target.value})}
                      className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 outline-none font-bold text-brand-dark"
                    >
                      <option value="Tür">Tür (Standard)</option>
                      <option value="Fenster">Fenster</option>
                      <option value="Badewanne">Badewanne</option>
                      <option value="Treppe">Treppe (Breite)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Länge in Meter</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={scaleReference.length}
                      onChange={e => setScaleReference({...scaleReference, length: Number(e.target.value)})}
                      className="w-full bg-white border border-slate-100 rounded-xl py-3 px-4 outline-none font-bold text-brand-dark"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 italic">Die KI nutzt dieses Objekt als Referenz, um Flächen und Längen im Plan zu berechnen.</p>
              </motion.div>
            )}

            <div className="flex justify-center">
              <button 
                id="plan-analyze-btn"
                onClick={analyzePlan}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-8 py-4 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <><Loader2 size={20} className="animate-spin" /> Analysiere Plan...</>
                ) : (
                  <><Maximize2 size={20} /> Analyse starten</>
                )}
              </button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium"
            >
              <AlertCircle size={18} /> {error}
            </motion.div>
          )}

          {result && (
            <motion.div 
              id="plan-analysis-results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-6">
                <button 
                  onClick={() => {
                    setResult(null);
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="flex items-center gap-2 text-slate-400 hover:text-brand-primary font-bold text-xs uppercase tracking-widest transition-all group bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm"
                >
                  <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                  Neu hochladen
                </button>
                <button 
                  onClick={() => {
                    setResult(null);
                    setFile(null);
                    setPreviewUrl(null);
                  }}
                  className="flex items-center justify-center w-9 h-9 bg-white text-slate-400 hover:text-red-500 border border-slate-100 hover:border-red-100 rounded-xl transition-all shadow-sm"
                  title="Schließen"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gesamtfläche</p>
                  <p className="text-2xl font-black text-brand-dark">{result.summary.totalArea.toFixed(2)} m²</p>
                </div>
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Wandlänge gesamt</p>
                  <p className="text-2xl font-black text-brand-dark">{result.summary.totalWallLength.toFixed(2)} lfm</p>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest px-2">Erkannte Räume</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.rooms.map((room, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => toggleRoom(idx)}
                      className={`p-4 border rounded-2xl shadow-sm transition-all cursor-pointer group ${
                        selectedRooms.includes(idx) 
                          ? 'bg-white border-brand-primary ring-1 ring-brand-primary/20' 
                          : 'bg-slate-50/50 border-slate-100 opacity-60 grayscale'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h5 className={`font-black ${selectedRooms.includes(idx) ? 'text-brand-dark' : 'text-slate-400'}`}>
                          {room.name}
                        </h5>
                        {selectedRooms.includes(idx) ? (
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        ) : (
                          <div className="w-[18px] h-[18px] border-2 border-slate-200 rounded-full" />
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-bold">
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                          selectedRooms.includes(idx) ? 'text-brand-primary bg-brand-primary/5' : 'text-slate-400 bg-slate-100'
                        }`}>
                          <Square size={12} /> {room.area} m²
                        </span>
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                          selectedRooms.includes(idx) ? 'text-slate-500 bg-slate-50' : 'text-slate-400 bg-slate-100'
                        }`}>
                          <Ruler size={12} /> {room.perimeter} lfm
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <motion.button 
                id="plan-apply-results-btn"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => {
                  if (result) {
                    onApplyResults({
                      ...result,
                      rooms: result.rooms.filter((_, idx) => selectedRooms.includes(idx))
                    });
                  }
                }}
                disabled={selectedRooms.length === 0}
                className="w-full py-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-[2rem] font-black text-xl hover:from-emerald-600 hover:to-teal-700 transition-all shadow-2xl shadow-emerald-500/40 flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1"
              >
                <CheckCircle2 size={28} /> {selectedRooms.length} Räume in Kalkulation übernehmen
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
