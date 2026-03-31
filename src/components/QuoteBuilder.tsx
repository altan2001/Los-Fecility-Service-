import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator,
  Plus, 
  Trash2, 
  FileText, 
  ChevronRight, 
  Save, 
  ArrowLeft, 
  Search, 
  Euro, 
  Clock, 
  User, 
  MapPin, 
  CheckCircle2,
  Printer,
  Download,
  X,
  HardHat,
  Loader2,
  Link as LinkIcon,
  Upload,
  Maximize2,
  Pencil,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import axios from 'axios';
import { TradeAttributeDefinition } from '../App';
import { PILOT_TRADE_ATTRIBUTES } from '../constants/tradeAttributes';
import PlanAnalyzer from './PlanAnalyzer';
import SketchPad from './SketchPad';

interface ServiceItem {
  id: string;
  trade_id: string;
  name: string;
  unit: string;
  labor_hours: number;
  material_price: number;
  description: string;
}

interface Trade {
  id: string;
  name: string;
  is_anlage_a: number;
  items: ServiceItem[];
  attribute_definitions?: TradeAttributeDefinition[];
}

interface QuoteItemLabor {
  id?: string;
  quote_item_id?: string;
  worker_type: 'Helfer' | 'Geselle' | 'Meister';
  hourly_rate: number;
  quantity: number;
  time_value: number;
  time_unit: 'Stunden' | 'Tage' | 'Wochen' | 'Monate';
}

interface QuoteItem {
  id: string;
  project_id: string;
  service_item_id: string | null;
  trade_id: string;
  name: string;
  description: string;
  unit: string;
  quantity: number;
  labor_hours_per_unit: number;
  material_price_per_unit: number;
  length?: number;
  width?: number;
  height?: number;
  depth?: number;
  sketch_data?: string;
  labor_components?: QuoteItemLabor[];
  special_attributes?: any;
  completion?: number;
}

interface Project {
  id: string;
  name: string;
  customer_id?: string;
  customer_name: string;
  customer_address: string;
  status: string;
  currency: string;
  tax_rate: number;
  tags?: string[];
  created_at: string;
  project_manager?: string;
  items?: QuoteItem[];
  craftsman_name?: string;
  craftsman_contact?: string;
  terms_and_conditions?: string;
  site_setup_enabled?: number;
  site_setup_price?: number;
  labor_markup?: number;
  material_markup?: number;
}

interface LaborRate {
  id: string;
  trade_id: string;
  trade_name: string;
  worker_type: string;
  hourly_rate: number;
}

export default function QuoteBuilder({ initialProjectId, initialView, userId }: { initialProjectId?: string, initialView?: 'list' | 'edit' | 'preview', userId?: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [catalog, setCatalog] = useState<Trade[]>([]);
  const [laborRates, setLaborRates] = useState<LaborRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'edit' | 'preview'>(initialView || 'list');
  const [showPlanAnalyzer, setShowPlanAnalyzer] = useState(false);
  const [showSketchModal, setShowSketchModal] = useState<{ itemId: string, unit: string, initialData?: string } | null>(null);
  
  // New Project Form
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProject, setNewProject] = useState({ 
    name: '', 
    customer_id: undefined as string | undefined,
    customer_name: '', 
    customer_address: '',
    currency: 'EUR',
    tax_rate: 19,
    craftsman_name: '',
    craftsman_contact: '',
    terms_and_conditions: '',
    project_manager: '',
    tags: [] as string[]
  });
  const [tagInput, setTagInput] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [userProfile, setUserProfile] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Catalog Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTradeId, setSelectedTradeId] = useState<string | 'all'>('all');
  const [editProjectDetails, setEditProjectDetails] = useState({
    craftsman_name: '',
    craftsman_contact: '',
    terms_and_conditions: '',
    site_setup_enabled: 0,
    site_setup_price: 0,
    project_manager: '',
    tags: [] as string[]
  });
  const [editTagInput, setEditTagInput] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [targetPriceInput, setTargetPriceInput] = useState<string>('');
  const [isCalculatingTarget, setIsCalculatingTarget] = useState(false);
  const [targetPricePreview, setTargetPricePreview] = useState<{ markup: number, currentNet: number, targetNet: number } | null>(null);
  const [showTargetModal, setShowTargetModal] = useState(false);

  // Copy & Price
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [showCopyPrice, setShowCopyPrice] = useState(true);
  const [showManualEntry, setShowManualEntry] = useState(true);

  // Manual Item Entry
  const initialManualItem = {
    name: '',
    unit: 'Stk',
    labor_hours: 0,
    material_price: 0,
    description: '',
    trade_id: 'all' as string | 'all'
  };
  const [manualItem, setManualItem] = useState(initialManualItem);

  // GAEB Import
  const [isUploadingGaeb, setIsUploadingGaeb] = useState(false);

  const checkMeisterRequirement = () => {
    if (!selectedProject || !selectedProject.items) return false;
    
    const hasAnlageA = selectedProject.items.some(item => {
      const trade = catalog.find(t => t.id === item.trade_id);
      return trade?.is_anlage_a === 1;
    });
    
    return hasAnlageA && settings.has_master_craftsman !== '1';
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projectsRes, catalogRes, ratesRes, customersRes, settingsRes] = await Promise.all([
        fetch('/api/projects').then(res => res.json()),
        fetch('/api/catalog').then(res => res.json()),
        fetch('/api/labor-rates/all').then(res => res.json()),
        fetch('/api/customers').then(res => res.json()),
        fetch('/api/settings').then(res => res.json())
      ]);
      setProjects(projectsRes);
      setCatalog(catalogRes);
      setLaborRates(ratesRes);
      setCustomers(customersRes);
      setSettings(settingsRes);

      // Fetch user profile if userId is provided
      if (userId) {
        try {
          const profileRes = await fetch(`/api/user/profile?userId=${userId}`);
          const profileData = await profileRes.json();
          if (profileData.success) setUserProfile(profileData.user);
        } catch (err) {
          console.error('Error fetching user profile:', err);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Freemium check
    if (settings.paid_offers_enabled === 'true' && userProfile?.subscription_status !== 'active') {
      if (projects.length >= 1) {
        setMessage({ type: 'error', text: 'Sie haben das Limit für kostenlose Angebote erreicht. Bitte führen Sie ein Upgrade auf den Premium Plan durch.' });
        return;
      }
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newProject, userId })
      });
      const data = await res.json();
      if (data.success) {
        setShowNewProjectModal(false);
        setNewProject({ 
          name: '', 
          customer_id: undefined,
          customer_name: '', 
          customer_address: '',
          currency: 'EUR',
          tax_rate: 19,
          craftsman_name: '',
          craftsman_contact: '',
          terms_and_conditions: '',
          project_manager: '',
          tags: []
        });
        setTagInput('');
        fetchData();
        handleSelectProject(data.id);
      }
    } catch (err) {
      console.error('Error creating project:', err);
    }
  };

  const handleSelectProject = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      setSelectedProject(data);
      setEditProjectDetails({
        craftsman_name: data.craftsman_name || '',
        craftsman_contact: data.craftsman_contact || '',
        terms_and_conditions: data.terms_and_conditions || '',
        site_setup_enabled: data.site_setup_enabled || 0,
        site_setup_price: data.site_setup_price || 0,
        project_manager: data.project_manager || '',
        tags: data.tags || []
      });
      setView('edit');
    } catch (err) {
      console.error('Error selecting project:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProjectDetails = async () => {
    if (!selectedProject) return;
    setIsSavingProject(true);
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedProject,
          ...editProjectDetails
        })
      });
      if (res.ok) {
        // Fetch fresh data to ensure totals are correct
        const freshRes = await fetch(`/api/projects/${selectedProject.id}`);
        const freshData = await freshRes.json();
        setSelectedProject(freshData);
        alert('Projekt-Details erfolgreich aktualisiert.');
      }
    } catch (err) {
      console.error('Error updating project details:', err);
      alert('Fehler beim Aktualisieren der Projekt-Details.');
    } finally {
      setIsSavingProject(false);
    }
  };

  useEffect(() => {
    if (initialProjectId && projects.length > 0) {
      const project = projects.find(p => p.id === initialProjectId);
      if (project) {
        handleSelectProject(project.id);
        if (initialView) setView(initialView);
      }
    }
  }, [initialProjectId, projects]);

  const handleCalculateTargetPrice = async (preview = true) => {
    if (!selectedProject || !targetPriceInput) return;
    const price = parseFloat(targetPriceInput);
    if (isNaN(price) || price <= 0) {
      setMessage({ type: 'error', text: 'Bitte geben Sie einen gültigen Zielpreis ein.' });
      return;
    }

    setIsCalculatingTarget(true);
    try {
      const response = await axios.post(`/api/projects/${selectedProject.id}/target-price`, { 
        targetPrice: price,
        preview: preview
      });
      
      if (response.data.success) {
        if (preview) {
          setTargetPricePreview(response.data);
          setShowTargetModal(true);
        } else {
          setMessage({ type: 'success', text: `Zielpreis-Kalkulation erfolgreich! Neuer Zuschlag: ${response.data.markup.toFixed(2)}%` });
          await handleSelectProject(selectedProject.id);
          setTargetPriceInput('');
          setShowTargetModal(false);
          setTargetPricePreview(null);
        }
      }
    } catch (err: any) {
      console.error("Error calculating target price:", err);
      setMessage({ type: 'error', text: err.response?.data?.message || 'Fehler bei der Zielpreis-Kalkulation.' });
    } finally {
      setIsCalculatingTarget(false);
    }
  };

  const handleResetMarkups = async () => {
    if (!selectedProject) return;
    try {
      await axios.put(`/api/projects/${selectedProject.id}`, {
        labor_markup: 0,
        material_markup: 0
      });
      await handleSelectProject(selectedProject.id);
      setMessage({ type: 'success', text: 'Zuschläge wurden zurückgesetzt.' });
    } catch (err) {
      console.error("Error resetting markups:", err);
      setMessage({ type: 'error', text: 'Fehler beim Zurücksetzen der Zuschläge.' });
    }
  };

  const handleAddItem = async (service: ServiceItem) => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_item_id: service.id,
          trade_id: service.trade_id,
          name: service.name,
          description: service.description,
          unit: service.unit,
          quantity: 1,
          labor_hours_per_unit: service.labor_hours,
          material_price_per_unit: service.material_price,
          length: 0,
          width: 0,
          height: 0,
          depth: 0,
          labor_components: [
            {
              worker_type: 'Geselle',
              hourly_rate: laborRates.find(r => r.trade_id === service.trade_id && r.worker_type === 'Geselle')?.hourly_rate || 52,
              quantity: 1,
              time_value: service.labor_hours,
              time_unit: 'Stunden'
            }
          ]
        })
      });
      const data = await res.json();
      if (data.success) {
        handleSelectProject(selectedProject.id);
      }
    } catch (err) {
      console.error('Error adding item:', err);
    }
  };

  const handleUpdateItem = async (itemId: string, updates: Partial<QuoteItem>) => {
    if (!selectedProject) return;

    // Auto-calculate quantity if dimensions or unit change
    const currentItem = selectedProject.items?.find(i => i.id === itemId);
    if (currentItem) {
      const merged = { ...currentItem, ...updates };
      if (['length', 'width', 'height', 'depth', 'unit'].some(k => k in updates)) {
        const l = merged.length || 0;
        const w = merged.width || 0;
        const h = merged.height || 0;
        const d = merged.depth || 0;
        
        if (merged.unit === 'm²') {
          updates.quantity = l * w;
        } else if (merged.unit === 'm³') {
          updates.quantity = l * w * (h || d);
        } else if (merged.unit === 'lfm') {
          updates.quantity = l;
        }
      }
    }

    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        // Optimistic update
        setSelectedProject(prev => {
          if (!prev) return null;
          return {
            ...prev,
            items: prev.items?.map(item => item.id === itemId ? { ...item, ...updates } : item)
          };
        });
      }
    } catch (err) {
      console.error('Error updating item:', err);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/items/${itemId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setSelectedProject(prev => {
          if (!prev) return null;
          return {
            ...prev,
            items: prev.items?.filter(item => item.id !== itemId)
          };
        });
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const handleAddManualItem = async () => {
    if (!selectedProject || !manualItem.name) return;
    
    const tradeId = manualItem.trade_id === 'all' ? (catalog[0]?.id || 1) : manualItem.trade_id;
    
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_item_id: null,
          trade_id: tradeId,
          name: manualItem.name,
          description: manualItem.description,
          unit: manualItem.unit,
          quantity: 1,
          labor_hours_per_unit: manualItem.labor_hours,
          material_price_per_unit: manualItem.material_price,
          length: 0,
          width: 0,
          height: 0,
          depth: 0,
          labor_components: [
            {
              worker_type: 'Geselle',
              hourly_rate: laborRates.find(r => r.trade_id === tradeId && r.worker_type === 'Geselle')?.hourly_rate || 52,
              quantity: 1,
              time_value: manualItem.labor_hours,
              time_unit: 'Stunden'
            }
          ]
        })
      });
      const data = await res.json();
      if (data.success) {
        handleSelectProject(selectedProject.id);
        setManualItem({
          name: '',
          unit: 'Stk',
          labor_hours: 0,
          material_price: 0,
          description: '',
          trade_id: 'all'
        });
      }
    } catch (err) {
      console.error('Error adding manual item:', err);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Möchten Sie dieses Projekt wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchData();
        if (selectedProject?.id === id) {
          setSelectedProject(null);
          setView('list');
        }
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const calculateTotals = () => {
    if (!selectedProject || !selectedProject.items) return { labor: 0, material: 0, net: 0, tax: 0, gross: 0 };
    
    let laborTotal = 0;
    let materialTotal = 0;

    selectedProject.items.forEach(item => {
      // Calculate labor from components if they exist
      if (item.labor_components && item.labor_components.length > 0) {
        item.labor_components.forEach(comp => {
          let multiplier = 1;
          if (comp.time_unit === 'Tage') multiplier = 8;
          else if (comp.time_unit === 'Wochen') multiplier = 40;
          else if (comp.time_unit === 'Monate') multiplier = 160;

          laborTotal += comp.quantity * comp.time_value * multiplier * comp.hourly_rate;
        });
      } else {
        // Fallback to old calculation if no components
        const rate = laborRates.find(r => r.trade_id === item.trade_id && r.worker_type === 'Geselle')?.hourly_rate || 52;
        laborTotal += item.quantity * item.labor_hours_per_unit * rate;
      }
      
      materialTotal += item.quantity * item.material_price_per_unit;
    });

    const laborMarkup = selectedProject.labor_markup || 0;
    const materialMarkup = selectedProject.material_markup || 0;
    const laborWithMarkup = laborTotal * (1 + laborMarkup / 100);
    const materialWithMarkup = materialTotal * (1 + materialMarkup / 100);

    const net = laborWithMarkup + materialWithMarkup + (selectedProject.site_setup_enabled ? (selectedProject.site_setup_price || 0) : 0);
    const tax = net * (selectedProject.tax_rate / 100);

    return {
      labor: laborWithMarkup,
      material: materialWithMarkup,
      net: net,
      tax: tax,
      gross: net + tax
    };
  };

  const calculateItemTotal = (item: QuoteItem) => {
    let laborTotal = 0;
    if (item.labor_components && item.labor_components.length > 0) {
      item.labor_components.forEach(comp => {
        let multiplier = 1;
        if (comp.time_unit === 'Tage') multiplier = 8;
        else if (comp.time_unit === 'Wochen') multiplier = 40;
        else if (comp.time_unit === 'Monate') multiplier = 160;
        laborTotal += comp.quantity * comp.time_value * multiplier * comp.hourly_rate;
      });
    } else {
      const rate = laborRates.find(r => r.trade_id === item.trade_id && r.worker_type === 'Geselle')?.hourly_rate || 52;
      laborTotal = item.quantity * item.labor_hours_per_unit * rate;
    }
    const materialTotal = item.quantity * item.material_price_per_unit;
    
    const laborMarkup = selectedProject?.labor_markup || 0;
    const materialMarkup = selectedProject?.material_markup || 0;
    
    return (laborTotal * (1 + laborMarkup / 100)) + (materialTotal * (1 + materialMarkup / 100));
  };

  const totals = calculateTotals();

  const getGroupedItems = () => {
    if (!selectedProject || !selectedProject.items) return {};
    return selectedProject.items.reduce((acc, item) => {
      const tradeId = item.trade_id;
      if (!acc[tradeId]) acc[tradeId] = [];
      acc[tradeId].push(item);
      return acc;
    }, {} as Record<string, QuoteItem[]>);
  };

  const calculateTradeCompletion = (items: QuoteItem[]) => {
    if (!items || items.length === 0) return 0;
    const totalCompletion = items.reduce((sum, item) => sum + (item.completion || 0), 0);
    return Math.round(totalCompletion / items.length);
  };

  const groupedItems = getGroupedItems();

  const handleDownloadPDF = () => {
    if (!selectedProject) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Header
    doc.setFillColor(20, 20, 20); // Dark header
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('LOS Facility Service', 20, 28);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 200, 200);
    doc.text('MEISTERBETRIEB FÜR HANDWERK & SERVICE', 20, 36);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('ANGEBOT', pageWidth - 20, 28, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Nr: ANG-${selectedProject.id.toString().padStart(5, '0')}`, pageWidth - 20, 36, { align: 'right' });

    // Company Info (Right side of header area, below the dark bar)
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    const companyInfo = [
      'LOS Facility Service GmbH',
      'Hauptstraße 1, 82216 Maisach',
      'Tel: +49 123 456789 | Web: www.los-facility.de',
      'Geschäftsführer: Altan K.G. | HRB 123456'
    ];
    companyInfo.forEach((line, i) => {
      doc.text(line, pageWidth - 20, 55 + (i * 4), { align: 'right' });
    });

    // Customer Info
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ANSCHRIFT DES EMPFÄNGERS', 20, 65);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(20, 68, 80, 68);

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(selectedProject.customer_name, 20, 78);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(selectedProject.customer_address, 20, 85);

    // Project Details Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(pageWidth - 90, 75, 70, 35, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('PROJEKT-DETAILS', pageWidth - 85, 82);
    doc.setTextColor(20, 20, 20);
    doc.setFont('helvetica', 'bold');
    doc.text(`Projekt: ${selectedProject.name}`, pageWidth - 85, 88);
    doc.setFont('helvetica', 'normal');
    doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, pageWidth - 85, 94);
    doc.text(`Gültig bis: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE')}`, pageWidth - 85, 100);
    doc.text(`Bearbeiter: System-KI`, pageWidth - 85, 106);

    // Intro Text
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Kalkulatorisches Angebot', 20, 125);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const intro = "Sehr geehrte Damen und Herren,\n\nvielen Dank für das entgegengebrachte Vertrauen und das Interesse an unseren Dienstleistungen. Auf Basis Ihrer Anforderungen und unserer Vor-Ort-Analyse (inkl. KI-gestützter Planerkennung) unterbreiten wir Ihnen gerne folgendes Angebot:";
    const splitIntro = doc.splitTextToSize(intro, pageWidth - 40);
    doc.text(splitIntro, 20, 135);

    // Table
    const tableData = selectedProject.items?.map((item, index) => {
      const itemTotal = calculateItemTotal(item);
      const ePrice = itemTotal / item.quantity;
      return [
        (index + 1).toString().padStart(2, '0'),
        { 
          content: `${item.name}\n${item.description || ''}`, 
          styles: { fontSize: 9, cellPadding: 5 } 
        },
        `${item.quantity.toLocaleString('de-DE')} ${item.unit}`,
        `${ePrice.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}`,
        `${itemTotal.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}`
      ];
    }) || [];

    (doc as any).autoTable({
      startY: 160,
      head: [['Pos.', 'Leistungsbeschreibung', 'Menge', 'E-Preis', 'Gesamt']],
      body: tableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [30, 41, 59], 
        textColor: [255, 255, 255], 
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 35, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' }
      },
      styles: {
        font: 'helvetica',
        fontSize: 9,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      alternateRowStyles: {
        fillColor: [252, 254, 255]
      },
      margin: { left: 20, right: 20 }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 15;

    // Totals Block
    const { net, tax, gross } = totals;
    const totalsX = pageWidth - 90;
    
    const hasSiteSetup = selectedProject.site_setup_enabled === 1;
    const totalsHeight = hasSiteSetup ? 42 : 35;

    doc.setFillColor(248, 250, 252);
    doc.rect(totalsX, currentY - 5, 70, totalsHeight, 'F');
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    let yOffset = currentY + 5;
    
    doc.setTextColor(100, 116, 139);
    doc.text('Summe Netto:', totalsX + 5, yOffset);
    doc.setTextColor(20, 20, 20);
    doc.text(`${(net - (hasSiteSetup ? (selectedProject.site_setup_price || 0) : 0)).toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}`, pageWidth - 25, yOffset, { align: 'right' });
    
    if (hasSiteSetup) {
      yOffset += 7;
      doc.setTextColor(100, 116, 139);
      doc.text('Baustelle einrichten:', totalsX + 5, yOffset);
      doc.setTextColor(20, 20, 20);
      doc.text(`${(selectedProject.site_setup_price || 0).toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}`, pageWidth - 25, yOffset, { align: 'right' });
    }

    yOffset += 7;
    doc.setTextColor(100, 116, 139);
    doc.text(`MwSt. (${selectedProject.tax_rate}%):`, totalsX + 5, yOffset);
    doc.setTextColor(20, 20, 20);
    doc.text(`${tax.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}`, pageWidth - 25, yOffset, { align: 'right' });
    
    doc.setDrawColor(203, 213, 225);
    doc.line(totalsX + 5, yOffset + 4, pageWidth - 25, yOffset + 4);

    yOffset += 11;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('GESAMTBETRAG:', totalsX + 5, yOffset);
    doc.text(`${gross.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}`, pageWidth - 25, yOffset, { align: 'right' });

    currentY += totalsHeight + 10;

    // Terms & Conditions Summary
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Zahlungs- und Ausführungsbedingungen', 20, currentY);
    currentY += 8;
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const terms = selectedProject.terms_and_conditions ? selectedProject.terms_and_conditions.split('\n') : [
      'Die Abrechnung erfolgt nach tatsächlichem Aufmaß.',
      'Zahlungsziel: 10 Tage nach Rechnungserhalt ohne Abzug.',
      'Alle Preise verstehen sich inkl. der gesetzlichen Mehrwertsteuer.',
      'Es gelten unsere allgemeinen Geschäftsbedingungen (AGB).',
      'Die Gültigkeit dieses Angebots beträgt 30 Kalendertage.'
    ];
    
    terms.forEach((term) => {
      const bulletTerm = term.trim().startsWith('•') ? term.trim() : `• ${term.trim()}`;
      const splitTerm = doc.splitTextToSize(bulletTerm, pageWidth - 40);
      doc.text(splitTerm, 20, currentY);
      currentY += (splitTerm.length * 4) + 1;
    });

    currentY += 35;

    // Signature Block
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    doc.setDrawColor(203, 213, 225);
    doc.line(20, currentY + 20, 80, currentY + 20);
    doc.line(110, currentY + 20, 170, currentY + 20);
    
    doc.setFontSize(8);
    doc.text('Ort, Datum, Stempel LOS Facility', 20, currentY + 25);
    doc.text('Ort, Datum, Unterschrift Kunde', 110, currentY + 25);

    // Sketches Section
    const itemsWithSketches = selectedProject.items?.filter(item => item.sketch_data) || [];
    
    if (itemsWithSketches.length > 0) {
      doc.addPage();
      currentY = 20;
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(20, 20, 20);
      doc.text('Anhang: Detaillierte Skizzen & Aufmaß', 20, currentY);
      currentY += 15;

      itemsWithSketches.forEach((item, idx) => {
        try {
          const sketch = JSON.parse(item.sketch_data!);
          if (sketch.image) {
            if (currentY > pageHeight - 80) {
              doc.addPage();
              currentY = 20;
            }
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`${idx + 1}. ${item.name}`, 20, currentY);
            currentY += 5;
            
            // Add dimensions info
            if (sketch.dimensions) {
              const d = sketch.dimensions;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.text(`Maße: L:${d.length}m, B:${d.width}m, H:${d.height}m, T:${d.depth}m | Gesamt: ${d.quantity} ${item.unit}`, 20, currentY);
              currentY += 5;
            }

            doc.addImage(sketch.image, 'PNG', 20, currentY, 100, 60);
            currentY += 70;
          }
        } catch (e) {
          console.error('Error adding sketch to PDF:', e);
        }
      });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Bankverbindung: Sparkasse München | IBAN: DE12 3456 7890 1234 5678 90', pageWidth / 2, pageHeight - 15, { align: 'center' });
    doc.text('Vielen Dank für Ihren Auftrag!', pageWidth / 2, pageHeight - 10, { align: 'center' });

    doc.save(`Angebot_${selectedProject.id}_${selectedProject.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleScrapePrice = async () => {
    if (!scrapeUrl) return;
    setIsScraping(true);
    try {
      const res = await fetch('/api/scrape-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl })
      });
      const data = await res.json();
      if (data.success) {
        if (selectedProject) {
          const resAdd = await fetch(`/api/projects/${selectedProject.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trade_id: catalog[0]?.id || 1,
              name: data.title,
              description: `Material-Import von: ${new URL(scrapeUrl).hostname}`,
              unit: data.unit || 'Stück',
              quantity: 1,
              labor_hours_per_unit: 0,
              material_price_per_unit: data.price
            })
          });
          const dataAdd = await resAdd.json();
          if (dataAdd.success) {
            handleSelectProject(selectedProject.id);
            setScrapeUrl('');
          }
        }
      } else {
        alert(data.message || 'Preis konnte nicht extrahiert werden.');
      }
    } catch (err) {
      console.error('Error scraping price:', err);
      alert('Fehler beim Abrufen der Preisdaten. Bitte prüfen Sie die URL.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleGaebUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject) return;

    setIsUploadingGaeb(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/import-gaeb`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        alert(`${data.count} Positionen erfolgreich aus GAEB importiert.`);
        handleSelectProject(selectedProject.id);
      } else {
        alert(data.message || 'Fehler beim GAEB-Import.');
      }
    } catch (err) {
      console.error('Error uploading GAEB:', err);
      alert('Fehler beim Hochladen der GAEB-Datei.');
    } finally {
      setIsUploadingGaeb(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleApplyPlanResults = async (results: any) => {
    if (!selectedProject) return;

    const confirmMapping = confirm(`Es wurden ${results.rooms.length} Räume erkannt. Möchten Sie diese mit den KI-vorgeschlagenen Leistungen zur Kalkulation hinzufügen?`);
    if (!confirmMapping) return;

    try {
      for (const room of results.rooms) {
        if (room.suggested_services && room.suggested_services.length > 0) {
          for (const s of room.suggested_services) {
            // Try to find matching trade and service in catalog
            const matchedTrade = catalog.find(t => 
              t.name.toLowerCase().includes(s.trade.toLowerCase()) || 
              s.trade.toLowerCase().includes(t.name.toLowerCase())
            );
            const matchedService = matchedTrade?.items?.find((si: any) => 
              si.name.toLowerCase().includes(s.service.toLowerCase()) || 
              s.service.toLowerCase().includes(si.name.toLowerCase())
            );

            await fetch(`/api/projects/${selectedProject.id}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                trade_id: matchedTrade?.id || catalog[0]?.id || 1,
                service_item_id: matchedService?.id,
                name: `${room.name} - ${s.service}`,
                description: `KI-erkanntes Aufmaß aus Grundriss. Features: ${room.features.join(', ')}`,
                unit: s.unit || 'm²',
                quantity: s.quantity || room.area,
                labor_hours_per_unit: matchedService?.labor_hours || 0.5,
                material_price_per_unit: matchedService?.material_price || 15.0
              })
            });
          }
        } else {
          // Fallback if no suggested services
          const defaultTradeId = catalog[0]?.id || 1;
          
          await fetch(`/api/projects/${selectedProject.id}/items`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trade_id: defaultTradeId,
              name: `${room.name} - Bodenfläche`,
              description: `KI-erkanntes Aufmaß aus Grundriss. Features: ${room.features.join(', ')}`,
              unit: 'm²',
              quantity: room.area,
              labor_hours_per_unit: 0.5,
              material_price_per_unit: 15.0
            })
          });

          if (room.perimeter > 0) {
            await fetch(`/api/projects/${selectedProject.id}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                trade_id: defaultTradeId,
                name: `${room.name} - Wandarbeiten`,
                description: `KI-erkanntes Aufmaß aus Grundriss (Umfang).`,
                unit: 'lfm',
                quantity: room.perimeter,
                labor_hours_per_unit: 0.3,
                material_price_per_unit: 5.0
              })
            });
          }
        }
      }
      
      alert(`${results.rooms.length} Räume wurden erfolgreich analysiert und kalkuliert.`);
      handleSelectProject(selectedProject.id);
      setShowPlanAnalyzer(false);
    } catch (err) {
      console.error('Error applying plan results:', err);
      alert('Fehler beim Übernehmen der Plan-Ergebnisse.');
    }
  };

  if (loading && view === 'list') {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8">
      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl flex items-center justify-between ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}
        >
          <div className="flex items-center gap-3">
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold text-sm">{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="p-1 hover:bg-black/5 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </motion.div>
      )}
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-brand-dark">Angebots-Builder</h2>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mt-1">Professionelle Kalkulation & Dokumentation</p>
        </div>
        {view === 'list' && (
          <button 
            onClick={() => setShowNewProjectModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20"
          >
            <Plus size={20} /> Neues Projekt
          </button>
        )}
        {view !== 'list' && (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setView('list');
                setSelectedProject(null);
              }}
              className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
            >
              <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
              Projekt wechseln
            </button>
            <button 
              onClick={() => {
                setView('list');
                setSelectedProject(null);
              }}
              className="flex items-center justify-center w-9 h-9 bg-white text-slate-400 hover:text-red-500 border border-slate-100 hover:border-red-100 rounded-xl transition-all shadow-sm"
              title="Schließen"
            >
              <X size={18} />
            </button>
            <button 
              onClick={() => setView(view === 'edit' ? 'preview' : 'edit')}
              className="flex items-center gap-2 px-6 py-3 bg-brand-dark text-white rounded-2xl font-bold hover:bg-brand-primary transition-all shadow-lg shadow-brand-dark/20 ml-2"
            >
              {view === 'edit' ? <><FileText size={20} /> Vorschau</> : <><Save size={20} /> Bearbeiten</>}
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {view === 'list' && (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {projects.map(project => (
              <div 
                key={project.id}
                className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden group hover:border-brand-primary/30 transition-all cursor-pointer"
                onClick={() => handleSelectProject(project.id)}
              >
                <div className="p-8 space-y-6">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 bg-brand-accent rounded-2xl flex items-center justify-center text-brand-primary group-hover:scale-110 transition-transform">
                      <FileText size={24} />
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      project.status === 'Entwurf' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-brand-dark group-hover:text-brand-primary transition-colors">{project.name}</h3>
                    <p className="text-sm text-slate-400 font-medium mt-1">Erstellt am {new Date(project.created_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  <div className="space-y-2 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                      <User size={14} className="text-slate-400" /> {project.customer_name || 'Kein Name'}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                      <MapPin size={14} className="text-slate-400" /> {project.customer_address || 'Keine Adresse'}
                    </div>
                  </div>
                </div>
                <div className="px-8 py-4 bg-slate-50 flex items-center justify-between">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                  <span className="text-brand-primary font-bold text-sm flex items-center gap-1">
                    Details <ChevronRight size={16} />
                  </span>
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-slate-400 italic">
                Noch keine Projekte vorhanden. Erstellen Sie Ihr erstes Angebot!
              </div>
            )}
          </motion.div>
        )}

        {view === 'edit' && selectedProject && (
          <motion.div 
            key="edit"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Left: Quote Items */}
            <div className="lg:col-span-8 space-y-6">
              {checkMeisterRequirement() && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-50 border border-red-100 p-6 rounded-[2rem] flex items-center gap-6"
                >
                  <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
                    <AlertCircle size={24} />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-red-900 tracking-tight">Meisterpflicht-Warnung</h4>
                    <p className="text-sm text-red-700 font-medium">
                      Dieses Projekt enthält Leistungen aus zulassungspflichtigen Gewerken (Anlage A). 
                      Laut Ihren Einstellungen verfügt Ihr Betrieb über keinen Meister. Bitte prüfen Sie die rechtliche Zulässigkeit.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Craftsman & Terms Section */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h3 className="text-xl font-black text-brand-dark flex items-center gap-2">
                    <HardHat size={20} className="text-brand-primary" /> Handwerker & Konditionen
                  </h3>
                  <button 
                    onClick={handleUpdateProjectDetails}
                    disabled={isSavingProject}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-dark transition-all disabled:opacity-50"
                  >
                    {isSavingProject ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Speichern
                  </button>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Handwerker Name / Firma</label>
                    <input 
                      type="text"
                      value={editProjectDetails.craftsman_name}
                      onChange={(e) => setEditProjectDetails({ ...editProjectDetails, craftsman_name: e.target.value })}
                      placeholder="z.B. Max Mustermann GmbH"
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Kontakt (Tel/Email)</label>
                    <input 
                      type="text"
                      value={editProjectDetails.craftsman_contact}
                      onChange={(e) => setEditProjectDetails({ ...editProjectDetails, craftsman_contact: e.target.value })}
                      placeholder="z.B. +49 123 456789"
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Projektleiter</label>
                    <input 
                      type="text"
                      value={editProjectDetails.project_manager}
                      onChange={(e) => setEditProjectDetails({ ...editProjectDetails, project_manager: e.target.value })}
                      placeholder="Name des Projektleiters"
                      className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Zahlungs- & Ausführungsbedingungen</label>
                    <textarea 
                      value={editProjectDetails.terms_and_conditions}
                      onChange={(e) => setEditProjectDetails({ ...editProjectDetails, terms_and_conditions: e.target.value })}
                      placeholder="Eigene Bedingungen hier eintragen oder leer lassen für Standard..."
                      rows={4}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all resize-none"
                    />
                  </div>
                  <div className="md:col-span-2 p-6 bg-brand-primary/5 rounded-3xl border border-brand-primary/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-primary text-white rounded-xl">
                          <MapPin size={18} />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-brand-dark">Baustelle einrichten</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pauschale für Anfahrt & Rüstzeit</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setEditProjectDetails({ ...editProjectDetails, site_setup_enabled: editProjectDetails.site_setup_enabled ? 0 : 1 })}
                        className={`w-14 h-7 rounded-full transition-all relative ${editProjectDetails.site_setup_enabled ? 'bg-brand-primary' : 'bg-slate-200'}`}
                      >
                        <motion.div 
                          animate={{ x: editProjectDetails.site_setup_enabled ? 28 : 4 }}
                          className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>
                    {editProjectDetails.site_setup_enabled === 1 && (
                      <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Pauschalpreis ({selectedProject.currency})</label>
                          <input 
                            type="number"
                            value={editProjectDetails.site_setup_price}
                            onChange={(e) => setEditProjectDetails({ ...editProjectDetails, site_setup_price: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 bg-white border border-slate-100 rounded-xl text-sm font-bold text-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-slate-500 italic">Dieser Betrag wird einmalig zur Gesamtsumme des Angebots addiert.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-2 space-y-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Projekt-Tags (Kategorisierung)</label>
                    <div className="flex flex-wrap gap-2">
                      {editProjectDetails.tags.map((tag, idx) => (
                        <span key={idx} className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-xs font-bold rounded-full flex items-center gap-2">
                          {tag}
                          <button 
                            type="button"
                            onClick={() => setEditProjectDetails({ ...editProjectDetails, tags: editProjectDetails.tags.filter((_, i) => i !== idx) })}
                            className="hover:text-brand-dark transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={editTagInput}
                        onChange={(e) => setEditTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (editTagInput.trim() && !editProjectDetails.tags.includes(editTagInput.trim())) {
                              setEditProjectDetails({ ...editProjectDetails, tags: [...editProjectDetails.tags, editTagInput.trim()] });
                              setEditTagInput('');
                            }
                          }
                        }}
                        placeholder="Tag hinzufügen..."
                        className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          if (editTagInput.trim() && !editProjectDetails.tags.includes(editTagInput.trim())) {
                            setEditProjectDetails({ ...editProjectDetails, tags: [...editProjectDetails.tags, editTagInput.trim()] });
                            setEditTagInput('');
                          }
                        }}
                        className="px-4 bg-brand-primary text-white rounded-xl hover:bg-brand-primary/90 transition-all"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-xl font-black text-brand-dark">Angebotspositionen</h3>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setShowPlanAnalyzer(true)}
                      className="flex items-center gap-2 px-4 py-1.5 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary/20 transition-all"
                    >
                      <Maximize2 size={14} /> KI-Plan Analyse
                    </button>
                    <button 
                      id="quote-auto-calc-btn"
                      onClick={async () => {
                        if (!selectedProject) return;
                        setLoading(true);
                        try {
                          const res = await fetch(`/api/projects/${selectedProject.id}/auto-calculate`, { method: 'POST' });
                          const data = await res.json();
                          if (data.success) {
                            alert(`${data.matchedCount} Positionen wurden automatisch mit Katalogdaten bestückt.`);
                            handleSelectProject(selectedProject.id);
                          }
                        } catch (err) {
                          console.error('Auto-calculate error:', err);
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-100 transition-all"
                    >
                      <CheckCircle2 size={14} /> Auto-Kalkulation
                    </button>
                    <label id="quote-gaeb-import-label" className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-all">
                      {isUploadingGaeb ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      GAEB Import
                      <input id="quote-gaeb-import-input" type="file" accept=".xml,.x83" className="hidden" onChange={handleGaebUpload} disabled={isUploadingGaeb} />
                    </label>
                    <button 
                      id="quote-gaeb-export-btn"
                      onClick={() => window.open(`/api/projects/${selectedProject.id}/export-gaeb`, '_blank')}
                      className="flex items-center gap-2 px-4 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                      <Download size={14} /> GAEB Export
                    </button>
                    <span className="px-4 py-1 bg-brand-accent text-brand-primary rounded-full text-[10px] font-bold uppercase tracking-widest">
                      {selectedProject.items?.length || 0} Positionen
                    </span>
                  </div>
                </div>
                <div className="divide-y divide-slate-50">
                  {Object.entries(groupedItems).map(([tradeId, items]) => {
                    const trade = catalog.find(t => t.id === tradeId);
                    const tradeCompletion = calculateTradeCompletion(items);
                    return (
                      <div key={tradeId} className="border-b border-slate-100 last:border-0">
                        {/* Trade Header with Progress Bar */}
                        <div className="p-6 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                              <HardHat size={18} />
                            </div>
                            <div>
                              <h3 className="font-black text-brand-dark uppercase tracking-widest text-sm">{trade?.name || 'Unbekanntes Gewerk'}</h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{items.length} Positionen</p>
                            </div>
                          </div>
                          <div className="flex-1 max-w-md">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gesamtfortschritt</span>
                              <span className="text-[10px] font-black text-brand-primary">{tradeCompletion}%</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${tradeCompletion}%` }}
                                className="h-full bg-brand-primary"
                              />
                            </div>
                          </div>
                        </div>
                        {/* Items in this trade */}
                        <div className="divide-y divide-slate-50">
                          {items.map((item) => (
                            <div key={item.id} className="p-8 hover:bg-slate-50/50 transition-colors group border-b border-slate-50 last:border-0">
                      <div className="flex flex-col gap-6">
                        {/* Header & Description */}
                        <div className="flex flex-col md:flex-row gap-6">
                          <div className="flex-1 space-y-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <input 
                                  value={item.name}
                                  onChange={(e) => handleUpdateItem(item.id, { name: e.target.value })}
                                  className="font-black text-brand-dark text-lg bg-transparent border-none p-0 focus:ring-0 w-full outline-none"
                                />
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                  {catalog.find(t => t.id === item.trade_id)?.name}
                                </p>
                              </div>
                              <button 
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                            <textarea 
                              value={item.description}
                              onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all resize-none"
                              rows={2}
                            />
                          </div>
                        </div>

                        {/* Dimensions & Basic Info */}
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                          <div className="col-span-2 md:col-span-1">
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Menge</label>
                              <button 
                                id={`quote-sketch-btn-${item.id}`}
                                onClick={() => setShowSketchModal({ itemId: item.id, unit: item.unit, initialData: item.sketch_data })}
                                className="text-[9px] font-bold text-brand-primary uppercase tracking-widest hover:text-brand-dark transition-colors flex items-center gap-1"
                                title="Skizze erstellen"
                              >
                                <Pencil size={10} /> Skizze
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                value={item.quantity}
                                onChange={(e) => handleUpdateItem(item.id, { quantity: parseFloat(e.target.value) || 0 })}
                                className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                              />
                              <select 
                                value={item.unit}
                                onChange={(e) => handleUpdateItem(item.id, { unit: e.target.value })}
                                className="text-xs font-bold text-brand-primary bg-white border border-slate-200 rounded-xl p-2 outline-none"
                              >
                                <option value="m²">m²</option>
                                <option value="lfm">lfm</option>
                                <option value="m³">m³</option>
                                <option value="Stk">Stk</option>
                                <option value="Std">Std</option>
                                <option value="Psch">Psch</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Länge (m)</label>
                            <input 
                              type="number" 
                              value={item.length ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, { length: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Breite (m)</label>
                            <input 
                              type="number" 
                              value={item.width ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, { width: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Höhe (m)</label>
                            <input 
                              type="number" 
                              value={item.height ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, { height: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Tiefe (m)</label>
                            <input 
                              type="number" 
                              value={item.depth ?? ''}
                              onChange={(e) => handleUpdateItem(item.id, { depth: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mat. ({selectedProject.currency}/Einh.)</label>
                            <input 
                              type="number" 
                              value={item.material_price_per_unit}
                              onChange={(e) => handleUpdateItem(item.id, { material_price_per_unit: parseFloat(e.target.value) || 0 })}
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                            />
                          </div>

                          {/* Trade-specific Attributes */}
                          {(() => {
                            const trade = catalog.find(t => t.id === item.trade_id);
                            const tradeName = trade?.name || '';
                            const attribute_definitions = trade?.attribute_definitions || PILOT_TRADE_ATTRIBUTES[tradeName] || [];
                            
                            if (attribute_definitions.length > 0) {
                              return (
                                <div className="col-span-full grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
                                  {attribute_definitions.map(attr => (
                                    <div key={attr.id}>
                                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                                        {attr.label} {attr.unit ? `(${attr.unit})` : ''}
                                      </label>
                                      {attr.type === 'select' ? (
                                        <select 
                                          value={item.special_attributes?.[attr.id] || ''}
                                          onChange={(e) => {
                                            const newAttrs = { ...(item.special_attributes || {}), [attr.id]: e.target.value };
                                            handleUpdateItem(item.id, { special_attributes: newAttrs });
                                          }}
                                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                        >
                                          <option value="">Wählen...</option>
                                          {attr.options?.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                          ))}
                                        </select>
                                      ) : attr.type === 'number' ? (
                                        <input 
                                          type="number"
                                          value={item.special_attributes?.[attr.id] || ''}
                                          onChange={(e) => {
                                            const newAttrs = { ...(item.special_attributes || {}), [attr.id]: parseFloat(e.target.value) || 0 };
                                            handleUpdateItem(item.id, { special_attributes: newAttrs });
                                          }}
                                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                        />
                                      ) : attr.type === 'boolean' ? (
                                        <button 
                                          onClick={() => {
                                            const newAttrs = { ...(item.special_attributes || {}), [attr.id]: !item.special_attributes?.[attr.id] };
                                            handleUpdateItem(item.id, { special_attributes: newAttrs });
                                          }}
                                          className={`w-full p-2 rounded-xl text-xs font-bold uppercase tracking-widest border transition-all ${
                                            item.special_attributes?.[attr.id] 
                                              ? 'bg-brand-primary text-white border-brand-primary' 
                                              : 'bg-white text-slate-400 border-slate-200'
                                          }`}
                                        >
                                          {item.special_attributes?.[attr.id] ? 'Ja' : 'Nein'}
                                        </button>
                                      ) : (
                                        <input 
                                          type="text"
                                          value={item.special_attributes?.[attr.id] || ''}
                                          onChange={(e) => {
                                            const newAttrs = { ...(item.special_attributes || {}), [attr.id]: e.target.value };
                                            handleUpdateItem(item.id, { special_attributes: newAttrs });
                                          }}
                                          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        {/* Labor Components */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                              <HardHat size={14} /> Personaleinsatz & Kalkulation
                            </h5>
                            <button 
                              onClick={() => {
                                const newComp: QuoteItemLabor = {
                                  worker_type: 'Geselle',
                                  hourly_rate: 52,
                                  quantity: 1,
                                  time_value: 1,
                                  time_unit: 'Stunden'
                                };
                                handleUpdateItem(item.id, { 
                                  labor_components: [...(item.labor_components || []), newComp] 
                                });
                              }}
                              className="text-[10px] font-bold text-brand-primary uppercase tracking-widest hover:text-brand-dark transition-colors flex items-center gap-1"
                            >
                              <Plus size={12} /> Personal hinzufügen
                            </button>
                          </div>
                          
                          <div className="space-y-2">
                            {item.labor_components?.map((comp, idx) => (
                              <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-4 bg-white border border-slate-100 rounded-2xl items-end shadow-sm">
                                <div className="md:col-span-1">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Typ</label>
                                  <select 
                                    value={comp.worker_type}
                                    onChange={(e) => {
                                      const newComps = [...(item.labor_components || [])];
                                      newComps[idx].worker_type = e.target.value as any;
                                      // Auto-update rate if found
                                      const rate = laborRates.find(r => r.trade_id === item.trade_id && r.worker_type === e.target.value)?.hourly_rate;
                                      if (rate) newComps[idx].hourly_rate = rate;
                                      handleUpdateItem(item.id, { labor_components: newComps });
                                    }}
                                    className="w-full p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-brand-dark"
                                  >
                                    <option value="Helfer">Helfer</option>
                                    <option value="Geselle">Geselle</option>
                                    <option value="Meister">Meister</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Anzahl Pers.</label>
                                  <input 
                                    type="number" 
                                    value={comp.quantity}
                                    onChange={(e) => {
                                      const newComps = [...(item.labor_components || [])];
                                      newComps[idx].quantity = parseInt(e.target.value) || 1;
                                      handleUpdateItem(item.id, { labor_components: newComps });
                                    }}
                                    className="w-full p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-brand-dark"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Zeitwert</label>
                                  <input 
                                    type="number" 
                                    value={comp.time_value}
                                    onChange={(e) => {
                                      const newComps = [...(item.labor_components || [])];
                                      newComps[idx].time_value = parseFloat(e.target.value) || 0;
                                      handleUpdateItem(item.id, { labor_components: newComps });
                                    }}
                                    className="w-full p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-brand-dark"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Einheit</label>
                                  <select 
                                    value={comp.time_unit}
                                    onChange={(e) => {
                                      const newComps = [...(item.labor_components || [])];
                                      newComps[idx].time_unit = e.target.value as any;
                                      handleUpdateItem(item.id, { labor_components: newComps });
                                    }}
                                    className="w-full p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-brand-dark"
                                  >
                                    <option value="Stunden">Stunden</option>
                                    <option value="Tage">Tage</option>
                                    <option value="Wochen">Wochen</option>
                                    <option value="Monate">Monate</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Satz ({selectedProject.currency}/h)</label>
                                  <input 
                                    type="number" 
                                    value={comp.hourly_rate}
                                    onChange={(e) => {
                                      const newComps = [...(item.labor_components || [])];
                                      newComps[idx].hourly_rate = parseFloat(e.target.value) || 0;
                                      handleUpdateItem(item.id, { labor_components: newComps });
                                    }}
                                    className="w-full p-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-brand-primary"
                                  />
                                </div>
                                <div className="flex items-center justify-end gap-2">
                                  <button 
                                    onClick={() => {
                                      const newComps = item.labor_components?.filter((_, i) => i !== idx);
                                      handleUpdateItem(item.id, { labor_components: newComps });
                                    }}
                                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Item Progress Bar */}
                        <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 mb-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Abschlussgrad</label>
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-black text-brand-dark">{item.completion || 0}%</span>
                                <div className="flex gap-1">
                                  {[0, 25, 50, 75, 100].map((val) => (
                                    <button 
                                      key={val}
                                      onClick={() => handleUpdateItem(item.id, { completion: val })}
                                      className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                                        (item.completion || 0) === val 
                                          ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                                          : 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50'
                                      }`}
                                    >
                                      {val}%
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                            <div className="flex-1 max-w-md">
                              <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden cursor-pointer relative" onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const percent = Math.round((x / rect.width) * 100);
                                handleUpdateItem(item.id, { completion: percent });
                              }}>
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.completion || 0}%` }}
                                  className="h-full bg-brand-primary"
                                />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <span className="text-[8px] font-black text-white mix-blend-difference uppercase">Klicken zum Anpassen</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Item Total */}
                        <div className="flex justify-end pt-4 border-t border-slate-50">
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Position Gesamt (Netto)</span>
                            <span className="text-2xl font-black text-brand-dark">
                              {calculateItemTotal(item).toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {(!selectedProject.items || selectedProject.items.length === 0) && (
            <div className="p-20 text-center text-slate-400 italic">
              Noch keine Positionen hinzugefügt. Wählen Sie Leistungen aus dem Katalog rechts aus.
            </div>
          )}
        </div>
                {selectedProject.items && selectedProject.items.length > 0 && (
                  <div className="p-8 bg-brand-dark text-white">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                          <Clock size={14} /> Lohnanteil (Geselle)
                        </div>
                        <div className="text-2xl font-black">{totals.labor.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}</div>
                        {selectedProject.labor_markup > 0 && (
                          <div className="text-[10px] text-brand-primary font-bold uppercase tracking-widest">+{selectedProject.labor_markup.toFixed(1)}% Zuschlag</div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                          <Euro size={14} /> Materialanteil
                        </div>
                        <div className="text-2xl font-black">{totals.material.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}</div>
                        {selectedProject.material_markup > 0 && (
                          <div className="text-[10px] text-brand-primary font-bold uppercase tracking-widest">+{selectedProject.material_markup.toFixed(1)}% Zuschlag</div>
                        )}
                      </div>
                      {selectedProject.site_setup_enabled === 1 && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                            <MapPin size={14} /> Baustelle einrichten
                          </div>
                          <div className="text-2xl font-black">{(selectedProject.site_setup_price || 0).toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}</div>
                        </div>
                      )}
                      <div className="space-y-2 pt-6 md:pt-0 md:pl-8 md:border-l border-white/10">
                        <div className="text-brand-primary text-xs font-bold uppercase tracking-widest">Gesamtsumme (Netto)</div>
                        <div className="text-4xl font-black text-brand-primary">{totals.net.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}</div>
                      </div>
                    </div>

                    {/* Target Price Tool */}
                    <div className="mt-8 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-white uppercase tracking-widest">Zielpreis-Kalkulation</h4>
                        <p className="text-xs text-slate-400 font-medium">Geben Sie Ihren Wunschpreis ein – das System passt die Zuschläge automatisch an.</p>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-48">
                          <input 
                            type="number" 
                            value={targetPriceInput}
                            onChange={(e) => setTargetPriceInput(e.target.value)}
                            placeholder="Zielpreis (€)"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold focus:outline-none focus:border-brand-primary transition-all"
                          />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">€</div>
                        </div>
                        <button 
                          onClick={() => handleCalculateTargetPrice(true)}
                          disabled={isCalculatingTarget || !targetPriceInput}
                          className="flex items-center gap-2 bg-brand-primary text-brand-dark px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isCalculatingTarget ? <div className="w-4 h-4 border-2 border-brand-dark border-t-transparent rounded-full animate-spin" /> : <Calculator size={16} />}
                          Optimieren
                        </button>
                        {(selectedProject.labor_markup > 0 || selectedProject.material_markup > 0) && (
                          <button 
                            onClick={handleResetMarkups}
                            className="p-2.5 text-slate-400 hover:text-white transition-colors"
                            title="Zuschläge zurücksetzen"
                          >
                            <RotateCcw size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Catalog Browser */}
            <div className="lg:col-span-4 space-y-6">
              {/* Copy & Price Tool */}
              <AnimatePresence>
                {showCopyPrice && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-brand-dark rounded-[2.5rem] p-8 shadow-xl space-y-4 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-brand-primary">
                        <LinkIcon size={20} />
                        <h3 className="text-lg font-black text-white">Copy & Price</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setShowCopyPrice(false)}
                          className="flex items-center gap-2 bg-white/10 text-white/60 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                          title="Schließen"
                        >
                          <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                          Zurück
                        </button>
                        <button 
                          onClick={() => setShowCopyPrice(false)}
                          className="p-2 text-white/40 hover:text-white transition-colors rounded-xl hover:bg-white/10"
                          title="Schließen"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">Fügen Sie eine Produkt-URL ein, um den Preis automatisch zu übernehmen.</p>
                    <div className="space-y-3">
                      <input 
                        type="url"
                        placeholder="https://www.hornbach.de/p/..."
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        className="w-full p-3 bg-white/10 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary/50 placeholder:text-white/20"
                      />
                      <button 
                        onClick={handleScrapePrice}
                        disabled={isScraping || !scrapeUrl}
                        className="w-full py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isScraping ? <><Loader2 size={18} className="animate-spin" /> Scraping...</> : 'Material importieren'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Manual Entry Tool */}
              <AnimatePresence>
                {showManualEntry && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl space-y-4 overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2 text-brand-primary">
                        <Plus size={20} />
                        <h3 className="text-lg font-black text-brand-dark">Manuelle Eingabe</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setManualItem({ ...initialManualItem })}
                          className="flex items-center gap-2 bg-slate-50 text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                          title="Zurücksetzen"
                        >
                          <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                          Zurück
                        </button>
                        <button 
                          onClick={() => setShowManualEntry(false)}
                          className="flex items-center justify-center w-10 h-10 bg-slate-50 text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 rounded-xl transition-all shadow-sm"
                          title="Schließen"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 font-medium">Fügen Sie eine neue Leistung manuell hinzu.</p>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Name der Leistung</label>
                        <input 
                          type="text"
                          placeholder="z.B. Sonderreinigung Fassade"
                          value={manualItem.name}
                          onChange={(e) => setManualItem({ ...manualItem, name: e.target.value })}
                          className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Einheit</label>
                          <select 
                            value={manualItem.unit}
                            onChange={(e) => setManualItem({ ...manualItem, unit: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                          >
                            <option value="m²">m²</option>
                            <option value="lfm">lfm</option>
                            <option value="m³">m³</option>
                            <option value="Stk">Stk</option>
                            <option value="Std">Std</option>
                            <option value="Psch">Psch</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gewerk</label>
                          <select 
                            value={manualItem.trade_id}
                            onChange={(e) => setManualItem({ ...manualItem, trade_id: e.target.value })}
                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                          >
                            <option value="all">Standard</option>
                            {catalog.map(trade => (
                              <option key={trade.id} value={trade.id}>{trade.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zeitaufwand (h)</label>
                          <input 
                            type="number"
                            placeholder="0.0"
                            value={manualItem.labor_hours || ''}
                            onChange={(e) => setManualItem({ ...manualItem, labor_hours: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Materialpreis (€)</label>
                          <input 
                            type="number"
                            placeholder="0.00"
                            value={manualItem.material_price || ''}
                            onChange={(e) => setManualItem({ ...manualItem, material_price: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Beschreibung</label>
                        <textarea 
                          placeholder="Optionale Beschreibung..."
                          value={manualItem.description}
                          onChange={(e) => setManualItem({ ...manualItem, description: e.target.value })}
                          className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 min-h-[80px]"
                        />
                      </div>
                      <button 
                        onClick={handleAddManualItem}
                        disabled={!manualItem.name}
                        className="w-full py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Plus size={18} /> Leistung hinzufügen
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Show Tools Buttons */}
              <div className="flex flex-col gap-3">
                {!showCopyPrice && (
                  <button 
                    onClick={() => setShowCopyPrice(true)}
                    className="w-full py-4 bg-brand-dark text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-primary transition-all shadow-xl shadow-brand-dark/20 flex items-center justify-center gap-3"
                  >
                    <LinkIcon size={20} />
                    Copy & Price öffnen
                  </button>
                )}
                {!showManualEntry && (
                  <button 
                    onClick={() => setShowManualEntry(true)}
                    className="w-full py-4 bg-white text-brand-dark border border-slate-100 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-xl shadow-slate-200/50 flex items-center justify-center gap-3"
                  >
                    <Plus size={20} />
                    Manuelle Eingabe öffnen
                  </button>
                )}
              </div>

              <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden sticky top-8">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 space-y-4">
                  <h3 className="text-xl font-black text-brand-dark flex items-center gap-2">
                    <Search size={20} className="text-brand-primary" /> Katalog durchsuchen
                  </h3>
                  <div className="space-y-3">
                    <input 
                      type="text"
                      placeholder="Leistung suchen..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    />
                    <select 
                      value={selectedTradeId}
                      onChange={(e) => setSelectedTradeId(e.target.value)}
                      className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    >
                      <option value="all">Alle Gewerke</option>
                      {catalog.map(trade => (
                        <option key={trade.id} value={trade.id}>{trade.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-50">
                  {catalog
                    .filter(t => selectedTradeId === 'all' || t.id === selectedTradeId)
                    .flatMap(t => t.items.map(item => ({ ...item, tradeName: t.name })))
                    .filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(item => (
                      <div key={item.id} className="p-6 hover:bg-slate-50 transition-colors group">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-bold text-brand-dark text-sm leading-tight">{item.name}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{item.tradeName}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[10px] font-bold text-brand-primary flex items-center gap-1">
                                <Clock size={10} /> {item.labor_hours}h
                              </span>
                              <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                                <Euro size={10} /> {item.material_price}€
                              </span>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleAddItem(item)}
                            className="p-2 bg-brand-accent text-brand-primary rounded-xl hover:bg-brand-primary hover:text-white transition-all"
                          >
                            <Plus size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'preview' && selectedProject && (
          <motion.div 
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-4xl mx-auto space-y-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setView('edit')}
                  className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                >
                  <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                  Zurück zum Editor
                </button>
                <button 
                  onClick={() => {
                    setSelectedProject(null);
                    setView('list');
                  }}
                  className="flex items-center justify-center w-9 h-9 bg-white text-slate-400 hover:text-red-500 border border-slate-100 hover:border-red-100 rounded-xl transition-all shadow-sm"
                  title="Schließen"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20"
                >
                  <FileText size={16} /> PDF Drucken
                </button>
              </div>
            </div>

            {checkMeisterRequirement() && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border border-red-100 p-6 rounded-[2rem] flex items-center gap-6 print:hidden"
              >
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 shrink-0">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-red-900 tracking-tight">Meisterpflicht-Warnung</h4>
                  <p className="text-sm text-red-700 font-medium">
                    Dieses Projekt enthält Leistungen aus zulassungspflichtigen Gewerken (Anlage A). 
                    Laut Ihren Einstellungen verfügt Ihr Betrieb über keinen Meister. Bitte prüfen Sie die rechtliche Zulässigkeit.
                  </p>
                </div>
              </motion.div>
            )}

            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden print:shadow-none print:border-none">
              {/* PDF Header */}
              <div className="p-12 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between gap-8">
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center text-white font-black text-2xl">
                      {selectedProject.craftsman_name ? selectedProject.craftsman_name.charAt(0) : 'L'}
                    </div>
                    <div>
                      <h1 className="text-2xl font-black tracking-tighter text-brand-dark">
                        {selectedProject.craftsman_name || 'LOS Facility Service'}
                      </h1>
                      {selectedProject.craftsman_contact && (
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{selectedProject.craftsman_contact}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Kunde</p>
                    <p className="text-lg font-black text-brand-dark">{selectedProject.customer_name}</p>
                    <p className="text-sm text-slate-600 font-medium">{selectedProject.customer_address}</p>
                  </div>
                </div>
                <div className="text-right space-y-6">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Angebot Nr.</p>
                    <p className="text-lg font-black text-brand-dark">ANG-{selectedProject.id.toString().padStart(4, '0')}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Datum</p>
                    <p className="text-sm text-slate-600 font-medium">{new Date().toLocaleDateString('de-DE')}</p>
                  </div>
                </div>
              </div>

              {/* PDF Body */}
              <div className="p-12 space-y-12">
                <div className="space-y-4">
                  <h2 className="text-3xl font-black tracking-tighter text-brand-dark">Angebot: {selectedProject.name}</h2>
                  <p className="text-slate-600 leading-relaxed max-w-2xl">
                    Sehr geehrte Damen und Herren, vielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot für die geplanten Arbeiten:
                  </p>
                </div>

                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b-2 border-brand-dark">
                      <th className="py-4 font-black text-brand-dark text-xs uppercase tracking-widest">Pos.</th>
                      <th className="py-4 font-black text-brand-dark text-xs uppercase tracking-widest">Leistung</th>
                      <th className="py-4 font-black text-brand-dark text-xs uppercase tracking-widest text-right">Menge</th>
                      <th className="py-4 font-black text-brand-dark text-xs uppercase tracking-widest text-right">E-Preis</th>
                      <th className="py-4 font-black text-brand-dark text-xs uppercase tracking-widest text-right">Gesamt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedProject.items?.map((item, index) => {
                      const itemTotal = calculateItemTotal(item);
                      const ePrice = itemTotal / item.quantity;
                      return (
                        <tr key={item.id}>
                          <td className="py-6 align-top font-bold text-slate-400">{(index + 1).toString().padStart(2, '0')}</td>
                          <td className="py-6 pr-8">
                            <p className="font-black text-brand-dark">{item.name}</p>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
                          </td>
                          <td className="py-6 text-right align-top font-bold text-brand-dark whitespace-nowrap">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-6 text-right align-top font-bold text-slate-600 whitespace-nowrap">
                            {ePrice.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}
                          </td>
                          <td className="py-6 text-right align-top font-black text-brand-dark whitespace-nowrap">
                            {itemTotal.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="pt-12 border-t-2 border-brand-dark flex flex-col md:flex-row justify-between gap-12">
                  <div className="flex-1 space-y-4">
                    <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Bedingungen & Hinweise</h4>
                    <div className="text-xs text-slate-600 space-y-2">
                      {selectedProject.terms_and_conditions ? (
                        <p className="whitespace-pre-wrap">{selectedProject.terms_and_conditions}</p>
                      ) : (
                        <ul className="space-y-1">
                          <li>• Die Abrechnung erfolgt nach tatsächlichem Aufmaß.</li>
                          <li>• Zahlungsziel: 10 Tage nach Rechnungserhalt ohne Abzug.</li>
                          <li>• Alle Preise verstehen sich inkl. der gesetzlichen Mehrwertsteuer.</li>
                          <li>• Die Gültigkeit dieses Angebots beträgt 30 Kalendertage.</li>
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="w-full max-w-xs space-y-4">
                    <div className="flex justify-between items-center text-sm font-bold text-slate-500 uppercase tracking-widest">
                      <span>Summe Netto</span>
                      <span>{totals.net.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-slate-500 uppercase tracking-widest">
                      <span>MwSt. ({selectedProject.tax_rate}%)</span>
                      <span>{totals.tax.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                      <span className="text-lg font-black text-brand-dark">Gesamtbetrag</span>
                      <span className="text-2xl font-black text-brand-primary">{totals.gross.toLocaleString('de-DE', { style: 'currency', currency: selectedProject.currency || 'EUR' })}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-20 grid grid-cols-2 gap-12">
                  <div className="space-y-4">
                    <div className="h-px bg-slate-200 w-full" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ort, Datum</p>
                  </div>
                  <div className="space-y-4">
                    <div className="h-px bg-slate-200 w-full" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Unterschrift Kunde</p>
                  </div>
                </div>
              </div>

              {/* PDF Footer */}
              <div className="p-12 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-between gap-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <div className="space-y-1">
                  <p className="text-brand-dark">{selectedProject.craftsman_name || 'LOS Facility Service'}</p>
                  <p>{selectedProject.craftsman_contact || 'Hauptstraße 1, 82216 Maisach'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-brand-dark">Kontakt</p>
                  <p>{selectedProject.craftsman_contact || '+49 123 456789'}</p>
                  <p>info@los-facility.de</p>
                </div>
                <div className="space-y-1">
                  <p className="text-brand-dark">Bankverbindung</p>
                  <p>Sparkasse München</p>
                  <p>IBAN: DE12 3456 7890 1234 5678 90</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-center gap-4 no-print">
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-8 py-4 bg-brand-dark text-white rounded-2xl font-bold hover:bg-brand-primary transition-all shadow-xl shadow-brand-dark/20"
              >
                <Printer size={20} /> PDF Drucken
              </button>
              <button 
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-8 py-4 bg-white text-brand-dark border border-slate-200 rounded-2xl font-bold hover:bg-slate-50 transition-all"
              >
                <Download size={20} /> Herunterladen
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showSketchModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSketchModal(null)}
              className="absolute inset-0 bg-brand-dark/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-6xl h-[90vh] bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <SketchPad 
                initialData={showSketchModal.initialData}
                initialUnit={showSketchModal.unit}
                onClose={() => setShowSketchModal(null)}
                onSave={(data, dims) => {
                  handleUpdateItem(showSketchModal.itemId, {
                    sketch_data: data,
                    length: dims.length,
                    width: dims.width,
                    height: dims.height,
                    depth: dims.depth,
                    quantity: dims.quantity,
                    unit: dims.unit
                  });
                  setShowSketchModal(null);
                }}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Project Modal */}
      <AnimatePresence>
        {showNewProjectModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewProjectModal(false)}
              className="absolute inset-0 bg-brand-dark/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-2xl font-black tracking-tighter text-brand-dark">Neues Projekt</h3>
                <button onClick={() => setShowNewProjectModal(false)} className="text-slate-400 hover:text-brand-dark transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreateProject} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projektname</label>
                  <input 
                    required
                    type="text" 
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    placeholder="z.B. Sanierung Bad Müller"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-brand-dark"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kunde auswählen</label>
                  <select 
                    value={newProject.customer_id || ''}
                    onChange={(e) => {
                      const customerId = e.target.value || undefined;
                      const customer = customers.find(c => String(c.id) === customerId);
                      setNewProject({ 
                        ...newProject, 
                        customer_id: customerId,
                        customer_name: customer?.name || '',
                        customer_address: customer?.address || ''
                      });
                    }}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-brand-dark"
                  >
                    <option value="">-- Kunde wählen (Optional) --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.company || 'Privat'})</option>
                    ))}
                  </select>
                </div>

                {!newProject.customer_id && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kundenname (Manuell)</label>
                      <input 
                        type="text" 
                        value={newProject.customer_name}
                        onChange={(e) => setNewProject({ ...newProject, customer_name: e.target.value })}
                        placeholder="Max Mustermann"
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-brand-dark"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adresse (Manuell)</label>
                      <input 
                        type="text" 
                        value={newProject.customer_address}
                        onChange={(e) => setNewProject({ ...newProject, customer_address: e.target.value })}
                        placeholder="Musterstraße 1, 12345 Stadt"
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-brand-dark"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tags (z.B. Sanierung, Neubau)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {newProject.tags.map((tag, idx) => (
                      <span key={idx} className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-xs font-bold rounded-full flex items-center gap-2">
                        {tag}
                        <button 
                          type="button"
                          onClick={() => setNewProject({ ...newProject, tags: newProject.tags.filter((_, i) => i !== idx) })}
                          className="hover:text-brand-dark transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (tagInput.trim() && !newProject.tags.includes(tagInput.trim())) {
                            setNewProject({ ...newProject, tags: [...newProject.tags, tagInput.trim()] });
                            setTagInput('');
                          }
                        }
                      }}
                      placeholder="Tag hinzufügen..."
                      className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-brand-dark"
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        if (tagInput.trim() && !newProject.tags.includes(tagInput.trim())) {
                          setNewProject({ ...newProject, tags: [...newProject.tags, tagInput.trim()] });
                          setTagInput('');
                        }
                      }}
                      className="px-4 bg-brand-primary text-white rounded-2xl hover:bg-brand-primary/90 transition-all"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Währung</label>
                    <select 
                      value={newProject.currency}
                      onChange={(e) => setNewProject({ ...newProject, currency: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-brand-dark"
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CHF">CHF (Fr.)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MwSt. (%)</label>
                    <input 
                      type="number" 
                      value={newProject.tax_rate}
                      onChange={(e) => setNewProject({ ...newProject, tax_rate: parseFloat(e.target.value) })}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-brand-dark"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projektleiter</label>
                  <input 
                    type="text" 
                    value={newProject.project_manager}
                    onChange={(e) => setNewProject({ ...newProject, project_manager: e.target.value })}
                    placeholder="Name des Projektleiters"
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-brand-dark"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20"
                >
                  Projekt Erstellen
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Plan Analyzer Modal */}
      <AnimatePresence>
        {showPlanAnalyzer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPlanAnalyzer(false)}
              className="absolute inset-0 bg-brand-dark/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              <PlanAnalyzer onApplyResults={handleApplyPlanResults} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Target Price Confirmation Modal */}
      <AnimatePresence>
        {showTargetModal && targetPricePreview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
                    <Calculator size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-brand-dark">Zielpreis Vorschau</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kalkulations-Optimierung</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowTargetModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aktuelle Kosten (Netto)</p>
                    <p className="text-xl font-black text-brand-dark">{targetPricePreview.currentNet.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-brand-primary uppercase tracking-widest">Zielpreis (Netto)</p>
                    <p className="text-xl font-black text-brand-primary">{targetPricePreview.targetNet.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Berechneter Zuschlag</p>
                    <p className="text-3xl font-black text-brand-dark">+{targetPricePreview.markup.toFixed(2)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Differenz</p>
                    <p className="text-lg font-bold text-emerald-600">{(targetPricePreview.targetNet - targetPricePreview.currentNet).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowTargetModal(false)}
                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Verwerfen
                  </button>
                  <button 
                    onClick={() => handleCalculateTargetPrice(false)}
                    disabled={isCalculatingTarget}
                    className="flex-1 px-6 py-4 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2"
                  >
                    {isCalculatingTarget ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={20} />}
                    Anwenden
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          #preview-container, #preview-container * {
            visibility: visible;
          }
          #preview-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
