import React, { useState } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Database,
  ArrowRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function DatanormImport({ onComplete }: { onComplete?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; count: number; tradeId: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/catalog/import-datanorm', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        if (onComplete) onComplete();
      } else {
        setError(data.message || "Fehler beim Importieren.");
      }
    } catch (err) {
      console.error("Import error:", err);
      setError("Netzwerkfehler beim Importieren.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div id="datanorm-import-container" className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
      <div id="datanorm-header" className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary">
            <Database size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-brand-dark">Datanorm Import</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Großhändler-Kataloge einspielen</p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        {!result ? (
          <div className="space-y-6">
            <label id="datanorm-upload-zone" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-200 rounded-[2rem] cursor-pointer hover:bg-slate-50 transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-12 h-12 text-slate-300 group-hover:text-brand-primary transition-colors mb-4" />
                <p className="mb-2 text-sm text-slate-500 font-bold">Datanorm-Datei hochladen (.dat, .csv)</p>
                <p className="text-xs text-slate-400">Klicken oder Drag & Drop</p>
                {file && (
                  <div className="mt-4 px-4 py-2 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center gap-2 text-xs font-bold">
                    <FileText size={14} /> {file.name}
                  </div>
                )}
              </div>
              <input type="file" className="hidden" onChange={handleFileChange} accept=".dat,.csv,text/plain" />
            </label>

            <div className="flex justify-center">
              <button 
                id="datanorm-import-btn"
                onClick={handleImport}
                disabled={!file || isUploading}
                className="flex items-center gap-2 px-8 py-4 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 disabled:opacity-50"
              >
                {isUploading ? (
                  <><Loader2 size={20} className="animate-spin" /> Importiere Daten...</>
                ) : (
                  <><Database size={20} /> Import starten</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6 py-8"
          >
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={40} />
            </div>
            <div>
              <h4 className="text-2xl font-black text-brand-dark">Import erfolgreich!</h4>
              <p className="text-slate-500 font-medium mt-2">
                Es wurden <span className="text-brand-primary font-black">{result.count}</span> Artikel erfolgreich in den Katalog importiert.
              </p>
            </div>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 max-w-sm mx-auto">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Neues Gewerk erstellt</p>
              <p className="text-sm font-bold text-brand-dark">Datanorm Import {new Date().toLocaleDateString('de-DE')}</p>
            </div>
            <button 
              onClick={() => { setFile(null); setResult(null); }}
              className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2 mx-auto"
            >
              Weiteren Import durchführen <ArrowRight size={18} />
            </button>
          </motion.div>
        )}

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium"
            >
              <AlertCircle size={18} /> {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
