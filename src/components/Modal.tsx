import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showCloseButton?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  closeOnOverlayClick?: boolean;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] h-[90vh]',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
  showCloseButton = true,
  showBackButton = false,
  onBack,
  closeOnOverlayClick = true,
}) => {
  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOnOverlayClick ? onClose : undefined}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`
              relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col
              max-h-[90vh] sm:max-h-[85vh]
              ${sizeClasses[size]}
              ${className}
            `}
          >
            {/* Header */}
            {(title || showCloseButton || showBackButton) && (
              <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {showBackButton && onBack && (
                    <button 
                      onClick={onBack}
                      className="flex items-center gap-1.5 bg-slate-50 text-slate-600 hover:text-brand-primary border border-slate-200 hover:border-brand-primary/30 px-3 py-2 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all shadow-sm group whitespace-nowrap"
                    >
                      <ChevronRight size={14} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                      Zurück
                    </button>
                  )}
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="flex items-center gap-1.5 bg-brand-accent text-brand-primary hover:bg-brand-primary hover:text-white border border-brand-primary/20 px-3 py-2 rounded-xl font-bold text-[9px] uppercase tracking-widest transition-all shadow-sm whitespace-nowrap"
                  >
                    <X size={14} />
                    Zur Website
                  </button>
                  {title && (
                    <h3 className="text-sm font-black text-brand-dark tracking-tighter leading-none ml-2 whitespace-nowrap">
                      {title}
                    </h3>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-accent/50 transition-all rounded-xl border border-transparent hover:border-brand-primary/10 shrink-0"
                    title="Schließen"
                  >
                    <X className="w-6 h-6" />
                  </button>
                )}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
