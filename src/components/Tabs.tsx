import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTabId?: string;
  activeTab?: string;
  onTabChange?: (id: string) => void;
  className?: string;
  tabClassName?: string;
  activeTabClassName?: string;
  contentClassName?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTabId,
  activeTab,
  onTabChange,
  className = '',
  tabClassName = '',
  activeTabClassName = '',
  contentClassName = '',
}) => {
  const [internalActiveTabId, setInternalActiveTabId] = useState(defaultTabId || tabs[0]?.id);
  const activeTabId = activeTab || internalActiveTabId;

  const handleTabClick = (id: string) => {
    if (onTabChange) {
      onTabChange(id);
    } else {
      setInternalActiveTabId(id);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`
              relative py-3 px-6 text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2
              ${activeTabId === tab.id 
                ? `text-brand-primary ${activeTabClassName}` 
                : `text-slate-500 hover:text-slate-700 ${tabClassName}`
              }
            `}
          >
            {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
            {tab.label}
            {activeTabId === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-primary"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      <div className={`relative ${contentClassName}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTabId}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {tabs.find((tab) => tab.id === activeTabId)?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
