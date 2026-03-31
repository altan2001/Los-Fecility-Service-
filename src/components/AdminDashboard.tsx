import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';

export default function AdminDashboard({ onSelectProject, onViewDiary }: { onSelectProject?: (id: string) => void, onViewDiary?: (id: string) => void }) {
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalRevenue: 0,
    pendingInvoices: 0,
    approvedChangeOrders: 0
  });

  const [recentProjects, setRecentProjects] = useState<any[]>([]);

  const [chartData, setChartData] = useState([
    { name: 'Jan', revenue: 45000, costs: 32000 },
    { name: 'Feb', revenue: 52000, costs: 38000 },
    { name: 'Mar', revenue: 48000, costs: 35000 },
    { name: 'Apr', revenue: 61000, costs: 42000 },
    { name: 'May', revenue: 55000, costs: 40000 },
    { name: 'Jun', revenue: 67000, costs: 48000 },
  ]);

  useEffect(() => {
    fetchStats();
    fetchRecentProjects();
  }, []);

  const fetchRecentProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setRecentProjects(data.slice(0, 5));
    } catch (err) {
      console.error('Error fetching recent projects:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const [projectsRes, invoicesRes, ordersRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/invoices/all'), // I need to add this endpoint
        fetch('/api/change-orders/all') // And this one
      ]);
      
      // For now, using mock data if endpoints don't exist yet
      setStats({
        totalProjects: 12,
        activeProjects: 8,
        totalRevenue: 245000,
        pendingInvoices: 4,
        approvedChangeOrders: 7
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  return (
    <div id="admin-dashboard-container" className="space-y-8">
      {/* Stats Grid */}
      <div id="admin-stats-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Gesamtumsatz" 
          value={stats.totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
          trend="+12.5%"
          trendType="up"
          icon={<TrendingUp size={24} />}
          color="bg-emerald-500"
        />
        <StatCard 
          title="Aktive Projekte" 
          value={stats.activeProjects.toString()}
          trend="+2"
          trendType="up"
          icon={<Briefcase size={24} />}
          color="bg-blue-500"
        />
        <StatCard 
          title="Offene Rechnungen" 
          value={stats.pendingInvoices.toString()}
          trend="-1"
          trendType="down"
          icon={<Clock size={24} />}
          color="bg-amber-500"
        />
        <StatCard 
          title="Genehmigte Nachträge" 
          value={stats.approvedChangeOrders.toString()}
          trend="+3"
          trendType="up"
          icon={<CheckCircle2 size={24} />}
          color="bg-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Chart */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-brand-dark tracking-tighter">Umsatz vs. Kosten</h3>
            <select className="bg-slate-50 border-none rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none">
              <option>Letzte 6 Monate</option>
              <option>Letztes Jahr</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }}
                  tickFormatter={(value) => `${value / 1000}k`}
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" fill="#F27D26" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="costs" fill="#141414" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Status */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <h3 className="text-xl font-black text-brand-dark tracking-tighter mb-8">Projekt-Status Übersicht</h3>
          <div className="space-y-6">
            <ProjectStatusItem title="In Planung" count={3} percentage={25} color="bg-blue-500" />
            <ProjectStatusItem title="In Ausführung" count={6} percentage={50} color="bg-brand-primary" />
            <ProjectStatusItem title="Abgeschlossen" count={2} percentage={15} color="bg-emerald-500" />
            <ProjectStatusItem title="Pausiert" count={1} percentage={10} color="bg-amber-500" />
          </div>
          
          <div className="mt-12 p-6 bg-slate-50 rounded-[2rem] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Durchschnittliche Marge</p>
              <p className="text-2xl font-black text-brand-dark">28.4%</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-xl font-black text-brand-dark tracking-tighter">Aktuelle Projekte</h3>
          <button className="text-xs font-bold text-brand-primary uppercase tracking-widest hover:underline">Alle ansehen</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-slate-50">
                <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Projekt</th>
                <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Kunde</th>
                <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Datum</th>
                <th className="pb-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {recentProjects.map((project) => (
                <tr key={project.id} className="group">
                  <td className="py-4">
                    <p className="font-bold text-brand-dark group-hover:text-brand-primary transition-colors">{project.name}</p>
                  </td>
                  <td className="py-4">
                    <p className="text-sm text-slate-600 font-medium">{project.customer_name}</p>
                  </td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      project.status === 'Entwurf' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="py-4">
                    <p className="text-sm text-slate-400 font-medium">{new Date(project.created_at).toLocaleDateString('de-DE')}</p>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => onViewDiary?.(project.id)}
                        className="text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:bg-slate-100 px-3 py-2 rounded-xl transition-all"
                        title="Bautagebuch"
                      >
                        Tagebuch
                      </button>
                      <button 
                        onClick={() => onSelectProject?.(project.id)}
                        className="text-brand-primary font-bold text-xs uppercase tracking-widest hover:bg-brand-primary hover:text-white px-4 py-2 rounded-xl transition-all"
                      >
                        Bearbeiten
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {recentProjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic">Keine Projekte gefunden.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, trendType, icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
      <div className="flex justify-between items-start mb-4">
        <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ${trendType === 'up' ? 'text-emerald-600' : 'text-red-600'}`}>
          {trendType === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {trend}
        </div>
      </div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-2xl font-black text-brand-dark tracking-tight">{value}</p>
    </div>
  );
}

function ProjectStatusItem({ title, count, percentage, color }: any) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm font-bold">
        <span className="text-brand-dark">{title}</span>
        <span className="text-slate-400">{count}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}
