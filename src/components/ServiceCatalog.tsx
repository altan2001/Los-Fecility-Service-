import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp, Info, Clock, Euro, Search, Filter, HardHat, X, ArrowUpDown, ArrowUp, ArrowDown, Plus, ChevronRight, Upload, FileText, Pencil, Trash2, LayoutDashboard } from 'lucide-react';
import { Modal } from './Modal';

interface ServiceItem {
  id: number;
  name: string;
  unit: string;
  labor_hours: number;
  material_price: number;
  description: string;
  group?: string;
}

interface TradeCatalog {
  id: number;
  name: string;
  description: string;
  items: ServiceItem[];
}

interface LaborRate {
  id: number;
  trade_id: number;
  trade_name: string;
  worker_type: 'Meister' | 'Geselle' | 'Helfer';
  hourly_rate: number;
}

interface ServiceCatalogProps {
  onSelect?: (item: ServiceItem) => void;
  adminMode?: boolean;
  catalog?: TradeCatalog[];
  onUpdate?: () => void;
}

export default function ServiceCatalog({ onSelect, adminMode = false, catalog: propCatalog, onUpdate }: ServiceCatalogProps) {
  const [catalog, setCatalog] = useState<TradeCatalog[]>(propCatalog || []);
  const [laborRates, setLaborRates] = useState<LaborRate[]>([]);
  const [loading, setLoading] = useState(!propCatalog);
  const [searchTerm, setSearchTerm] = useState('Malerarbeiten');
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newServiceData, setNewServiceData] = useState({
    trade_id: '',
    name: '',
    unit: 'm²',
    labor_hours: 0,
    material_price: 0,
    description: '',
    group: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem & { trade_id: number } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'labor_hours' | 'material_price' | 'tradeName' | 'unit' | 'group' | null, direction: 'asc' | 'desc' }>({ key: 'group', direction: 'asc' });
  const [isLaborRatesExpanded, setIsLaborRatesExpanded] = useState(false);
  const [groupByLG, setGroupByLG] = useState(true);
  const [groupByTrade, setGroupByTrade] = useState(false);

  useEffect(() => {
    if (propCatalog) {
      setCatalog(propCatalog);
      setLoading(false);
    }
  }, [propCatalog]);

  const fetchData = () => {
    if (propCatalog) return; // Use props instead
    setLoading(true);
    Promise.all([
      fetch('/api/catalog').then(res => res.json()),
      fetch('/api/labor-rates/all').then(res => res.json())
    ])
      .then(([catalogData, ratesData]) => {
        setCatalog(catalogData);
        setLaborRates(ratesData);
        if (catalogData.length > 0 && !newServiceData.trade_id) {
          setNewServiceData(prev => ({ ...prev, trade_id: catalogData[0].id.toString() }));
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching catalog data:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  // Flatten the catalog into a single list of items with trade names
  const allItems = catalog.flatMap(trade => 
    trade.items.map(item => ({
      ...item,
      tradeName: trade.name
    }))
  ).filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(searchLower) || 
                         (item.description && item.description.toLowerCase().includes(searchLower)) ||
                         item.tradeName.toLowerCase().includes(searchLower);
    const matchesTrade = selectedTrade === 'all' || item.tradeName === selectedTrade;
    return matchesSearch && matchesTrade;
  });

  // Sort the items
  if (sortConfig.key) {
    allItems.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      if (sortConfig.key === 'tradeName') {
        aValue = a.tradeName;
        bValue = b.tradeName;
      } else {
        aValue = a[sortConfig.key as keyof ServiceItem];
        bValue = b[sortConfig.key as keyof ServiceItem];
      }

      if (aValue === undefined || bValue === undefined) return 0;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' 
          ? aValue - bValue 
          : bValue - aValue;
      }

      return 0;
    });
  }

  const trades = Array.from(new Set(catalog.map(t => t.name)));

  const handleScrape = async () => {
    if (!scrapeUrl) return;
    setIsScraping(true);
    try {
      const response = await fetch('/api/scrape-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl })
      });
      const data = await response.json();
      if (data.success) {
        setNewServiceData(prev => ({
          ...prev,
          name: data.title || prev.name,
          material_price: data.price || prev.material_price,
          unit: data.unit || prev.unit
        }));
        setShowAddModal(true);
        setScrapeUrl('');
      } else {
        alert(data.message || 'Preis konnte nicht extrahiert werden.');
      }
    } catch (err) {
      console.error('Scraping error:', err);
      alert('Fehler beim Abrufen der Preisdaten.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleSort = (key: 'name' | 'labor_hours' | 'material_price' | 'tradeName' | 'unit' | 'group') => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/service-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newServiceData,
          trade_id: parseInt(newServiceData.trade_id),
          labor_hours: parseFloat(newServiceData.labor_hours.toString()),
          material_price: parseFloat(newServiceData.material_price.toString())
        })
      });
      if (response.ok) {
        if (onUpdate) onUpdate();
        else fetchData();
        setShowAddModal(false);
      }
    } catch (err) {
      console.error('Error adding service:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const items = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.split(',').map(v => v.trim());
        const item: any = {
          trade_id: parseInt(newServiceData.trade_id) || (catalog.length > 0 ? catalog[0].id : 0)
        };
        
        headers.forEach((header, idx) => {
          if (header === 'name' || header === 'leistung') item.name = values[idx];
          if (header === 'unit' || header === 'einheit') item.unit = values[idx];
          if (header === 'labor_hours' || header === 'zeit' || header === 'stunden') item.labor_hours = parseFloat(values[idx]) || 0;
          if (header === 'material_price' || header === 'preis' || header === 'material') item.material_price = parseFloat(values[idx]) || 0;
          if (header === 'description' || header === 'beschreibung') item.description = values[idx];
          if (header === 'group' || header === 'leistungsgruppe') item.group = values[idx];
        });
        
        return item;
      }).filter(item => item.name && item.unit);

      if (items.length > 0) {
        try {
          const res = await fetch('/api/service-items/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          if (res.ok) {
            alert(`${items.length} Leistungen erfolgreich importiert!`);
            if (onUpdate) onUpdate();
            else fetchData();
          }
        } catch (err) {
          console.error('Bulk import error:', err);
          alert('Fehler beim Importieren der Leistungen.');
        }
      }
      setIsImporting(false);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleEditService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/service-items/${editingService.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingService,
          trade_id: editingService.trade_id,
          labor_hours: parseFloat(editingService.labor_hours.toString()),
          material_price: parseFloat(editingService.material_price.toString())
        })
      });
      if (response.ok) {
        setShowEditModal(false);
        setEditingService(null);
        if (onUpdate) onUpdate();
        else fetchData();
      }
    } catch (err) {
      console.error('Error updating service:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm('Möchten Sie diese Leistung wirklich löschen?')) return;
    try {
      const response = await fetch(`/api/service-items/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        if (onUpdate) onUpdate();
        else fetchData();
      }
    } catch (err) {
      console.error('Error deleting service:', err);
    }
  };

  const SortIcon = ({ column }: { column: 'name' | 'labor_hours' | 'material_price' | 'tradeName' | 'unit' | 'group' }) => {
    if (sortConfig.key !== column) return <ArrowUpDown size={14} className="opacity-20 group-hover:opacity-50 transition-opacity" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={14} className="text-brand-primary animate-bounce-subtle" /> 
      : <ArrowDown size={14} className="text-brand-primary animate-bounce-subtle" />;
  };

  return (
    <div id="service-catalog-container" className="space-y-12">
      {/* Services Section */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              id="service-catalog-search-input"
              type="text"
              placeholder="Leistung oder Beschreibung suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all text-sm"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-dark transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="relative min-w-[200px] w-full md:w-auto">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <select
              id="service-catalog-trade-filter"
              value={selectedTrade}
              onChange={(e) => setSelectedTrade(e.target.value)}
              className="w-full pl-12 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all text-sm appearance-none cursor-pointer font-medium"
            >
              <option value="all">Alle Gewerke</option>
              {trades.map(trade => (
                <option key={trade} value={trade}>{trade}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
          </div>
          {adminMode && (
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <div className="flex gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                <button 
                  onClick={() => { setGroupByLG(false); setGroupByTrade(false); }}
                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    !groupByLG && !groupByTrade ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-brand-dark'
                  }`}
                >
                  Liste
                </button>
                <button 
                  onClick={() => { setGroupByLG(true); setGroupByTrade(false); }}
                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    groupByLG ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-brand-dark'
                  }`}
                >
                  Gruppen
                </button>
                <button 
                  onClick={() => { setGroupByLG(false); setGroupByTrade(true); }}
                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    groupByTrade ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-brand-dark'
                  }`}
                >
                  Gewerke
                </button>
              </div>
              <div className="flex bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 focus-within:border-brand-primary/30 transition-all flex-1 md:w-64">
                <input 
                  type="text" 
                  value={scrapeUrl}
                  onChange={e => setScrapeUrl(e.target.value)}
                  placeholder="Produkt URL (Copy & Price)"
                  className="bg-transparent px-4 py-3 text-xs outline-none flex-1"
                />
                <button 
                  onClick={handleScrape}
                  disabled={isScraping || !scrapeUrl}
                  className="bg-brand-secondary text-white px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:bg-brand-dark transition-all disabled:opacity-50"
                >
                  {isScraping ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : 'Scrape'}
                </button>
              </div>
              <button 
                id="service-catalog-add-btn"
                onClick={() => setShowAddModal(true)}
                className="px-6 py-4 bg-brand-primary text-white rounded-2xl font-bold text-sm hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20 whitespace-nowrap flex items-center gap-2"
              >
                <Plus size={18} /> Leistung hinzufügen
              </button>
              <label className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap">
                {isImporting ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div> : <Upload size={18} />}
                CSV Import
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden" 
                  onChange={handleCsvImport}
                  disabled={isImporting}
                />
              </label>
            </div>
          )}
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          {['Malerarbeiten', 'Trockenbau', 'Bodenbelag', 'Elektro', 'Sanitär'].map(tag => (
            <button
              key={tag}
              onClick={() => setSearchTerm(tag)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                searchTerm === tag 
                  ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/20' 
                  : 'bg-white text-slate-400 border-slate-100 hover:border-brand-primary hover:text-brand-primary'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th 
                    className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] cursor-pointer hover:text-brand-primary transition-colors group"
                    onClick={() => handleSort('tradeName')}
                  >
                    <div className="flex items-center gap-2">
                      Gewerk <SortIcon column="tradeName" />
                    </div>
                  </th>
                  <th 
                    className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] cursor-pointer hover:text-brand-primary transition-colors group"
                    onClick={() => handleSort('group')}
                  >
                    <div className="flex items-center gap-2">
                      Gruppe <SortIcon column="group" />
                    </div>
                  </th>
                  <th 
                    className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] cursor-pointer hover:text-brand-primary transition-colors group"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-2">
                      Leistung <SortIcon column="name" />
                    </div>
                  </th>
                  <th 
                    className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] cursor-pointer hover:text-brand-primary transition-colors group"
                    onClick={() => handleSort('unit')}
                  >
                    <div className="flex items-center gap-2">
                      Einheit <SortIcon column="unit" />
                    </div>
                  </th>
                  <th 
                    className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] cursor-pointer hover:text-brand-primary transition-colors group"
                    onClick={() => handleSort('labor_hours')}
                  >
                    <div className="flex items-center gap-2">
                      Zeit (h) <SortIcon column="labor_hours" />
                    </div>
                  </th>
                  <th 
                    className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px] cursor-pointer hover:text-brand-primary transition-colors group"
                    onClick={() => handleSort('material_price')}
                  >
                    <div className="flex items-center gap-2">
                      Material (€) <SortIcon column="material_price" />
                    </div>
                  </th>
                  {adminMode && (
                    <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">
                      Aktionen
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {allItems.length > 0 ? (
                  (() => {
                    if (!groupByLG && !groupByTrade) {
                      return allItems.map((item) => (
                        <tr 
                          key={item.id} 
                          className="group hover:bg-brand-accent/30 transition-colors cursor-pointer"
                          onClick={() => setSelectedService(item)}
                        >
                          <td className="py-4 px-6">
                            <span className="px-3 py-1 bg-brand-accent text-brand-primary rounded-full text-[10px] font-bold uppercase tracking-wider">
                              {item.tradeName}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-slate-500 font-medium italic">{item.group || 'Keine Gruppe'}</span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="font-bold text-brand-dark group-hover:text-brand-primary transition-colors">{item.name}</div>
                            {item.description && (
                              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                <Info size={10} /> {item.description.substring(0, 60)}{item.description.length > 60 ? '...' : ''}
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6 font-medium text-slate-500">{item.unit}</td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-1.5 text-brand-primary font-bold">
                              <Clock size={12} />
                              {item.labor_hours.toFixed(2)}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                              <Euro size={12} />
                              {item.material_price.toFixed(2)}
                            </div>
                          </td>
                          {adminMode && (
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const trade = catalog.find(t => t.name === item.tradeName);
                                    setEditingService({ ...item, trade_id: trade?.id || 0 });
                                    setShowEditModal(true);
                                  }}
                                  className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteService(item.id);
                                  }}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ));
                    }

                    // Grouped view
                    const groups: { [key: string]: typeof allItems } = {};
                    allItems.forEach(item => {
                      const g = groupByTrade ? item.tradeName : (item.group || 'Allgemein');
                      if (!groups[g]) groups[g] = [];
                      groups[g].push(item);
                    });

                    // Sort the groups themselves alphabetically
                    const sortedGroupEntries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

                    return sortedGroupEntries.map(([groupName, groupItems]) => (
                      <React.Fragment key={groupName}>
                        <tr className="bg-slate-100/50">
                          <td colSpan={adminMode ? 7 : 6} className="py-3 px-6">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-brand-primary"></div>
                              <span className="text-xs font-black text-brand-dark uppercase tracking-widest">{groupName}</span>
                              <span className="text-[10px] font-bold text-slate-400 ml-2">({groupItems.length} Leistungen)</span>
                            </div>
                          </td>
                        </tr>
                        {groupItems.map((item) => (
                          <tr 
                            key={item.id} 
                            className="group hover:bg-brand-accent/30 transition-colors cursor-pointer"
                            onClick={() => setSelectedService(item)}
                          >
                            <td className="py-4 px-6">
                              <span className="px-3 py-1 bg-brand-accent text-brand-primary rounded-full text-[10px] font-bold uppercase tracking-wider">
                                {item.tradeName}
                              </span>
                            </td>
                            <td className="py-4 px-6">
                              <span className="text-slate-400 text-xs">{item.group || '-'}</span>
                            </td>
                            <td className="py-4 px-6">
                              <div className="font-bold text-brand-dark group-hover:text-brand-primary transition-colors">{item.name}</div>
                              {item.description && (
                                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                                  <Info size={10} /> {item.description.substring(0, 60)}{item.description.length > 60 ? '...' : ''}
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-6 font-medium text-slate-500">{item.unit}</td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-1.5 text-brand-primary font-bold">
                                <Clock size={12} />
                                {item.labor_hours.toFixed(2)}
                              </div>
                            </td>
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-1.5 text-emerald-600 font-bold">
                                <Euro size={12} />
                                {item.material_price.toFixed(2)}
                              </div>
                            </td>
                            {adminMode && (
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const trade = catalog.find(t => t.name === item.tradeName);
                                      setEditingService({ ...item, trade_id: trade?.id || 0 });
                                      setShowEditModal(true);
                                    }}
                                    className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteService(item.id);
                                    }}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </React.Fragment>
                    ));
                  })()
                ) : (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-400 italic">
                      Keine Leistungen gefunden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Labor Rates Section */}
      <div className="space-y-6 pt-12 border-t border-slate-100">
        <button 
          id="service-catalog-labor-rates-toggle"
          onClick={() => setIsLaborRatesExpanded(!isLaborRatesExpanded)}
          className="w-full flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center group-hover:bg-brand-primary group-hover:text-white transition-all">
              <HardHat size={20} />
            </div>
            <div className="text-left">
              <h3 className="text-2xl font-black tracking-tighter text-brand-dark group-hover:text-brand-primary transition-colors">Aktuelle Lohnsätze</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transparente Abrechnung nach Qualifikation</p>
            </div>
          </div>
          <div className={`w-10 h-10 rounded-full border border-slate-100 flex items-center justify-center text-slate-400 group-hover:border-brand-primary group-hover:text-brand-primary transition-all ${isLaborRatesExpanded ? 'rotate-180' : ''}`}>
            <ChevronDown size={20} />
          </div>
        </button>

        <AnimatePresence>
          {isLaborRatesExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Gewerk</th>
                        <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Qualifikation</th>
                        <th className="py-5 px-6 font-black text-slate-400 uppercase tracking-widest text-[10px]">Stundensatz (Netto)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {laborRates.map((rate) => (
                        <tr key={rate.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-6">
                            <span className="font-bold text-brand-dark">{rate.trade_name}</span>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              rate.worker_type === 'Meister' ? 'bg-brand-dark text-white' :
                              rate.worker_type === 'Geselle' ? 'bg-brand-primary/10 text-brand-primary' :
                              'bg-slate-100 text-slate-500'
                            }`}>
                              {rate.worker_type}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-1.5 text-brand-dark font-black text-base">
                              {rate.hourly_rate.toFixed(2)}
                              <span className="text-xs font-bold text-slate-400">€/h</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium italic mt-4">
                * Alle Preise verstehen sich als Nettopreise zzgl. der gesetzlichen Mehrwertsteuer.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Edit Service Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingService(null);
        }}
        title="Leistung bearbeiten"
      >
        <form onSubmit={handleEditService} className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Gewerk</label>
              <select 
                required
                value={editingService?.trade_id}
                onChange={e => setEditingService(prev => prev ? {...prev, trade_id: parseInt(e.target.value)} : null)}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold"
              >
                {catalog.map(trade => (
                  <option key={trade.id} value={trade.id}>{trade.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Leistungsgruppe</label>
              <input 
                type="text"
                value={editingService?.group || ''}
                onChange={e => setEditingService(prev => prev ? {...prev, group: e.target.value} : null)}
                placeholder="z.B. Vorbereitung, Hauptleistung, Abschluss"
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Name der Leistung</label>
              <input 
                required
                type="text"
                value={editingService?.name || ''}
                onChange={e => setEditingService(prev => prev ? {...prev, name: e.target.value} : null)}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Einheit</label>
              <input 
                required
                type="text"
                value={editingService?.unit || ''}
                onChange={e => setEditingService(prev => prev ? {...prev, unit: e.target.value} : null)}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Zeitaufwand (h)</label>
              <input 
                required
                type="number"
                step="0.01"
                value={editingService?.labor_hours || 0}
                onChange={e => setEditingService(prev => prev ? {...prev, labor_hours: parseFloat(e.target.value) || 0} : null)}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Materialpreis (€)</label>
              <input 
                required
                type="number"
                step="0.01"
                value={editingService?.material_price || 0}
                onChange={e => setEditingService(prev => prev ? {...prev, material_price: parseFloat(e.target.value) || 0} : null)}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Beschreibung</label>
              <textarea 
                value={editingService?.description || ''}
                onChange={e => setEditingService(prev => prev ? {...prev, description: e.target.value} : null)}
                rows={4}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button 
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setEditingService(null);
              }}
              className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Abbrechen
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-brand-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Speichern...' : 'Änderungen speichern'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Service Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        showBackButton={true}
        onBack={() => setShowAddModal(false)}
        title="Neue Leistung hinzufügen"
        size="lg"
      >
        <form onSubmit={handleAddService} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Gewerk</label>
              <select 
                required
                value={newServiceData.trade_id}
                onChange={e => setNewServiceData({...newServiceData, trade_id: e.target.value})}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
              >
                {catalog.map(trade => (
                  <option key={trade.id} value={trade.id}>{trade.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Leistungsgruppe</label>
              <input 
                type="text"
                value={newServiceData.group}
                onChange={e => setNewServiceData({...newServiceData, group: e.target.value})}
                placeholder="z.B. Vorbereitung, Hauptleistung, Abschluss"
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Name der Leistung</label>
              <input 
                required
                type="text"
                value={newServiceData.name}
                onChange={e => setNewServiceData({...newServiceData, name: e.target.value})}
                placeholder="z.B. Wände streichen (weiß)"
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Einheit</label>
              <input 
                required
                type="text"
                value={newServiceData.unit}
                onChange={e => setNewServiceData({...newServiceData, unit: e.target.value})}
                placeholder="z.B. m², lfm, Stück"
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Zeitaufwand (h)</label>
              <input 
                required
                type="number"
                step="0.01"
                value={newServiceData.labor_hours}
                onChange={e => setNewServiceData({...newServiceData, labor_hours: parseFloat(e.target.value) || 0})}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Materialpreis (€)</label>
              <input 
                required
                type="number"
                step="0.01"
                value={newServiceData.material_price}
                onChange={e => setNewServiceData({...newServiceData, material_price: parseFloat(e.target.value) || 0})}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 ml-1">Beschreibung</label>
              <textarea 
                value={newServiceData.description}
                onChange={e => setNewServiceData({...newServiceData, description: e.target.value})}
                placeholder="Detaillierte Beschreibung der Leistung..."
                rows={4}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button 
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Abbrechen
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-3 bg-brand-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Speichern...' : 'Leistung speichern'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedService}
        onClose={() => setSelectedService(null)}
        showBackButton={true}
        onBack={() => setSelectedService(null)}
        title="Leistungsdetails"
        size="md"
      >
        {selectedService && (
          <div className="space-y-8">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Bezeichnung</label>
              <h4 className="text-xl font-black text-brand-dark">{selectedService.name}</h4>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Leistungsgruppe</label>
                <span className="text-lg font-black text-brand-dark">{selectedService.group || 'Allgemein'}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Einheit</label>
                <span className="text-lg font-black text-brand-dark">{selectedService.unit}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Zeitaufwand</label>
                <div className="flex items-center gap-2 text-lg font-black text-brand-primary">
                  <Clock size={18} />
                  {selectedService.labor_hours.toFixed(2)} h
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Materialkosten (Netto)</label>
                <div className="flex items-center gap-2 text-lg font-black text-emerald-600">
                  <Euro size={18} />
                  {selectedService.material_price.toFixed(2)} € / {selectedService.unit}
                </div>
              </div>
            </div>

            {selectedService.description && (
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Beschreibung</label>
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-sm text-slate-600 leading-relaxed font-medium">
                  {selectedService.description}
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-4">
              {onSelect && (
                <button 
                  onClick={() => {
                    onSelect(selectedService);
                    setSelectedService(null);
                  }}
                  className="px-8 py-3 bg-brand-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20 flex items-center gap-2"
                >
                  <Plus size={16} /> Auswählen
                </button>
              )}
              <button 
                onClick={() => setSelectedService(null)}
                className="px-8 py-3 bg-brand-dark text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-primary transition-all shadow-lg shadow-brand-dark/20"
              >
                Schließen
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
