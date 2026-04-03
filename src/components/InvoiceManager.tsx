import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Receipt, 
  Download, 
  CheckCircle2, 
  Clock, 
  X,
  ChevronRight,
  FileText,
  AlertTriangle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUI } from './UIContext';

interface Project {
  id: string;
  name: string;
  client_name: string;
}

interface Invoice {
  id: string;
  project_id: string;
  project_name?: string;
  invoice_number: string;
  type: 'Abschlagsrechnung' | 'Schlussrechnung' | 'Rechnung';
  amount: number;
  status: 'draft' | 'sent' | 'paid';
  due_date: string;
  created_at: string;
}

export default function InvoiceManager() {
  const { showNotification } = useUI();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'overdue'>('all');
  const [showNewInvoiceForm, setShowNewInvoiceForm] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedInvoiceForReminder, setSelectedInvoiceForReminder] = useState<Invoice | null>(null);
  const [customReminderMessage, setCustomReminderMessage] = useState('');
  const [showValidationModal, setShowValidationModal] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ errors: string[], warnings: string[], isReady: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [newInvoice, setNewInvoice] = useState({
    invoice_number: `RE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    type: 'Abschlagsrechnung' as const,
    amount: 0,
    status: 'draft' as const,
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchInvoices(selectedProject);
    } else {
      fetchAllInvoices();
    }
    fetchOverdueInvoices();
  }, [selectedProject]);

  const fetchOverdueInvoices = async () => {
    try {
      const res = await fetch('/api/invoices/overdue');
      const data = await res.json();
      setOverdueInvoices(data);
    } catch (err) {
      console.error('Error fetching overdue invoices:', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchAllInvoices = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/invoices/all');
      const data = await res.json();
      setInvoices(data);
    } catch (err) {
      console.error('Error fetching all invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async (projectId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invoices`);
      const data = await res.json();
      setInvoices(data);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProject}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInvoice)
      });
      if (res.ok) {
        setShowNewInvoiceForm(false);
        setNewInvoice({
          invoice_number: `RE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          type: 'Abschlagsrechnung',
          amount: 0,
          status: 'draft',
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
        fetchInvoices(selectedProject);
      }
    } catch (err) {
      console.error('Error creating invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  const validateEInvoice = async (invoice: Invoice) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${invoice.project_id}/invoices/${invoice.id}/validate-einvoice`);
      const data = await res.json();
      setValidationResult(data);
      setShowValidationModal(invoice.id);
    } catch (err) {
      console.error('Error validating invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForReminder) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${selectedInvoiceForReminder.id}/send-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId: selectedInvoiceForReminder.project_id,
          customMessage: customReminderMessage 
        })
      });
      const data = await res.json();
      if (res.ok) {
        showNotification(data.message, 'success');
        setShowReminderModal(false);
        setSelectedInvoiceForReminder(null);
        setCustomReminderMessage('');
      } else {
        showNotification(data.message || 'Fehler beim Senden der Mahnung', 'error');
      }
    } catch (err) {
      console.error('Error sending reminder:', err);
      showNotification('Fehler beim Senden der Mahnung', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openReminderModal = (invoice: Invoice) => {
    setSelectedInvoiceForReminder(invoice);
    setCustomReminderMessage('');
    setShowReminderModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-600';
      case 'sent': return 'bg-blue-100 text-blue-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div id="invoice-manager-container" className="space-y-8">
      <div id="invoice-project-filter-bar" className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Filter nach Projekt</label>
        <select 
          id="invoice-project-select"
          value={selectedProject || ''} 
          onChange={(e) => setSelectedProject(e.target.value || null)}
          className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
        >
          <option value="">Alle Projekte</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.client_name})</option>
          ))}
        </select>
      </div>

      <div id="invoice-list-container" className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4">
              {selectedProject && (
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                >
                  <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                  Projekt wechseln
                </button>
              )}
              <h3 className="text-2xl font-black text-brand-dark tracking-tighter">
                {selectedProject ? 'Projekt-Rechnungen' : 'Rechnungsübersicht'}
              </h3>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-2xl">
              <button 
                onClick={() => setActiveTab('all')}
                className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-white text-brand-dark shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Alle ({invoices.length})
              </button>
              <button 
                onClick={() => setActiveTab('overdue')}
                className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'overdue' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Überfällig ({overdueInvoices.length})
                {overdueInvoices.length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {selectedProject && (
              <>
                <button 
                  id="invoice-new-btn"
                  onClick={() => setShowNewInvoiceForm(true)}
                  className="bg-brand-dark text-white px-6 py-3 rounded-2xl font-bold hover:bg-brand-primary transition-all flex items-center gap-2 text-sm uppercase tracking-widest"
                >
                  <Plus size={18} />
                  Neue Rechnung
                </button>
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="flex items-center justify-center w-11 h-11 bg-white text-slate-400 hover:text-red-500 border border-slate-100 hover:border-red-100 rounded-2xl transition-all shadow-sm"
                  title="Schließen"
                >
                  <X size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {(activeTab === 'all' ? invoices : overdueInvoices).length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-[2rem] text-center text-slate-400">
              Keine {activeTab === 'overdue' ? 'überfälligen' : ''} Rechnungen gefunden.
            </div>
          ) : (
            (activeTab === 'all' ? invoices : overdueInvoices).map(invoice => (
              <div key={invoice.id} className={`bg-white p-8 rounded-[2.5rem] shadow-sm border ${activeTab === 'overdue' ? 'border-red-100' : 'border-slate-100'} flex justify-between items-center group hover:border-brand-primary/30 transition-all`}>
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 ${activeTab === 'overdue' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-brand-dark'} rounded-2xl flex items-center justify-center shadow-sm`}>
                    <Receipt size={28} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h4 className="font-bold text-brand-dark text-lg">{invoice.invoice_number}</h4>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-widest">{invoice.type}</span>
                      {activeTab === 'overdue' && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded uppercase tracking-widest flex items-center gap-1">
                          <Clock size={10} /> Überfällig
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest mt-1">
                      <span className={`px-3 py-1 rounded-full ${getStatusColor(invoice.status)}`}>
                        {invoice.status === 'paid' ? 'Bezahlt' : invoice.status === 'sent' ? 'Versendet' : 'Entwurf'}
                      </span>
                      <span className={`${activeTab === 'overdue' ? 'text-red-500' : 'text-slate-400'}`}>Fällig: {new Date(invoice.due_date).toLocaleDateString('de-DE')}</span>
                      {invoice.project_name && (
                        <span className="text-brand-primary font-black">Projekt: {invoice.project_name}</span>
                      )}
                    </div>
                  </div>
                </div>
                  <div className="flex items-center gap-12">
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Bruttobetrag</p>
                      <p className="text-xl font-black text-brand-dark">{invoice.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                    </div>
                    <div className="flex gap-2">
                      {activeTab === 'overdue' && (
                        <button 
                          onClick={() => openReminderModal(invoice)}
                          className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 hover:bg-red-100 transition-all"
                          title="Zahlungserinnerung senden"
                        >
                          <AlertTriangle size={20} />
                        </button>
                      )}
                      <button 
                        onClick={() => validateEInvoice(invoice)}
                        className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-all"
                        title="E-Rechnung Validierung"
                      >
                        <AlertTriangle size={20} />
                      </button>
                      <button 
                        onClick={() => window.open(`/api/projects/${invoice.project_id}/invoices/${invoice.id}/export-xrechnung`, '_blank')}
                        className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-all"
                        title="XRechnung Export (XML)"
                      >
                        <FileText size={20} />
                      </button>
                      <button className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand-primary transition-all">
                        <Download size={20} />
                      </button>
                      <button className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand-primary transition-all group-hover:bg-brand-primary group-hover:text-white">
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  </div>
                </div>
            ))
          )}
        </div>
      </div>

      {/* New Invoice Modal */}
      <AnimatePresence>
        {showNewInvoiceForm && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              id="invoice-new-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Neue Rechnung erstellen</h3>
                  <p className="text-slate-400 text-sm font-medium">Erstellen Sie eine Abschlags- oder Schlussrechnung.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowNewInvoiceForm(false)}
                    className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                  >
                    <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                    Zurück
                  </button>
                  <button onClick={() => setShowNewInvoiceForm(false)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand-dark transition-colors shadow-sm">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-8">
                <form onSubmit={handleCreateInvoice} className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Rechnungsnummer</label>
                      <input 
                        type="text" 
                        required
                        value={newInvoice.invoice_number}
                        onChange={e => setNewInvoice({ ...newInvoice, invoice_number: e.target.value })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Rechnungstyp</label>
                      <select 
                        value={newInvoice.type}
                        onChange={e => setNewInvoice({ ...newInvoice, type: e.target.value as any })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      >
                        <option value="Abschlagsrechnung">Abschlagsrechnung</option>
                        <option value="Schlussrechnung">Schlussrechnung</option>
                        <option value="Rechnung">Einzelrechnung</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Bruttobetrag (€)</label>
                      <input 
                        type="number" 
                        required
                        step="0.01"
                        value={newInvoice.amount}
                        onChange={e => setNewInvoice({ ...newInvoice, amount: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Zahlungsziel</label>
                      <input 
                        type="date" 
                        required
                        value={newInvoice.due_date}
                        onChange={e => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 flex gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h5 className="font-bold text-blue-900 text-sm">E-Rechnung Hinweis</h5>
                      <p className="text-blue-700 text-xs mt-1 leading-relaxed">Diese Rechnung wird automatisch im XRechnung/ZUGFeRD Format vorbereitet (Pflicht ab 2025).</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowNewInvoiceForm(false)}
                      className="px-8 py-4 rounded-2xl font-bold text-slate-400 hover:text-brand-dark transition-colors uppercase tracking-widest text-xs"
                    >
                      Abbrechen
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="bg-brand-primary text-white px-12 py-4 rounded-2xl font-bold hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 flex items-center gap-3"
                    >
                      <Save size={20} />
                      {loading ? 'Erstellen...' : 'Rechnung Erstellen'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReminderModal && selectedInvoiceForReminder && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Zahlungserinnerung senden</h3>
                  <p className="text-slate-400 text-sm font-medium">Rechnung: {selectedInvoiceForReminder.invoice_number}</p>
                </div>
                <button onClick={() => setShowReminderModal(false)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand-dark transition-colors shadow-sm">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8">
                <form onSubmit={handleSendReminder} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nachricht (optional personalisieren)</label>
                    <textarea 
                      value={customReminderMessage}
                      onChange={e => setCustomReminderMessage(e.target.value)}
                      placeholder="Lassen Sie das Feld leer, um die Standardnachricht zu verwenden."
                      className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-medium text-brand-dark min-h-[200px]"
                    />
                  </div>

                  <div className="bg-amber-50 p-6 rounded-[2rem] border border-amber-100 flex gap-4">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                      <Info size={20} />
                    </div>
                    <div>
                      <h5 className="font-bold text-amber-900 text-sm">Standard-Vorlage</h5>
                      <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                        Die Standardnachricht enthält automatisch den Namen des Kunden, die Rechnungsnummer, das Datum und den Betrag.
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowReminderModal(false)}
                      className="px-8 py-4 rounded-2xl font-bold text-slate-400 hover:text-brand-dark transition-colors uppercase tracking-widest text-xs"
                    >
                      Abbrechen
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="bg-red-500 text-white px-12 py-4 rounded-2xl font-bold hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 flex items-center gap-3"
                    >
                      <AlertTriangle size={20} />
                      {loading ? 'Sende...' : 'Erinnerung senden'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Validation Modal */}
      <AnimatePresence>
        {showValidationModal && validationResult && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              id="invoice-validation-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${validationResult.isReady ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {validationResult.isReady ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-brand-dark tracking-tighter">E-Rechnung Validierung</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Status: {validationResult.isReady ? 'Bereit' : 'Nicht Bereit'}</p>
                  </div>
                </div>
                <button onClick={() => setShowValidationModal(null)} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 hover:text-brand-dark transition-colors shadow-sm">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                {validationResult.errors.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                      <X size={14} /> Fehler ({validationResult.errors.length})
                    </h4>
                    <div className="space-y-2">
                      {validationResult.errors.map((err, i) => (
                        <div key={i} className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-sm font-medium">
                          {err}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {validationResult.warnings.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                      <Info size={14} /> Warnungen ({validationResult.warnings.length})
                    </h4>
                    <div className="space-y-2">
                      {validationResult.warnings.map((warn, i) => (
                        <div key={i} className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-sm font-medium">
                          {warn}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {validationResult.isReady && (
                  <div className="p-6 bg-emerald-50 border border-emerald-100 rounded-[2rem] flex gap-4">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h5 className="font-bold text-emerald-900 text-sm">Validierung erfolgreich</h5>
                      <p className="text-emerald-700 text-xs mt-1 leading-relaxed">Alle Pflichtfelder für den XRechnung/ZUGFeRD Export sind vorhanden. Sie können die Datei nun exportieren.</p>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
                  <button 
                    onClick={() => setShowValidationModal(null)}
                    className="bg-brand-dark text-white px-8 py-4 rounded-2xl font-bold hover:bg-brand-primary transition-all shadow-xl shadow-brand-dark/20"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
