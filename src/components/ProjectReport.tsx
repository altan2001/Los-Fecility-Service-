import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  TrendingUp, 
  DollarSign, 
  ClipboardCheck,
  ChevronRight,
  BarChart3,
  Calendar,
  User,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import SketchPad from './SketchPad';
import { Pencil, X } from 'lucide-react';

interface Project {
  id: number;
  name: string;
  customer_name: string;
  customer_address: string;
  status: string;
  created_at: string;
}

interface QuoteItem {
  id: number;
  name: string;
  quantity: number;
  unit: string;
  labor_hours_per_unit: number;
  material_price_per_unit: number;
}

interface Diary {
  id: number;
  date: string;
  work_done: string;
  weather: string;
  temperature: number;
}

interface ChangeOrder {
  id: number;
  title: string;
  amount: number;
  status: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  amount: number;
  status: string;
}

export default function ProjectReport() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [reportData, setReportData] = useState<{
    project: Project;
    items: QuoteItem[];
    diaries: Diary[];
    changeOrders: ChangeOrder[];
    invoices: Invoice[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSketchModal, setShowSketchModal] = useState(false);
  const [projectSketch, setProjectSketch] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  const fetchReportData = async (projectId: number) => {
    setLoading(true);
    try {
      const [projectRes, diariesRes, changeOrdersRes, invoicesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch(`/api/projects/${projectId}/diaries`),
        fetch(`/api/projects/${projectId}/change-orders`),
        fetch(`/api/projects/${projectId}/invoices`)
      ]);

      const project = await projectRes.json();
      const diaries = await diariesRes.json();
      const changeOrders = await changeOrdersRes.json();
      const invoices = await invoicesRes.json();

      setReportData({
        project,
        items: project.items || [],
        diaries,
        changeOrders,
        invoices
      });
    } catch (err) {
      console.error('Error fetching report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    const { project, items, diaries, changeOrders, invoices } = reportData;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(20, 20, 20);
    doc.text('PROJEKT-ABSCHLUSSBERICHT', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 105, 28, { align: 'center' });

    // Project Info
    doc.setFontSize(14);
    doc.setTextColor(242, 125, 38); // Brand Primary
    doc.text('PROJEKTINFORMATIONEN', 20, 45);
    
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(`Projektname: ${project.name}`, 20, 55);
    doc.text(`Kunde: ${project.customer_name}`, 20, 60);
    doc.text(`Adresse: ${project.customer_address}`, 20, 65);
    doc.text(`Status: ${project.status}`, 20, 70);

    // Financial Summary
    const totalQuote = items.reduce((sum, item) => sum + (item.quantity * (item.material_price_per_unit + (item.labor_hours_per_unit * 65))), 0);
    const totalChangeOrders = changeOrders.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.amount, 0);
    const totalInvoiced = invoices.reduce((sum, i) => sum + i.amount, 0);

    doc.setFontSize(14);
    doc.setTextColor(242, 125, 38);
    doc.text('FINANZIELLE ZUSAMMENFASSUNG', 20, 85);

    (doc as any).autoTable({
      startY: 90,
      head: [['Posten', 'Betrag']],
      body: [
        ['Ursprüngliches Angebot', `${totalQuote.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`],
        ['Genehmigte Nachträge', `${totalChangeOrders.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`],
        ['Gesamtvolumen', `${(totalQuote + totalChangeOrders).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`],
        ['Bereits fakturiert', `${totalInvoiced.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [242, 125, 38] }
    });

    // Work Progress
    let currentY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setTextColor(242, 125, 38);
    doc.text('DURCHGEFÜHRTE ARBEITEN (AUSZUG)', 20, currentY);

    const diaryData = diaries.slice(0, 10).map(d => [
      new Date(d.date).toLocaleDateString('de-DE'),
      d.work_done
    ]);

    (doc as any).autoTable({
      startY: currentY + 5,
      head: [['Datum', 'Arbeitsbericht']],
      body: diaryData,
      theme: 'grid',
      headStyles: { fillColor: [51, 65, 85] }
    });

    doc.save(`Projektbericht_${project.name.replace(/\s+/g, '_')}.pdf`);
  };

  const calculateTotals = () => {
    if (!reportData) return { quote: 0, changes: 0, invoiced: 0 };
    const quote = reportData.items.reduce((sum, item) => sum + (item.quantity * (item.material_price_per_unit + (item.labor_hours_per_unit * 65))), 0);
    const changes = reportData.changeOrders.filter(o => o.status === 'approved').reduce((sum, o) => sum + o.amount, 0);
    const invoiced = reportData.invoices.reduce((sum, i) => sum + i.amount, 0);
    return { quote, changes, invoiced };
  };

  const totals = calculateTotals();

  return (
    <div id="project-report-container" className="space-y-8">
      <div id="project-report-header" className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl font-black text-brand-dark tracking-tighter">Projektberichte</h2>
            <p className="text-slate-400 font-medium">Detaillierte Auswertung von Fortschritt und Kosten.</p>
          </div>
          <div className="flex gap-4">
            <select 
              id="project-report-select"
              value={selectedProject || ''} 
              onChange={(e) => {
                const id = Number(e.target.value);
                setSelectedProject(id);
                if (id) fetchReportData(id);
              }}
              className="bg-slate-50 border border-transparent focus:border-brand-primary/30 rounded-2xl py-4 px-6 outline-none transition-all font-bold text-brand-dark min-w-[250px]"
            >
              <option value="">-- Projekt wählen --</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {reportData && (
              <div className="flex gap-4">
                <button 
                  id="project-report-sketch-btn"
                  onClick={() => setShowSketchModal(true)}
                  className="bg-white text-brand-primary border border-brand-primary/20 px-8 py-4 rounded-2xl font-bold hover:bg-brand-primary/5 transition-all flex items-center gap-2"
                >
                  <Pencil size={20} />
                  Skizze
                </button>
                <button 
                  id="project-report-pdf-btn"
                  onClick={generatePDF}
                  className="bg-brand-primary text-white px-8 py-4 rounded-2xl font-bold hover:bg-brand-dark transition-all flex items-center gap-2 shadow-lg shadow-brand-primary/20"
                >
                  <Download size={20} />
                  PDF Export
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Daten werden geladen...</p>
          </motion.div>
        ) : reportData ? (
          <motion.div 
            id="project-report-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Left Column: Summary Stats */}
            <div className="space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
                    <DollarSign size={24} />
                  </div>
                  <h3 className="font-bold text-brand-dark text-lg">Finanz-Status</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-400 text-sm font-medium">Angebot</span>
                    <span className="font-bold text-brand-dark">{totals.quote.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-slate-400 text-sm font-medium">Nachträge</span>
                    <span className="font-bold text-emerald-600">+{totals.changes.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="h-px bg-slate-100 my-2"></div>
                  <div className="flex justify-between items-end">
                    <span className="text-brand-dark font-bold uppercase tracking-widest text-xs">Gesamt</span>
                    <span className="text-2xl font-black text-brand-dark">{(totals.quote + totals.changes).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                  </div>
                  <div className="pt-4">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest mb-2">
                      <span className="text-slate-400">Fakturiert</span>
                      <span className="text-brand-primary">{Math.round((totals.invoiced / (totals.quote + totals.changes)) * 100)}%</span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand-primary transition-all duration-1000" 
                        style={{ width: `${Math.min(100, (totals.invoiced / (totals.quote + totals.changes)) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-brand-dark p-8 rounded-[2.5rem] shadow-xl text-white">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-brand-primary">
                    <TrendingUp size={24} />
                  </div>
                  <h3 className="font-bold text-lg">Projekt-Details</h3>
                </div>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <User className="text-brand-primary shrink-0" size={20} />
                    <div>
                      <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Kunde</p>
                      <p className="font-bold">{reportData.project.customer_name}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <MapPin className="text-brand-primary shrink-0" size={20} />
                    <div>
                      <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Adresse</p>
                      <p className="font-bold">{reportData.project.customer_address}</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <Calendar className="text-brand-primary shrink-0" size={20} />
                    <div>
                      <p className="text-white/50 text-xs font-bold uppercase tracking-widest">Erstellt am</p>
                      <p className="font-bold">{new Date(reportData.project.created_at).toLocaleDateString('de-DE')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Work Log & Progress */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-brand-dark">
                      <ClipboardCheck size={24} />
                    </div>
                    <h3 className="font-bold text-brand-dark text-xl">Arbeitsfortschritt</h3>
                  </div>
                  <span className="px-4 py-1.5 bg-emerald-100 text-emerald-600 rounded-full text-xs font-bold uppercase tracking-widest">
                    {reportData.diaries.length} Einträge
                  </span>
                </div>

                <div className="space-y-4">
                  {reportData.diaries.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 font-medium bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                      Keine Bautagebucheinträge vorhanden.
                    </div>
                  ) : (
                    reportData.diaries.slice(0, 5).map((diary, idx) => (
                      <div key={diary.id} className="group p-6 rounded-3xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                        <div className="flex items-start gap-6">
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-xs font-black text-brand-primary uppercase tracking-tighter">
                              {new Date(diary.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                            </span>
                            <div className="w-px h-12 bg-slate-200 group-last:hidden"></div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                {diary.weather} • {diary.temperature}°C
                              </span>
                            </div>
                            <p className="text-brand-dark font-medium leading-relaxed">
                              {diary.work_done}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-brand-dark">
                    <BarChart3 size={24} />
                  </div>
                  <h3 className="font-bold text-brand-dark text-xl">Leistungsübersicht</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                        <th className="pb-4 pl-4">Position</th>
                        <th className="pb-4">Menge</th>
                        <th className="pb-4 text-right pr-4">Gesamt (geschätzt)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {reportData.items.map(item => (
                        <tr key={item.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="py-4 pl-4 font-bold text-brand-dark">{item.name}</td>
                          <td className="py-4 text-slate-500 font-medium">{item.quantity} {item.unit}</td>
                          <td className="py-4 text-right pr-4 font-black text-brand-dark">
                            {(item.quantity * (item.material_price_per_unit + (item.labor_hours_per_unit * 65))).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-20 rounded-[3rem] shadow-sm border border-slate-100 text-center"
          >
            <div className="w-24 h-24 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-300 mx-auto mb-8">
              <FileText size={48} />
            </div>
            <h3 className="text-2xl font-black text-brand-dark tracking-tighter mb-4">Wählen Sie ein Projekt</h3>
            <p className="text-slate-400 font-medium max-w-md mx-auto">
              Wählen Sie oben ein Projekt aus, um eine detaillierte Auswertung und einen Bericht zu generieren.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sketch Modal */}
      <AnimatePresence>
        {showSketchModal && (
          <div className="fixed inset-0 bg-brand-dark/60 backdrop-blur-sm z-[100] flex items-center justify-center p-8">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-6xl h-[80vh] bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-brand-dark tracking-tighter">Projekt-Skizze</h3>
                  <p className="text-slate-400 font-medium">Visualisieren Sie Leistungen direkt im Bericht.</p>
                </div>
                <button 
                  onClick={() => setShowSketchModal(false)}
                  className="p-3 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>
              <div className="flex-1 p-8 bg-slate-50">
                <SketchPad 
                  initialData={projectSketch || undefined}
                  onSave={(data) => {
                    setProjectSketch(data);
                    setShowSketchModal(false);
                  }}
                  onClose={() => setShowSketchModal(false)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
