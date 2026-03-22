import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Briefcase,
  Search,
  Filter,
  ArrowUpRight,
  Calendar,
  User,
  MoreVertical,
  Edit3,
  Trash2,
  Euro
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

interface Project {
  id: number;
  name: string;
  customer_name: string;
  status: string;
  created_at: string;
  updated_at: string;
  total_amount?: number;
}

export default function ProjectVisualOverview({ onEditProject, onViewDiary }: { onEditProject: (id: number) => void, onViewDiary: (id: number) => void }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      
      // Fetch totals for each project to make it more "visual"
      const projectsWithTotals = await Promise.all(data.map(async (p: Project) => {
        try {
          const itemsRes = await fetch(`/api/projects/${p.id}/items`);
          const items = await itemsRes.json();
          const total = items.reduce((sum: number, item: any) => sum + (item.quantity * (item.unit_price || 0)), 0);
          return { ...p, total_amount: total };
        } catch (err) {
          return p;
        }
      }));
      
      setProjects(projectsWithTotals);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = projects.reduce((acc: any, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value: value as number }));
  
  const COLORS = ['#F27D26', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#64748b'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Entwurf': return 'bg-slate-100 text-slate-500 border-slate-200';
      case 'Aktiv': return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'Abgeschlossen': return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'Pausiert': return 'bg-amber-100 text-amber-600 border-amber-200';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Entwurf': return <Clock size={14} />;
      case 'Aktiv': return <TrendingUp size={14} />;
      case 'Abgeschlossen': return <CheckCircle2 size={14} />;
      case 'Pausiert': return <AlertCircle size={14} />;
      default: return <Clock size={14} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Visual Stats Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-brand-dark tracking-tighter">Status-Verteilung</h3>
            <div className="flex gap-2">
              {Object.entries(statusCounts).map(([status, count], idx) => (
                <div key={status} className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{status}: {count as number}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pieData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} width={100} />
                <RechartsTooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
          <div className="w-20 h-20 bg-brand-accent rounded-[2rem] flex items-center justify-center text-brand-primary mb-4 shadow-lg shadow-brand-primary/10">
            <Briefcase size={40} />
          </div>
          <h3 className="text-3xl font-black text-brand-dark tracking-tighter">{projects.length}</h3>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Projekte Insgesamt</p>
          <div className="mt-6 grid grid-cols-2 gap-4 w-full">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Aktiv</p>
              <p className="text-xl font-black text-emerald-700">{statusCounts['Aktiv'] || 0}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Abgeschlossen</p>
              <p className="text-xl font-black text-blue-700">{statusCounts['Abgeschlossen'] || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Projekte oder Kunden suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-xs uppercase tracking-widest text-slate-600 cursor-pointer"
          >
            <option value="all">Alle Status</option>
            {Object.keys(statusCounts).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex bg-slate-50 rounded-2xl p-1">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Briefcase size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <FileText size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid/List */}
      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div 
            key="grid"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filteredProjects.map((project) => (
              <motion.div 
                key={project.id}
                layout
                className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden"
              >
                <div className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${getStatusColor(project.status)}`}>
                      {getStatusIcon(project.status)}
                      {project.status}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onEditProject(project.id)}
                        className="p-2 bg-slate-50 text-slate-400 hover:bg-brand-primary hover:text-white rounded-xl transition-all"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => onViewDiary(project.id)}
                        className="p-2 bg-slate-50 text-slate-400 hover:bg-brand-primary hover:text-white rounded-xl transition-all"
                      >
                        <Clock size={16} />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-xl font-black text-brand-dark mb-2 group-hover:text-brand-primary transition-colors line-clamp-1">
                    {project.name}
                  </h4>
                  
                  <div className="flex items-center gap-2 text-slate-500 mb-6">
                    <User size={14} />
                    <span className="text-xs font-medium">{project.customer_name}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-6 border-t border-slate-50">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Volumen</p>
                      <p className="text-lg font-black text-brand-dark">
                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(project.total_amount || 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Aktualisiert</p>
                      <p className="text-xs font-bold text-slate-600">
                        {new Date(project.updated_at || project.created_at).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => onEditProject(project.id)}
                  className="w-full py-4 bg-slate-50 text-brand-primary text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  Projekt Details <ArrowUpRight size={14} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden"
          >
            <table className="w-full">
              <thead>
                <tr className="text-left bg-slate-50/50">
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Projekt</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Kunde</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Letzte Änderung</th>
                  <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Volumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredProjects.map((project) => (
                  <tr 
                    key={project.id} 
                    className="hover:bg-slate-50/30 transition-colors cursor-pointer group"
                    onClick={() => onEditProject(project.id)}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center text-brand-primary">
                          <FileText size={20} />
                        </div>
                        <span className="font-bold text-brand-dark group-hover:text-brand-primary transition-colors">{project.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm text-slate-600 font-medium">{project.customer_name}</td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getStatusColor(project.status)}`}>
                        {project.status}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-sm text-slate-400 font-medium">
                      {new Date(project.updated_at || project.created_at).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-8 py-5 text-right font-black text-brand-dark">
                      {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(project.total_amount || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      {filteredProjects.length === 0 && (
        <div className="py-20 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200 text-slate-400 italic">
          Keine Projekte gefunden, die Ihren Kriterien entsprechen.
        </div>
      )}
    </div>
  );
}
