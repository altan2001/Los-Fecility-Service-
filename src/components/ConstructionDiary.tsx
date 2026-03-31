import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Calendar, 
  CloudRain, 
  Thermometer, 
  Users, 
  ClipboardList,
  CheckCircle2,
  X,
  Paperclip,
  File as FileIcon,
  Image as ImageIcon,
  Upload,
  Download,
  ChevronRight,
  Loader2,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Project {
  id: string;
  name: string;
  client_name: string;
}

interface DiaryEntry {
  id: string;
  project_id: string;
  date: string;
  weather: string;
  temperature: number;
  work_done: string;
  notes: string;
  created_at: string;
}

interface Presence {
  id: string;
  diary_id: string;
  person_name: string;
  role: string;
  hours: number;
}

interface Attachment {
  id: string;
  diary_id: string;
  file_path: string;
  file_name: string;
  file_type: string;
  created_at: string;
}

export default function ConstructionDiary({ initialProjectId }: { initialProjectId?: string | null }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(initialProjectId || null);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [showNewDiaryForm, setShowNewDiaryForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDiary, setNewDiary] = useState({
    project_id: null as string | null,
    date: new Date().toISOString().split('T')[0],
    weather: 'Sonnig',
    temperature: 18,
    work_done: 'Materialanlieferung und Baustelleneinrichtung. Beginn der Arbeiten gemäß Bauzeitenplan.',
    notes: 'Keine besonderen Vorkommnisse.'
  });
  const [presenceList, setPresenceList] = useState<{ person_name: string; role: string; hours: number }[]>([
    { person_name: 'Max Mustermann', role: 'Bauleiter', hours: 8 }
  ]);
  const [newPresence, setNewPresence] = useState({ person_name: '', role: 'Geselle', hours: 8 });
  const [selectedDiaryForAttachments, setSelectedDiaryForAttachments] = useState<DiaryEntry | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzingPhotoId, setAnalyzingPhotoId] = useState<string | null>(null);
  const [photoAnalysis, setPhotoAnalysis] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchProjects();
  }, []);

  const analyzePhoto = async (attachment: Attachment) => {
    if (!attachment.file_path.match(/\.(jpg|jpeg|png|webp)$/i)) return;
    
    setAnalyzingPhotoId(attachment.id);
    try {
      const fileRes = await fetch(attachment.file_path);
      const blob = await fileRes.blob();
      const file = new File([blob], attachment.file_name, { type: attachment.file_type });
      
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/ai/analyze-photo', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setPhotoAnalysis(prev => ({ ...prev, [attachment.id]: data.analysis }));
      }
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      setAnalyzingPhotoId(null);
    }
  };

  useEffect(() => {
    if (initialProjectId) {
      setSelectedProject(initialProjectId);
    }
  }, [initialProjectId]);

  useEffect(() => {
    if (selectedProject) {
      fetchDiaries(selectedProject);
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

  const fetchDiaries = async (projectId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/diaries`);
      const data = await res.json();
      setDiaries(data);
    } catch (err) {
      console.error('Error fetching diaries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDiary = async (e: React.FormEvent) => {
    e.preventDefault();
    const projectId = selectedProject || newDiary.project_id;
    if (!projectId) {
      alert('Bitte wählen Sie ein Projekt aus.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/diaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newDiary,
          project_id: projectId,
          presence: presenceList
        })
      });
      if (res.ok) {
        setShowNewDiaryForm(false);
        setNewDiary({
          project_id: null,
          date: new Date().toISOString().split('T')[0],
          weather: 'Sonnig',
          temperature: 18,
          work_done: 'Materialanlieferung und Baustelleneinrichtung. Beginn der Arbeiten gemäß Bauzeitenplan.',
          notes: 'Keine besonderen Vorkommnisse.'
        });
        setPresenceList([
          { person_name: 'Max Mustermann', role: 'Bauleiter', hours: 8 }
        ]);
        if (selectedProject) {
          fetchDiaries(selectedProject);
        } else {
          setSelectedProject(projectId);
        }
      }
    } catch (err) {
      console.error('Error creating diary:', err);
    } finally {
      setLoading(false);
    }
  };

  const addPresence = () => {
    if (!newPresence.person_name) return;
    setPresenceList([...presenceList, newPresence]);
    setNewPresence({ person_name: '', role: 'Geselle', hours: 8 });
  };

  const removePresence = (index: number) => {
    setPresenceList(presenceList.filter((_, i) => i !== index));
  };

  const fetchAttachments = async (diaryId: string) => {
    if (!selectedProject) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject}/diaries/${diaryId}/attachments`);
      const data = await res.json();
      setAttachments(data);
    } catch (err) {
      console.error('Error fetching attachments:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedDiaryForAttachments || !e.target.files?.[0] || !selectedProject) return;
    
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const res = await fetch(`/api/projects/${selectedProject}/diaries/${selectedDiaryForAttachments.id}/attachments`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        fetchAttachments(selectedDiaryForAttachments.id);
      }
    } catch (err) {
      console.error('Error uploading file:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Anhang wirklich löschen?') || !selectedProject || !selectedDiaryForAttachments) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject}/diaries/${selectedDiaryForAttachments.id}/attachments/${attachmentId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAttachments(selectedDiaryForAttachments.id);
      }
    } catch (err) {
      console.error('Error deleting attachment:', err);
    }
  };

  return (
    <div id="construction-diary-container" className="space-y-8">
      <div id="diary-project-selector-bar" className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-end gap-6">
        <div className="flex-1">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Projekt auswählen</label>
          <select 
            id="diary-project-select"
            value={selectedProject || ''} 
            onChange={(e) => setSelectedProject(e.target.value)}
            className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
          >
            <option value="">-- Projekt wählen --</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.client_name})</option>
            ))}
          </select>
        </div>
        <button 
          id="diary-new-entry-btn-top"
          onClick={() => {
            setNewDiary(prev => ({ ...prev, project_id: selectedProject }));
            setShowNewDiaryForm(true);
          }}
          className="bg-brand-primary text-white px-8 py-4 rounded-2xl font-bold hover:bg-brand-dark transition-all flex items-center gap-3 shadow-xl shadow-brand-primary/20 uppercase tracking-widest text-xs"
        >
          <Plus size={20} /> Neuer Eintrag
        </button>
      </div>

      {selectedProject && (
        <div id="diary-entries-list-container" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {!initialProjectId && (
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                >
                  <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                  Projekt wechseln
                </button>
              )}
              <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Bautagebucheinträge</h3>
            </div>
            <div className="flex items-center gap-3">
              <button 
                id="diary-new-entry-btn-list"
                onClick={() => setShowNewDiaryForm(true)}
                className="bg-brand-dark text-white px-6 py-3 rounded-2xl font-bold hover:bg-brand-primary transition-all flex items-center gap-2 text-sm uppercase tracking-widest"
              >
                <Plus size={18} />
                Neuer Eintrag
              </button>
              {!initialProjectId && (
                <button 
                  onClick={() => setSelectedProject(null)}
                  className="flex items-center justify-center w-11 h-11 bg-white text-slate-400 hover:text-red-500 border border-slate-100 hover:border-red-100 rounded-2xl transition-all shadow-sm"
                  title="Schließen"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {diaries.length === 0 ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-12 rounded-[2rem] text-center text-slate-400">
                Keine Einträge für dieses Projekt gefunden.
              </div>
            ) : (
              diaries.map(diary => (
                <div key={diary.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex justify-between items-center">
                  <div className="flex items-center gap-6">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-brand-dark">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-brand-dark">{new Date(diary.date).toLocaleDateString('de-DE')}</h4>
                      <div className="flex items-center gap-4 text-xs text-slate-400 font-medium mt-1">
                        <span className="flex items-center gap-1"><CloudRain size={12} /> {diary.weather}</span>
                        <span className="flex items-center gap-1"><Thermometer size={12} /> {diary.temperature}°C</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        setSelectedDiaryForAttachments(diary);
                        fetchAttachments(diary.id);
                      }}
                      className="text-slate-300 hover:text-brand-primary transition-colors flex items-center gap-1"
                      title="Anhänge"
                    >
                      <Paperclip size={20} />
                    </button>
                    <button className="text-slate-300 hover:text-brand-primary transition-colors">
                      <ClipboardList size={20} />
                    </button>
                    <button className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* New Diary Modal */}
      <AnimatePresence>
        {showNewDiaryForm && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              id="diary-new-entry-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Neuer Bautagebucheintrag</h3>
                  <p className="text-slate-400 text-sm font-medium">Dokumentieren Sie den heutigen Baufortschritt.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowNewDiaryForm(false)}
                    className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-4 py-2 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                  >
                    <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                    Zurück
                  </button>
                  <button onClick={() => setShowNewDiaryForm(false)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand-dark transition-colors shadow-sm">
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-8 overflow-y-auto flex-1">
                <form onSubmit={handleCreateDiary} className="space-y-8">
                  {!selectedProject && (
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Projekt</label>
                      <select 
                        required
                        value={newDiary.project_id || ''}
                        onChange={e => setNewDiary({ ...newDiary, project_id: e.target.value })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      >
                        <option value="">-- Projekt wählen --</option>
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.client_name})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Datum</label>
                      <input 
                        type="date" 
                        value={newDiary.date}
                        onChange={e => setNewDiary({ ...newDiary, date: e.target.value })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Wetter</label>
                      <select 
                        value={newDiary.weather}
                        onChange={e => setNewDiary({ ...newDiary, weather: e.target.value })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      >
                        <option value="Sonnig">Sonnig</option>
                        <option value="Bewölkt">Bewölkt</option>
                        <option value="Regen">Regen</option>
                        <option value="Schnee">Schnee</option>
                        <option value="Sturm">Sturm</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Temperatur (°C)</label>
                      <input 
                        type="number" 
                        value={newDiary.temperature}
                        onChange={e => setNewDiary({ ...newDiary, temperature: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Ausgeführte Arbeiten</label>
                    <textarea 
                      value={newDiary.work_done}
                      onChange={e => setNewDiary({ ...newDiary, work_done: e.target.value })}
                      className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-medium text-brand-dark min-h-[120px]"
                      placeholder="Was wurde heute erledigt?"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Anwesenheit</label>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-[2rem] space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <input 
                            type="text" 
                            placeholder="Name"
                            value={newPresence.person_name}
                            onChange={e => setNewPresence({ ...newPresence, person_name: e.target.value })}
                            className="w-full bg-white border border-transparent focus:border-brand-primary/30 rounded-xl py-3 px-4 outline-none transition-all font-medium text-brand-dark"
                          />
                        </div>
                        <div>
                          <select 
                            value={newPresence.role}
                            onChange={e => setNewPresence({ ...newPresence, role: e.target.value })}
                            className="w-full bg-white border border-transparent focus:border-brand-primary/30 rounded-xl py-3 px-4 outline-none transition-all font-medium text-brand-dark"
                          >
                            <option value="Meister">Meister</option>
                            <option value="Geselle">Geselle</option>
                            <option value="Helfer">Helfer</option>
                            <option value="Azubi">Azubi</option>
                            <option value="Bauleiter">Bauleiter</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            placeholder="Std"
                            value={newPresence.hours}
                            onChange={e => setNewPresence({ ...newPresence, hours: Number(e.target.value) })}
                            className="w-full bg-white border border-transparent focus:border-brand-primary/30 rounded-xl py-3 px-4 outline-none transition-all font-medium text-brand-dark"
                          />
                          <button 
                            type="button"
                            onClick={addPresence}
                            className="bg-brand-dark text-white p-3 rounded-xl hover:bg-brand-primary transition-colors"
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {presenceList.map((p, idx) => (
                          <div key={idx} className="bg-white px-4 py-2 rounded-xl flex justify-between items-center text-sm">
                            <span className="font-bold text-brand-dark">{p.person_name} <span className="text-slate-400 font-medium ml-2">({p.role})</span></span>
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-brand-primary">{p.hours} Std</span>
                              <button onClick={() => removePresence(idx)} className="text-slate-300 hover:text-red-500">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Besondere Vorkommnisse / Notizen</label>
                    <textarea 
                      value={newDiary.notes}
                      onChange={e => setNewDiary({ ...newDiary, notes: e.target.value })}
                      className="w-full bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-medium text-brand-dark min-h-[80px]"
                      placeholder="Verzögerungen, Mängel, Abnahmen..."
                    />
                  </div>

                  <div className="flex justify-end gap-4 pt-4">
                    <button 
                      type="button"
                      onClick={() => setShowNewDiaryForm(false)}
                      className="px-8 py-4 rounded-2xl font-bold text-slate-400 hover:text-brand-dark transition-colors uppercase tracking-widest text-xs"
                    >
                      Abbrechen
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="bg-brand-primary text-white px-12 py-4 rounded-2xl font-bold hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 flex items-center gap-3"
                    >
                      <Save size={20} />
                      {loading ? 'Speichern...' : 'Eintrag Speichern'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Attachments Modal */}
      <AnimatePresence>
        {selectedDiaryForAttachments && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <motion.div 
              id="diary-attachments-modal"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Anhänge & Fotos</h3>
                  <p className="text-slate-400 text-sm font-medium">
                    Eintrag vom {new Date(selectedDiaryForAttachments.date).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <button onClick={() => setSelectedDiaryForAttachments(null)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 hover:text-brand-dark transition-colors shadow-sm">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 gap-4 mb-8">
                  {attachments.length === 0 ? (
                    <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-8 rounded-[2rem] text-center text-slate-400">
                      Keine Anhänge vorhanden.
                    </div>
                  ) : (
                    attachments.map(att => (
                      <div key={att.id} className="bg-slate-50 p-4 rounded-3xl border border-slate-100 space-y-4 group">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand-primary shadow-sm">
                              {att.file_type.startsWith('image/') ? <ImageIcon size={20} /> : <FileIcon size={20} />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-brand-dark truncate max-w-[200px]">{att.file_name}</p>
                              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                                {new Date(att.created_at).toLocaleDateString('de-DE')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {att.file_type.startsWith('image/') && (
                              <button 
                                onClick={() => analyzePhoto(att)}
                                disabled={analyzingPhotoId === att.id}
                                className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                                title="KI-Analyse"
                              >
                                {analyzingPhotoId === att.id ? <Loader2 size={16} className="animate-spin" /> : <Maximize2 size={16} />}
                                KI-Check
                              </button>
                            )}
                            <a 
                              href={att.file_path} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 hover:text-brand-primary transition-colors"
                              title="Ansehen / Download"
                            >
                              <Download size={18} />
                            </a>
                            <button 
                              onClick={() => handleDeleteAttachment(att.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                              title="Löschen"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>

                        {att.file_type.startsWith('image/') && (
                          <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-slate-200">
                            <img src={att.file_path} alt={att.file_name} className="w-full h-full object-cover" />
                          </div>
                        )}

                        {photoAnalysis[att.id] && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="p-4 bg-brand-primary/5 rounded-2xl border border-brand-primary/10"
                          >
                            <div className="flex items-center gap-2 text-brand-primary mb-2">
                              <Maximize2 size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest">KI-Analyse Ergebnis</span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed italic">
                              "{photoAnalysis[att.id]}"
                            </p>
                          </motion.div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="bg-brand-accent/30 p-8 rounded-[2rem] border-2 border-dashed border-brand-primary/20 text-center">
                  <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <label 
                    htmlFor="file-upload" 
                    className={`inline-flex items-center gap-3 bg-brand-primary text-white px-8 py-4 rounded-2xl font-bold hover:bg-brand-dark transition-all cursor-pointer shadow-xl shadow-brand-primary/20 uppercase tracking-widest text-xs ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <Upload size={18} />
                    {uploading ? 'Wird hochgeladen...' : 'Datei auswählen'}
                  </label>
                  <p className="mt-4 text-xs text-slate-400 font-medium">Fotos, PDFs oder Dokumente hochladen (max. 10MB)</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
