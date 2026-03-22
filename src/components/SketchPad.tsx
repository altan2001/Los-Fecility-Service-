import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Pencil, 
  Eraser, 
  Trash2, 
  Save, 
  X, 
  Undo2,
  Redo2,
  Download,
  MousePointer2,
  Type,
  Square,
  Circle,
  Minus,
  Palette,
  Layers,
  Share2,
  Check,
  Globe,
  Home
} from 'lucide-react';

interface SketchPadProps {
  onSave?: (data: string, dimensions?: any) => void;
  onClose?: () => void;
  initialData?: string;
  initialUnit?: string;
}

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
}

export default function SketchPad({ onSave, onClose, initialData, initialUnit }: SketchPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<'pencil' | 'eraser' | 'line' | 'rect' | 'circle' | 'text' | 'select'>('pencil');
  const [color, setColor] = useState('#141414');
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [tempCanvasData, setTempCanvasData] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [dimensions, setDimensions] = useState({
    length: 0,
    width: 0,
    height: 0,
    depth: 0,
    quantity: 0,
    unit: initialUnit || 'm²',
    wastage: 0,
    difficulty: 1,
    areaName: '',
    isExterior: false
  });
  const [title, setTitle] = useState('Neue Skizze');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (selectedTextId) {
      const selectedText = textElements.find(t => t.id === selectedTextId);
      if (selectedText) {
        setColor(selectedText.color);
        setLineWidth(selectedText.fontSize / 5);
      }
    }
  }, [selectedTextId]);

  useEffect(() => {
    if (tool !== 'select') {
      setSelectedTextId(null);
    }
  }, [tool]);

  useEffect(() => {
    if (selectedTextId) {
      setTextElements(prev => prev.map(t => 
        t.id === selectedTextId ? { ...t, color: color, fontSize: lineWidth * 5 } : t
      ));
    }
  }, [color, lineWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match container
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const temp = canvas.toDataURL();
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = temp;
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    if (initialData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = initialData;
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [initialData]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory(prev => [...prev, canvas.toDataURL()]);
    setRedoStack([]);
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    if (tool === 'select') {
      const clickedText = textElements.find(t => {
        const dist = Math.sqrt(Math.pow(t.x - x, 2) + Math.pow(t.y - y, 2));
        return dist < 50; // Simple hit detection
      });
      if (clickedText) {
        setSelectedTextId(clickedText.id);
        setIsDraggingText(true);
        setStartPos({ x, y });
        return;
      } else {
        setSelectedTextId(null);
      }
    }

    setStartPos({ x, y });
    setIsDrawing(true);
    setTempCanvasData(canvas.toDataURL());

    if (tool === 'pencil' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    } else if (tool === 'text') {
      setStartPos({ x, y });
      setShowTextInput(true);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;

    if (isDraggingText && selectedTextId) {
      const dx = x - startPos.x;
      const dy = y - startPos.y;
      setTextElements(prev => prev.map(t => 
        t.id === selectedTextId ? { ...t, x: t.x + dx, y: t.y + dy } : t
      ));
      setStartPos({ x, y });
      return;
    }

    if (!isDrawing) return;

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;

    if (tool === 'pencil' || tool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      // For shapes, clear and redraw from temp data
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        ctx.beginPath();
        if (tool === 'line') {
          ctx.moveTo(startPos.x, startPos.y);
          ctx.lineTo(x, y);
        } else if (tool === 'rect') {
          ctx.strokeRect(startPos.x, startPos.y, x - startPos.x, y - startPos.y);
        } else if (tool === 'circle') {
          const radius = Math.sqrt(Math.pow(x - startPos.x, 2) + Math.pow(y - startPos.y, 2));
          ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        }
        ctx.stroke();
      };
      if (tempCanvasData) img.src = tempCanvasData;
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput) {
      setShowTextInput(false);
      return;
    }

    const newText: TextElement = {
      id: Math.random().toString(36).substr(2, 9),
      text: textInput,
      x: startPos.x,
      y: startPos.y,
      color: color,
      fontSize: lineWidth * 5
    };

    setTextElements(prev => [...prev, newText]);
    setTextInput('');
    setShowTextInput(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        saveToHistory();
        // Scale image to fit canvas while maintaining aspect ratio
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width / 2) - (img.width / 2) * scale;
        const y = (canvas.height / 2) - (img.height / 2) * scale;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const analyzeSketch = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    setIsAnalyzing(true);
    try {
      const imageData = canvas.toDataURL('image/png').split(',')[1];
      
      // Use Gemini to analyze the sketch
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Analysiere diese Skizze. Extrahiere alle sichtbaren Maße (Länge, Breite, Höhe, Tiefe) und Texte. Gib das Ergebnis im JSON-Format zurück: { dimensions: { length: number, width: number, height: number, depth: number }, texts: string[] }. Wenn ein Maß nicht gefunden wird, setze es auf 0." },
              { inlineData: { mimeType: "image/png", data: imageData } }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const result = JSON.parse(response.text);
      if (result.dimensions) {
        setDimensions(prev => ({
          ...prev,
          ...result.dimensions
        }));
      }
      
      if (result.texts && result.texts.length > 0) {
        alert(`Gefundene Texte: ${result.texts.join(', ')}`);
      }
    } catch (error) {
      console.error('Fehler bei der Skizzenanalyse:', error);
      alert('Fehler bei der Analyse der Skizze.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateQuantity = () => {
    const { length, width, height, depth, unit, wastage, difficulty } = dimensions;
    let baseQty = 0;
    
    if (unit === 'm²') baseQty = length * width;
    else if (unit === 'lfm' || unit === 'm') baseQty = length;
    else if (unit === 'm³') baseQty = length * width * (height || depth || 1);
    else if (unit === 'Stk') baseQty = dimensions.quantity || 1;
    
    const withWastage = baseQty * (1 + (wastage || 0) / 100);
    const finalQty = withWastage * (difficulty || 1);
    
    // Only update if it's different to avoid infinite loops
    if (Math.abs(dimensions.quantity - finalQty) > 0.001) {
      setDimensions(prev => ({ ...prev, quantity: finalQty }));
    }
  };

  useEffect(() => {
    if (dimensions.unit !== 'Stk') {
      calculateQuantity();
    }
  }, [dimensions.length, dimensions.width, dimensions.height, dimensions.depth, dimensions.unit, dimensions.wastage, dimensions.difficulty]);

  const stopDrawing = () => {
    if (isDraggingText) {
      setIsDraggingText(false);
      return;
    }
    if (isDrawing) {
      saveToHistory();
      setIsDrawing(false);
      setTempCanvasData(null);
    }
  };

  const undo = () => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentState = canvas.toDataURL();
    setRedoStack(prev => [...prev, currentState]);

    const previousState = history[history.length - 1];
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = previousState;
    setHistory(prev => prev.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentState = canvas.toDataURL();
    setHistory(prev => [...prev, currentState]);

    const nextState = redoStack[redoStack.length - 1];
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = nextState;
    setRedoStack(prev => prev.slice(0, -1));
  };

  const clearCanvas = () => {
    if (!confirm('Möchten Sie die gesamte Skizze löschen?')) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    saveToHistory();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTextElements([]);
    setSelectedTextId(null);
  };

  const getCanvasWithText = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    // Create a temporary canvas to merge drawing and text
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return null;
    
    // Draw original canvas
    tempCtx.drawImage(canvas, 0, 0);
    
    // Draw text elements
    textElements.forEach(t => {
      tempCtx.font = `${t.fontSize}px Inter, sans-serif`;
      tempCtx.fillStyle = t.color;
      tempCtx.fillText(t.text, t.x, t.y);
    });
    
    return tempCanvas;
  };

  const downloadSketch = () => {
    const canvas = getCanvasWithText();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `skizze_${new Date().getTime()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div id="sketchpad-container" className="flex flex-col h-full bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
      {/* Header with Title */}
      <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-primary/10 rounded-xl text-brand-primary">
            <Layers size={20} />
          </div>
          <input 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)}
            className="text-lg font-black text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/10 px-2 py-1 rounded-lg transition-all"
            placeholder="Skizzen-Titel..."
          />
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Live Kalkulation Aktiv
        </div>
      </div>

      {/* Toolbar */}
      <div id="sketchpad-toolbar" className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100">
            <ToolButton active={tool === 'select'} onClick={() => setTool('select')} icon={<MousePointer2 size={18} />} title="Auswählen" />
            <div className="w-px h-6 bg-slate-100 mx-1" />
            <ToolButton active={tool === 'pencil'} onClick={() => setTool('pencil')} icon={<Pencil size={18} />} title="Stift" />
            <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={<Eraser size={18} />} title="Radiergummi" />
            <ToolButton active={tool === 'text'} onClick={() => setTool('text')} icon={<Type size={18} />} title="Text" />
            <div className="w-px h-6 bg-slate-100 mx-1" />
            <ToolButton active={tool === 'line'} onClick={() => setTool('line')} icon={<Minus size={18} />} title="Linie" />
            <ToolButton active={tool === 'rect'} onClick={() => setTool('rect')} icon={<Square size={18} />} title="Rechteck" />
            <ToolButton active={tool === 'circle'} onClick={() => setTool('circle')} icon={<Circle size={18} />} title="Kreis" />
          </div>

          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-slate-100 items-center">
            {['#141414', '#ef4444', '#3b82f6', '#10b981', '#f59e0b'].map(c => (
              <button 
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center ${color === c ? 'scale-110 shadow-sm' : 'opacity-40 hover:opacity-100'}`}
              >
                <div className="w-5 h-5 rounded-md" style={{ backgroundColor: c }} />
              </button>
            ))}
            <div className="w-px h-6 bg-slate-100 mx-1" />
            <div className="relative group">
              <input 
                type="color" 
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded-xl cursor-pointer opacity-0 absolute inset-0 z-10"
              />
              <button className={`w-8 h-8 rounded-xl transition-all flex items-center justify-center bg-slate-50 border border-slate-100 text-slate-400 group-hover:text-brand-primary`}>
                <Palette size={16} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-2xl border border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Größe</span>
            <input 
              type="range" 
              min="1" 
              max="20" 
              value={lineWidth} 
              onChange={(e) => setLineWidth(parseInt(e.target.value))}
              className="w-24 accent-brand-primary"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input 
            type="file" 
            id="sketch-upload" 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileUpload}
          />
          <ActionButton onClick={() => document.getElementById('sketch-upload')?.click()} icon={<Download size={18} className="rotate-180" />} title="Skizze hochladen" />
          <button 
            onClick={analyzeSketch}
            disabled={isAnalyzing}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${isAnalyzing ? 'bg-slate-100 text-slate-400' : 'bg-brand-secondary text-white hover:bg-brand-dark shadow-lg shadow-brand-secondary/20'}`}
          >
            {isAnalyzing ? 'Analysiere...' : 'KI-Analyse'}
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <ActionButton onClick={undo} disabled={history.length === 0} icon={<Undo2 size={18} />} title="Rückgängig" />
          <ActionButton onClick={redo} disabled={redoStack.length === 0} icon={<Redo2 size={18} />} title="Wiederholen" />
          <div className="w-px h-6 bg-slate-200 mx-1" />
          <ActionButton onClick={clearCanvas} icon={<Trash2 size={18} />} title="Löschen" className="text-red-500 hover:bg-red-50" />
          <ActionButton onClick={downloadSketch} icon={<Download size={18} />} title="Download" />
          {onSave && (
            <button 
              onClick={() => {
                const canvas = getCanvasWithText();
                onSave(canvas?.toDataURL() || '', dimensions);
              }}
              className="flex items-center gap-2 px-6 py-2 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20"
            >
              <Save size={18} /> Speichern
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X size={24} className="text-slate-400" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas Area */}
        <div id="sketchpad-canvas-area" className={`flex-1 bg-slate-100 relative overflow-hidden ${tool === 'text' ? 'cursor-text' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}>
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-full bg-white"
          />

          {/* Text Elements Layer */}
          <div className="absolute inset-0 pointer-events-none">
            {textElements.map(t => (
              <div 
                key={t.id}
                className={`absolute pointer-events-auto cursor-move select-none group ${selectedTextId === t.id ? 'ring-2 ring-brand-primary ring-offset-2 rounded-sm' : ''}`}
                style={{ left: t.x, top: t.y - t.fontSize }}
                onMouseDown={(e) => {
                  if (tool === 'select') {
                    e.stopPropagation();
                    setSelectedTextId(t.id);
                    setIsDraggingText(true);
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (rect) {
                      setStartPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                    }
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setSelectedTextId(t.id);
                  setTextInput(t.text);
                  setStartPos({ x: t.x, y: t.y });
                  setShowTextInput(true);
                  // Remove the old one when editing
                  setTextElements(prev => prev.filter(el => el.id !== t.id));
                }}
              >
                <span 
                  style={{ color: t.color, fontSize: t.fontSize, fontFamily: 'Inter, sans-serif', fontWeight: 'bold' }}
                >
                  {t.text}
                </span>
                {selectedTextId === t.id && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setTextElements(prev => prev.filter(el => el.id !== t.id));
                      setSelectedTextId(null);
                    }}
                    className="absolute -top-8 -right-8 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {/* Text Input Overlay */}
          <AnimatePresence>
            {showTextInput && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute z-10 bg-white p-4 rounded-2xl shadow-2xl border border-slate-100"
                style={{ left: startPos.x, top: startPos.y }}
              >
                <form onSubmit={handleTextSubmit} className="flex gap-2">
                  <input 
                    autoFocus
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Text eingeben..."
                    className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20"
                  />
                  <button type="submit" className="p-2 bg-brand-primary text-white rounded-xl hover:bg-brand-dark transition-all">
                    <Check size={20} />
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute bottom-6 right-6 flex flex-col items-end gap-2 pointer-events-none">
            <div className="bg-white/80 backdrop-blur-md px-4 py-2 rounded-2xl text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-200 shadow-sm">
              Digitale Skizzenfläche
            </div>
          </div>
        </div>

        {/* Calculation Sidebar */}
        <div className="w-80 bg-white border-l border-slate-100 p-6 flex flex-col gap-6 overflow-y-auto">
          <div className="flex items-center gap-2 text-brand-dark">
            <Layers size={20} />
            <h4 className="text-sm font-black uppercase tracking-widest">Kalkulation</h4>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Bereich / Raum</label>
              <input 
                type="text" 
                value={dimensions.areaName}
                onChange={(e) => setDimensions(prev => ({ ...prev, areaName: e.target.value }))}
                placeholder="z.B. Wohnzimmer"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20"
              />
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setDimensions(prev => ({ ...prev, isExterior: false }))}
                className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${!dimensions.isExterior ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-slate-50 text-slate-400'}`}
              >
                <Home size={14} /> Innen
              </button>
              <button 
                onClick={() => setDimensions(prev => ({ ...prev, isExterior: true }))}
                className={`flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${dimensions.isExterior ? 'bg-brand-secondary text-white shadow-lg shadow-brand-secondary/20' : 'bg-slate-50 text-slate-400'}`}
              >
                <Globe size={14} /> Außen
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Einheit</label>
              <select 
                value={dimensions.unit}
                onChange={(e) => setDimensions(prev => ({ ...prev, unit: e.target.value }))}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="m²">Quadratmeter (m²)</option>
                <option value="lfm">Laufende Meter (lfm)</option>
                <option value="m³">Kubikmeter (m³)</option>
                <option value="m">Meter (m)</option>
                <option value="Stk">Stück (Stk)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Länge (m)</label>
                <input 
                  type="number" 
                  value={dimensions.length}
                  onChange={(e) => setDimensions(prev => ({ ...prev, length: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Breite (m)</label>
                <input 
                  type="number" 
                  value={dimensions.width}
                  onChange={(e) => setDimensions(prev => ({ ...prev, width: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Höhe (m)</label>
                <input 
                  type="number" 
                  value={dimensions.height}
                  onChange={(e) => setDimensions(prev => ({ ...prev, height: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tiefe (m)</label>
                <input 
                  type="number" 
                  value={dimensions.depth}
                  onChange={(e) => setDimensions(prev => ({ ...prev, depth: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Verschnitt (%)</label>
                <input 
                  type="number" 
                  value={dimensions.wastage}
                  onChange={(e) => setDimensions(prev => ({ ...prev, wastage: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Erschwernis</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={dimensions.difficulty}
                  onChange={(e) => setDimensions(prev => ({ ...prev, difficulty: parseFloat(e.target.value) || 1 }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            </div>

            {dimensions.unit === 'Stk' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Anzahl (Stk)</label>
                <input 
                  type="number" 
                  value={dimensions.quantity}
                  onChange={(e) => setDimensions(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 1 }))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl font-bold text-brand-dark outline-none focus:ring-2 focus:ring-brand-primary/20"
                />
              </div>
            )}
          </div>

          <div className="mt-auto pt-6 border-t border-slate-100">
            <div className="bg-brand-accent/30 p-6 rounded-3xl">
              <label className="block text-[10px] font-bold text-brand-primary uppercase tracking-widest mb-1">Gesamtmenge</label>
              <div className="text-3xl font-black text-brand-dark">
                {dimensions.quantity.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {dimensions.unit}
              </div>
              <p className="text-[10px] text-slate-400 font-medium mt-1 italic">Inkl. Verschnitt & Erschwernis</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolButton({ active, onClick, icon, title }: { active: boolean, onClick: () => void, icon: React.ReactNode, title: string }) {
  return (
    <button 
      onClick={onClick}
      className={`p-2.5 rounded-xl transition-all ${active ? 'bg-brand-primary text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-brand-primary'}`}
      title={title}
    >
      {icon}
    </button>
  );
}

function ActionButton({ onClick, disabled, icon, title, className = "" }: { onClick: () => void, disabled?: boolean, icon: React.ReactNode, title: string, className?: string }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`p-2.5 rounded-xl transition-all ${disabled ? 'opacity-20 cursor-not-allowed' : `bg-white text-slate-400 hover:bg-slate-50 hover:text-brand-primary border border-slate-100 shadow-sm ${className}`}`}
      title={title}
    >
      {icon}
    </button>
  );
}
