import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  HardHat, 
  ArrowRight, 
  ChevronRight, 
  Minus, 
  Plus, 
  Download,
  X,
  Clock,
  Search,
  Pencil,
  FileText,
  Euro
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import SketchPad from './SketchPad';

interface CalcPosition {
  id: number;
  name: string;
  unit: string;
  labor_hours: number;
  material_price: number;
  quantity: number;
  worker_type?: 'Meister' | 'Geselle' | 'Helfer';
  tradeId?: number;
  tradeName?: string;
  description?: string;
  length?: number;
  width?: number;
  height?: number;
  depth?: number;
  showCalculator?: boolean;
}

interface Trade {
  id: number;
  name: string;
  description: string;
}

interface LaborRate {
  id: number;
  worker_type: 'Meister' | 'Geselle' | 'Helfer';
  hourly_rate: number;
}

export default function LiveCalculator() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [catalog, setCatalog] = useState<(Trade & { items: CalcPosition[] })[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<number | null>(null);
  const [laborRates, setLaborRates] = useState<Record<number, LaborRate[]>>({});
  const [availablePositions, setAvailablePositions] = useState<CalcPosition[]>([]);
  const [selectedPositions, setSelectedPositions] = useState<(CalcPosition & { isManual?: boolean })[]>([]);
  const [selectedWorkerType, setSelectedWorkerType] = useState<'Meister' | 'Geselle' | 'Helfer'>('Geselle');
  const [wastePercentage, setWastePercentage] = useState<number>(5);
  const [discount, setDiscount] = useState<number>(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalTab, setModalTab] = useState<'list' | 'manual'>('list');
  const [modalTradeFilter, setModalTradeFilter] = useState<number | 'all'>('all');
  const [tradeSearch, setTradeSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [manualInput, setManualInput] = useState({
    name: '',
    unit: 'm²',
    labor_hours: 0,
    material_price: 0
  });
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    address: '',
    projectName: ''
  });
  const [showSketchModal, setShowSketchModal] = useState<{ show: boolean, itemId: number | null, initialData?: any }>({
    show: false,
    itemId: null
  });

  useEffect(() => {
    Promise.all([
      fetch('/api/trades').then(res => res.json()),
      fetch('/api/catalog').then(res => res.json()),
      fetch('/api/labor-rates/all').then(res => res.json())
    ]).then(([tradesData, catalogData, allRates]) => {
      setTrades(tradesData);
      setCatalog(catalogData);
      
      // Group labor rates by tradeId
      const ratesMap: Record<number, LaborRate[]> = {};
      allRates.forEach((rate: any) => {
        if (!ratesMap[rate.trade_id]) ratesMap[rate.trade_id] = [];
        ratesMap[rate.trade_id].push(rate);
      });
      setLaborRates(ratesMap);

      // Add 'Spezialreinigung' as a default selected position if not present
      const sanitarTrade = tradesData.find((t: any) => t.name === 'Sanitär & Heizung');
      if (sanitarTrade) {
        setSelectedPositions(prev => {
          if (prev.some(p => p.name === 'Spezialreinigung')) return prev;
          return [
            ...prev,
            {
              id: 999999,
              name: 'Spezialreinigung',
              unit: 'm²',
              labor_hours: 0.3,
              material_price: 2.50,
              quantity: 1,
              worker_type: 'Geselle',
              tradeId: sanitarTrade.id,
              tradeName: sanitarTrade.name,
              isManual: true,
              description: 'Spezialreinigung von Sanitäranlagen oder Heizungskomponenten'
            }
          ];
        });
      }
    });
  }, []);

  useEffect(() => {
    if (selectedTrade) {
      const tradeData = catalog.find(t => t.id === selectedTrade);
      if (tradeData) {
        setAvailablePositions(tradeData.items);
        setModalTradeFilter(selectedTrade);
        setShowAddModal(true);
      }
    }
  }, [selectedTrade, catalog]);

  // Update available positions based on modal filter
  useEffect(() => {
    if (showAddModal) {
      if (modalTradeFilter === 'all') {
        const allItems = catalog.flatMap(t => t.items.map(i => ({ ...i, tradeName: t.name, tradeId: t.id })));
        setAvailablePositions(allItems);
      } else {
        const tradeData = catalog.find(t => t.id === modalTradeFilter);
        if (tradeData) {
          setAvailablePositions(tradeData.items.map(i => ({ ...i, tradeName: tradeData.name, tradeId: tradeData.id })));
        }
      }
    }
  }, [modalTradeFilter, showAddModal, catalog]);

  const getRate = (tradeId?: number, type?: 'Meister' | 'Geselle' | 'Helfer') => {
    const workerType = type || selectedWorkerType;
    const tId = tradeId || selectedTrade;
    if (!tId || !laborRates[tId]) return 0;
    return laborRates[tId].find(r => r.worker_type === workerType)?.hourly_rate || 0;
  };

  const subtotal = selectedPositions.reduce((acc, pos) => {
    const rate = getRate(pos.tradeId, pos.worker_type);
    const laborCost = pos.labor_hours * rate * pos.quantity;
    const materialCost = pos.material_price * pos.quantity * (1 + wastePercentage / 100);
    return acc + laborCost + materialCost;
  }, 0);

  const discountAmount = subtotal * (discount / 100);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const tax = subtotalAfterDiscount * 0.19;
  const total = subtotalAfterDiscount + tax;

  // --- Team & Duration Logic ---
  const totalLaborHours = selectedPositions.reduce((acc, pos) => acc + (pos.labor_hours * pos.quantity), 0);
  
  const getTeamComposition = (hours: number) => {
    if (hours === 0) return null;
    if (hours < 20) return { meister: 0, geselle: 1, helfer: 0, azubi: 0, total: 1 };
    if (hours < 60) return { meister: 0, geselle: 1, helfer: 1, azubi: 0, total: 2 };
    if (hours < 150) return { meister: 0.2, geselle: 2, helfer: 1, azubi: 0, total: 3.2 };
    if (hours < 400) return { meister: 0.5, geselle: 3, helfer: 2, azubi: 1, total: 6.5 };
    return { meister: 1, geselle: 4, helfer: 3, azubi: 2, total: 10 };
  };

  const team = getTeamComposition(totalLaborHours);
  
  const getDuration = (hours: number, teamSize: number) => {
    if (hours === 0 || teamSize === 0) return null;
    const workingHoursPerDay = 8;
    const days = hours / (teamSize * workingHoursPerDay);
    
    if (days < 1) return `${Math.ceil(hours)} Stunden`;
    if (days <= 5) return `${Math.ceil(days)} Arbeitstage`;
    if (days <= 20) return `${(days / 5).toFixed(1)} Arbeitswochen`;
    return `${(days / 20).toFixed(1)} Monate`;
  };

  const duration = team ? getDuration(totalLaborHours, team.total) : null;

  const updateQty = (id: number, delta: number) => {
    setSelectedPositions(prev => prev.map(p => p.id === id ? { ...p, quantity: Math.max(0, p.quantity + delta) } : p));
  };

  const setQty = (id: number, value: string) => {
    const num = parseFloat(value) || 0;
    setSelectedPositions(prev => prev.map(p => p.id === id ? { ...p, quantity: Math.max(0, num) } : p));
  };

  const addPosition = (pos: CalcPosition) => {
    if (pos.labor_hours <= 0) return;
    if (selectedPositions.find(p => p.id === pos.id)) return;
    const trade = trades.find(t => t.id === selectedTrade);
    setSelectedPositions(prev => [...prev, { 
      ...pos, 
      quantity: 1, 
      worker_type: selectedWorkerType,
      tradeId: selectedTrade || undefined,
      tradeName: trade?.name || 'Manuell'
    }]);
    // Removed setShowAddModal(false) to allow multiple selection
  };

  const addManualPosition = () => {
    if (!manualInput.name || manualInput.labor_hours <= 0) return;
    const newId = Date.now();
    const trade = trades.find(t => t.id === selectedTrade);
    setSelectedPositions(prev => [...prev, {
      id: newId,
      name: manualInput.name,
      unit: manualInput.unit,
      labor_hours: manualInput.labor_hours,
      material_price: manualInput.material_price,
      quantity: 1,
      isManual: true,
      worker_type: selectedWorkerType,
      tradeId: selectedTrade || undefined,
      tradeName: trade?.name || 'Manuell'
    }]);
    setManualInput({ name: '', unit: 'm²', labor_hours: 0, material_price: 0 });
    // Removed setShowAddModal(false) to allow multiple selection
  };

  const removePosition = (id: number) => {
    setSelectedPositions(prev => prev.filter(p => p.id !== id));
  };

  const updateManualPos = (id: number, field: keyof CalcPosition, value: any) => {
    setSelectedPositions(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: value };
        
        // Auto-calculate quantity if dimensions or unit change
        if (['length', 'width', 'height', 'depth', 'unit'].includes(field as string)) {
          const l = updated.length || 0;
          const w = updated.width || 0;
          const h = updated.height || 0;
          const d = updated.depth || 0;
          
          if (updated.unit === 'm²') {
            updated.quantity = l * w;
          } else if (updated.unit === 'm³') {
            updated.quantity = l * w * (h || d);
          } else if (updated.unit === 'lfm') {
            updated.quantity = l;
          }
        }
        
        return updated;
      }
      return p;
    }));
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const tradeName = trades.find(t => t.id === selectedTrade)?.name || '';
    
    doc.setFontSize(22);
    doc.text('Los Facility Service', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('Unverbindliches Kostenangebot', 14, 30);
    
    doc.setTextColor(0);
    doc.setFontSize(12);
    doc.text('Kunde:', 14, 45);
    doc.setFontSize(10);
    doc.text(customerInfo.name || 'N/A', 14, 50);
    doc.text(customerInfo.address || 'N/A', 14, 55);
    
    doc.setFontSize(12);
    doc.text('Projekt:', 100, 45);
    doc.setFontSize(10);
    doc.text(customerInfo.projectName || 'N/A', 100, 50);
    doc.text(`Gewerk: ${tradeName}`, 100, 55);
    doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, 100, 60);

    doc.setFontSize(10);
    doc.text(`Verschnitt: ${wastePercentage}%`, 14, 75);
    if (discount > 0) {
      doc.text(`Rabatt: ${discount}%`, 14, 80);
    }

    if (team && duration) {
      doc.setFontSize(12);
      doc.setTextColor(37, 99, 235);
      doc.text('Projekt-Ressourcen & Zeitplan', 14, 85);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Geschätzte Gesamtarbeitszeit: ${totalLaborHours.toFixed(1)} Stunden`, 14, 90);
      doc.text(`Geplantes Team: ${Math.ceil(team.total)} Mitarbeiter (${team.geselle} Ges., ${team.helfer} Helf., ${team.meister > 0 ? 'inkl. Bauleitung' : ''})`, 14, 95);
      doc.text(`Voraussichtliche Ausführungsdauer: ${duration}`, 14, 100);
    }
    
    const tableData: any[] = [];
    const tradesInSelection = Array.from(new Set(selectedPositions.filter(p => p.quantity > 0).map(p => p.tradeName)));
    
    tradesInSelection.forEach(tradeName => {
      // Add trade header row
      tableData.push([
        { content: tradeName?.toUpperCase(), colSpan: 4, styles: { fillColor: [241, 245, 249], fontStyle: 'bold', textColor: [30, 41, 59] } }
      ]);
      
      selectedPositions
        .filter(p => p.tradeName === tradeName && p.quantity > 0)
        .forEach(p => {
          const rate = getRate(p.tradeId, p.worker_type);
          const laborCost = p.labor_hours * rate * p.quantity;
          const materialCost = p.material_price * p.quantity * (1 + wastePercentage / 100);
          const totalPos = laborCost + materialCost;
          tableData.push([
            `${p.name}${p.description ? '\n' + p.description : ''}\n(${p.worker_type || selectedWorkerType})`,
            `${p.quantity} ${p.unit}`,
            `${(totalPos / p.quantity).toFixed(2)} €`,
            `${totalPos.toFixed(2)} €`
          ]);
        });
    });

    autoTable(doc, {
      startY: team ? 110 : 85,
      head: [['Leistung / Position', 'Menge / Einheit', 'Einh. Preis (inkl. Verschnitt)', 'Gesamtbetrag']],
      body: tableData,
      foot: [
        ['', '', 'Zwischensumme (Netto)', `${subtotal.toFixed(2)} €`],
        ...(discount > 0 ? [['', '', `Rabatt (${discount}%)`, `-${discountAmount.toFixed(2)} €`]] : []),
        ['', '', 'MwSt. (19%)', `${tax.toFixed(2)} €`],
        ['', '', 'Gesamtsumme (Brutto)', `${total.toFixed(2)} €`]
      ],
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
      footStyles: { fontStyle: 'bold', fillColor: [248, 250, 252] }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Zahlungsbedingungen: 14 Tage netto nach Rechnungserhalt.', 14, finalY + 20);
    doc.text('Dieses Angebot ist freibleibend und gültig für 30 Tage.', 14, finalY + 25);
    doc.text('Vielen Dank für Ihr Vertrauen!', 14, finalY + 35);

    doc.save(`Angebot_Los_Facility_${tradeName.replace(/\s/g, '_')}.pdf`);
  };

  return (
    <div id="live-calculator-container" className="bg-white rounded-[2rem] md:rounded-[3rem] shadow-2xl shadow-brand-dark/10 overflow-hidden border border-slate-100">
      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Left: Selection & Configuration */}
        <div className="lg:col-span-2 p-6 md:p-12 lg:p-16 bg-slate-50">
          <div className="mb-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
              <div>
                <h3 className="text-3xl md:text-4xl font-black text-brand-dark tracking-tighter mb-4">
                  {!selectedTrade ? 'Gewerk wählen' : trades.find(t => t.id === selectedTrade)?.name}
                </h3>
                <p className="text-slate-400 font-medium">
                  {!selectedTrade 
                    ? 'Wählen Sie Ihr Gewerk oder suchen Sie direkt nach einer Leistung.' 
                    : 'Stellen Sie Ihr individuelles Leistungsverzeichnis zusammen.'}
                </p>
              </div>
              
              {!selectedTrade && (
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                  <button 
                    onClick={() => {
                      setModalTradeFilter('all');
                      setShowAddModal(true);
                    }}
                    className="flex items-center gap-2 bg-white text-brand-primary border border-brand-primary/20 px-6 py-3 rounded-2xl font-bold text-sm hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                  >
                    <FileText size={18} /> Globaler Katalog
                  </button>
                  <div className="relative w-full md:w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      id="live-calc-trade-search-input"
                      type="text"
                      placeholder="Leistung suchen..."
                      value={tradeSearch}
                      onChange={(e) => setTradeSearch(e.target.value)}
                      className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all text-sm shadow-sm"
                    />
                    {tradeSearch && (
                      <button 
                        onClick={() => setTradeSearch('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-dark transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            {/* Trade Selection or Search Results */}
            {!selectedTrade ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tradeSearch ? (
                  // Search Results across all trades
                  catalog.flatMap(trade => 
                    trade.items
                      .filter(item => item.name.toLowerCase().includes(tradeSearch.toLowerCase()))
                      .map(item => ({ ...item, tradeName: trade.name, tradeId: trade.id }))
                  ).map(item => (
                    <button 
                      key={`${item.tradeId}-${item.id}`}
                      onClick={() => {
                        setSelectedTrade(item.tradeId!);
                        addPosition(item);
                        setTradeSearch('');
                      }}
                      className="p-6 rounded-2xl border-2 border-slate-100 bg-white hover:border-brand-primary hover:shadow-xl hover:shadow-brand-primary/10 transition-all text-left group flex items-center justify-between"
                    >
                      <div>
                        <span className="text-[10px] font-bold text-brand-primary uppercase tracking-widest block mb-1">{item.tradeName}</span>
                        <h4 className="font-bold text-brand-dark">{item.name}</h4>
                        <p className="text-[10px] text-slate-400 mt-1">{item.unit} • {item.labor_hours}h</p>
                      </div>
                      <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all">
                        <Plus size={16} />
                      </div>
                    </button>
                  ))
                ) : (
                  // Normal Trade Grid
                  trades.map(trade => (
                    <button 
                      key={trade.id}
                      onClick={() => setSelectedTrade(trade.id)}
                      className="p-6 md:p-8 rounded-[2rem] border-2 border-slate-100 bg-white hover:border-brand-primary hover:shadow-xl hover:shadow-brand-primary/10 transition-all text-left group"
                    >
                      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-6 text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all">
                        <HardHat size={24} />
                      </div>
                      <h4 className="text-xl font-black text-brand-dark mb-2">{trade.name}</h4>
                      <p className="text-xs text-slate-400 font-medium line-clamp-2">{trade.description}</p>
                      <div className="mt-6 flex items-center gap-2 text-brand-primary font-bold text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">
                        Kalkulieren <ArrowRight size={14} />
                      </div>
                    </button>
                  ))
                )}
                {tradeSearch && catalog.flatMap(t => t.items).filter(i => i.name.toLowerCase().includes(tradeSearch.toLowerCase())).length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400 italic">
                    Keine Leistungen für "{tradeSearch}" gefunden.
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        setSelectedTrade(null);
                      }}
                      className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                    >
                      <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                      Zurück zur Auswahl
                    </button>
                    <button 
                      onClick={() => setSelectedTrade(null)}
                      className="flex items-center justify-center w-9 h-9 bg-white text-slate-400 hover:text-red-500 border border-slate-100 hover:border-red-100 rounded-xl transition-all shadow-sm"
                      title="Schließen"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Standard-Qualifikation:</span>
                    <span className="text-sm font-black text-brand-primary">{selectedWorkerType} ({getRate().toFixed(2)} €/h)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Customer Info */}
                  <div className="md:col-span-2 space-y-4">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kunden- & Projektinformationen</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input 
                        type="text"
                        placeholder="Kundenname"
                        value={customerInfo.name}
                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                        className="bg-white border border-slate-100 rounded-xl py-2.5 px-4 font-medium text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all shadow-sm text-sm"
                      />
                      <input 
                        type="text"
                        placeholder="Adresse"
                        value={customerInfo.address}
                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, address: e.target.value }))}
                        className="bg-white border border-slate-100 rounded-xl py-2.5 px-4 font-medium text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all shadow-sm text-sm"
                      />
                      <input 
                        type="text"
                        placeholder="Projektname"
                        value={customerInfo.projectName}
                        onChange={(e) => setCustomerInfo(prev => ({ ...prev, projectName: e.target.value }))}
                        className="bg-white border border-slate-100 rounded-xl py-2.5 px-4 font-medium text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all shadow-sm text-sm"
                      />
                    </div>
                  </div>

                  {/* Worker Type Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Personal-Qualifikation</label>
                    <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-100 shadow-sm">
                      {(['Meister', 'Geselle', 'Helfer'] as const).map(type => (
                        <button 
                          key={type}
                          onClick={() => setSelectedWorkerType(type)}
                          className={`flex-1 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all ${selectedWorkerType === type ? 'bg-brand-dark text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Waste Percentage */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Verschnitt (%)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        value={wastePercentage}
                        onChange={(e) => setWastePercentage(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-100 rounded-xl py-2.5 px-4 font-black text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all shadow-sm"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                    </div>
                  </div>

                  {/* Discount */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Rabatt (%)</label>
                    <div className="relative">
                      <input 
                        type="number"
                        value={discount}
                        onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                        className="w-full bg-white border border-slate-100 rounded-xl py-2.5 px-4 font-black text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all shadow-sm"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                    </div>
                  </div>
                </div>

                {/* Selected Positions Grouped by Trade */}
                <div className="space-y-8">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kalkulations-Positionen</label>
                    <div className="flex gap-2">
                      {selectedPositions.length > 0 && (
                        <button 
                          onClick={() => {
                            if (confirm('Möchten Sie wirklich alle Positionen löschen?')) {
                              setSelectedPositions([]);
                            }
                          }}
                          className="flex items-center gap-2 bg-white text-red-500 border border-red-100 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all shadow-sm mr-2"
                        >
                          Leeren
                        </button>
                      )}
                      <button 
                        id="live-calc-add-position-btn"
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20"
                      >
                        <Plus size={14} /> Leistung wählen
                      </button>
                      <button 
                        id="live-calc-add-manual-btn"
                        onClick={addManualPosition}
                        className="flex items-center gap-2 bg-white text-brand-dark border border-slate-200 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:border-brand-primary transition-all shadow-sm"
                      >
                        <Plus size={14} /> Manuell
                      </button>
                    </div>
                  </div>

                  {selectedPositions.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
                      <Calculator size={48} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-400 font-medium">Noch keine Leistungen hinzugefügt.</p>
                      <button onClick={() => setShowAddModal(true)} className="mt-4 text-brand-primary font-bold text-xs uppercase tracking-widest hover:underline">
                        Jetzt Leistungen auswählen
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-10">
                      {Array.from(new Set(selectedPositions.map(p => p.tradeName))).map(tradeName => (
                        <div key={tradeName} className="space-y-4">
                          <div className="flex items-center gap-4">
                            <h6 className="text-xs font-black text-brand-primary uppercase tracking-[0.2em]">{tradeName}</h6>
                            <div className="flex-1 h-px bg-brand-primary/10" />
                          </div>
                          
                          <div className="space-y-3">
                            {selectedPositions.filter(p => p.tradeName === tradeName).map((pos) => (
                              <div key={pos.id} className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100 group hover:border-brand-primary/30 transition-all">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex flex-col gap-1">
                                      <input 
                                        type="text"
                                        value={pos.name}
                                        onChange={(e) => updateManualPos(pos.id, 'name', e.target.value)}
                                        className="w-full font-bold text-brand-dark bg-transparent border-none rounded-lg px-1 py-0.5 outline-none focus:ring-1 focus:ring-brand-primary"
                                      />
                                      <textarea 
                                        value={pos.description || ''}
                                        onChange={(e) => updateManualPos(pos.id, 'description', e.target.value)}
                                        placeholder="Zusätzliche Beschreibung..."
                                        className="w-full text-xs text-slate-500 bg-transparent border-none rounded-lg px-1 py-0.5 outline-none focus:ring-1 focus:ring-brand-primary resize-none"
                                        rows={1}
                                      />
                                    </div>
                                    
                                    <div className="flex flex-wrap items-center gap-4">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Personal:</span>
                                        <select 
                                          value={pos.worker_type || selectedWorkerType}
                                          onChange={(e) => updateManualPos(pos.id, 'worker_type', e.target.value)}
                                          className="text-[10px] font-bold text-brand-primary bg-slate-50 border-none rounded-lg px-2 py-1 outline-none"
                                        >
                                          <option value="Meister">Meister</option>
                                          <option value="Geselle">Geselle</option>
                                          <option value="Helfer">Helfer</option>
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Einheit:</span>
                                        <select 
                                          value={pos.unit}
                                          onChange={(e) => updateManualPos(pos.id, 'unit', e.target.value)}
                                          className="text-[10px] font-bold text-brand-primary bg-slate-50 border-none rounded-lg px-2 py-1 outline-none"
                                        >
                                          <option value="m²">m²</option>
                                          <option value="lfm">lfm</option>
                                          <option value="m³">m³</option>
                                          <option value="Stk">Stk</option>
                                          <option value="Std">Std</option>
                                          <option value="Psch">Psch</option>
                                        </select>
                                      </div>

                                      <button 
                                        onClick={() => updateManualPos(pos.id, 'showCalculator', !pos.showCalculator)}
                                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${pos.showCalculator ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                      >
                                        <Calculator size={12} /> Rechner
                                      </button>

                                      <button 
                                        onClick={() => setShowSketchModal({ 
                                          show: true, 
                                          itemId: pos.id, 
                                          initialData: (pos as any).sketch_data
                                        })}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                                      >
                                        <Pencil size={12} /> Skizze
                                      </button>
                                      
                                      {pos.isManual && (
                                        <>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Zeit (h):</span>
                                            <input 
                                              type="number"
                                              value={pos.labor_hours}
                                              onChange={(e) => updateManualPos(pos.id, 'labor_hours', parseFloat(e.target.value) || 0)}
                                              className="w-16 text-[10px] font-bold text-brand-primary bg-slate-50 border-none rounded-lg px-2 py-1 outline-none"
                                            />
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Material (€):</span>
                                            <input 
                                              type="number"
                                              value={pos.material_price}
                                              onChange={(e) => updateManualPos(pos.id, 'material_price', parseFloat(e.target.value) || 0)}
                                              className="w-16 text-[10px] font-bold text-brand-primary bg-slate-50 border-none rounded-lg px-2 py-1 outline-none"
                                            />
                                          </div>
                                        </>
                                      )}
                                      
                                      <span className="text-[10px] font-bold text-slate-400">
                                        Preis: {((pos.labor_hours * getRate(pos.tradeId, pos.worker_type)) + (pos.material_price * (1 + wastePercentage/100))).toFixed(2)}€ / {pos.unit}
                                      </span>
                                    </div>

                                    {/* Dimension Calculator Tool */}
                                    <AnimatePresence>
                                      {pos.showCalculator && (
                                        <motion.div 
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4"
                                        >
                                          {(pos.unit === 'm²' || pos.unit === 'm³' || pos.unit === 'lfm') && (
                                            <div>
                                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Länge (m)</label>
                                              <input 
                                                type="number"
                                                value={pos.length || 0}
                                                onChange={(e) => updateManualPos(pos.id, 'length', parseFloat(e.target.value) || 0)}
                                                className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold text-brand-dark focus:ring-1 focus:ring-brand-primary outline-none"
                                              />
                                            </div>
                                          )}
                                          {(pos.unit === 'm²' || pos.unit === 'm³') && (
                                            <div>
                                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Breite (m)</label>
                                              <input 
                                                type="number"
                                                value={pos.width || 0}
                                                onChange={(e) => updateManualPos(pos.id, 'width', parseFloat(e.target.value) || 0)}
                                                className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold text-brand-dark focus:ring-1 focus:ring-brand-primary outline-none"
                                              />
                                            </div>
                                          )}
                                          {pos.unit === 'm³' && (
                                            <div>
                                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Höhe/Tiefe (m)</label>
                                              <input 
                                                type="number"
                                                value={pos.height || pos.depth || 0}
                                                onChange={(e) => updateManualPos(pos.id, 'height', parseFloat(e.target.value) || 0)}
                                                className="w-full bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold text-brand-dark focus:ring-1 focus:ring-brand-primary outline-none"
                                              />
                                            </div>
                                          )}
                                          <div className="flex items-end">
                                            <div className="bg-brand-primary/10 text-brand-primary px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                                              Ergebnis: {pos.quantity.toFixed(2)} {pos.unit}
                                            </div>
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </div>

                                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 pt-4 md:pt-0">
                                    <div className="flex items-center gap-3">
                                      <button onClick={() => updateQty(pos.id, -1)} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-brand-primary hover:text-white transition-all">
                                        <Minus size={14} />
                                      </button>
                                      <input 
                                        type="number"
                                        value={pos.quantity}
                                        onChange={(e) => setQty(pos.id, e.target.value)}
                                        className="w-12 text-center font-black text-lg text-brand-dark bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                      <button onClick={() => updateQty(pos.id, 1)} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-brand-primary hover:text-white transition-all">
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                    <button 
                                      onClick={() => removePosition(pos.id)}
                                      className="text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                      <X size={18} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {/* Trade Subtotal */}
                            <div className="flex justify-end pt-2 pr-6">
                              <div className="text-right">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Zwischensumme {tradeName}</span>
                                <span className="text-lg font-black text-brand-dark">
                                  {selectedPositions
                                    .filter(p => p.tradeName === tradeName)
                                    .reduce((acc, p) => {
                                      const rate = getRate(p.tradeId, p.worker_type);
                                      const laborCost = p.labor_hours * rate * p.quantity;
                                      const materialCost = p.material_price * p.quantity * (1 + wastePercentage / 100);
                                      return acc + laborCost + materialCost;
                                    }, 0).toFixed(2)} €
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Summary */}
        <div className="p-8 md:p-12 lg:p-16 bg-brand-dark text-white flex flex-col">
          <div className="mb-12">
            <h4 className="text-2xl font-black tracking-tighter mb-2">Kostenübersicht</h4>
            <p className="text-white/40 font-medium text-sm">Zusammenfassung Ihrer Kalkulation.</p>
          </div>

          <div className="flex-1 space-y-6">
            {/* Team & Duration Insights */}
            {team && duration && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-white/5 rounded-3xl p-6 border border-white/10 mb-8"
              >
                <h5 className="text-brand-secondary font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Clock size={14} /> Projekt-Insights
                </h5>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white/40 text-xs">Team-Größe</span>
                    <span className="font-bold text-sm">{Math.ceil(team.total)} Mitarbeiter</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/40 text-xs">Zusammensetzung</span>
                    <span className="text-[10px] font-medium text-white/60">
                      {team.meister > 0 && `${team.meister} Meister, `}
                      {team.geselle} Ges., {team.helfer} Helf.
                      {team.azubi > 0 && `, ${team.azubi} Azubi`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/40 text-xs">Vorauss. Dauer</span>
                    <span className="font-bold text-brand-secondary text-sm">{duration}</span>
                  </div>
                  <div className="pt-3 border-t border-white/5">
                    <div className="flex justify-between items-center">
                      <span className="text-white/40 text-xs">Gesamt-Arbeitszeit</span>
                      <span className="font-medium text-xs">{totalLaborHours.toFixed(1)} Std.</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {Array.from(new Set(selectedPositions.filter(p => p.quantity > 0).map(p => p.tradeName))).map(tradeName => (
                <div key={tradeName} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-brand-secondary uppercase tracking-widest">{tradeName}</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  {selectedPositions.filter(p => p.tradeName === tradeName && p.quantity > 0).map(p => {
                    const rate = getRate(p.tradeId, p.worker_type);
                    const laborCost = p.labor_hours * rate * p.quantity;
                    const materialCost = p.material_price * p.quantity * (1 + wastePercentage / 100);
                    const totalPos = laborCost + materialCost;
                    return (
                      <div key={p.id} className="flex justify-between items-start text-sm gap-4 pl-2">
                        <span className="text-white/60 leading-tight">
                          {p.name} <br/>
                          <span className="text-[10px] text-white/30">{p.quantity} {p.unit} • {p.worker_type || selectedWorkerType}</span>
                        </span>
                        <span className="font-bold whitespace-nowrap">{totalPos.toFixed(2)} €</span>
                      </div>
                    );
                  })}
                </div>
              ))}
              {selectedPositions.filter(p => p.quantity > 0).length === 0 && (
                <p className="text-white/20 text-xs italic">Keine Positionen ausgewählt.</p>
              )}
            </div>

            <div className="h-px bg-white/10 my-8" />

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/40">Zwischensumme</span>
                <span className="font-medium">{subtotal.toFixed(2)} €</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between items-center text-sm text-brand-secondary">
                  <span className="text-brand-secondary/60">Rabatt ({discount}%)</span>
                  <span className="font-medium">-{discountAmount.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between items-center text-sm">
                <span className="text-white/40">MwSt. (19%)</span>
                <span className="font-medium">{tax.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between items-center text-2xl pt-6 border-t border-white/5">
                <span className="font-black tracking-tighter">Gesamt</span>
                <span className="font-black text-brand-secondary">{total.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          <div className="mt-12 space-y-4">
            <button 
              onClick={generatePDF}
              disabled={selectedPositions.length === 0 || subtotal === 0}
              className="w-full bg-brand-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-white hover:text-brand-dark transition-all shadow-2xl shadow-brand-primary/20 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={20} />
              Angebot als PDF
            </button>
            <p className="text-[10px] text-white/30 text-center font-bold uppercase tracking-widest">
              * Unverbindliche Schätzung inkl. MwSt.
            </p>
          </div>
        </div>
      </div>

      {/* Add Service Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-brand-dark/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex gap-6">
                  <button 
                    onClick={() => setModalTab('list')}
                    className={`text-2xl font-black tracking-tighter transition-all ${modalTab === 'list' ? 'text-brand-dark' : 'text-slate-300 hover:text-slate-400'}`}
                  >
                    Leistung wählen
                  </button>
                  <button 
                    onClick={() => setModalTab('manual')}
                    className={`text-2xl font-black tracking-tighter transition-all ${modalTab === 'manual' ? 'text-brand-dark' : 'text-slate-300 hover:text-slate-400'}`}
                  >
                    Manuelle Eingabe
                  </button>
                </div>
                
                {modalTab === 'list' && (
                  <div className="flex flex-col md:flex-row gap-4 flex-1 max-w-xl">
                    <div className="relative min-w-[160px]">
                      <select 
                        value={modalTradeFilter}
                        onChange={(e) => setModalTradeFilter(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                        className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-primary/20 appearance-none cursor-pointer"
                      >
                        <option value="all">Alle Gewerke</option>
                        {trades.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={12} />
                    </div>
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input 
                        type="text"
                        placeholder="Leistung suchen..."
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                      />
                    </div>
                  </div>
                )}

                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-brand-dark transition-colors hidden md:block">
                  <X size={24} />
                </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto">
                {modalTab === 'list' ? (
                  <div className="space-y-3">
                    {availablePositions.filter(p => p.name.toLowerCase().includes(serviceSearch.toLowerCase())).length === 0 ? (
                      <p className="text-center text-slate-400 py-12">Keine Leistungen gefunden.</p>
                    ) : (
                      availablePositions
                        .filter(p => p.name.toLowerCase().includes(serviceSearch.toLowerCase()))
                        .map(pos => {
                        const isSelected = selectedPositions.find(p => p.id === pos.id);
                        return (
                          <button 
                            key={pos.id}
                            disabled={!!isSelected || pos.labor_hours <= 0}
                            onClick={() => addPosition(pos)}
                            className={`w-full p-5 rounded-2xl border text-left transition-all flex items-center justify-between group ${isSelected || pos.labor_hours <= 0 ? 'bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed' : 'bg-white border-slate-100 hover:border-brand-primary hover:shadow-lg hover:shadow-brand-primary/5'}`}
                          >
                            <div className="flex-1 pr-4">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[9px] font-black text-brand-primary/50 uppercase tracking-widest">{pos.tradeName}</span>
                                <h5 className="font-bold text-brand-dark group-hover:text-brand-primary transition-colors">{pos.name}</h5>
                              </div>
                              {pos.description && (
                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 group-hover:line-clamp-none transition-all">{pos.description}</p>
                              )}
                              <p className="text-[10px] font-bold text-brand-primary uppercase tracking-widest mt-2">
                                {pos.unit} • {pos.labor_hours}h Zeitaufwand
                                {pos.labor_hours <= 0 && <span className="text-red-500 ml-2">(Zeitaufwand erforderlich)</span>}
                              </p>
                            </div>
                            {isSelected ? (
                              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Hinzugefügt</span>
                            ) : pos.labor_hours <= 0 ? (
                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-red-300 shrink-0">
                                <X size={18} />
                              </div>
                            ) : (
                              <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-brand-primary group-hover:text-white transition-all shrink-0">
                                <Plus size={18} />
                              </div>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bezeichnung der Leistung</label>
                      <input 
                        type="text"
                        placeholder="z.B. Spezialgrundierung"
                        value={manualInput.name}
                        onChange={(e) => setManualInput(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 font-medium text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                      />
                    </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Einheit</label>
                          <input 
                            type="text"
                            placeholder="z.B. m²"
                            value={manualInput.unit}
                            onChange={(e) => setManualInput(prev => ({ ...prev, unit: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 font-medium text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zeitaufwand (h) pro Einheit</label>
                        <input 
                          type="number"
                          step="0.01"
                          value={manualInput.labor_hours}
                          onChange={(e) => setManualInput(prev => ({ ...prev, labor_hours: parseFloat(e.target.value) || 0 }))}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 font-medium text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materialpreis (€) pro Einheit</label>
                      <input 
                        type="number"
                        step="0.01"
                        value={manualInput.material_price}
                        onChange={(e) => setManualInput(prev => ({ ...prev, material_price: parseFloat(e.target.value) || 0 }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl py-4 px-6 font-medium text-brand-dark focus:ring-2 focus:ring-brand-primary outline-none transition-all"
                      />
                    </div>
                    <button 
                      onClick={addManualPosition}
                      disabled={!manualInput.name || manualInput.labor_hours <= 0}
                      className="w-full bg-brand-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      <Plus size={20} />
                      {manualInput.labor_hours <= 0 ? 'Zeitaufwand erforderlich' : 'Position hinzufügen'}
                    </button>
                  </div>
                )}
              </div>
              <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="px-8 py-3 bg-brand-dark text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-primary transition-all"
                >
                  Fertig
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sketch Modal */}
      <AnimatePresence>
        {showSketchModal.show && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-[100] flex items-center justify-center p-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-6xl h-[90vh] bg-white rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <SketchPad 
                initialData={showSketchModal.initialData}
                initialUnit={selectedPositions.find(p => p.id === showSketchModal.itemId)?.unit || 'm²'}
                onSave={(data, dims) => {
                  if (showSketchModal.itemId !== null) {
                    setSelectedPositions(prev => prev.map(p => {
                      if (p.id === showSketchModal.itemId) {
                        return { 
                          ...p, 
                          sketch_data: data,
                          length: dims.length,
                          width: dims.width,
                          height: dims.height,
                          depth: dims.depth,
                          quantity: dims.quantity,
                          unit: dims.unit
                        };
                      }
                      return p;
                    }));
                  }
                  setShowSketchModal({ show: false, itemId: null });
                }}
                onClose={() => setShowSketchModal({ show: false, itemId: null })}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
