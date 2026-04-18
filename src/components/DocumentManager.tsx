import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  Trash2, 
  Eye, 
  History, 
  CheckCircle2, 
  Clock, 
  Search,
  Filter,
  MoreVertical,
  Plus,
  X,
  FileCode,
  FileImage,
  File
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';

interface Project {
  id: string;
  name: string;
}

interface DocVersion {
  version: string;
  url: string;
  created_at: string;
  created_by: string;
  notes?: string;
}

interface ProjectDocument {
  id: string;
  project_id: string;
  title: string;
  category: 'plan' | 'statics' | 'permit' | 'contract' | 'other';
  status: 'draft' | 'review' | 'approved' | 'obsolete';
  current_version: string;
  file_type: string;
  versions: DocVersion[];
  created_at: string;
  updated_at: string;
}

export default function DocumentManager() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [newDoc, setNewDoc] = useState<Partial<ProjectDocument>>({
    title: '',
    category: 'plan',
    status: 'draft'
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      const docsRef = collection(db, `projects/${selectedProject}/documents`);
      const q = query(docsRef, orderBy('updated_at', 'desc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectDocument));
        setDocuments(docsData);
      }, (error) => handleFirestoreError(error, OperationType.LIST, `projects/${selectedProject}/documents`));

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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    setLoading(true);
    try {
      const docsRef = collection(db, `projects/${selectedProject}/documents`);
      const timestamp = new Date().toISOString();
      await addDoc(docsRef, {
        ...newDoc,
        project_id: selectedProject,
        current_version: '1.0',
        file_type: 'PDF',
        created_at: timestamp,
        updated_at: timestamp,
        versions: [
          {
            version: '1.0',
            url: '#',
            created_at: timestamp,
            created_by: 'Architekt',
            notes: 'Initialer Upload'
          }
        ]
      });
      setShowUploadModal(false);
      setNewDoc({ title: '', category: 'plan', status: 'draft' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `projects/${selectedProject}/documents`);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.toLowerCase().includes('pdf')) return <FileText className="text-red-500" size={24} />;
    if (type.toLowerCase().includes('dwg') || type.toLowerCase().includes('dxf')) return <FileCode className="text-blue-500" size={24} />;
    if (type.toLowerCase().includes('png') || type.toLowerCase().includes('jpg')) return <FileImage className="text-emerald-500" size={24} />;
    return <File className="text-slate-400" size={24} />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-emerald-100 text-emerald-600';
      case 'review': return 'bg-amber-100 text-amber-600';
      case 'obsolete': return 'bg-slate-100 text-slate-400';
      default: return 'bg-blue-100 text-blue-600';
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesCategory = filterCategory === 'all' || doc.category === filterCategory;
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div id="document-manager-container" className="space-y-8">
      {/* Header */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500 shadow-sm">
            <FileText size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Plan- & Dokumentenmanagement</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Zentrale Ablage für Architekten & Statiker</p>
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
              onClick={() => setShowUploadModal(true)}
              className="bg-brand-dark text-white px-6 py-4 rounded-2xl font-bold hover:bg-brand-primary transition-all flex items-center gap-2 text-sm uppercase tracking-widest shadow-lg shadow-brand-dark/10"
            >
              <Upload size={18} />
              Upload
            </button>
          )}
        </div>
      </div>

      {selectedProject && (
        <div className="space-y-6">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4 flex-1 min-w-[300px]">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Dokumente durchsuchen..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-xl py-3 pl-12 pr-4 outline-none transition-all font-medium text-brand-dark text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400" />
                <select 
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="bg-slate-50 border-none rounded-xl py-3 px-4 outline-none text-xs font-bold text-slate-500 uppercase tracking-widest"
                >
                  <option value="all">Alle Kategorien</option>
                  <option value="plan">Pläne</option>
                  <option value="statics">Statik</option>
                  <option value="permit">Genehmigungen</option>
                  <option value="contract">Verträge</option>
                </select>
              </div>
            </div>
          </div>

          {/* Document List */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dokument</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategorie</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Version</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Zuletzt geändert</th>
                  <th className="p-6 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {filteredDocs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-20 text-center text-slate-400 font-medium">
                      Keine Dokumente gefunden.
                    </td>
                  </tr>
                ) : (
                  filteredDocs.map((doc) => (
                    <tr key={doc.id} className="border-b border-slate-50 hover:bg-slate-50/30 transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center shadow-sm group-hover:bg-white transition-colors">
                            {getFileIcon(doc.file_type)}
                          </div>
                          <div>
                            <p className="font-bold text-brand-dark group-hover:text-brand-primary transition-colors">{doc.title}</p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{doc.file_type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                          {doc.category}
                        </span>
                      </td>
                      <td className="p-6">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${getStatusBadge(doc.status)}`}>
                          {doc.status}
                        </span>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2 text-slate-500">
                          <History size={14} />
                          <span className="text-xs font-bold">v{doc.current_version}</span>
                        </div>
                      </td>
                      <td className="p-6">
                        <p className="text-xs font-bold text-slate-500">{new Date(doc.updated_at).toLocaleDateString('de-DE')}</p>
                        <p className="text-[10px] text-slate-400 font-medium">vor 2 Stunden</p>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 text-slate-400 hover:text-brand-primary transition-colors">
                            <Download size={18} />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-brand-primary transition-colors">
                            <Eye size={18} />
                          </button>
                          <button className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Dokument hochladen</h3>
                  <p className="text-slate-400 text-sm font-medium">Wählen Sie eine Datei und die passende Kategorie.</p>
                </div>
                <button onClick={() => setShowUploadModal(false)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand-dark transition-colors shadow-sm">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8">
                <form onSubmit={handleUpload} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Titel des Dokuments</label>
                    <input 
                      type="text" 
                      required
                      value={newDoc.title}
                      onChange={e => setNewDoc({ ...newDoc, title: e.target.value })}
                      placeholder="z.B. Grundriss EG_v2"
                      className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Kategorie</label>
                      <select 
                        value={newDoc.category}
                        onChange={e => setNewDoc({ ...newDoc, category: e.target.value as any })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      >
                        <option value="plan">Plan</option>
                        <option value="statics">Statik</option>
                        <option value="permit">Genehmigung</option>
                        <option value="contract">Vertrag</option>
                        <option value="other">Sonstiges</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Status</label>
                      <select 
                        value={newDoc.status}
                        onChange={e => setNewDoc({ ...newDoc, status: e.target.value as any })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      >
                        <option value="draft">Entwurf</option>
                        <option value="review">In Prüfung</option>
                        <option value="approved">Freigegeben</option>
                      </select>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center hover:bg-slate-50 transition-colors cursor-pointer group">
                    <Upload className="mx-auto text-slate-300 group-hover:text-brand-primary transition-colors mb-4" size={40} />
                    <p className="text-sm font-bold text-slate-500">Datei auswählen oder hierher ziehen</p>
                    <p className="text-xs text-slate-400 mt-1">PDF, DWG, DXF, PNG (max. 50MB)</p>
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowUploadModal(false)}
                      className="px-8 py-4 rounded-2xl font-bold text-slate-400 hover:text-brand-dark transition-colors uppercase tracking-widest text-xs"
                    >
                      Abbrechen
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="bg-brand-dark text-white px-12 py-4 rounded-2xl font-bold hover:bg-brand-primary transition-all shadow-xl shadow-brand-dark/20 flex items-center gap-3"
                    >
                      {loading ? 'Lade hoch...' : 'Dokument speichern'}
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
