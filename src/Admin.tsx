import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Settings as SettingsIcon, 
  LogOut, 
  Save, 
  Plus, 
  Trash2, 
  Edit3,
  Check,
  X,
  ChevronRight,
  Lock,
  Download,
  CheckCircle2,
  HardHat,
  ClipboardList,
  Calendar,
  Users,
  Receipt,
  Clock,
  BarChart3,
  Pencil,
  Globe,
  Search,
  Euro,
  Database,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tabs } from './components/Tabs';
import { Modal } from './components/Modal';
import { Accordion } from './components/Accordion';
import LiveCalculator from './components/LiveCalculator';
import QuoteBuilder from './components/QuoteBuilder';
import ConstructionDiary from './components/ConstructionDiary';
import ChangeOrderManager from './components/ChangeOrderManager';
import InvoiceManager from './components/InvoiceManager';
import AdminDashboard from './components/AdminDashboard';
import ResourcePlanner from './components/ResourcePlanner';
import ProjectReport from './components/ProjectReport';
import CustomerManagement from './components/CustomerManagement';
import ProjectOverview from './components/ProjectOverview';
import ProjectVisualOverview from './components/ProjectVisualOverview';
import SketchPad from './components/SketchPad';
import ServiceCatalog from './components/ServiceCatalog';
import DatanormImport from './components/DatanormImport';
import DefectManager from './components/DefectManager';
import DocumentManager from './components/DocumentManager';
import WorkerApp from './components/WorkerApp';

const getEmbedUrl = (url: string) => {
  if (!url) return null;
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : url;
  }
  if (url.includes('vimeo.com')) {
    const regExp = /vimeo\.com\/(\d+)/;
    const match = url.match(regExp);
    return match ? `https://player.vimeo.com/video/${match[1]}` : url;
  }
  return null;
};

import { useAuth, TradeAttributeDefinition } from './App';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';

import { PILOT_TRADE_ATTRIBUTES } from './constants/tradeAttributes';

export type ContentMap = { [key: string]: string };
export type MediaItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  category: string;
  title: string;
  description: string;
  sort_order: number;
};

export default function Admin({ activeTabDefault }: { activeTabDefault?: 'dashboard' | 'projects_visual' | 'customers' | 'content' | 'media' | 'settings' | 'calc' | 'quotes' | 'rates' | 'diaries' | 'change-orders' | 'invoices' | 'resources' | 'reports' | 'projects' | 'sketches' | 'catalog' | 'users' | 'defects' | 'documents' | 'worker-app' }) {
  const { user, isAdmin, permissions, loading: authLoading, handleLogin, handleLogout } = useAuth();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [ratesSearchTerm, setRatesSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects_visual' | 'customers' | 'content' | 'media' | 'settings' | 'calc' | 'quotes' | 'rates' | 'diaries' | 'change-orders' | 'invoices' | 'resources' | 'reports' | 'projects' | 'sketches' | 'catalog' | 'users' | 'defects' | 'documents' | 'worker-app'>(activeTabDefault || 'dashboard');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null);
  const [laborRates, setLaborRates] = useState<any[]>([]);
  const [serviceItems, setServiceItems] = useState<any[]>([]);
  const [allLaborRates, setAllLaborRates] = useState<any[]>([]);
  const [newTrade, setNewTrade] = useState({ name: '', description: '', is_anlage_a: 0, attribute_definitions: [] as any[] });
  const [editingTrade, setEditingTrade] = useState<any>(null);
  const [showNewTradeForm, setShowNewTradeForm] = useState(false);
  const [newServiceItem, setNewServiceItem] = useState({
    name: '',
    unit: 'm²',
    labor_hours: 1,
    material_price: 0,
    description: '',
    sort_order: 0
  });
  const [showNewServiceForm, setShowNewServiceForm] = useState(false);
  const [showDatanormImport, setShowDatanormImport] = useState(false);
  const [editingServiceItem, setEditingServiceItem] = useState<any>(null);
  const [showServiceLibrary, setShowServiceLibrary] = useState(false);
  const [content, setContent] = useState<ContentMap>({});
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showRolesManager, setShowRolesManager] = useState(false);
  const [calcSubTab, setCalcSubTab] = useState<'trades' | 'rates'>('trades');
  const [catalogSubTab, setCatalogSubTab] = useState<'services' | 'trades'>('services');

  const hasPermission = (module: string, action: 'view' | 'edit' | 'delete' = 'view') => {
    if (!permissions) return true; // Default for super admin
    const modulePerms = permissions[module.toLowerCase()];
    if (!modulePerms) return false;
    return modulePerms[action];
  };
  const [userRole, setUserRole] = useState('user');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sketches, setSketches] = useState<{ id: string; title: string; data: string; date: string }[]>([]);
  const [currentSketch, setCurrentSketch] = useState<string | null>(null);

  const handleUpgrade = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, planId: 'pro' })
      });
      const data = await response.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: data.message || 'Fehler beim Starten des Upgrades.' });
      }
    } catch (err) {
      console.error('Upgrade Error:', err);
      setMessage({ type: 'error', text: 'Ein Fehler ist aufgetreten.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePortal = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid })
      });
      const data = await response.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: 'error', text: data.message || 'Fehler beim Öffnen des Portals.' });
      }
    } catch (err) {
      console.error('Portal Error:', err);
      setMessage({ type: 'error', text: 'Ein Fehler ist aufgetreten.' });
    } finally {
      setLoading(false);
    }
  };

  const [settings, setSettings] = useState<any>({
    company_name: '',
    company_address: '',
    company_vat_id: '',
    company_iban: '',
    has_master_craftsman: 0,
    maintenance_mode: 'false'
  });

  useEffect(() => {
    // Redirect to dashboard if no permission for current tab
    const tabToModule: Record<string, string> = {
      'content': 'content',
      'media': 'media',
      'settings': 'settings',
      'users': 'settings',
      'reports': 'settings',
      'sketches': 'settings',
      'calc': 'calculation',
      'rates': 'calculation',
      'catalog': 'calculation',
      'quotes': 'calculation',
      'projects': 'calculation',
      'projects_visual': 'calculation',
      'customers': 'calculation',
      'diaries': 'calculation',
      'change-orders': 'calculation',
      'invoices': 'calculation',
      'resources': 'calculation'
    };

    const module = tabToModule[activeTab];
    if (module && !hasPermission(module)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, permissions]);

  useEffect(() => {
    if (user) {
      fetchContent();
      fetchMedia();
      fetchTrades();
      fetchCatalog();
      fetchAllLaborRates();
      fetchRoles();
      fetchSettings();
      fetchUserProfile();
      fetchUsers();

      const params = new URLSearchParams(window.location.search);
      if (params.get('session_id')) {
        setMessage({ type: 'success', text: 'Vielen Dank! Ihr Abonnement wurde erfolgreich aktiviert.' });
        // Clean up URL
        const tab = params.get('tab');
        window.history.replaceState({}, document.title, window.location.pathname + (tab ? `?tab=${tab}` : ''));
      }
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/user/profile?userId=${user.uid}`);
      const data = await res.json();
      if (data.success) setUserProfile(data.user);
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) setUsersList(data.users);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const updateUserRole = async (userId: string, roleId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Benutzerrolle aktualisiert.' });
        fetchUsers();
      } else {
        setMessage({ type: 'error', text: data.message || 'Fehler beim Aktualisieren.' });
      }
    } catch (err) {
      console.error('Error updating user role:', err);
      setMessage({ type: 'error', text: 'Ein Fehler ist aufgetreten.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data) setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Einstellungen gespeichert' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setLoading(true);
      setTimeout(() => setLoading(false), 500);
    }
  };

  const [scrapeUrl, setScrapeUrl] = useState('');

  const handleScrape = async () => {
    if (!scrapeUrl || !selectedTrade) return;
    setLoading(true);
    try {
      const res = await fetch('/api/scrape-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: scrapeUrl })
      });
      const data = await res.json();
      if (data.success) {
        // Automatically add to service items
        const addRes = await fetch('/api/service-items', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trade_id: selectedTrade,
            name: data.title,
            unit: 'Stk',
            labor_hours: 0.5, // Default
            material_price: data.price,
            description: `Importiert von ${scrapeUrl}`
          })
        });
        if (addRes.ok) {
          setMessage({ type: 'success', text: 'Produkt erfolgreich hinzugefügt' });
          fetchTradeDetails(selectedTrade);
          setScrapeUrl('');
        }
      } else {
        setMessage({ type: 'error', text: data.message });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Scrapen' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await fetch('/api/catalog');
      const data = await res.json();
      setCatalog(data);
    } catch (err) {
      console.error('Error fetching catalog:', err);
    }
  };

  const fetchTrades = async () => {
    const res = await fetch('/api/trades');
    const data = await res.json();
    setTrades(data);
  };

  const fetchAllLaborRates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/labor-rates/all');
      setAllLaborRates(await res.json());
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Laden der Lohnsätze' });
    } finally {
      setLoading(false);
    }
  };

  const saveAllLaborRates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/labor-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates: allLaborRates })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Alle Lohnsätze gespeichert' });
        fetchAllLaborRates();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setLoading(false);
    }
  };

  const addServiceFromLibrary = async (item: any) => {
    if (!selectedTrade) return;
    setLoading(true);
    try {
      const res = await fetch('/api/service-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          unit: item.unit,
          labor_hours: item.labor_hours,
          material_price: item.material_price,
          description: item.description,
          trade_id: selectedTrade,
          sort_order: serviceItems.length
        })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Leistung aus Bibliothek hinzugefügt' });
        fetchTradeDetails(selectedTrade);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Hinzufügen' });
    } finally {
      setLoading(false);
    }
  };

  const fetchTradeDetails = async (tradeId: string | null) => {
    if (!tradeId) return;
    setSelectedTrade(tradeId);
    const [ratesRes, itemsRes] = await Promise.all([
      fetch(`/api/trades/${tradeId}/labor-rates`),
      fetch(`/api/trades/${tradeId}/service-items`)
    ]);
    setLaborRates(await ratesRes.json());
    setServiceItems(await itemsRes.json());
  };

  const createTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Auto-assign attributes if pilot trade
      const pilotAttrs = PILOT_TRADE_ATTRIBUTES[newTrade.name] || [];
      const tradeToCreate = { 
        ...newTrade, 
        attribute_definitions: newTrade.attribute_definitions.length > 0 ? newTrade.attribute_definitions : pilotAttrs 
      };

      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tradeToCreate)
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: 'Gewerk erfolgreich erstellt' });
        setNewTrade({ name: '', description: '', is_anlage_a: 0, attribute_definitions: [] });
        setShowNewTradeForm(false);
        fetchTrades();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Erstellen' });
    } finally {
      setLoading(false);
    }
  };

  const updateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrade) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/trades/${editingTrade.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: editingTrade.name, 
          description: editingTrade.description,
          is_anlage_a: editingTrade.is_anlage_a
        })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Gewerk aktualisiert' });
        setEditingTrade(null);
        fetchTrades();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren' });
    } finally {
      setLoading(false);
    }
  };

  const deleteTrade = async (id: string) => {
    if (confirm('Möchten Sie dieses Gewerk wirklich löschen? Alle zugehörigen Lohnsätze und Leistungen gehen verloren.')) {
      setLoading(true);
      try {
        const res = await fetch(`/api/trades/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setMessage({ type: 'success', text: 'Gewerk gelöscht' });
          if (selectedTrade === id) setSelectedTrade(null);
          fetchTrades();
          fetchAllLaborRates();
        }
      } catch (err) {
        setMessage({ type: 'error', text: 'Fehler beim Löschen' });
      } finally {
        setLoading(false);
      }
    }
  };

  const saveLaborRates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/labor-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates: laborRates })
      });
      if (res.ok) setMessage({ type: 'success', text: 'Lohnsätze gespeichert' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setLoading(false);
    }
  };

  const createServiceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrade) return;
    setLoading(true);
    try {
      const res = await fetch('/api/service-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newServiceItem,
          trade_id: selectedTrade
        })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Leistung erfolgreich hinzugefügt' });
        setNewServiceItem({
          name: '',
          unit: 'm²',
          labor_hours: 1,
          material_price: 0,
          description: '',
          sort_order: serviceItems.length
        });
        setShowNewServiceForm(false);
        fetchTradeDetails(selectedTrade);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Erstellen' });
    } finally {
      setLoading(false);
    }
  };

  const updateServiceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServiceItem) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/service-items/${editingServiceItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingServiceItem)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Leistung aktualisiert' });
        setEditingServiceItem(null);
        if (selectedTrade) fetchTradeDetails(selectedTrade);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren' });
    } finally {
      setLoading(false);
    }
  };

  const quickUpdateServiceItem = async (item: any) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/service-items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Leistung aktualisiert' });
        if (selectedTrade) fetchTradeDetails(selectedTrade);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Aktualisieren' });
    } finally {
      setLoading(false);
    }
  };

  const deleteServiceItem = async (id: string) => {
    if (confirm('Möchten Sie diese Leistung wirklich löschen?')) {
      setLoading(true);
      try {
        const res = await fetch(`/api/service-items/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setMessage({ type: 'success', text: 'Leistung gelöscht' });
          if (selectedTrade) fetchTradeDetails(selectedTrade);
        }
      } catch (err) {
        setMessage({ type: 'error', text: 'Fehler beim Löschen' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTrade) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/trades/${selectedTrade}/import-csv`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setMessage({ type: 'success', text: `${data.count || 0} Leistungen erfolgreich importiert` });
        fetchTradeDetails(selectedTrade);
      } else {
        const errorData = await res.json();
        setMessage({ type: 'error', text: errorData.message || 'Import fehlgeschlagen' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Import fehlgeschlagen' });
    } finally {
      setLoading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const downloadCsvTemplate = () => {
    const headers = 'name,unit,labor_hours,material_price,description';
    const examples = [
      'Wandanstrich Innen (weiß),m²,0.25,4.50,Standard Innenanstrich mit Dispersionsfarbe inkl. Abkleben',
      'Fassadenanstrich (Silikonharz),m²,0.45,8.20,Hochwertiger Außenanstrich wetterbeständig',
      'Tapezieren (Raufaser),m²,0.60,3.50,Anbringen von Raufasertapete inkl. Kleister',
      'Grundierung (Tiefgrund),m²,0.10,1.50,Vorbereitung des Untergrunds für Folgeanstriche',
      'Trockenbauwand (einfach beplankt),m²,1.20,25.00,Ständerwerk inkl. Dämmung und Gipsplatten'
    ].join('\n');
    const blob = new Blob([`${headers}\n${examples}`], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'los_facility_lv_vorlage.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const fetchContent = async () => {
    const res = await fetch('/api/content');
    const data = await res.json();
    setContent(data);
  };

  const fetchMedia = async () => {
    const res = await fetch('/api/media');
    const data = await res.json();
    setMedia(data);
  };

  const fetchRoles = async () => {
    const res = await fetch('/api/roles');
    const data = await res.json();
    setRoles(data);
  };

  const saveRole = async (role: any) => {
    setLoading(true);
    try {
      const res = await fetch(role.id ? `/api/roles/${role.id}` : '/api/roles', {
        method: role.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Rolle gespeichert' });
        fetchRoles();
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setLoading(false);
    }
  };

  const deleteRole = async (id: number) => {
    if (confirm('Rolle wirklich löschen?')) {
      await fetch(`/api/roles/${id}`, { method: 'DELETE' });
      fetchRoles();
    }
  };

  const saveContent = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (res.ok) setMessage({ type: 'success', text: 'Inhalte gespeichert' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Fehler beim Speichern' });
    } finally {
      setLoading(false);
    }
  };

  const addMedia = async (type: 'image' | 'video') => {
    const newItem = {
      type,
      url: '',
      category: 'gallery',
      title: 'Neues Element',
      description: '',
      sort_order: media.length
    };
    const res = await fetch('/api/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem)
    });
    if (res.ok) fetchMedia();
  };

  const updateMedia = async (item: MediaItem) => {
    await fetch(`/api/media/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    setMessage({ type: 'success', text: 'Medien aktualisiert' });
    fetchMedia();
  };

  const deleteMedia = async (id: string) => {
    if (confirm('Möchten Sie dieses Element wirklich löschen?')) {
      await fetch(`/api/media/${id}`, { method: 'DELETE' });
      fetchMedia();
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-12 border border-slate-100"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-brand-dark rounded-2xl flex items-center justify-center text-brand-primary shadow-xl">
              <Lock size={32} />
            </div>
          </div>
          <h1 className="text-3xl font-black text-brand-dark text-center mb-2 tracking-tighter">
            {!user ? 'Admin Login' : 'Zugriff verweigert'}
          </h1>
          <p className="text-slate-400 text-center mb-10 font-medium">
            {!user 
              ? 'Los Facility Service Management' 
              : 'Sie haben keine Administrator-Berechtigungen.'}
          </p>
          
          {!user ? (
            <button 
              onClick={handleLogin}
              className="w-full bg-brand-dark text-white rounded-2xl py-4 font-bold hover:bg-brand-primary transition-all shadow-xl shadow-brand-dark/20 flex items-center justify-center gap-3"
            >
              <Globe size={20} />
              Mit Google anmelden
            </button>
          ) : (
            <button 
              onClick={handleLogout}
              className="w-full bg-red-500 text-white rounded-2xl py-4 font-bold hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 flex items-center justify-center gap-3"
            >
              <LogOut size={20} />
              Abmelden
            </button>
          )}

          <div className="mt-8 pt-8 border-t border-slate-100 flex justify-center">
            <a href="/" className="text-sm font-bold text-brand-primary hover:underline">Zurück zur Website</a>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Sidebar */}
      <aside className="w-80 bg-brand-dark text-white p-8 flex flex-col">
        <div className="flex items-center gap-4 mb-16">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white shadow-lg">
            <LayoutDashboard size={20} />
          </div>
          <span className="text-xl font-black tracking-tighter uppercase">Admin Panel</span>
        </div>

        <nav className="flex-1 space-y-2">
          <SidebarLink 
            id="admin-sidebar-back-to-site"
            active={false} 
            onClick={() => window.location.href = '/'}
            icon={<Globe size={20} />}
            label="Zur Website"
            className="mb-8 border-b border-white/10 pb-4"
          />
          <SidebarLink 
            id="admin-sidebar-dashboard"
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
          />
          {hasPermission('calculation') && (
            <>
              <SidebarLink 
                id="admin-sidebar-projects-visual"
                active={activeTab === 'projects_visual'} 
                onClick={() => setActiveTab('projects_visual')}
                icon={<BarChart3 size={20} />}
                label="Projekt-Übersicht"
              />
              <SidebarLink 
                id="admin-sidebar-projects"
                active={activeTab === 'projects'} 
                onClick={() => setActiveTab('projects')}
                icon={<ClipboardList size={20} />}
                label="Projekt-Liste"
              />
              <SidebarLink 
                id="admin-sidebar-customers"
                active={activeTab === 'customers'} 
                onClick={() => setActiveTab('customers')}
                icon={<Users size={20} />}
                label="Kunden (CRM)"
              />
            </>
          )}
          {hasPermission('content') && (
            <SidebarLink 
              id="admin-sidebar-content"
              active={activeTab === 'content'} 
              onClick={() => setActiveTab('content')}
              icon={<FileText size={20} />}
              label="Inhalte"
            />
          )}
          {hasPermission('media') && (
            <SidebarLink 
              id="admin-sidebar-media"
              active={activeTab === 'media'} 
              onClick={() => setActiveTab('media')}
              icon={<ImageIcon size={20} />}
              label="Medien"
            />
          )}
          {hasPermission('calculation') && (
            <>
              <SidebarLink 
                id="admin-sidebar-catalog"
                active={activeTab === 'catalog'} 
                onClick={() => setActiveTab('catalog')}
                icon={<ClipboardList size={20} />}
                label="Service-Katalog"
              />
              <SidebarLink 
                id="admin-sidebar-calc"
                active={activeTab === 'calc'} 
                onClick={() => setActiveTab('calc')}
                icon={<HardHat size={20} />}
                label="Gewerke-Verwaltung"
              />
              <SidebarLink 
                id="admin-sidebar-rates"
                active={activeTab === 'rates'} 
                onClick={() => setActiveTab('rates')}
                icon={<Euro size={20} />}
                label="Lohnsätze"
              />
              <SidebarLink 
                id="admin-sidebar-quotes"
                active={activeTab === 'quotes'} 
                onClick={() => {
                  setSelectedProjectId(null);
                  setActiveTab('quotes');
                }}
                icon={<FileText size={20} />}
                label="Angebots-Builder"
              />
              <SidebarLink 
                id="admin-sidebar-diaries"
                active={activeTab === 'diaries'} 
                onClick={() => setActiveTab('diaries')}
                icon={<ClipboardList size={20} />}
                label="Bautagebuch"
              />
              <SidebarLink 
                id="admin-sidebar-defects"
                active={activeTab === 'defects'} 
                onClick={() => setActiveTab('defects')}
                icon={<AlertCircle size={20} />}
                label="Mängel"
              />
              <SidebarLink 
                id="admin-sidebar-documents"
                active={activeTab === 'documents'} 
                onClick={() => setActiveTab('documents')}
                icon={<FileText size={20} />}
                label="Dokumente"
              />
              <SidebarLink 
                id="admin-sidebar-change-orders"
                active={activeTab === 'change-orders'} 
                onClick={() => setActiveTab('change-orders')}
                icon={<Clock size={20} />}
                label="Nachträge"
              />
              <SidebarLink 
                id="admin-sidebar-invoices"
                active={activeTab === 'invoices'} 
                onClick={() => setActiveTab('invoices')}
                icon={<Receipt size={20} />}
                label="Rechnungswesen"
              />
              <SidebarLink 
                id="admin-sidebar-resources"
                active={activeTab === 'resources'} 
                onClick={() => setActiveTab('resources')}
                icon={<Users size={20} />}
                label="Ressourcen"
              />
              <SidebarLink 
                id="admin-sidebar-worker-app"
                active={activeTab === 'worker-app'} 
                onClick={() => setActiveTab('worker-app')}
                icon={<HardHat size={20} />}
                label="Mitarbeiter-App"
              />
            </>
          )}
          {hasPermission('settings') && (
            <>
              <SidebarLink 
                id="admin-sidebar-users"
                active={activeTab === 'users'} 
                onClick={() => setActiveTab('users')}
                icon={<Users size={20} />}
                label="Benutzerverwaltung"
              />
              <SidebarLink 
                id="admin-sidebar-reports"
                active={activeTab === 'reports'} 
                onClick={() => setActiveTab('reports')}
                icon={<BarChart3 size={20} />}
                label="Berichte"
              />
              <SidebarLink 
                id="admin-sidebar-sketches"
                active={activeTab === 'sketches'} 
                onClick={() => setActiveTab('sketches')}
                icon={<Pencil size={20} />}
                label="Skizzen"
              />
              <SidebarLink 
                id="admin-sidebar-settings"
                active={activeTab === 'settings'} 
                onClick={() => setActiveTab('settings')}
                icon={<SettingsIcon size={20} />}
                label="Einstellungen"
              />
            </>
          )}
        </nav>

        <button 
          onClick={handleLogout}
          className="mt-auto flex items-center gap-4 text-white/40 hover:text-white transition-colors font-bold text-sm uppercase tracking-widest"
        >
          <LogOut size={20} />
          Abmelden
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-12 overflow-y-auto">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => window.location.href = '/'}
                className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                title="Zurück zur Website"
              >
                <Globe size={18} className="group-hover:scale-110 transition-transform" />
                Website
              </button>
              {activeTab !== 'dashboard' && (
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                  title="Zurück zum Dashboard"
                >
                  <ChevronRight size={18} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                  Dashboard
                </button>
              )}
            </div>
            <div>
              <h2 className="text-4xl font-black text-brand-dark tracking-tighter">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'projects' && 'Projektübersicht'}
              {activeTab === 'content' && 'Website Inhalte'}
              {activeTab === 'media' && 'Medien Management'}
              {activeTab === 'calc' && 'Leistungskatalog'}
              {activeTab === 'rates' && 'Lohnsätze'}
              {activeTab === 'quotes' && 'Angebots-Builder'}
              {activeTab === 'diaries' && 'Bautagebuch'}
              {activeTab === 'change-orders' && 'Nachtragsmanagement'}
              {activeTab === 'invoices' && 'Rechnungswesen'}
              {activeTab === 'resources' && 'Ressourcenplanung'}
              {activeTab === 'reports' && 'Projektberichte'}
              {activeTab === 'sketches' && 'Skizzen & Visualisierung'}
              {activeTab === 'settings' && 'System Einstellungen'}
              {activeTab === 'users' && 'Benutzerverwaltung'}
            </h2>
            <p className="text-slate-400 font-medium mt-2">Verwalten Sie Ihre Webseite in Echtzeit.</p>
          </div>
        </div>
        <button 
          onClick={saveContent}
            disabled={loading}
            className="bg-brand-primary text-white px-8 py-4 rounded-2xl font-bold hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 flex items-center gap-3"
          >
            <Save size={20} />
            {loading ? 'Speichern...' : 'Änderungen Speichern'}
          </button>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AdminDashboard 
                onSelectProject={(id: string) => {
                  setSelectedProjectId(id);
                  setActiveTab('quotes');
                }} 
                onViewDiary={(id: string) => {
                  setSelectedProjectId(id);
                  setActiveTab('diaries');
                }}
              />
            </motion.div>
          )}

          {activeTab === 'projects_visual' && (
            <motion.div 
              key="projects_visual"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ProjectVisualOverview 
                onEditProject={(id: string) => {
                  setSelectedProjectId(id);
                  setActiveTab('quotes');
                }} 
                onViewDiary={(id: string) => {
                  setSelectedProjectId(id);
                  setActiveTab('diaries');
                }}
                onViewChangeOrders={(id: string) => {
                  setSelectedProjectId(id);
                  setActiveTab('change-orders');
                }}
              />
            </motion.div>
          )}

          {activeTab === 'projects' && (
            <motion.div 
              key="projects"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ProjectOverview 
                onEditProject={(id: string) => {
                  setSelectedProjectId(id);
                  setActiveTab('quotes');
                }} 
                onViewDiary={(id: string) => {
                  setSelectedProjectId(id);
                  setActiveTab('diaries');
                }}
                onViewChangeOrders={(id: string) => {
                  setSelectedProjectId(id);
                  setActiveTab('change-orders');
                }}
              />
            </motion.div>
          )}

          {activeTab === 'customers' && (
            <motion.div 
              key="customers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <CustomerManagement />
            </motion.div>
          )}

          {activeTab === 'sketches' && (
            <div className="h-[calc(100vh-12rem)] flex gap-6">
              <div className="flex-1">
                <SketchPad 
                  initialData={currentSketch || undefined}
                  onSave={(data, dims) => {
                    const newSketch = {
                      id: Math.random().toString(36).substr(2, 9),
                      title: dims?.areaName || `Skizze ${sketches.length + 1}`,
                      data,
                      date: new Date().toLocaleString('de-DE'),
                      dimensions: dims
                    };
                    setSketches(prev => [newSketch, ...prev]);
                    setMessage({ type: 'success', text: 'Skizze erfolgreich gespeichert!' });
                  }}
                />
              </div>
              <div className="w-80 bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase tracking-widest text-brand-dark">Gespeicherte Skizzen</h3>
                  <button 
                    onClick={() => setCurrentSketch(null)}
                    className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl hover:bg-brand-primary/20 transition-all"
                    title="Neue Skizze"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {sketches.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
                      <p className="text-xs font-bold uppercase tracking-widest">Keine Skizzen vorhanden</p>
                    </div>
                  ) : (
                    sketches.map(sketch => (
                      <button
                        key={sketch.id}
                        onClick={() => setCurrentSketch(sketch.data)}
                        className={`w-full p-4 rounded-2xl border transition-all text-left group ${currentSketch === sketch.data ? 'bg-brand-primary/5 border-brand-primary shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-brand-primary/30'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black text-brand-dark uppercase tracking-widest truncate">{sketch.title}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSketches(prev => prev.filter(s => s.id !== sketch.id));
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="aspect-video bg-white rounded-xl border border-slate-200 overflow-hidden mb-2">
                          <img src={sketch.data} alt={sketch.title} className="w-full h-full object-contain" />
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{sketch.date}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <motion.div 
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 gap-8"
            >
              {Object.entries(content).map(([key, value]) => (
                <div key={key} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{key.replace(/_/g, ' ')}</label>
                  <textarea 
                    value={value}
                    onChange={e => setContent({ ...content, [key]: e.target.value })}
                    className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-medium text-brand-dark min-h-[100px]"
                  />
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'media' && (
            <motion.div 
              key="media"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="flex gap-4">
                <button 
                  onClick={() => addMedia('image')}
                  className="bg-white border-2 border-dashed border-slate-200 p-6 rounded-[2rem] flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-brand-primary hover:text-brand-primary transition-all group"
                >
                  <Plus size={32} className="group-hover:scale-110 transition-transform" />
                  <span className="font-bold uppercase tracking-widest text-xs">Foto hinzufügen</span>
                </button>
                <button 
                  onClick={() => addMedia('video')}
                  className="bg-white border-2 border-dashed border-slate-200 p-6 rounded-[2rem] flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-brand-primary hover:text-brand-primary transition-all group"
                >
                  <Video size={32} className="group-hover:scale-110 transition-transform" />
                  <span className="font-bold uppercase tracking-widest text-xs">Video hinzufügen</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {media.map(item => (
                  <div key={item.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.type === 'video' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                          {item.type === 'video' ? <Video size={20} /> : <ImageIcon size={20} />}
                        </div>
                        <div>
                          <h4 className="font-bold text-brand-dark">{item.title}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.category}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => deleteMedia(item.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>

                    <div className="aspect-video rounded-2xl overflow-hidden bg-slate-100 mb-6 relative group/preview">
                      {item.type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center">
                          {getEmbedUrl(item.url) ? (
                            <iframe 
                              src={getEmbedUrl(item.url)!} 
                              className="w-full h-full border-none"
                              allowFullScreen
                            />
                          ) : (
                            <div className="text-slate-400 flex flex-col items-center gap-2">
                              <Video size={32} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Video Vorschau nicht verfügbar</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <img 
                          src={item.url} 
                          alt={item.title} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/error/800/600';
                          }}
                        />
                      )}
                    </div>

                    <div className="space-y-4">
                      <input 
                        type="text" 
                        value={item.url}
                        onChange={e => {
                          const newMedia = media.map(m => m.id === item.id ? { ...m, url: e.target.value } : m);
                          setMedia(newMedia);
                        }}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-xl py-3 px-4 outline-none transition-all text-sm font-medium"
                        placeholder="URL (Unsplash, YouTube, etc.)"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <select 
                          value={item.category}
                          onChange={e => {
                            const newMedia = media.map(m => m.id === item.id ? { ...m, category: e.target.value } : m);
                            setMedia(newMedia);
                          }}
                          className="bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-xl py-3 px-4 outline-none transition-all text-sm font-medium"
                        >
                          <option value="gallery">Galerie</option>
                          <option value="hero">Hero</option>
                          <option value="service">Service</option>
                        </select>
                        <input 
                          type="number" 
                          value={item.sort_order}
                          onChange={e => {
                            const newMedia = media.map(m => m.id === item.id ? { ...m, sort_order: parseInt(e.target.value) } : m);
                            setMedia(newMedia);
                          }}
                          className="bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-xl py-3 px-4 outline-none transition-all text-sm font-medium"
                          placeholder="Sortierung"
                        />
                      </div>
                      <button 
                        onClick={() => updateMedia(item)}
                        className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all"
                      >
                        Aktualisieren
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'catalog' && (
            <motion.div 
              key="catalog"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                  <div>
                    <h4 className="text-3xl font-black text-brand-dark tracking-tighter">Zentraler Service-Katalog</h4>
                    <p className="text-slate-400 text-sm font-medium">Verwalten Sie hier alle Leistungen und Gewerke gewerkeübergreifend.</p>
                  </div>
                </div>

                <Tabs 
                  tabs={[
                    {
                      id: 'services',
                      label: 'Leistungen',
                      icon: <ClipboardList size={16} />,
                      content: (
                        <div className="space-y-8">
                          <div className="flex justify-end">
                            <button 
                              onClick={() => setShowDatanormImport(!showDatanormImport)}
                              className="flex items-center gap-2 bg-brand-secondary text-white px-6 py-3 rounded-2xl font-bold hover:bg-brand-dark transition-all text-sm uppercase tracking-widest shadow-xl shadow-brand-secondary/20"
                            >
                              <Database size={18} />
                              Datanorm Import
                            </button>
                          </div>

                          <AnimatePresence>
                            {showDatanormImport && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="mb-12 overflow-hidden"
                              >
                                <DatanormImport onComplete={() => { fetchCatalog(); fetchTrades(); }} />
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <ServiceCatalog 
                            adminMode={true} 
                            catalog={catalog} 
                            onUpdate={() => { fetchCatalog(); fetchTrades(); }} 
                          />
                        </div>
                      )
                    },
                    {
                      id: 'trades',
                      label: 'Gewerke-Verwaltung',
                      icon: <HardHat size={16} />,
                      content: (
                        <div className="space-y-12">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
                            <div>
                              <h4 className="text-xl font-black text-brand-dark tracking-tighter">Verfügbare Gewerke</h4>
                              <p className="text-slate-400 text-xs font-medium">Verwalten Sie Ihre Gewerke und deren Eigenschaften.</p>
                            </div>
                            <div className="flex items-center gap-4 w-full md:w-auto">
                              <button 
                                onClick={async () => {
                                  if (confirm('Möchten Sie die Pilot-Daten (Maler, Elektriker, etc.) wirklich laden? Dies kann zu Duplikaten führen.')) {
                                    setLoading(true);
                                    try {
                                      const res = await fetch('/api/seed-catalog', { method: 'POST' });
                                      const data = await res.json();
                                      if (data.success) {
                                        alert(data.message);
                                        window.location.reload();
                                      }
                                    } catch (err) {
                                      alert('Fehler beim Laden der Pilot-Daten.');
                                    } finally {
                                      setLoading(false);
                                    }
                                  }
                                }}
                                className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-bold hover:bg-slate-200 transition-all text-sm uppercase tracking-widest"
                              >
                                <Download size={18} />
                                Pilot-Daten laden
                              </button>
                              <div className="relative flex-1 md:w-64">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                  type="text" 
                                  placeholder="Gewerke suchen..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-brand-primary/30 transition-all text-sm font-medium"
                                />
                              </div>
                              <button 
                                onClick={() => setShowNewTradeForm(!showNewTradeForm)}
                                className="flex items-center gap-2 bg-brand-dark text-white px-6 py-3 rounded-2xl font-bold hover:bg-brand-primary transition-all text-sm uppercase tracking-widest whitespace-nowrap"
                              >
                                <Plus size={18} />
                                Neu
                              </button>
                            </div>
                          </div>

                          <AnimatePresence>
                            {showNewTradeForm && (
                              <motion.form 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                onSubmit={createTrade}
                                className="mb-12 p-8 bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden"
                              >
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                  <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Name des Gewerks</label>
                                    <input 
                                      type="text" 
                                      required
                                      value={newTrade.name}
                                      onChange={e => setNewTrade({ ...newTrade, name: e.target.value })}
                                      className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-brand-primary/30 transition-all font-bold"
                                      placeholder="z.B. Bodenleger"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Beschreibung</label>
                                    <input 
                                      type="text" 
                                      value={newTrade.description}
                                      onChange={e => setNewTrade({ ...newTrade, description: e.target.value })}
                                      className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-brand-primary/30 transition-all font-bold"
                                      placeholder="Kurze Beschreibung"
                                    />
                                  </div>
                                  <div className="flex items-end pb-3">
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                      <div className="relative">
                                        <input 
                                          type="checkbox" 
                                          checked={newTrade.is_anlage_a === 1}
                                          onChange={e => setNewTrade({ ...newTrade, is_anlage_a: e.target.checked ? 1 : 0 })}
                                          className="sr-only"
                                        />
                                        <div className={`w-12 h-6 rounded-full transition-colors ${newTrade.is_anlage_a ? 'bg-brand-primary' : 'bg-slate-200'}`}></div>
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${newTrade.is_anlage_a ? 'translate-x-6' : ''}`}></div>
                                      </div>
                                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest group-hover:text-brand-primary transition-colors">Meisterpflicht (Anlage A)</span>
                                    </label>
                                  </div>
                                </div>
                                <div className="flex gap-4">
                                  <button 
                                    type="submit"
                                    disabled={loading}
                                    className="bg-brand-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-dark transition-all"
                                  >
                                    {loading ? 'Speichern...' : 'Gewerk Speichern'}
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => setShowNewTradeForm(false)}
                                    className="bg-slate-200 text-slate-600 px-8 py-3 rounded-xl font-bold hover:bg-slate-300 transition-all"
                                  >
                                    Abbrechen
                                  </button>
                                </div>
                              </motion.form>
                            )}
                          </AnimatePresence>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {trades
                              .filter(t => 
                                t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                t.description?.toLowerCase().includes(searchTerm.toLowerCase())
                              )
                              .map((trade) => (
                                <div key={trade.id} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 hover:border-brand-primary/30 transition-all group">
                                  <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:bg-brand-primary group-hover:text-white transition-all">
                                      <HardHat size={24} />
                                    </div>
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={() => setEditingTrade(trade)}
                                        className="p-2 text-slate-400 hover:text-brand-primary transition-colors"
                                      >
                                        <Edit3 size={18} />
                                      </button>
                                      <button 
                                        onClick={() => deleteTrade(trade.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    </div>
                                  </div>
                                  <h5 className="text-lg font-black text-brand-dark tracking-tighter mb-1">{trade.name}</h5>
                                  <p className="text-slate-400 text-xs font-medium mb-4 line-clamp-2">{trade.description || 'Keine Beschreibung'}</p>
                                  <div className="flex items-center gap-2">
                                    {trade.is_anlage_a === 1 && (
                                      <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-widest rounded-full">
                                        Meisterpflicht
                                      </span>
                                    )}
                                    <span className="px-3 py-1 bg-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest rounded-full">
                                      {trade.attribute_definitions?.length || 0} Attribute
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )
                    }
                  ]}
                  activeTab={catalogSubTab}
                  onTabChange={(id) => setCatalogSubTab(id as 'services' | 'trades')}
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'calc' && (
            <motion.div 
              key="calc"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100">
              <Tabs 
                tabs={[
                  {
                    id: 'trades',
                    label: 'Gewerke & Leistungen',
                    icon: <LayoutDashboard size={16} />,
                    content: (
                      <div className="space-y-12">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
                          <div>
                            <h4 className="text-xl font-black text-brand-dark tracking-tighter">Verfügbare Gewerke</h4>
                            <p className="text-slate-400 text-xs font-medium">Verwalten Sie Ihre Gewerke und Leistungen.</p>
                          </div>
                          <div className="flex items-center gap-4 w-full md:w-auto">
                            <button 
                              onClick={async () => {
                                if (confirm('Möchten Sie die Pilot-Daten (Maler, Elektriker, etc.) wirklich laden? Dies kann zu Duplikaten führen.')) {
                                  setLoading(true);
                                  try {
                                    const res = await fetch('/api/seed-catalog', { method: 'POST' });
                                    const data = await res.json();
                                    if (data.success) {
                                      alert(data.message);
                                      window.location.reload();
                                    }
                                  } catch (err) {
                                    alert('Fehler beim Laden der Pilot-Daten.');
                                  } finally {
                                    setLoading(false);
                                  }
                                }
                              }}
                              className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-3 rounded-2xl font-bold hover:bg-slate-200 transition-all text-sm uppercase tracking-widest whitespace-nowrap"
                            >
                              Pilot-Daten laden
                            </button>
                            <div className="relative flex-1 md:w-64">
                              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                              <input 
                                type="text" 
                                placeholder="Gewerke suchen..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-brand-primary/30 transition-all text-sm font-medium"
                              />
                            </div>
                            <button 
                              onClick={() => setShowNewTradeForm(!showNewTradeForm)}
                              className="flex items-center gap-2 bg-brand-dark text-white px-6 py-3 rounded-2xl font-bold hover:bg-brand-primary transition-all text-sm uppercase tracking-widest whitespace-nowrap"
                            >
                              <Plus size={18} />
                              Neu
                            </button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {showNewTradeForm && (
                            <motion.form 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              onSubmit={createTrade}
                              className="mb-12 p-8 bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                <div>
                                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Name des Gewerks</label>
                                  <input 
                                    type="text" 
                                    required
                                    value={newTrade.name}
                                    onChange={e => setNewTrade({ ...newTrade, name: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-brand-primary/30 transition-all font-bold"
                                    placeholder="z.B. Bodenleger"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Beschreibung</label>
                                  <input 
                                    type="text" 
                                    value={newTrade.description}
                                    onChange={e => setNewTrade({ ...newTrade, description: e.target.value })}
                                    className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-brand-primary/30 transition-all font-bold"
                                    placeholder="Kurze Beschreibung"
                                  />
                                </div>
                                <div className="flex items-end pb-3">
                                  <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                      <input 
                                        type="checkbox" 
                                        checked={newTrade.is_anlage_a === 1}
                                        onChange={e => setNewTrade({ ...newTrade, is_anlage_a: e.target.checked ? 1 : 0 })}
                                        className="sr-only"
                                      />
                                      <div className={`w-12 h-6 rounded-full transition-colors ${newTrade.is_anlage_a ? 'bg-brand-primary' : 'bg-slate-200'}`}></div>
                                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${newTrade.is_anlage_a ? 'translate-x-6' : ''}`}></div>
                                    </div>
                                    <span className="text-xs font-bold text-slate-600 uppercase tracking-widest group-hover:text-brand-primary transition-colors">Meisterpflicht (Anlage A)</span>
                                  </label>
                                </div>
                              </div>
                              <div className="flex gap-4">
                                <button 
                                  type="submit"
                                  disabled={loading}
                                  className="bg-brand-primary text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-dark transition-all"
                                >
                                  {loading ? 'Speichern...' : 'Gewerk Speichern'}
                                </button>
                                <button 
                                  type="button"
                                  onClick={() => setShowNewTradeForm(false)}
                                  className="bg-slate-200 text-slate-600 px-8 py-3 rounded-xl font-bold hover:bg-slate-300 transition-all"
                                >
                                  Abbrechen
                                </button>
                              </div>
                            </motion.form>
                          )}
                        </AnimatePresence>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {trades
                            .filter(t => 
                              t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              t.description?.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .map(trade => (
                            <div 
                              key={trade.id}
                              className={`relative p-6 rounded-2xl border-2 transition-all text-left flex flex-col justify-between ${selectedTrade === trade.id ? 'border-brand-primary bg-brand-primary/5' : 'border-slate-100 hover:border-brand-primary/30'}`}
                            >
                              <div onClick={() => fetchTradeDetails(trade.id)} className="cursor-pointer flex-1">
                                <div className="flex justify-between items-start">
                                  <h4 className="font-bold text-brand-dark">{trade.name}</h4>
                                  {trade.is_anlage_a === 1 && (
                                    <span className="text-[8px] bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Anlage A</span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{trade.description}</p>
                              </div>
                              <div className="mt-4 flex gap-2 pt-4 border-t border-slate-100">
                                <button 
                                  onClick={() => setEditingTrade(trade)}
                                  className="p-2 text-slate-400 hover:text-brand-primary transition-colors"
                                  title="Bearbeiten"
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button 
                                  onClick={() => deleteTrade(trade.id)}
                                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                  title="Löschen"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {selectedTrade && (
                          <div className="mt-12 space-y-8">
                            <div className="flex items-center gap-4">
                              <button 
                                onClick={() => setSelectedTrade(null)}
                                className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                              >
                                <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                                Zurück zur Gewerke-Übersicht
                              </button>
                              <button 
                                onClick={() => setSelectedTrade(null)}
                                className="flex items-center justify-center w-9 h-9 bg-white text-slate-400 hover:text-red-500 border border-slate-100 hover:border-red-100 rounded-xl transition-all shadow-sm"
                                title="Schließen"
                              >
                                <X size={18} />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100">
                              <div className="flex justify-between items-center mb-8">
                                <div className="flex flex-col">
                                  <h4 className="text-xl font-black text-brand-dark tracking-tighter">Lohnsätze (€/Std)</h4>
                                  {(userRole.toLowerCase() === 'superadmin' || userRole.toLowerCase() === 'content manager') && (
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                                      <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                                      Auto-Save Aktiv
                                    </span>
                                  )}
                                </div>
                                <button onClick={saveLaborRates} className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-xl hover:bg-brand-dark transition-all font-bold text-xs uppercase tracking-widest">
                                  <Save size={16} />
                                  Speichern
                                </button>
                              </div>
                              <div className="space-y-4">
                                {laborRates.map(rate => (
                                  <div key={rate.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                                    <span className="font-bold text-slate-600">{rate.worker_type}</span>
                                    <input 
                                      type="number" 
                                      value={rate.hourly_rate}
                                      onChange={e => setLaborRates(prev => prev.map(r => r.id === rate.id ? { ...r, hourly_rate: parseFloat(e.target.value) } : r))}
                                      onBlur={() => {
                                        if (userRole.toLowerCase() === 'superadmin' || userRole.toLowerCase() === 'content manager') {
                                          saveLaborRates();
                                        }
                                      }}
                                      className="w-24 bg-white border border-slate-200 rounded-lg p-2 text-right font-bold focus:border-brand-primary outline-none transition-all"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100">
                              <div className="flex justify-between items-center mb-8">
                                <h4 className="text-xl font-black text-brand-dark tracking-tighter">Leistungsverzeichnis</h4>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => setShowServiceLibrary(true)}
                                    className="p-2 bg-brand-secondary text-white rounded-xl hover:bg-brand-dark transition-all flex items-center gap-2 px-4 text-xs font-bold uppercase tracking-widest"
                                  >
                                    <Search size={16} /> Bibliothek
                                  </button>
                                  <button 
                                    onClick={() => setShowNewServiceForm(!showNewServiceForm)}
                                    className="p-2 bg-brand-primary text-white rounded-xl hover:bg-brand-dark transition-all flex items-center gap-2 px-4 text-xs font-bold uppercase tracking-widest"
                                  >
                                    <Plus size={16} /> Neu
                                  </button>
                                  <div className="flex items-center gap-2">
                                    <div className="flex bg-slate-50 rounded-xl overflow-hidden border border-slate-200 focus-within:border-brand-primary/30 transition-all">
                                      <input 
                                        type="text" 
                                        value={scrapeUrl}
                                        onChange={e => setScrapeUrl(e.target.value)}
                                        placeholder="Produkt URL (Copy & Price)"
                                        className="bg-transparent px-4 py-2 text-xs outline-none w-48"
                                      />
                                    </div>
                                    <button 
                                      onClick={handleScrape}
                                      className="bg-brand-secondary text-white px-8 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-brand-dark hover:scale-105 active:scale-95 transition-all shadow-xl shadow-brand-secondary/20 flex items-center gap-2"
                                    >
                                      <Check size={16} />
                                      Übernehmen
                                    </button>
                                  </div>
                                  <input 
                                    type="file" 
                                    id="csv-upload" 
                                    className="hidden" 
                                    accept=".csv"
                                    onChange={handleCsvImport}
                                  />
                                  <label 
                                    htmlFor="csv-upload"
                                    className="p-2 bg-brand-dark text-white rounded-xl hover:bg-brand-primary transition-all flex items-center gap-2 px-4 text-xs font-bold uppercase tracking-widest cursor-pointer"
                                  >
                                    <Plus size={16} /> CSV
                                  </label>
                                  <button 
                                    onClick={downloadCsvTemplate}
                                    className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 px-4 text-xs font-bold uppercase tracking-widest"
                                    title="CSV Vorlage herunterladen"
                                  >
                                    <Download size={16} /> Vorlage
                                  </button>
                                </div>
                              </div>

                              <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-3">
                                <div className="text-amber-600 mt-0.5">
                                  <CheckCircle2 size={16} />
                                </div>
                                <p className="text-[10px] font-medium text-amber-800 leading-relaxed">
                                  <span className="font-bold block mb-1">CSV Format Info:</span>
                                  Die Datei muss folgende Spalten enthalten: <code className="bg-white/50 px-1 rounded">name, unit, labor_hours, material_price, description</code>. 
                                  Nutzen Sie die Vorlage für einen reibungslosen Import.
                                </p>
                              </div>

                              <AnimatePresence>
                                {showNewServiceForm && (
                                  <motion.form 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    onSubmit={createServiceItem}
                                    className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden space-y-4"
                                  >
                                    <div className="flex items-center justify-between mb-4">
                                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Neue Leistung hinzufügen</h4>
                                      <div className="flex items-center gap-2">
                                        <button 
                                          type="button"
                                          onClick={() => setShowNewServiceForm(false)}
                                          className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-3 py-1.5 rounded-xl font-bold text-[8px] uppercase tracking-widest transition-all shadow-sm group"
                                        >
                                          <ChevronRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                                          Zurück
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => setShowNewServiceForm(false)}
                                          className="flex items-center justify-center w-8 h-8 bg-white text-slate-400 hover:text-red-500 border border-slate-100 hover:border-red-100 rounded-xl transition-all shadow-sm"
                                        >
                                          <X size={16} />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="col-span-2">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Name</label>
                                        <input 
                                          type="text" 
                                          required
                                          value={newServiceItem.name}
                                          onChange={e => setNewServiceItem({ ...newServiceItem, name: e.target.value })}
                                          className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none focus:border-brand-primary/30 transition-all text-sm font-bold"
                                          placeholder="z.B. Wandanstrich"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Einheit</label>
                                        <select 
                                          required
                                          value={newServiceItem.unit}
                                          onChange={e => setNewServiceItem({ ...newServiceItem, unit: e.target.value })}
                                          className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none focus:border-brand-primary/30 transition-all text-sm font-bold"
                                        >
                                          <option value="m²">m²</option>
                                          <option value="lfm">lfm</option>
                                          <option value="Stk">Stk</option>
                                          <option value="m³">m³</option>
                                          <option value="Std">Std</option>
                                          <option value="Pkg">Pkg</option>
                                          <option value="t">t</option>
                                          <option value="Pauschal">Pauschal</option>
                                        </select>
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Zeit (h)</label>
                                        <input 
                                          type="number" 
                                          step="0.01"
                                          required
                                          value={newServiceItem.labor_hours}
                                          onChange={e => setNewServiceItem({ ...newServiceItem, labor_hours: parseFloat(e.target.value) })}
                                          className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none focus:border-brand-primary/30 transition-all text-sm font-bold"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Material (€)</label>
                                        <input 
                                          type="number" 
                                          step="0.01"
                                          required
                                          value={newServiceItem.material_price}
                                          onChange={e => setNewServiceItem({ ...newServiceItem, material_price: parseFloat(e.target.value) })}
                                          className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none focus:border-brand-primary/30 transition-all text-sm font-bold"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sortierung</label>
                                        <input 
                                          type="number" 
                                          value={newServiceItem.sort_order}
                                          onChange={e => setNewServiceItem({ ...newServiceItem, sort_order: parseInt(e.target.value) })}
                                          className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none focus:border-brand-primary/30 transition-all text-sm font-bold"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Beschreibung</label>
                                      <textarea 
                                        value={newServiceItem.description}
                                        onChange={e => setNewServiceItem({ ...newServiceItem, description: e.target.value })}
                                        className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 outline-none focus:border-brand-primary/30 transition-all text-sm font-medium min-h-[60px]"
                                      />
                                    </div>
                                    <div className="flex gap-2">
                                      <button 
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 bg-brand-primary text-white py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-dark transition-all"
                                      >
                                        Hinzufügen
                                      </button>
                                      <button 
                                        type="button"
                                        onClick={() => setShowNewServiceForm(false)}
                                        className="flex-1 bg-slate-200 text-slate-600 py-2 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-300 transition-all"
                                      >
                                        Abbrechen
                                      </button>
                                    </div>
                                  </motion.form>
                                )}
                              </AnimatePresence>

                              <div className="overflow-x-auto max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                  <thead className="sticky top-0 bg-white z-10">
                                    <tr className="border-b border-slate-100">
                                      <th className="py-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Leistung</th>
                                      <th className="py-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Einheit</th>
                                      <th className="py-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zeit (h)</th>
                                      <th className="py-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mat (€)</th>
                                      <th className="py-3 px-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aktion</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {serviceItems.map(item => (
                                      <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group/item">
                                        <td className="py-4 px-2 font-bold text-brand-dark text-sm leading-tight max-w-[200px]">{item.name}</td>
                                        <td className="py-4 px-2 text-[10px] font-black text-brand-primary uppercase">{item.unit}</td>
                                        <td className="py-4 px-2">
                                          <input 
                                            type="number"
                                            step="0.01"
                                            value={item.labor_hours}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value);
                                              const updatedItems = serviceItems.map(si => si.id === item.id ? { ...si, labor_hours: isNaN(val) ? 0 : val } : si);
                                              setServiceItems(updatedItems);
                                            }}
                                            className="w-20 bg-white border border-slate-200 rounded-xl p-2 text-right font-black text-brand-primary focus:border-brand-primary outline-none transition-all text-xs shadow-sm"
                                          />
                                        </td>
                                        <td className="py-4 px-2">
                                          <input 
                                            type="number"
                                            step="0.01"
                                            value={item.material_price}
                                            onChange={(e) => {
                                              const val = parseFloat(e.target.value);
                                              const updatedItems = serviceItems.map(si => si.id === item.id ? { ...si, material_price: isNaN(val) ? 0 : val } : si);
                                              setServiceItems(updatedItems);
                                            }}
                                            className="w-20 bg-white border border-slate-200 rounded-xl p-2 text-right font-black text-emerald-600 focus:border-brand-primary outline-none transition-all text-xs shadow-sm"
                                          />
                                        </td>
                                        <td className="py-4 px-2">
                                          <div className="flex items-center gap-2">
                                            <button 
                                              onClick={() => quickUpdateServiceItem(item)}
                                              className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                                              title="Speichern"
                                            >
                                              <Save size={14} />
                                            </button>
                                            <button 
                                              onClick={() => setEditingServiceItem(item)}
                                              className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                                              title="Bearbeiten"
                                            >
                                              <Edit3 size={14} />
                                            </button>
                                            <button 
                                              onClick={() => deleteServiceItem(item.id)}
                                              className="p-2 bg-slate-100 text-slate-400 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                              title="Löschen"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      </div>
                    )
                  },
                  {
                    id: 'preview',
                      label: 'Vorschau & Test',
                      icon: <Globe size={16} />,
                      content: (
                        <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100">
                          <div className="mb-12">
                            <h3 className="text-2xl font-black text-brand-dark tracking-tighter mb-2">Vorschau & Test</h3>
                            <p className="text-slate-400 font-medium">Testen Sie hier den Live-Kalkulator, wie er auf der Webseite erscheint.</p>
                          </div>
                          <div className="max-w-5xl mx-auto">
                            <LiveCalculator />
                          </div>
                        </div>
                      )
                    }
                  ]} 
                />
              </div>
              
              <Modal
                isOpen={!!editingTrade}
                onClose={() => setEditingTrade(null)}
                showBackButton={true}
                onBack={() => setEditingTrade(null)}
                title="Gewerk bearbeiten"
              >
                <form onSubmit={updateTrade} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Name</label>
                    <input 
                      type="text" 
                      required
                      value={editingTrade?.name || ''}
                      onChange={e => setEditingTrade({ ...editingTrade, name: e.target.value })}
                      className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Beschreibung</label>
                    <textarea 
                      value={editingTrade?.description || ''}
                      onChange={e => setEditingTrade({ ...editingTrade, description: e.target.value })}
                      className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-medium min-h-[100px]"
                    />
                  </div>
                  <div className="flex items-center gap-4 py-2">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input 
                          type="checkbox"
                          checked={editingTrade?.is_anlage_a === 1}
                          onChange={e => setEditingTrade({ ...editingTrade, is_anlage_a: e.target.checked ? 1 : 0 })}
                          className="sr-only peer"
                        />
                        <div className={`w-12 h-6 rounded-full transition-colors ${editingTrade?.is_anlage_a === 1 ? 'bg-brand-primary' : 'bg-slate-200'}`}></div>
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${editingTrade?.is_anlage_a === 1 ? 'translate-x-6' : ''}`}></div>
                      </div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest group-hover:text-brand-primary transition-colors">Meisterpflicht (Anlage A)</span>
                    </label>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-brand-primary text-white py-4 rounded-2xl font-bold hover:bg-brand-dark transition-all"
                    >
                      Speichern
                    </button>
                    <button 
                      type="button"
                      onClick={() => setEditingTrade(null)}
                      className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Abbrechen
                    </button>
                  </div>
                </form>
              </Modal>

              <Modal
                isOpen={!!editingServiceItem}
                onClose={() => setEditingServiceItem(null)}
                showBackButton={true}
                onBack={() => setEditingServiceItem(null)}
                title="Leistung bearbeiten"
                size="lg"
              >
                <form onSubmit={updateServiceItem} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Name</label>
                      <input 
                        type="text" 
                        required
                        value={editingServiceItem?.name || ''}
                        onChange={e => setEditingServiceItem({ ...editingServiceItem, name: e.target.value })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Einheit</label>
                      <select 
                        required
                        value={editingServiceItem?.unit || 'm²'}
                        onChange={e => setEditingServiceItem({ ...editingServiceItem, unit: e.target.value })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold"
                      >
                        <option value="m²">m²</option>
                        <option value="lfm">lfm</option>
                        <option value="Stk">Stk</option>
                        <option value="m³">m³</option>
                        <option value="Std">Std</option>
                        <option value="Pkg">Pkg</option>
                        <option value="t">t</option>
                        <option value="Pauschal">Pauschal</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Sortierung</label>
                      <input 
                        type="number" 
                        value={editingServiceItem?.sort_order || 0}
                        onChange={e => setEditingServiceItem({ ...editingServiceItem, sort_order: parseInt(e.target.value) })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Zeitaufwand (h)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={editingServiceItem?.labor_hours || 0}
                        onChange={e => setEditingServiceItem({ ...editingServiceItem, labor_hours: parseFloat(e.target.value) })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Materialkosten (€)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        required
                        value={editingServiceItem?.material_price || 0}
                        onChange={e => setEditingServiceItem({ ...editingServiceItem, material_price: parseFloat(e.target.value) })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Beschreibung</label>
                    <textarea 
                      value={editingServiceItem?.description || ''}
                      onChange={e => setEditingServiceItem({ ...editingServiceItem, description: e.target.value })}
                      className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-medium min-h-[80px]"
                    />
                  </div>
                  <div className="flex gap-4">
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-brand-primary text-white py-4 rounded-2xl font-bold hover:bg-brand-dark transition-all"
                    >
                      Speichern
                    </button>
                    <button 
                      type="button"
                      onClick={() => setEditingServiceItem(null)}
                      className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Abbrechen
                    </button>
                  </div>
                </form>
              </Modal>
              
              <Modal
                isOpen={showServiceLibrary}
                onClose={() => setShowServiceLibrary(false)}
                showBackButton={true}
                onBack={() => setShowServiceLibrary(false)}
                title="Leistungsbibliothek"
                size="full"
              >
                <div className="p-4">
                  <p className="text-slate-400 mb-6 font-medium">Wählen Sie eine Leistung aus der Bibliothek aus, um sie dem Gewerk <span className="text-brand-primary font-bold">{trades.find(t => t.id === selectedTrade)?.name}</span> hinzuzufügen.</p>
                  <ServiceCatalog 
                    onSelect={(item) => {
                      addServiceFromLibrary(item);
                      setShowServiceLibrary(false);
                    }} 
                  />
                </div>
              </Modal>
              
            </motion.div>
          )}

          {activeTab === 'rates' && (
            <motion.div 
              key="rates"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
                      <HardHat size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Lohnsätze pro Gewerk</h3>
                      <p className="text-slate-400 font-medium">Verwalten Sie die Stundenverrechnungssätze für verschiedene Mitarbeiter-Typen.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input 
                        type="text" 
                        placeholder="Gewerke suchen..."
                        value={ratesSearchTerm}
                        onChange={(e) => setRatesSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-brand-primary/30 transition-all text-sm font-medium"
                      />
                    </div>
                    <button 
                      onClick={saveAllLaborRates}
                      className="flex items-center gap-2 px-8 py-4 bg-brand-primary text-white rounded-2xl font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20 whitespace-nowrap"
                    >
                      <Save size={20} /> Änderungen Speichern
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-6 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Gewerk</th>
                        <th className="text-left py-6 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Meister (€/h)</th>
                        <th className="text-left py-6 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Geselle (€/h)</th>
                        <th className="text-left py-6 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Helfer (€/h)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {trades
                        .filter(t => t.name.toLowerCase().includes(ratesSearchTerm.toLowerCase()))
                        .map(trade => {
                        const meister = allLaborRates.find(r => r.trade_id === trade.id && r.worker_type === 'Meister');
                        const geselle = allLaborRates.find(r => r.trade_id === trade.id && r.worker_type === 'Geselle');
                        const helfer = allLaborRates.find(r => r.trade_id === trade.id && r.worker_type === 'Helfer');

                        return (
                          <tr key={trade.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-6 px-4">
                              <div className="font-black text-brand-dark">{trade.name}</div>
                              <div className="text-xs text-slate-400">{trade.description}</div>
                            </td>
                            <td className="py-6 px-4">
                              {meister ? (
                                <div className="relative">
                                  <input 
                                    type="number"
                                    value={meister.hourly_rate}
                                    onChange={(e) => setAllLaborRates(prev => prev.map(r => r.id === meister.id ? { ...r, hourly_rate: parseFloat(e.target.value) || 0 } : r))}
                                    className="w-32 bg-white border border-slate-200 rounded-xl p-3 pl-8 text-right font-black text-brand-primary focus:border-brand-primary outline-none transition-all shadow-sm"
                                  />
                                  <Euro size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                </div>
                              ) : (
                                <span className="text-xs text-slate-300 italic">Nicht definiert</span>
                              )}
                            </td>
                            <td className="py-6 px-4">
                              {geselle ? (
                                <div className="relative">
                                  <input 
                                    type="number"
                                    value={geselle.hourly_rate}
                                    onChange={(e) => setAllLaborRates(prev => prev.map(r => r.id === geselle.id ? { ...r, hourly_rate: parseFloat(e.target.value) || 0 } : r))}
                                    className="w-32 bg-white border border-slate-200 rounded-xl p-3 pl-8 text-right font-black text-brand-primary focus:border-brand-primary outline-none transition-all shadow-sm"
                                  />
                                  <Euro size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                </div>
                              ) : (
                                <span className="text-xs text-slate-300 italic">Nicht definiert</span>
                              )}
                            </td>
                            <td className="py-6 px-4">
                              {helfer ? (
                                <div className="relative">
                                  <input 
                                    type="number"
                                    value={helfer.hourly_rate}
                                    onChange={(e) => setAllLaborRates(prev => prev.map(r => r.id === helfer.id ? { ...r, hourly_rate: parseFloat(e.target.value) || 0 } : r))}
                                    className="w-32 bg-white border border-slate-200 rounded-xl p-3 pl-8 text-right font-black text-brand-primary focus:border-brand-primary outline-none transition-all shadow-sm"
                                  />
                                  <Euro size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                                </div>
                              ) : (
                                <span className="text-xs text-slate-300 italic">Nicht definiert</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
          {activeTab === 'quotes' && (
            <motion.div 
              key="quotes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <QuoteBuilder 
                initialProjectId={selectedProjectId || undefined} 
                initialView={selectedProjectId ? 'edit' : 'list'} 
                userId={user?.uid}
              />
            </motion.div>
          )}

          {activeTab === 'diaries' && (
            <motion.div 
              key="diaries"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ConstructionDiary initialProjectId={selectedProjectId} />
            </motion.div>
          )}

          {activeTab === 'change-orders' && (
            <motion.div 
              key="change-orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ChangeOrderManager initialProjectId={selectedProjectId} />
            </motion.div>
          )}

          {activeTab === 'invoices' && (
            <motion.div 
              key="invoices"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <InvoiceManager />
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ProjectReport />
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div 
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-6 mb-12">
                  <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
                    <Users size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Benutzerverwaltung</h3>
                    <p className="text-slate-400 font-medium">Verwalten Sie Systembenutzer und weisen Sie Rollen zu.</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-6 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Benutzer</th>
                        <th className="text-left py-6 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Email</th>
                        <th className="text-left py-6 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Aktuelle Rolle</th>
                        <th className="text-left py-6 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Aktion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {usersList.map(userItem => (
                        <tr key={userItem.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-6 px-4">
                            <div className="font-black text-brand-dark">
                              {userItem.first_name} {userItem.last_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">ID: {userItem.id}</div>
                          </td>
                          <td className="py-6 px-4">
                            <div className="text-sm font-medium text-slate-600">{userItem.email}</div>
                          </td>
                          <td className="py-6 px-4">
                            <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-widest">
                              {roles.find(r => r.id === userItem.role)?.name || userItem.role || 'Keine Rolle'}
                            </span>
                          </td>
                          <td className="py-6 px-4">
                            <select 
                              value={userItem.role || ''}
                              onChange={(e) => updateUserRole(userItem.id, e.target.value)}
                              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-brand-dark outline-none focus:border-brand-primary transition-all"
                            >
                              <option value="">Rolle wählen...</option>
                              {roles.map(role => (
                                <option key={role.id} value={role.id}>{role.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'defects' && (
            <motion.div key="defects" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <DefectManager />
            </motion.div>
          )}

          {activeTab === 'documents' && (
            <motion.div key="documents" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <DocumentManager />
            </motion.div>
          )}

          {activeTab === 'worker-app' && (
            <motion.div key="worker-app" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <WorkerApp />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
                      <SettingsIcon size={32} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Globale Einstellungen</h3>
                      <p className="text-slate-400 font-medium">Konfigurieren Sie Systemparameter und Benutzerberechtigungen.</p>
                    </div>
                  </div>
                  {showRolesManager && (
                    <button 
                      onClick={() => setShowRolesManager(false)}
                      className="text-slate-400 hover:text-brand-dark font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                    >
                      <X size={16} /> Schließen
                    </button>
                  )}
                </div>

                {!showRolesManager ? (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl">
                      <div>
                        <h4 className="font-bold text-brand-dark">Wartungsmodus</h4>
                        <p className="text-sm text-slate-400">Webseite für Besucher vorübergehend sperren.</p>
                      </div>
                      <button 
                        onClick={() => setSettings({ ...settings, maintenance_mode: settings.maintenance_mode === 'true' ? 'false' : 'true' })}
                        className={`w-14 h-8 rounded-full relative transition-all ${settings.maintenance_mode === 'true' ? 'bg-brand-primary' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-all ${settings.maintenance_mode === 'true' ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl">
                      <div>
                        <h4 className="font-bold text-brand-dark">Benutzer-Rollen</h4>
                        <p className="text-sm text-slate-400">Rollen und Berechtigungen verwalten.</p>
                      </div>
                      <button 
                        onClick={() => setShowRolesManager(true)}
                        className="text-brand-primary font-bold text-sm uppercase tracking-widest hover:text-brand-dark transition-colors"
                      >
                        Verwalten
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl">
                      <div>
                        <h4 className="font-bold text-brand-dark">Kostenpflichtige Angebote</h4>
                        <p className="text-sm text-slate-400">Angebote nach dem ersten kostenlosen Angebot kostenpflichtig machen.</p>
                      </div>
                      <button 
                        onClick={() => setSettings({ ...settings, paid_offers_enabled: settings.paid_offers_enabled === 'true' ? 'false' : 'true' })}
                        className={`w-14 h-8 rounded-full relative transition-all ${settings.paid_offers_enabled === 'true' ? 'bg-brand-primary' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-all ${settings.paid_offers_enabled === 'true' ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl">
                      <div>
                        <h4 className="font-bold text-brand-dark">Meister im Betrieb</h4>
                        <p className="text-sm text-slate-400">Geben Sie an, ob ein Meister für zulassungspflichtige Gewerke (Anlage A) vorhanden ist.</p>
                      </div>
                      <button 
                        onClick={() => setSettings({ ...settings, has_master_craftsman: settings.has_master_craftsman === '1' ? '0' : '1' })}
                        className={`w-14 h-8 rounded-full relative transition-all ${settings.has_master_craftsman === '1' ? 'bg-brand-primary' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-sm transition-all ${settings.has_master_craftsman === '1' ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl">
                      <div>
                        <h4 className="font-bold text-brand-dark">Abonnement & Abrechnung</h4>
                        <p className="text-sm text-slate-400">Verwalten Sie Ihren SaaS-Tarif (Stripe).</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right mr-4">
                          <p className="text-xs font-bold text-brand-dark uppercase tracking-widest">
                            Tarif: {userProfile?.plan === 'pro' ? 'Profi' : userProfile?.plan === 'enterprise' ? 'Enterprise' : 'Basis'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            Status: {userProfile?.subscription_status === 'active' ? 'Aktiv' : 'Inaktiv'}
                          </p>
                        </div>
                        {userProfile?.subscription_status === 'active' ? (
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full uppercase tracking-widest">Aktiviert</span>
                            <button 
                              onClick={handlePortal}
                              disabled={loading}
                              className="text-brand-primary font-bold text-sm uppercase tracking-widest hover:text-brand-dark transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {loading ? 'Laden...' : (
                                <>
                                  <SettingsIcon size={14} />
                                  Verwalten
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4">
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1 rounded-full uppercase tracking-widest">Basis</span>
                            <button 
                              onClick={handleUpgrade}
                              disabled={loading}
                              className="text-brand-primary font-bold text-sm uppercase tracking-widest hover:text-brand-dark transition-colors disabled:opacity-50"
                            >
                              {loading ? 'Laden...' : 'Upgrade'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Company Settings for E-Invoicing */}
                    <div id="admin-settings-company-data" className="p-8 bg-slate-50 rounded-[2rem] border border-slate-200">
                      <h4 className="text-xl font-black text-brand-dark tracking-tighter mb-6">Unternehmensdaten (E-Rechnung)</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Firmenname</label>
                          <input 
                            id="settings-company-name"
                            type="text" 
                            value={settings.company_name}
                            onChange={e => setSettings({ ...settings, company_name: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-brand-primary transition-all font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">USt-ID</label>
                          <input 
                            type="text" 
                            value={settings.company_vat_id}
                            onChange={e => setSettings({ ...settings, company_vat_id: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-brand-primary transition-all font-bold"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Adresse</label>
                          <textarea 
                            value={settings.company_address}
                            onChange={e => setSettings({ ...settings, company_address: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-brand-primary transition-all font-medium min-h-[80px]"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">IBAN</label>
                          <input 
                            type="text" 
                            value={settings.company_iban}
                            onChange={e => setSettings({ ...settings, company_iban: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-brand-primary transition-all font-bold"
                          />
                        </div>
                        <div className="md:col-span-2 flex items-center gap-4 py-2">
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="relative">
                              <input 
                                type="checkbox"
                                checked={settings.has_master_craftsman === 1}
                                onChange={e => setSettings({ ...settings, has_master_craftsman: e.target.checked ? 1 : 0 })}
                                className="sr-only peer"
                              />
                              <div className="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:bg-brand-primary transition-all after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-6" />
                            </div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest group-hover:text-brand-primary transition-colors">Meister im Betrieb vorhanden</span>
                          </label>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Benutzerdefiniertes CSS (CSS Selector Funktionalität)</label>
                          <p className="text-[10px] text-slate-400 mb-2 font-medium">Hier können Sie CSS-Regeln eingeben, um das Design der Anwendung anzupassen. Nutzen Sie CSS-Selektoren, um gezielt Elemente anzusprechen.</p>
                          <textarea 
                            id="settings-custom-css"
                            value={settings.custom_css || ''}
                            onChange={e => setSettings({ ...settings, custom_css: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-2xl py-3 px-4 outline-none focus:border-brand-primary transition-all font-mono text-sm min-h-[200px]"
                            placeholder=".my-custom-class { color: red; }"
                          />
                        </div>
                      </div>
                      <button 
                        id="settings-save-btn"
                        onClick={saveSettings}
                        disabled={loading}
                        className="mt-8 bg-brand-dark text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-primary transition-all"
                      >
                        Einstellungen speichern
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-12">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xl font-black text-brand-dark tracking-tighter">Rollen-Management</h4>
                      <button 
                        onClick={() => saveRole({ 
                          name: 'Neue Rolle', 
                          permissions: { 
                            content: { view: true, edit: false }, 
                            media: { view: true, edit: false, delete: false },
                            calc: { view: true, edit: false },
                            settings: { view: false, edit: false }
                          } 
                        })}
                        className="bg-brand-dark text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-primary transition-all flex items-center gap-2"
                      >
                        <Plus size={16} /> Rolle hinzufügen
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {roles.map(role => (
                        <div key={role.id} className="p-8 bg-slate-50 rounded-[2rem] border border-slate-200">
                          <div className="flex justify-between items-start mb-8">
                            <input 
                              type="text" 
                              value={role.name}
                              onChange={e => setRoles(roles.map(r => r.id === role.id ? { ...r, name: e.target.value } : r))}
                              className="text-xl font-black text-brand-dark bg-transparent border-b-2 border-transparent focus:border-brand-primary outline-none px-2 py-1"
                            />
                            <div className="flex gap-2">
                              <button 
                                onClick={() => saveRole(role)}
                                className="p-2 bg-brand-primary text-white rounded-lg hover:bg-brand-dark transition-all"
                                title="Speichern"
                              >
                                <Save size={18} />
                              </button>
                              <button 
                                onClick={() => deleteRole(role.id)}
                                className="p-2 bg-white text-slate-300 hover:text-red-500 rounded-lg border border-slate-200 transition-all"
                                title="Löschen"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {/* Content Permissions */}
                            <div className="space-y-4">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Inhalte</h5>
                              <PermissionToggle 
                                label="Ansehen" 
                                active={role.permissions.content.view} 
                                onChange={val => {
                                  const newRoles = roles.map(r => r.id === role.id ? { ...r, permissions: { ...r.permissions, content: { ...r.permissions.content, view: val } } } : r);
                                  setRoles(newRoles);
                                }}
                              />
                              <PermissionToggle 
                                label="Bearbeiten" 
                                active={role.permissions.content.edit} 
                                onChange={val => {
                                  const newRoles = roles.map(r => r.id === role.id ? { ...r, permissions: { ...r.permissions, content: { ...r.permissions.content, edit: val } } } : r);
                                  setRoles(newRoles);
                                }}
                              />
                            </div>

                            {/* Media Permissions */}
                            <div className="space-y-4">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Medien</h5>
                              <PermissionToggle 
                                label="Ansehen" 
                                active={role.permissions.media.view} 
                                onChange={val => {
                                  const newRoles = roles.map(r => r.id === role.id ? { ...r, permissions: { ...r.permissions, media: { ...r.permissions.media, view: val } } } : r);
                                  setRoles(newRoles);
                                }}
                              />
                              <PermissionToggle 
                                label="Bearbeiten" 
                                active={role.permissions.media.edit} 
                                onChange={val => {
                                  const newRoles = roles.map(r => r.id === role.id ? { ...r, permissions: { ...r.permissions, media: { ...r.permissions.media, edit: val } } } : r);
                                  setRoles(newRoles);
                                }}
                              />
                              <PermissionToggle 
                                label="Löschen" 
                                active={role.permissions.media.delete} 
                                onChange={val => {
                                  const newRoles = roles.map(r => r.id === role.id ? { ...r, permissions: { ...r.permissions, media: { ...r.permissions.media, delete: val } } } : r);
                                  setRoles(newRoles);
                                }}
                              />
                            </div>

                            {/* Calculation Permissions */}
                            <div className="space-y-4">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Kalkulation</h5>
                              <PermissionToggle 
                                label="Ansehen" 
                                active={role.permissions.calc.view} 
                                onChange={val => {
                                  const newRoles = roles.map(r => r.id === role.id ? { ...r, permissions: { ...r.permissions, calc: { ...r.permissions.calc, view: val } } } : r);
                                  setRoles(newRoles);
                                }}
                              />
                              <PermissionToggle 
                                label="Bearbeiten" 
                                active={role.permissions.calc.edit} 
                                onChange={val => {
                                  const newRoles = roles.map(r => r.id === role.id ? { ...r, permissions: { ...r.permissions, calc: { ...r.permissions.calc, edit: val } } } : r);
                                  setRoles(newRoles);
                                }}
                              />
                            </div>

                            {/* Settings Permissions */}
                            <div className="space-y-4">
                              <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Einstellungen</h5>
                              <PermissionToggle 
                                label="Ansehen" 
                                active={role.permissions.settings.view} 
                                onChange={val => {
                                  const newRoles = roles.map(r => r.id === role.id ? { ...r, permissions: { ...r.permissions, settings: { ...r.permissions.settings, view: val } } } : r);
                                  setRoles(newRoles);
                                }}
                              />
                              <PermissionToggle 
                                label="Bearbeiten" 
                                active={role.permissions.settings.edit} 
                                onChange={val => {
                                  const newRoles = roles.map(r => r.id === role.id ? { ...r, permissions: { ...r.permissions, settings: { ...r.permissions.settings, edit: val } } } : r);
                                  setRoles(newRoles);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Notification Toast */}
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-12 right-12 px-8 py-4 rounded-2xl shadow-2xl text-white font-bold flex items-center gap-3 z-50 ${message.type === 'success' ? 'bg-brand-primary' : 'bg-red-500'}`}
          >
            {message.type === 'success' ? <Check size={20} /> : <X size={20} />}
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarLink({ active, onClick, icon, label, id, className }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, id?: string, className?: string }) {
  return (
    <button 
      id={id}
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all ${active ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'text-white/40 hover:text-white hover:bg-white/5'} ${className || ''}`}
    >
      {icon}
      {label}
    </button>
  );
}

function PermissionToggle({ label, active, onChange }: { label: string, active: boolean, onChange: (val: boolean) => void }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer" onClick={() => onChange(!active)}>
      <span className={`text-xs font-bold transition-colors ${active ? 'text-brand-dark' : 'text-slate-300'}`}>{label}</span>
      <div className={`w-8 h-4 rounded-full relative transition-all ${active ? 'bg-brand-primary' : 'bg-slate-200'}`}>
        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm transition-all ${active ? 'left-4.5' : 'left-0.5'}`} />
      </div>
    </div>
  );
}
