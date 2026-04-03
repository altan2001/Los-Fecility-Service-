import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// --- Types ---
type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface UIContextType {
  showNotification: (message: string, type?: NotificationType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setNotifications((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve
      });
    });
  }, []);

  const handleConfirmClose = (value: boolean) => {
    if (confirmState) {
      confirmState.resolve(value);
      setConfirmState(null);
    }
  };

  return (
    <UIContext.Provider value={{ showNotification, confirm }}>
      {children}
      
      {/* Notifications UI */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className={`pointer-events-auto flex items-center gap-3 p-4 rounded-2xl border shadow-xl min-w-[300px] max-w-md ${
                n.type === 'success' ? 'bg-green-50 border-green-200' :
                n.type === 'error' ? 'bg-red-50 border-red-200' :
                n.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}
            >
              {n.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-500" /> :
               n.type === 'error' ? <AlertCircle className="w-5 h-5 text-red-500" /> :
               n.type === 'warning' ? <AlertTriangle className="w-5 h-5 text-yellow-500" /> :
               <Info className="w-5 h-5 text-blue-500" />}
              <p className="flex-1 text-sm font-bold text-gray-800">{n.message}</p>
              <button
                onClick={() => setNotifications((prev) => prev.filter((notif) => notif.id !== n.id))}
                className="p-1 hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirm Modal UI */}
      <AnimatePresence>
        {confirmState?.isOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-brand-dark/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden border border-slate-100"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      confirmState.options.type === 'danger' ? 'bg-red-50 text-red-500' :
                      confirmState.options.type === 'info' ? 'bg-blue-50 text-blue-500' :
                      'bg-yellow-50 text-yellow-500'
                    }`}>
                      <AlertTriangle size={24} />
                    </div>
                    <h3 className="text-2xl font-black text-brand-dark tracking-tighter">{confirmState.options.title}</h3>
                  </div>
                  <button onClick={() => handleConfirmClose(false)} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
                <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                  {confirmState.options.message}
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => handleConfirmClose(false)}
                    className="px-6 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-all"
                  >
                    {confirmState.options.cancelText || 'Abbrechen'}
                  </button>
                  <button
                    onClick={() => handleConfirmClose(true)}
                    className={`px-8 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${
                      confirmState.options.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-200' :
                      confirmState.options.type === 'info' ? 'bg-blue-500 hover:bg-blue-600 shadow-blue-200' :
                      'bg-brand-primary hover:bg-brand-primary/90 shadow-brand-primary/20'
                    }`}
                  >
                    {confirmState.options.confirmText || 'Bestätigen'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};
