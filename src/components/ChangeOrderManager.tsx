import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  X,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

interface Project {
  id: string;
  name: string;
  client_name: string;
}

interface ChangeOrder {
  id: string;
  project_id: string;
  title: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface ChangeOrderManagerProps {
  initialProjectId?: string | null;
}

export default function ChangeOrderManager({ initialProjectId }: ChangeOrderManagerProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(initialProjectId || null);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newOrder, setNewOrder] = useState({
    title: '',
    description: '',
    amount: 0,
    status: 'pending' as const
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (initialProjectId) {
      setSelectedProject(initialProjectId);
    }
  }, [initialProjectId]);

  useEffect(() => {
    if (selectedProject) {
      fetchChangeOrders(selectedProject);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject) {
      const ordersRef = collection(db, `projects/${selectedProject}/change_orders`);
      const q = query(ordersRef, orderBy('created_at', 'desc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChangeOrder));
        setChangeOrders(ordersData);
      }, (error) => handleFirestoreError(error, OperationType.LIST, `projects/${selectedProject}/change_orders`));

      return () => unsubscribe();
    }
  }, [selectedProject]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchChangeOrders = async (projectId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/change-orders`);
      const data = await res.json();
      setChangeOrders(data);
    } catch (err) {
      console.error('Error fetching change orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProject}/change-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrder)
      });
      if (res.ok) {
        setShowNewOrderForm(false);
        setNewOrder({
          title: '',
          description: '',
          amount: 0,
          status: 'pending'
        });
        fetchChangeOrders(selectedProject);
      }
    } catch (err) {
      console.error('Error creating change order:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: 'approved' | 'rejected') => {
    if (!selectedProject) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProject}/change-orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        fetchChangeOrders(selectedProject);
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (order: ChangeOrder) => {
    const doc = new jsPDF();
    const project = projects.find(p => p.id === selectedProject);
    
    // Header
    doc.setFontSize(22);
    doc.text('NACHTRAGSANGEBOT', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text('Los Facility Service', 20, 40);
    doc.text('Kandlerstr 4', 20, 45);
    doc.text('82216 Maisach', 20, 50);
    
    doc.text('Kunde:', 120, 40);
    doc.text(project?.client_name || 'N/A', 120, 45);
    doc.text(`Projekt: ${project?.name}`, 120, 50);
    
    doc.setFontSize(14);
    doc.text(`Nachtrag: ${order.title}`, 20, 70);
    
    doc.setFontSize(10);
    const splitDesc = doc.splitTextToSize(order.description || 'Keine Beschreibung vorhanden.', 170);
    doc.text(splitDesc, 20, 80);
    
    const tableData = [
      ['Position', 'Beschreibung', 'Betrag'],
      [order.title, order.description || '-', order.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })]
    ];
    
    (doc as any).autoTable({
      startY: 100,
      head: [tableData[0]],
      body: [tableData[1]],
      theme: 'striped',
      headStyles: { fillStyle: [242, 125, 38] }
    });
    
    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(12);
    doc.text(`Gesamtbetrag Nachtrag: ${order.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`, 120, finalY);
    
    doc.save(`Nachtrag_${order.id}_${project?.name}.pdf`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-600';
      case 'rejected': return 'bg-red-100 text-red-600';
      default: return 'bg-amber-100 text-amber-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle2 size={16} />;
      case 'rejected': return <AlertCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  return (
    <div id="change-order-section" className="space-y-8">
      <div id="change-order-project-selector" className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Projekt auswählen</label>
        <select 
          id="change-order-project-select"
          value={selectedProject || ''} 
          onChange={(e) => setSelectedProject(e.target.value)}
          className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
        >
          <option value="">-- Projekt wählen --</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.client_name})</option>
          ))}
        </select>
      </div>

      {selectedProject && (
        <div id="change-order-list-container" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSelectedProject(null)}
                className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
              >
                <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                Projekt wechseln
              </button>
              <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Nachträge & Änderungen</h3>
            </div>
            <div className="flex items-center gap-3">
              <button 
                id="change-order-new-btn"
                onClick={() => setShowNewOrderForm(true)}
                className="bg-brand-dark text-white px-6 py-3 rounded-2xl font-bold hover:bg-brand-primary transition-all flex items-center gap-2 text-sm uppercase tracking-widest"
              >
                <Plus size={18} />
                Neuer Nachtrag
              </button>
              <button 
                onClick={() => setSelectedProject(null)}
                className="flex items-center justify-center w-11 h-11 bg-white text-slate-400 hover:text-red-500 border border-slate-100 hover:border-red-100 rounded-2xl transition-all shadow-sm"
                title="Schließen"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {changeOrders.length === 0 ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-[2rem] text-center text-slate-400">
                Keine Nachträge für dieses Projekt gefunden.
              </div>
            ) : (
              changeOrders.map(order => (
                <div key={order.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex justify-between items-center group hover:border-brand-primary/30 transition-all">
                  <div className="flex items-center gap-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getStatusColor(order.status)} shadow-sm`}>
                      <FileText size={28} />
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-dark text-lg">{order.title}</h4>
                      <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest mt-1">
                        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusIcon(order.status)}
                          {order.status === 'pending' ? 'Ausstehend' : order.status === 'approved' ? 'Genehmigt' : 'Abgelehnt'}
                        </span>
                        <span className="text-slate-400">{new Date(order.created_at).toLocaleDateString('de-DE')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Betrag</p>
                      <p className="text-xl font-black text-brand-dark">{order.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => generatePDF(order)}
                        className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand-primary transition-all"
                        title="PDF Angebot"
                      >
                        <FileText size={18} />
                      </button>
                      {order.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => handleUpdateStatus(order.id, 'approved')}
                            className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 hover:bg-emerald-100 transition-all"
                            title="Genehmigen"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleUpdateStatus(order.id, 'rejected')}
                            className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600 hover:bg-red-100 transition-all"
                            title="Ablehnen"
                          >
                            <AlertCircle size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* New Order Modal */}
      <AnimatePresence>
        {showNewOrderForm && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              id="change-order-new-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Neuer Nachtrag</h3>
                  <p className="text-slate-400 text-sm font-medium">Erfassen Sie zusätzliche Leistungen oder Änderungen.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowNewOrderForm(false)}
                    className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                  >
                    <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                    Zurück
                  </button>
                  <button onClick={() => setShowNewOrderForm(false)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand-dark transition-colors shadow-sm">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-8">
                <form onSubmit={handleCreateOrder} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Titel / Bezeichnung</label>
                    <input 
                      type="text" 
                      required
                      value={newOrder.title}
                      onChange={e => setNewOrder({ ...newOrder, title: e.target.value })}
                      className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      placeholder="z.B. Zusätzliche Steckdosen Küche"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Beschreibung</label>
                    <textarea 
                      value={newOrder.description}
                      onChange={e => setNewOrder({ ...newOrder, description: e.target.value })}
                      className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-medium text-brand-dark min-h-[120px]"
                      placeholder="Detaillierte Beschreibung der Mehrleistung..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Voraussichtlicher Betrag (€)</label>
                      <input 
                        type="number" 
                        required
                        step="0.01"
                        value={newOrder.amount}
                        onChange={e => setNewOrder({ ...newOrder, amount: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Status</label>
                      <select 
                        value={newOrder.status}
                        onChange={e => setNewOrder({ ...newOrder, status: e.target.value as any })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      >
                        <option value="pending">Ausstehend</option>
                        <option value="approved">Genehmigt</option>
                        <option value="rejected">Abgelehnt</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowNewOrderForm(false)}
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
                      {loading ? 'Speichern...' : 'Nachtrag Speichern'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
