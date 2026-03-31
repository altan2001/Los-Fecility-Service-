import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Clock, 
  User, 
  Calendar,
  ChevronRight,
  Search,
  Filter,
  AlertCircle
} from 'lucide-react';
import { motion } from 'motion/react';

interface Project {
  id: string;
  name: string;
  customer_name: string;
  status: string;
  tags?: string[];
  created_at: string;
}

export default function MyProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('Alle');

  useEffect(() => {
    fetchProjects();
  }, []);

  const allTags = ['Alle', ...Array.from(new Set(projects.flatMap(p => p.tags || [])))];

  const fetchProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Fehler beim Laden der Projekte');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Ihre Projekte konnten nicht geladen werden. Bitte versuchen Sie es später erneut.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.tags && p.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())));
    
    const matchesTag = selectedTag === 'Alle' || (p.tags && p.tags.includes(selectedTag));
    
    return matchesSearch && matchesTag;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-8 rounded-[2rem] text-center border border-red-100 max-w-2xl mx-auto my-10">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={40} />
        <h3 className="text-xl font-bold text-red-700 mb-2">Hoppla!</h3>
        <p className="text-red-600 mb-6">{error}</p>
        <button 
          onClick={fetchProjects}
          className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-red-700 transition-all"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Projekte suchen..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium shadow-sm"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 w-full md:w-auto no-scrollbar">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                selectedTag === tag 
                  ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' 
                  : 'bg-white text-slate-500 border border-slate-100 hover:border-brand-primary/30'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => (
          <motion.div 
            key={project.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-brand-primary/5 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-brand-primary/10 transition-colors" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 bg-brand-accent rounded-2xl flex items-center justify-center text-brand-primary">
                  <FileText size={24} />
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  project.status === 'Entwurf' ? 'bg-slate-100 text-slate-500' : 
                  project.status === 'Aktiv' ? 'bg-emerald-100 text-emerald-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {project.status}
                </span>
              </div>

              <h3 className="text-xl font-black text-brand-dark tracking-tighter mb-4 group-hover:text-brand-primary transition-colors">
                {project.name}
              </h3>

              {project.tags && project.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tags.map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-100">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-3 mb-8">
                <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
                  <User size={16} className="text-slate-400" />
                  <span>{project.customer_name}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
                  <Calendar size={16} className="text-slate-400" />
                  <span>
                    {new Date(project.created_at).toLocaleDateString('de-DE', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })}
                  </span>
                </div>
              </div>

              <button className="w-full py-3 bg-slate-50 text-brand-dark font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-brand-primary hover:text-white transition-all group/btn">
                Details ansehen
                <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-6 text-slate-300">
              <FileText size={40} />
            </div>
            <h3 className="text-2xl font-black text-brand-dark tracking-tighter mb-2">Keine Projekte gefunden</h3>
            <p className="text-slate-500 font-medium">Erstellen Sie Ihre erste Kalkulation, um ein Projekt zu starten.</p>
          </div>
        )}
      </div>
    </div>
  );
}
