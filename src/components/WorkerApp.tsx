import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Camera, 
  MessageSquare, 
  MapPin, 
  Calendar,
  ChevronRight,
  Plus,
  X,
  Play,
  Square as StopSquare,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, where } from 'firebase/firestore';

interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  assigned_to: string;
  due_date: string;
  created_at: string;
}

interface SafetyBriefing {
  id: string;
  title: string;
  content: string;
  date: string;
  signed_by: string[];
}

export default function WorkerApp() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefings, setBriefings] = useState<SafetyBriefing[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [selectedBriefing, setSelectedBriefing] = useState<SafetyBriefing | null>(null);

  useEffect(() => {
    // Mock tasks for now - in real app fetch from Firestore
    const mockTasks: Task[] = [
      {
        id: '1',
        project_id: 'p1',
        title: 'Wand verputzen - Wohnzimmer',
        description: 'Gipsputz auftragen, Q3 Qualität',
        status: 'todo',
        priority: 'high',
        assigned_to: 'Max Mustermann',
        due_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        project_id: 'p1',
        title: 'Materialprüfung - Fliesen',
        description: 'Lieferung auf Schäden prüfen',
        status: 'in_progress',
        priority: 'medium',
        assigned_to: 'Max Mustermann',
        due_date: new Date().toISOString(),
        created_at: new Date().toISOString()
      }
    ];
    setTasks(mockTasks);

    const mockBriefings: SafetyBriefing[] = [
      {
        id: 'b1',
        title: 'Arbeiten auf Gerüsten',
        content: 'Sicherer Stand, PSA tragen, Absturzsicherung prüfen...',
        date: new Date().toISOString(),
        signed_by: []
      },
      {
        id: 'b2',
        title: 'Umgang mit Gefahrstoffen',
        content: 'Datenblätter beachten, Belüftung sicherstellen...',
        date: new Date().toISOString(),
        signed_by: ['Max Mustermann']
      }
    ];
    setBriefings(mockBriefings);
  }, []);

  useEffect(() => {
    let interval: any;
    if (isTracking) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSignBriefing = (id: string) => {
    setBriefings(prev => prev.map(b => 
      b.id === id ? { ...b, signed_by: [...b.signed_by, 'Max Mustermann'] } : b
    ));
    setShowSafetyModal(false);
  };

  return (
    <div id="worker-app-container" className="max-w-md mx-auto space-y-8 pb-20">
      {/* Worker Profile Header */}
      <div className="bg-brand-dark p-8 rounded-b-[3rem] -mt-8 text-white shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-brand-primary backdrop-blur-md">
              <UserCheck size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">Max Mustermann</h3>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Geselle • Maler & Lackierer</p>
            </div>
          </div>
          <button className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center hover:bg-white/10 transition-all">
            <Calendar size={20} />
          </button>
        </div>

        {/* Time Tracker Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/10 shadow-inner">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-brand-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Arbeitszeit heute</span>
            </div>
            <span className="text-2xl font-black font-mono">{formatTime(timeElapsed)}</span>
          </div>
          <button 
            onClick={() => setIsTracking(!isTracking)}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all ${
              isTracking 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                : 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
            }`}
          >
            {isTracking ? (
              <>
                <StopSquare size={20} fill="currentColor" />
                Stop & Buchen
              </>
            ) : (
              <>
                <Play size={20} fill="currentColor" />
                Arbeit starten
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tasks Section */}
      <div className="px-6 space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-black text-brand-dark tracking-tight">Meine Aufgaben</h4>
          <span className="bg-brand-primary/10 text-brand-primary text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
            {tasks.length} Offen
          </span>
        </div>

        <div className="space-y-4">
          {tasks.map(task => (
            <motion.div 
              key={task.id}
              whileTap={{ scale: 0.98 }}
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-brand-primary/30 transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  task.status === 'in_progress' ? 'bg-amber-50 text-amber-500' : 'bg-slate-50 text-slate-400'
                }`}>
                  <ClipboardList size={24} />
                </div>
                <div>
                  <h5 className="font-bold text-brand-dark">{task.title}</h5>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projekt: Neubau Müller</p>
                </div>
              </div>
              <ChevronRight size={20} className="text-slate-300 group-hover:text-brand-primary transition-colors" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Safety Section */}
      <div className="px-6 space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-black text-brand-dark tracking-tight">Arbeitssicherheit</h4>
          <ShieldCheck className="text-emerald-500" size={20} />
        </div>

        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex items-center justify-between group cursor-pointer" onClick={() => setShowSafetyModal(true)}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h5 className="font-bold text-emerald-900">Sicherheitsunterweisung</h5>
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">1 neue Unterweisung fällig</p>
            </div>
          </div>
          <div className="w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Plus size={16} />
          </div>
        </div>
      </div>

      {/* Quick Actions Floating Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-brand-dark/90 backdrop-blur-xl p-2 rounded-full shadow-2xl border border-white/10 flex items-center gap-2 z-40">
        <button className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all">
          <Camera size={20} />
        </button>
        <button className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all">
          <MessageSquare size={20} />
        </button>
        <button className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all">
          <MapPin size={20} />
        </button>
        <div className="w-px h-6 bg-white/10 mx-1" />
        <button className="px-6 h-12 bg-brand-primary text-white rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-brand-primary/20">
          Rapportzettel
        </button>
      </div>

      {/* Safety Briefing Modal */}
      <AnimatePresence>
        {showSafetyModal && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-end justify-center">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full rounded-t-[3rem] shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Sicherheitsunterweisung</h3>
                <button onClick={() => setShowSafetyModal(false)} className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6 mb-12">
                {briefings.map(b => (
                  <div key={b.id} className={`p-6 rounded-3xl border ${b.signed_by.includes('Max Mustermann') ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-black text-brand-dark">{b.title}</h4>
                      {b.signed_by.includes('Max Mustermann') ? (
                        <CheckCircle2 className="text-emerald-500" size={20} />
                      ) : (
                        <span className="text-[10px] font-black bg-amber-500 text-white px-3 py-1 rounded-full uppercase tracking-widest">Fällig</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">{b.content}</p>
                    {!b.signed_by.includes('Max Mustermann') && (
                      <button 
                        onClick={() => handleSignBriefing(b.id)}
                        className="w-full py-4 bg-brand-dark text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-brand-dark/20"
                      >
                        Gelesen & Bestätigt
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
