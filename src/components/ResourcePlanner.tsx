import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Users, Clock, Plus, Trash2, X, Info } from 'lucide-react';
import axios from 'axios';

interface ResourceEvent {
  id: string;
  project_id?: string;
  worker_name: string;
  start_date: string;
  end_date: string;
  type: 'project' | 'leave' | 'meeting';
  notes?: string;
  project_name?: string;
}

interface Worker {
  id: string;
  name: string;
  role: string;
}

interface SimpleProject {
  id: string;
  name: string;
}

export default function ResourcePlanner() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('month');
  const [events, setEvents] = useState<ResourceEvent[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [projects, setProjects] = useState<SimpleProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [newAssignment, setNewAssignment] = useState({
    worker_name: '',
    project_id: '',
    start_date: '',
    end_date: '',
    type: 'project' as const,
    notes: ''
  });
  const [newWorker, setNewWorker] = useState({
    name: '',
    role: 'Geselle'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [eventsRes, workersRes, projectsRes] = await Promise.all([
        axios.get('/api/resource-assignments'),
        axios.get('/api/workers'),
        axios.get('/api/projects-simple')
      ]);
      
      // Map project names to events
      const projectsMap = projectsRes.data.reduce((acc: any, p: any) => {
        acc[p.id] = p.name;
        return acc;
      }, {});

      const mappedEvents = eventsRes.data.map((e: any) => ({
        ...e,
        project_name: e.project_id ? projectsMap[e.project_id] : null
      }));

      setEvents(mappedEvents);
      setWorkers(workersRes.data);
      setProjects(projectsRes.data);
    } catch (err) {
      console.error('Error fetching resource data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/resource-assignments', newAssignment);
      setShowAddModal(false);
      setNewAssignment({
        worker_name: '',
        project_id: '',
        start_date: '',
        end_date: '',
        type: 'project',
        notes: ''
      });
      fetchData();
    } catch (err) {
      console.error('Error adding assignment:', err);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    try {
      await axios.delete(`/api/resource-assignments/${id}`);
      setShowDeleteConfirm(null);
      fetchData();
    } catch (err) {
      console.error('Error deleting assignment:', err);
    }
  };

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/workers', newWorker);
      setNewWorker({ name: '', role: 'Geselle' });
      fetchData();
    } catch (err) {
      console.error('Error adding worker:', err);
    }
  };

  const handleDeleteWorker = async (id: string) => {
    try {
      await axios.delete(`/api/workers/${id}`);
      fetchData();
    } catch (err) {
      console.error('Error deleting worker:', err);
    }
  };

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  
  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    start.setDate(diff);
    
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  };

  const prevDate = () => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (view === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
    }
  };

  const nextDate = () => {
    if (view === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (view === 'week') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
    }
  };

  const getHeaderTitle = () => {
    if (view === 'month') {
      return currentDate.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
    } else if (view === 'week') {
      const weekDays = getWeekDays(currentDate);
      const first = weekDays[0];
      const last = weekDays[6];
      return `${first.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - ${last.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
    }
  };

  const renderCalendarGrid = () => {
    if (view === 'month') {
      const daysInMonth = getDaysInMonth(currentDate);
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-4 text-left border-b border-slate-100 min-w-[200px] sticky left-0 bg-slate-50 z-10">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <Users size={14} /> Mitarbeiter
                  </div>
                </th>
                {Array.from({ length: daysInMonth }).map((_, i) => (
                  <th key={i} className="p-2 text-center border-b border-l border-slate-100 min-w-[40px]">
                    <span className="text-[10px] font-bold text-slate-400">{i + 1}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="p-4 border-b border-slate-100 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {worker.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-brand-dark">{worker.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{worker.role}</p>
                      </div>
                    </div>
                  </td>
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                    const dayEvents = events.filter(e => e.worker_name === worker.name && dateStr >= e.start_date && dateStr <= e.end_date);
                    
                    return (
                      <td key={i} className="p-1 border-b border-l border-slate-100 relative h-16">
                        {dayEvents.map((event, eIdx) => (
                          <div 
                            key={event.id}
                            className={`absolute inset-x-1 rounded-lg text-[8px] p-1 font-bold overflow-hidden leading-tight cursor-pointer group ${
                              event.type === 'project' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' :
                              event.type === 'leave' ? 'bg-red-50 text-red-600 border border-red-100' :
                              'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}
                            style={{ top: `${eIdx * 20 + 4}px`, height: '18px' }}
                            title={`${event.type === 'project' ? event.project_name : event.type}: ${event.notes || ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate">
                                {dateStr === event.start_date && (event.type === 'project' ? event.project_name : event.type)}
                              </span>
                              <button 
                                onClick={() => handleDeleteAssignment(event.id)}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                              >
                                <X size={8} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else if (view === 'week') {
      const weekDays = getWeekDays(currentDate);
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-4 text-left border-b border-slate-100 min-w-[200px] sticky left-0 bg-slate-50 z-10">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <Users size={14} /> Mitarbeiter
                  </div>
                </th>
                {weekDays.map((day, i) => (
                  <th key={i} className="p-4 text-center border-b border-l border-slate-100 min-w-[120px]">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {day.toLocaleDateString('de-DE', { weekday: 'short' })}
                      </span>
                      <span className="text-sm font-black text-brand-dark">
                        {day.getDate()}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr key={worker.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="p-4 border-b border-slate-100 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {worker.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-brand-dark">{worker.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{worker.role}</p>
                      </div>
                    </div>
                  </td>
                  {weekDays.map((day, i) => {
                    const dateStr = day.toISOString().split('T')[0];
                    const dayEvents = events.filter(e => e.worker_name === worker.name && dateStr >= e.start_date && dateStr <= e.end_date);
                    
                    return (
                      <td key={i} className="p-2 border-b border-l border-slate-100 relative h-24">
                        <div className="space-y-1">
                          {dayEvents.map((event) => (
                            <div 
                              key={event.id}
                              className={`rounded-xl text-[10px] p-2 font-bold overflow-hidden leading-tight cursor-pointer group shadow-sm border ${
                                event.type === 'project' ? 'bg-brand-primary/5 text-brand-primary border-brand-primary/10' :
                                event.type === 'leave' ? 'bg-red-50 text-red-600 border-red-100' :
                                'bg-amber-50 text-amber-600 border-amber-100'
                              }`}
                              title={`${event.type === 'project' ? event.project_name : event.type}: ${event.notes || ''}`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="truncate">
                                  {event.type === 'project' ? event.project_name : event.type}
                                </span>
                                <button 
                                  onClick={() => handleDeleteAssignment(event.id)}
                                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else {
      // Day view
      const dateStr = currentDate.toISOString().split('T')[0];
      return (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workers.map((worker) => {
              const dayEvents = events.filter(e => e.worker_name === worker.name && dateStr >= e.start_date && dateStr <= e.end_date);
              return (
                <div key={worker.id} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-sm font-bold text-brand-primary shadow-sm">
                      {worker.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h4 className="font-black text-brand-dark">{worker.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{worker.role}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {dayEvents.length > 0 ? dayEvents.map(event => (
                      <div 
                        key={event.id}
                        className={`p-4 rounded-2xl border flex items-center justify-between group ${
                          event.type === 'project' ? 'bg-white border-brand-primary/10 text-brand-primary' :
                          event.type === 'leave' ? 'bg-red-50 border-red-100 text-red-600' :
                          'bg-amber-50 border-amber-100 text-amber-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            event.type === 'project' ? 'bg-brand-primary' :
                            event.type === 'leave' ? 'bg-red-500' :
                            'bg-amber-500'
                          }`} />
                          <div>
                            <p className="text-sm font-black">
                              {event.type === 'project' ? event.project_name : event.type}
                            </p>
                            {event.notes && <p className="text-[10px] opacity-70">{event.notes}</p>}
                          </div>
                        </div>
                        <button 
                          onClick={() => setShowDeleteConfirm(event.id)}
                          className="opacity-0 group-hover:opacity-100 p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )) : (
                      <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Keine Einsätze</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  };

  // Stats calculation (simplified for now, ideally should be view-dependent)
  const activeProjectsCount = new Set(events.filter(e => e.type === 'project' && e.project_id).map(e => e.project_id)).size;
  const daysInMonth = getDaysInMonth(currentDate);
  const totalDaysInMonth = daysInMonth * workers.length;
  const assignedDaysInMonth = events.reduce((acc, event) => {
    const start = new Date(event.start_date);
    const end = new Date(event.end_date);
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const actualStart = start < monthStart ? monthStart : start;
    const actualEnd = end > monthEnd ? monthEnd : end;
    
    if (actualStart > actualEnd) return acc;
    
    const diffTime = Math.abs(actualEnd.getTime() - actualStart.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return acc + diffDays;
  }, 0);

  const utilization = totalDaysInMonth > 0 ? Math.round((assignedDaysInMonth / totalDaysInMonth) * 100) : 0;
  const openCapacityHours = (totalDaysInMonth - assignedDaysInMonth) * 8;

  return (
    <div id="resource-planner-container" className="space-y-6">
      <div id="resource-calendar-header" className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-brand-dark">{getHeaderTitle()}</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ressourcen- & Einsatzplanung</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            {(['day', 'week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  view === v ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {v === 'day' ? 'Tag' : v === 'week' ? 'Woche' : 'Monat'}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setShowWorkerModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs uppercase tracking-widest"
          >
            <Users size={16} />
            <span>Mitarbeiter</span>
          </button>

          <div className="flex items-center gap-2">
            <button onClick={prevDate} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold text-brand-primary hover:bg-brand-primary/5 rounded-xl transition-colors">
              Heute
            </button>
            <button onClick={nextDate} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20"
          >
            <Plus size={18} />
            <span>Neuer Einsatz</span>
          </button>
        </div>
      </div>

      <div id="resource-calendar-grid" className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        {renderCalendarGrid()}
      </div>

      <div id="resource-stats-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-2xl font-black text-brand-dark">{utilization}%</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Auslastung</p>
          </div>
        </div>
        <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-2xl font-black text-brand-dark">{openCapacityHours}h</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Offene Kapazität</p>
          </div>
        </div>
        <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
            <CalendarIcon size={24} />
          </div>
          <div>
            <p className="text-2xl font-black text-brand-dark">{activeProjectsCount}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aktive Projekte</p>
          </div>
        </div>
      </div>

      {/* Add Assignment Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
                    <Plus size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-brand-dark">Neuer Einsatz</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mitarbeiter verplanen</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddAssignment} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mitarbeiter</label>
                    <select 
                      required
                      value={newAssignment.worker_name}
                      onChange={(e) => setNewAssignment({...newAssignment, worker_name: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    >
                      <option value="">Wählen...</option>
                      {workers.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Typ</label>
                    <select 
                      required
                      value={newAssignment.type}
                      onChange={(e) => setNewAssignment({...newAssignment, type: e.target.value as any})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    >
                      <option value="project">Projekt</option>
                      <option value="leave">Urlaub</option>
                      <option value="meeting">Meeting</option>
                    </select>
                  </div>
                </div>

                {newAssignment.type === 'project' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Projekt</label>
                    <select 
                      required
                      value={newAssignment.project_id}
                      onChange={(e) => setNewAssignment({...newAssignment, project_id: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    >
                      <option value="">Wählen...</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Startdatum</label>
                    <input 
                      type="date"
                      required
                      value={newAssignment.start_date}
                      onChange={(e) => setNewAssignment({...newAssignment, start_date: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Enddatum</label>
                    <input 
                      type="date"
                      required
                      value={newAssignment.end_date}
                      onChange={(e) => setNewAssignment({...newAssignment, end_date: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notizen</label>
                  <textarea 
                    value={newAssignment.notes}
                    onChange={(e) => setNewAssignment({...newAssignment, notes: e.target.value})}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-primary/20 transition-all min-h-[100px]"
                    placeholder="Optionale Details..."
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Abbrechen
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20"
                  >
                    Speichern
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-sm p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-brand-dark mb-2">Einsatz löschen?</h3>
              <p className="text-slate-400 text-sm font-medium mb-8">Dieser Vorgang kann nicht rückgängig gemacht werden.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Abbrechen
                </button>
                <button 
                  onClick={() => handleDeleteAssignment(showDeleteConfirm)}
                  className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
                >
                  Löschen
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Worker Management Modal */}
      <AnimatePresence>
        {showWorkerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-brand-dark rounded-2xl flex items-center justify-center text-white">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-brand-dark">Mitarbeiterverwaltung</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Team bearbeiten</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowWorkerModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto">
                <form onSubmit={handleAddWorker} className="flex gap-4 mb-8">
                  <div className="flex-1">
                    <input 
                      type="text"
                      required
                      placeholder="Name des Mitarbeiters"
                      value={newWorker.name}
                      onChange={(e) => setNewWorker({...newWorker, name: e.target.value})}
                      className="w-full px-5 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    />
                  </div>
                  <div className="w-40">
                    <select 
                      value={newWorker.role}
                      onChange={(e) => setNewWorker({...newWorker, role: e.target.value})}
                      className="w-full px-5 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-brand-dark focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    >
                      <option value="Meister">Meister</option>
                      <option value="Geselle">Geselle</option>
                      <option value="Helfer">Helfer</option>
                      <option value="Azubi">Azubi</option>
                    </select>
                  </div>
                  <button 
                    type="submit"
                    className="px-6 py-3 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20"
                  >
                    Hinzufügen
                  </button>
                </form>

                <div className="space-y-3">
                  {workers.map(worker => (
                    <div key={worker.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xs font-bold text-brand-primary shadow-sm">
                          {worker.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-bold text-brand-dark">{worker.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{worker.role}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteWorker(worker.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

