import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Camera, 
  Plus, 
  Trash2, 
  X, 
  ChevronRight, 
  MapPin, 
  User,
  Calendar,
  Filter,
  Download,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';

interface Project {
  id: string;
  name: string;
}

interface Defect {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'accepted';
  priority: 'low' | 'medium' | 'high' | 'critical';
  trade: string;
  location?: string;
  assigned_to?: string;
  due_date?: string;
  created_at: string;
  photos?: string[];
}

export default function DefectManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewDefectForm, setShowNewDefectForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const [newDefect, setNewDefect] = useState<Partial<Defect>>({
    title: '',
    description: '',
    status: 'open',
    priority: 'medium',
    trade: '',
    location: '',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      const defectsRef = collection(db, `projects/${selectedProject}/defects`);
      const q = query(defectsRef, orderBy('created_at', 'desc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const defectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Defect));
        setDefects(defectsData);
      }, (error) => handleFirestoreError(error, OperationType.LIST, `projects/${selectedProject}/defects`));

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

  const handleCreateDefect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setLoading(true);
    try {
      const defectsRef = collection(db, `projects/${selectedProject}/defects`);
      await addDoc(defectsRef, {
        ...newDefect,
        project_id: selectedProject,
        created_at: new Date().toISOString(),
        photos: []
      });
      setShowNewDefectForm(false);
      setNewDefect({
        title: '',
        description: '',
        status: 'open',
        priority: 'medium',
        trade: '',
        location: '',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `projects/${selectedProject}/defects`);
    } finally {
      setLoading(false);
    }
  };

  const updateDefectStatus = async (defectId: string, newStatus: Defect['status']) => {
    if (!selectedProject) return;
    try {
      const defectRef = doc(db, `projects/${selectedProject}/defects`, defectId);
      await updateDoc(defectRef, { status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${selectedProject}/defects/${defectId}`);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-600 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'medium': return 'bg-amber-100 text-amber-600 border-amber-200';
      default: return 'bg-blue-100 text-blue-600 border-blue-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'accepted': return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'resolved': return <CheckCircle2 className="text-blue-500" size={20} />;
      case 'in_progress': return <Clock className="text-amber-500" size={20} />;
      default: return <AlertCircle className="text-red-500" size={20} />;
    }
  };

  const filteredDefects = defects.filter(d => filterStatus === 'all' || d.status === filterStatus);

  return (
    <div id="defect-manager-container" className="space-y-8">
      {/* Header & Project Selection */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 shadow-sm">
            <AlertCircle size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Mängelmanagement</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Erfassung & Nachverfolgung von Baumängeln</p>
          </div>
        </div>

        <div className="flex items-center gap-4 min-w-[300px]">
          <select 
            value={selectedProject || ''} 
            onChange={(e) => setSelectedProject(e.target.value || null)}
            className="flex-1 bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
          >
            <option value="">Projekt auswählen...</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selectedProject && (
            <button 
              onClick={() => setShowNewDefectForm(true)}
              className="bg-brand-dark text-white px-6 py-4 rounded-2xl font-bold hover:bg-brand-primary transition-all flex items-center gap-2 text-sm uppercase tracking-widest shadow-lg shadow-brand-dark/10"
            >
              <Plus size={18} />
              Neuer Mangel
            </button>
          )}
        </div>
      </div>

      {!selectedProject ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-20 rounded-[3rem] text-center">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-6 shadow-sm">
            <MapPin size={40} />
          </div>
          <h4 className="text-xl font-bold text-slate-400">Bitte wählen Sie ein Projekt aus, um Mängel zu verwalten.</h4>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm overflow-x-auto">
            <div className="flex items-center gap-2 px-4 border-r border-slate-100">
              <Filter size={16} className="text-slate-400" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status:</span>
            </div>
            {['all', 'open', 'in_progress', 'resolved', 'accepted'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                  filterStatus === status 
                    ? 'bg-brand-dark text-white shadow-md' 
                    : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                {status === 'all' ? 'Alle' : status.replace('_', ' ')}
              </button>
            ))}
          </div>

          {/* Defect Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredDefects.map((defect) => (
                <motion.div
                  key={defect.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-brand-primary/20 transition-all overflow-hidden group"
                >
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(defect.status)}
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${getPriorityColor(defect.priority)}`}>
                          {defect.priority}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {new Date(defect.created_at).toLocaleDateString('de-DE')}
                      </span>
                    </div>

                    <h4 className="text-xl font-black text-brand-dark mb-2 tracking-tight group-hover:text-brand-primary transition-colors">
                      {defect.title}
                    </h4>
                    <p className="text-slate-500 text-sm leading-relaxed mb-6 line-clamp-2">
                      {defect.description}
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 shadow-sm">
                          <User size={16} />
                        </div>
                        <div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Gewerk</p>
                          <p className="text-xs font-bold text-brand-dark">{defect.trade || 'Nicht zugewiesen'}</p>
                        </div>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-slate-400 shadow-sm">
                          <MapPin size={16} />
                        </div>
                        <div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Ort</p>
                          <p className="text-xs font-bold text-brand-dark">{defect.location || 'Baustelle'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                      <div className="flex -space-x-2">
                        {[1, 2].map(i => (
                          <div key={i} className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-400">
                            +
                          </div>
                        ))}
                        <button className="w-8 h-8 rounded-full bg-brand-primary/10 border-2 border-white flex items-center justify-center text-brand-primary hover:bg-brand-primary hover:text-white transition-all">
                          <Camera size={14} />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {defect.status === 'open' && (
                          <button 
                            onClick={() => updateDefectStatus(defect.id, 'in_progress')}
                            className="px-4 py-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-amber-100 transition-all"
                          >
                            Bearbeiten
                          </button>
                        )}
                        {defect.status === 'in_progress' && (
                          <button 
                            onClick={() => updateDefectStatus(defect.id, 'resolved')}
                            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-blue-100 transition-all"
                          >
                            Abschließen
                          </button>
                        )}
                        {defect.status === 'resolved' && (
                          <button 
                            onClick={() => updateDefectStatus(defect.id, 'accepted')}
                            className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-100 transition-all"
                          >
                            Abnehmen
                          </button>
                        )}
                        <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* New Defect Modal */}
      <AnimatePresence>
        {showNewDefectForm && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Neuen Mangel erfassen</h3>
                  <p className="text-slate-400 text-sm font-medium">Dokumentieren Sie den Mangel präzise für das Gewerk.</p>
                </div>
                <button onClick={() => setShowNewDefectForm(false)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand-dark transition-colors shadow-sm">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8">
                <form onSubmit={handleCreateDefect} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Titel / Bezeichnung</label>
                    <input 
                      type="text" 
                      required
                      value={newDefect.title}
                      onChange={e => setNewDefect({ ...newDefect, title: e.target.value })}
                      placeholder="z.B. Riss in der Fliese, Fenster schließt nicht"
                      className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Gewerk</label>
                      <input 
                        type="text" 
                        required
                        value={newDefect.trade}
                        onChange={e => setNewDefect({ ...newDefect, trade: e.target.value })}
                        placeholder="z.B. Fliesenleger"
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Priorität</label>
                      <select 
                        value={newDefect.priority}
                        onChange={e => setNewDefect({ ...newDefect, priority: e.target.value as any })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      >
                        <option value="low">Niedrig</option>
                        <option value="medium">Mittel</option>
                        <option value="high">Hoch</option>
                        <option value="critical">Kritisch</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Beschreibung</label>
                    <textarea 
                      required
                      value={newDefect.description}
                      onChange={e => setNewDefect({ ...newDefect, description: e.target.value })}
                      className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-medium text-brand-dark min-h-[120px]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Ort / Raum</label>
                      <input 
                        type="text" 
                        value={newDefect.location}
                        onChange={e => setNewDefect({ ...newDefect, location: e.target.value })}
                        placeholder="z.B. Bad OG, Küche"
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Frist zur Behebung</label>
                      <input 
                        type="date" 
                        value={newDefect.due_date}
                        onChange={e => setNewDefect({ ...newDefect, due_date: e.target.value })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowNewDefectForm(false)}
                      className="px-8 py-4 rounded-2xl font-bold text-slate-400 hover:text-brand-dark transition-colors uppercase tracking-widest text-xs"
                    >
                      Abbrechen
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="bg-brand-dark text-white px-12 py-4 rounded-2xl font-bold hover:bg-brand-primary transition-all shadow-xl shadow-brand-dark/20 flex items-center gap-3"
                    >
                      {loading ? 'Speichere...' : 'Mangel speichern'}
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
