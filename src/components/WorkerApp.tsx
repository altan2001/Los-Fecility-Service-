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
  UserCheck,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, addDoc, doc, updateDoc, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../App';
import ProjectChat from './ProjectChat';

interface Task {
  id: string;
  project_id: string;
  project_name?: string;
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
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [briefings, setBriefings] = useState<SafetyBriefing[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Fetch tasks assigned to the user
    const qTasks = query(
      collection(db, 'tasks'),
      where('assigned_to', '==', user.uid),
      orderBy('due_date', 'asc')
    );

    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    // Fetch briefings
    const qBriefings = query(
      collection(db, 'safety_briefings'),
      orderBy('date', 'desc')
    );

    const unsubscribeBriefings = onSnapshot(qBriefings, (snapshot) => {
      setBriefings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SafetyBriefing)));
    });

    return () => {
      unsubscribeTasks();
      unsubscribeBriefings();
    };
  }, [user]);

  useEffect(() => {
    let interval: any;
    if (isTracking) {
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTracking]);

  const handleStartArbeit = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsTracking(true);
        setIsLocating(false);
      }, (error) => {
        console.error("Location error:", error);
        setIsTracking(true); // Still start even if location fails
        setIsLocating(false);
      });
    } else {
      setIsTracking(true);
      setIsLocating(false);
    }
  };

  const handleStopArbeit = async () => {
    if (!user) return;
    
    // Save time entry to Firestore
    try {
      await addDoc(collection(db, 'time_entries'), {
        worker_id: user.uid,
        worker_name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        duration_seconds: timeElapsed,
        lat: location?.lat || null,
        lng: location?.lng || null,
        timestamp: serverTimestamp(),
        project_id: activeTask?.project_id || 'general'
      });
      
      setIsTracking(false);
      setTimeElapsed(0);
      setLocation(null);
    } catch (err) {
      console.error('Error saving time entry:', err);
    }
  };

  const handleSignBriefing = async (briefingId: string) => {
    if (!user) return;
    try {
      const briefingRef = doc(db, 'safety_briefings', briefingId);
      const briefing = briefings.find(b => b.id === briefingId);
      if (briefing) {
        await updateDoc(briefingRef, {
          signed_by: [...briefing.signed_by, user.uid]
        });
      }
    } catch (err) {
      console.error('Error signing briefing:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
              <h3 className="text-xl font-black tracking-tight">{user?.first_name} {user?.last_name || 'Mitarbeiter'}</h3>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">{user?.role || 'Fachkraft'}</p>
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
          
          {location && (
            <div className="flex items-center gap-2 mb-4 bg-emerald-500/20 px-3 py-1.5 rounded-lg border border-emerald-500/30">
              <Navigation size={12} className="text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Standort erfasst: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
            </div>
          )}

          <button 
            onClick={isTracking ? handleStopArbeit : handleStartArbeit}
            disabled={isLocating}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 transition-all ${
              isTracking 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                : 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20'
            } disabled:opacity-50`}
          >
            {isLocating ? (
              <span className="flex items-center gap-2">
                <Clock className="animate-spin" size={20} /> Ortung...
              </span>
            ) : isTracking ? (
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
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projekt: {task.project_name || 'Unbekannt'}</p>
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
        <button 
          onClick={() => setShowChatModal(true)}
          className="w-12 h-12 bg-white/10 text-white rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
        >
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

      {/* Chat Modal */}
      <AnimatePresence>
        {showChatModal && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-end justify-center">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full rounded-t-[3rem] shadow-2xl pb-10 max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-8 pb-2 flex justify-between items-center">
                <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Team Chat</h3>
                <button onClick={() => setShowChatModal(false)} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ProjectChat projectId={activeTask?.project_id || 'general'} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                  <div key={b.id} className={`p-6 rounded-3xl border ${b.signed_by.includes(user?.uid || '') ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-black text-brand-dark">{b.title}</h4>
                      {b.signed_by.includes(user?.uid || '') ? (
                        <CheckCircle2 className="text-emerald-500" size={20} />
                      ) : (
                        <span className="text-[10px] font-black bg-amber-500 text-white px-3 py-1 rounded-full uppercase tracking-widest">Fällig</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">{b.content}</p>
                    {!(b.signed_by.includes(user?.uid || '')) && (
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
