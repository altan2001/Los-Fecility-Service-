import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Trash2, 
  Edit3, 
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  TrendingUp,
  Briefcase,
  Clock,
  CheckCircle2,
  Euro,
  Image as ImageIcon,
  Plus,
  X,
  Upload
} from 'lucide-react';
import { motion } from 'motion/react';
import { Modal } from './Modal';

interface Project {
  id: number;
  name: string;
  customer_name: string;
  status: string;
  created_at: string;
}

interface ProjectOverviewProps {
  onEditProject: (id: number) => void;
  onViewDiary: (id: number) => void;
}

export default function ProjectOverview({ onEditProject, onViewDiary }: ProjectOverviewProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [managingImagesProjectId, setManagingImagesProjectId] = useState<number | null>(null);
  const [projectImages, setProjectImages] = useState<any[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    totalRevenue: 0,
    pendingInvoices: 0,
    approvedChangeOrders: 0
  });

  useEffect(() => {
    fetchProjects();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [projectsRes, invoicesRes, ordersRes] = await Promise.all([
        fetch('/api/projects'),
        fetch('/api/invoices/all'),
        fetch('/api/change-orders/all')
      ]);

      const projectsData = await projectsRes.json();
      const invoicesData = await invoicesRes.json();
      const ordersData = await ordersRes.json();

      setStats({
        totalProjects: projectsData.length,
        activeProjects: projectsData.filter((p: any) => p.status === 'Aktiv').length,
        totalRevenue: invoicesData.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0),
        pendingInvoices: invoicesData.filter((inv: any) => inv.status === 'pending' || inv.status === 'draft').length,
        approvedChangeOrders: ordersData.filter((ord: any) => ord.status === 'approved').length
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectImages = async (projectId: number) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/images`);
      const data = await res.json();
      setProjectImages(data);
    } catch (err) {
      console.error('Error fetching project images:', err);
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !managingImagesProjectId) return;

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name);

    try {
      const res = await fetch(`/api/projects/${managingImagesProjectId}/images`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        fetchProjectImages(managingImagesProjectId);
      }
    } catch (err) {
      console.error('Error uploading image:', err);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!confirm('Möchten Sie dieses Bild wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/projects/${managingImagesProjectId}/images/${imageId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setProjectImages(prev => prev.filter(img => img.id !== imageId));
      }
    } catch (err) {
      console.error('Error deleting image:', err);
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('Möchten Sie dieses Projekt wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         p.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    
    const projectDate = new Date(p.created_at);
    const matchesDateFrom = !dateFrom || projectDate >= new Date(dateFrom);
    const matchesDateTo = !dateTo || projectDate <= new Date(dateTo + 'T23:59:59');

    return matchesSearch && matchesStatus && matchesDateFrom && matchesDateTo;
  });

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (sortBy === 'created_at') {
      comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortBy === 'status') {
      comparison = a.status.localeCompare(b.status);
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const statuses = Array.from(new Set(projects.map(p => p.status)));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  return (
    <div id="project-overview-container" className="space-y-6">
      {/* Stats Grid */}
      <div id="project-stats-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
              <Briefcase size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Projekte</span>
          </div>
          <div className="text-2xl font-black text-brand-dark tracking-tighter">{stats.totalProjects}</div>
          <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Gesamt</div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aktiv</span>
          </div>
          <div className="text-2xl font-black text-brand-dark tracking-tighter">{stats.activeProjects}</div>
          <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">In Arbeit</div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center text-brand-primary">
              <Euro size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Umsatz</span>
          </div>
          <div className="text-2xl font-black text-brand-dark tracking-tighter">
            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(stats.totalRevenue)}
          </div>
          <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Gesamt</div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
              <Clock size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Offen</span>
          </div>
          <div className="text-2xl font-black text-brand-dark tracking-tighter">{stats.pendingInvoices}</div>
          <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Rechnungen</div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500">
              <CheckCircle2 size={20} />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nachträge</span>
          </div>
          <div className="text-2xl font-black text-brand-dark tracking-tighter">{stats.approvedChangeOrders}</div>
          <div className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Genehmigt</div>
        </div>
      </div>

      <div id="project-search-filter-bar" className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            id="project-search-input"
            type="text"
            placeholder="Projekte oder Kunden suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            id="project-filter-toggle-btn"
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
              showFilters || statusFilter !== 'all' || dateFrom || dateTo 
                ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Filter size={20} /> Filter
          </button>
          <div className="flex bg-slate-50 rounded-2xl p-1">
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-none outline-none px-4 py-2 text-xs font-bold text-slate-600 uppercase tracking-widest cursor-pointer"
            >
              <option value="name">Name</option>
              <option value="created_at">Datum</option>
              <option value="status">Status</option>
            </select>
            <button 
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 text-brand-primary hover:bg-white rounded-xl transition-all"
              title={sortOrder === 'asc' ? 'Aufsteigend' : 'Absteigend'}
            >
              {sortOrder === 'asc' ? <TrendingUp size={18} /> : <TrendingUp size={18} className="rotate-180" />}
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      {showFilters && (
        <motion.div 
          id="project-filters-panel"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Status</label>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium text-sm"
            >
              <option value="all">Alle Status</option>
              {statuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Von Datum</label>
            <input 
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium text-sm"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bis Datum</label>
            <input 
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium text-sm"
            />
          </div>
          {(statusFilter !== 'all' || dateFrom || dateTo) && (
            <div className="md:col-span-3 flex justify-end">
              <button 
                onClick={() => {
                  setStatusFilter('all');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="text-xs font-bold text-brand-primary hover:text-brand-dark transition-colors uppercase tracking-widest"
              >
                Filter zurücksetzen
              </button>
            </div>
          )}
        </motion.div>
      )}

      <div id="project-list-table-container" className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left bg-slate-50/50">
                <th 
                  className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-brand-primary transition-colors"
                  onClick={() => {
                    if (sortBy === 'name') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('name'); setSortOrder('asc'); }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Projektname
                    {sortBy === 'name' && (sortOrder === 'asc' ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />)}
                  </div>
                </th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Kunde</th>
                <th 
                  className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-brand-primary transition-colors"
                  onClick={() => {
                    if (sortBy === 'status') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('status'); setSortOrder('asc'); }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {sortBy === 'status' && (sortOrder === 'asc' ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />)}
                  </div>
                </th>
                <th 
                  className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-brand-primary transition-colors"
                  onClick={() => {
                    if (sortBy === 'created_at') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('created_at'); setSortOrder('asc'); }
                  }}
                >
                  <div className="flex items-center gap-2">
                    Erstellungsdatum
                    {sortBy === 'created_at' && (sortOrder === 'asc' ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />)}
                  </div>
                </th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedProjects.map((project) => (
                <motion.tr 
                  key={project.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-slate-50/30 transition-colors group"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center text-brand-primary">
                        <FileText size={20} />
                      </div>
                      <span className="font-bold text-brand-dark">{project.name}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm text-slate-600 font-medium">{project.customer_name}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      project.status === 'Entwurf' ? 'bg-slate-100 text-slate-500' : 
                      project.status === 'Aktiv' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm text-slate-400 font-medium">
                      {new Date(project.created_at).toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => {
                          setManagingImagesProjectId(project.id);
                          fetchProjectImages(project.id);
                        }}
                        className="p-2 bg-slate-50 text-slate-400 hover:bg-brand-primary hover:text-white rounded-xl transition-all"
                        title="Bilder verwalten"
                      >
                        <ImageIcon size={18} />
                      </button>
                      <button 
                        onClick={() => onViewDiary(project.id)}
                        className="p-2 bg-slate-50 text-slate-400 hover:bg-brand-primary hover:text-white rounded-xl transition-all"
                        title="Bautagebuch"
                      >
                        <Clock size={18} />
                      </button>
                      <button 
                        onClick={() => onEditProject(project.id)}
                        className="p-2 bg-slate-50 text-slate-400 hover:bg-brand-primary hover:text-white rounded-xl transition-all"
                        title="Bearbeiten"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteProject(project.id)}
                        className="p-2 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
                        title="Löschen"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {sortedProjects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-400 italic">
                    Keine Projekte gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Image Management Modal */}
      <Modal
        isOpen={!!managingImagesProjectId}
        onClose={() => setManagingImagesProjectId(null)}
        showBackButton={true}
        onBack={() => setManagingImagesProjectId(null)}
        title="Projektbilder verwalten"
        size="xl"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {projects.find(p => p.id === managingImagesProjectId)?.name}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-brand-primary hover:text-brand-primary transition-all cursor-pointer group">
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handleUploadImage}
                disabled={uploadingImage}
              />
              {uploadingImage ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
              ) : (
                <>
                  <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={24} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Bild hochladen</span>
                </>
              )}
            </label>

            {projectImages.map(image => (
              <div key={image.id} className="aspect-square rounded-3xl overflow-hidden relative group shadow-sm border border-slate-100">
                <img 
                  src={image.url} 
                  alt={image.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-brand-dark/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button 
                    onClick={() => handleDeleteImage(image.id)}
                    className="w-10 h-10 bg-white/20 backdrop-blur-md text-white hover:bg-red-500 hover:text-white rounded-xl flex items-center justify-center transition-all"
                    title="Löschen"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                {image.title && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-brand-dark/80 to-transparent">
                    <p className="text-white text-[10px] font-bold uppercase tracking-widest truncate">{image.title}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {projectImages.length === 0 && !uploadingImage && (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-300 mx-auto mb-4">
                <ImageIcon size={40} />
              </div>
              <p className="text-slate-400 italic">Noch keine Bilder für dieses Projekt hochgeladen.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
