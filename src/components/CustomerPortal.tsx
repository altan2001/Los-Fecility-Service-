import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  Calendar, 
  HardHat, 
  PenTool, 
  Download,
  AlertCircle,
  ArrowLeft,
  Image as ImageIcon,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../App';
import { Modal } from './Modal';

interface Project {
  id: string;
  name: string;
  status: string;
  created_at: string;
  signed_at?: string;
  customer_name: string;
  customer_address: string;
  craftsman_name?: string;
}

interface DiaryEntry {
  id: string;
  date: string;
  weather: string;
  temperature: string;
  activities: string;
  notes: string;
}

export default function CustomerPortal() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signatureData, setSignatureData] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (user?.email) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customer/projects?email=${user.email}`);
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects);
      }
    } catch (err) {
      console.error('Error fetching customer projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectDetails = async (project: Project) => {
    setSelectedProject(project);
    try {
      const res = await fetch(`/api/customer/diaries/${project.id}`);
      const data = await res.json();
      if (data.success) {
        setDiaries(data.diaries);
      }
    } catch (err) {
      console.error('Error fetching diaries:', err);
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0F172A';

    if (!isDrawing) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      setSignatureData('');
    }
  };

  const handleSign = async () => {
    if (!selectedProject || !signatureData) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData,
          signedBy: user.email
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowSignatureModal(false);
        fetchProjects();
        if (selectedProject) {
          setSelectedProject({ ...selectedProject, status: 'Beauftragt', signed_at: new Date().toISOString() });
        }
      }
    } catch (err) {
      console.error('Error signing:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedProject && (
              <button 
                onClick={() => setSelectedProject(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-xl font-black text-brand-dark tracking-tighter uppercase">
              {selectedProject ? 'Projekt-Details' : 'Kundenportal'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-brand-dark">{user?.email}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bauherr</p>
            </div>
            <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center font-bold">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {!selectedProject ? (
          <div className="space-y-8">
            <div className="bg-brand-dark rounded-[2.5rem] p-10 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="relative z-10">
                <h2 className="text-3xl font-black tracking-tighter mb-2">Willkommen zurück!</h2>
                <p className="text-white/60 font-medium">Hier finden Sie eine Übersicht Ihrer aktuellen Bauprojekte.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.length > 0 ? (
                projects.map(project => (
                  <motion.div 
                    key={project.id}
                    whileHover={{ y: -5 }}
                    onClick={() => fetchProjectDetails(project)}
                    className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                        project.status === 'Angebot' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        project.status === 'Beauftragt' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                        {project.status}
                      </div>
                      <ChevronRight size={20} className="text-slate-300 group-hover:text-brand-primary transition-colors" />
                    </div>
                    <h3 className="text-xl font-black text-brand-dark mb-2 tracking-tight">{project.name}</h3>
                    <p className="text-slate-400 text-sm font-medium mb-6 flex items-center gap-2">
                      <Calendar size={14} /> {new Date(project.created_at).toLocaleDateString('de-DE')}
                    </p>
                    <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fortschritt</span>
                      <span className="text-sm font-black text-brand-primary">
                        {project.status === 'Angebot' ? '0%' : project.status === 'Beauftragt' ? '10%' : '100%'}
                      </span>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                  <FileText size={48} className="mx-auto text-slate-200 mb-4" />
                  <h3 className="text-xl font-bold text-slate-400">Keine Projekte gefunden</h3>
                  <p className="text-slate-300">Sobald wir ein Projekt für Sie anlegen, erscheint es hier.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Project Info & Actions */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                  <div>
                    <h2 className="text-3xl font-black text-brand-dark tracking-tighter mb-2">{selectedProject.name}</h2>
                    <p className="text-slate-400 font-medium flex items-center gap-2">
                      <MapPin size={16} /> {selectedProject.customer_address}
                    </p>
                  </div>
                  <div className={`px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest ${
                    selectedProject.status === 'Angebot' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                    selectedProject.status === 'Beauftragt' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                    'bg-blue-50 text-blue-600 border border-blue-100'
                  }`}>
                    Status: {selectedProject.status}
                  </div>
                </div>

                {selectedProject.status === 'Angebot' && (
                  <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-brand-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-brand-primary/20">
                        <PenTool size={32} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-brand-dark">Angebot bereit zur Unterschrift</h4>
                        <p className="text-slate-500 text-sm">Prüfen Sie Ihr Angebot und beauftragen Sie uns digital.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowSignatureModal(true)}
                      className="px-8 py-4 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20 uppercase tracking-widest text-sm"
                    >
                      Jetzt unterschreiben
                    </button>
                  </div>
                )}

                {selectedProject.signed_at && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8 flex items-center gap-6">
                    <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <CheckCircle2 size={32} />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-emerald-900">Projekt beauftragt</h4>
                      <p className="text-emerald-700 text-sm">Unterschrieben am {new Date(selectedProject.signed_at).toLocaleDateString('de-DE')}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Construction Diary */}
              <div className="space-y-6">
                <h3 className="text-2xl font-black text-brand-dark tracking-tighter flex items-center gap-3">
                  <HardHat size={24} className="text-brand-primary" /> Bautagebuch
                </h3>
                <div className="space-y-4">
                  {diaries.length > 0 ? (
                    diaries.map(entry => (
                      <motion.div 
                        key={entry.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                              <Calendar size={24} />
                            </div>
                            <div>
                              <p className="text-lg font-black text-brand-dark">{new Date(entry.date).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{entry.weather} • {entry.temperature}°C</p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <h5 className="text-[10px] font-bold text-brand-primary uppercase tracking-widest mb-2">Geleistete Arbeiten</h5>
                            <p className="text-slate-600 text-sm leading-relaxed">{entry.activities}</p>
                          </div>
                          {entry.notes && (
                            <div className="pt-4 border-t border-slate-50">
                              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Besondere Vorkommnisse</h5>
                              <p className="text-slate-500 text-xs italic">{entry.notes}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="bg-white rounded-[2rem] p-12 text-center border border-slate-100">
                      <Clock size={40} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-400 font-medium">Noch keine Einträge im Bautagebuch vorhanden.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <h4 className="text-sm font-black text-brand-dark uppercase tracking-widest mb-6">Ansprechpartner</h4>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center">
                    <HardHat size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-brand-dark">{selectedProject.craftsman_name || 'Los Facility Service'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Projektleiter</p>
                  </div>
                </div>
                <button className="w-full py-4 bg-slate-50 text-brand-dark rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                  <MessageSquare size={16} /> Nachricht senden
                </button>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
                <h4 className="text-sm font-black text-brand-dark uppercase tracking-widest mb-6">Dokumente</h4>
                <div className="space-y-3">
                  <button className="w-full p-4 bg-slate-50 rounded-2xl flex items-center justify-between group hover:bg-brand-primary/5 transition-all">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-slate-400 group-hover:text-brand-primary" />
                      <span className="text-xs font-bold text-slate-600 group-hover:text-brand-dark">Angebot.pdf</span>
                    </div>
                    <Download size={16} className="text-slate-300 group-hover:text-brand-primary" />
                  </button>
                  <button className="w-full p-4 bg-slate-50 rounded-2xl flex items-center justify-between group hover:bg-brand-primary/5 transition-all">
                    <div className="flex items-center gap-3">
                      <ImageIcon size={18} className="text-slate-400 group-hover:text-brand-primary" />
                      <span className="text-xs font-bold text-slate-600 group-hover:text-brand-dark">Bauplaene.zip</span>
                    </div>
                    <Download size={16} className="text-slate-300 group-hover:text-brand-primary" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Signature Modal */}
      <Modal 
        isOpen={showSignatureModal} 
        onClose={() => setShowSignatureModal(false)}
        title="Angebot digital unterschreiben"
      >
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
            <AlertCircle className="text-amber-600 shrink-0" size={20} />
            <p className="text-xs text-amber-800 leading-relaxed">
              Mit Ihrer digitalen Unterschrift beauftragen Sie uns verbindlich mit der Ausführung der im Angebot beschriebenen Leistungen.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ihre Unterschrift</label>
            <div className="border-2 border-dashed border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
              <canvas 
                ref={canvasRef}
                width={500}
                height={200}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full cursor-crosshair touch-none"
              />
            </div>
            <div className="flex justify-end">
              <button 
                onClick={clearSignature}
                className="text-[10px] font-bold text-brand-primary uppercase tracking-widest hover:underline"
              >
                Löschen
              </button>
            </div>
          </div>

          <div className="pt-6 flex gap-4">
            <button 
              onClick={() => setShowSignatureModal(false)}
              className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
            >
              Abbrechen
            </button>
            <button 
              onClick={handleSign}
              disabled={!signatureData}
              className="flex-1 py-4 bg-brand-primary text-white rounded-2xl font-bold uppercase tracking-widest text-xs hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20 disabled:opacity-50"
            >
              Kostenpflichtig beauftragen
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MapPin({ size, className }: { size: number, className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
