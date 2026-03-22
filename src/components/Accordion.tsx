import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AccordionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  onToggle?: (isOpen: boolean) => void;
}

export function Accordion({ title, children, defaultOpen = false, className = '', onToggle }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (onToggle) onToggle(nextState);
  };

  return (
    <div className={`border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm transition-all ${className}`}>
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex-1">{title}</div>
        <div className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={20} />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="p-6 pt-0 border-t border-slate-50">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
