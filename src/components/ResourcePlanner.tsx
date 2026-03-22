import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Users, Clock } from 'lucide-react';

interface ResourceEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  type: 'project' | 'leave' | 'meeting';
  resource: string;
}

export default function ResourcePlanner() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<ResourceEvent[]>([
    { id: 1, title: 'Projekt: Neubau Müller', start: '2026-03-10', end: '2026-03-15', type: 'project', resource: 'Max Mustermann' },
    { id: 2, title: 'Urlaub', start: '2026-03-12', end: '2026-03-14', type: 'leave', resource: 'Erika Musterfrau' },
    { id: 3, title: 'Projekt: Sanierung Schmidt', start: '2026-03-11', end: '2026-03-20', type: 'project', resource: 'Hans Dampf' },
  ]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const monthName = currentDate.toLocaleString('de-DE', { month: 'long', year: 'numeric' });

  const resources = ['Max Mustermann', 'Erika Musterfrau', 'Hans Dampf', 'Azubi Tim'];

  return (
    <div id="resource-planner-container" className="space-y-6">
      <div id="resource-calendar-header" className="flex items-center justify-between bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-brand-dark">{monthName}</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ressourcen- & Einsatzplanung</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold text-brand-primary hover:bg-brand-primary/5 rounded-xl transition-colors">
            Heute
          </button>
          <button onClick={nextMonth} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div id="resource-calendar-grid" className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-4 text-left border-b border-slate-100 min-w-[200px]">
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
              {resources.map((resource, idx) => (
                <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                  <td className="p-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                        {resource.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="text-sm font-bold text-brand-dark">{resource}</span>
                    </div>
                  </td>
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                    const event = events.find(e => e.resource === resource && dateStr >= e.start && dateStr <= e.end);
                    
                    return (
                      <td key={i} className="p-1 border-b border-l border-slate-100 relative h-12">
                        {event && (
                          <div 
                            className={`absolute inset-1 rounded-lg text-[8px] p-1 font-bold overflow-hidden leading-tight ${
                              event.type === 'project' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' :
                              event.type === 'leave' ? 'bg-red-50 text-red-600 border border-red-100' :
                              'bg-amber-50 text-amber-600 border border-amber-100'
                            }`}
                            title={event.title}
                          >
                            {dateStr === event.start && event.title}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div id="resource-stats-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-2xl font-black text-brand-dark">85%</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Auslastung</p>
          </div>
        </div>
        <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-2xl font-black text-brand-dark">120h</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Offene Kapazität</p>
          </div>
        </div>
        <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
            <CalendarIcon size={24} />
          </div>
          <div>
            <p className="text-2xl font-black text-brand-dark">4</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aktive Projekte</p>
          </div>
        </div>
      </div>
    </div>
  );
}
