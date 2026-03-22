import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  MessageSquare, 
  History, 
  Save, 
  Trash2, 
  ChevronRight,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Customer {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
}

interface CommLog {
  id: number;
  customer_id: number;
  type: string;
  content: string;
  date: string;
}

export default function CustomerCRM() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [logs, setLogs] = useState<CommLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({});
  const [newLog, setNewLog] = useState({ type: 'Call', content: '' });

  useEffect(() => {
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchLogs(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const fetchCustomers = async () => {
    const res = await fetch('/api/customers');
    const data = await res.json();
    setCustomers(data);
  };

  const fetchLogs = async (id: number) => {
    const res = await fetch(`/api/customers/${id}/logs`);
    const data = await res.json();
    setLogs(data);
  };

  const handleSaveCustomer = async () => {
    const method = newCustomer.id ? 'PUT' : 'POST';
    const url = newCustomer.id ? `/api/customers/${newCustomer.id}` : '/api/customers';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCustomer)
    });

    if (res.ok) {
      fetchCustomers();
      setIsAdding(false);
      setNewCustomer({});
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('Kunde wirklich löschen?')) return;
    await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    fetchCustomers();
    if (selectedCustomer?.id === id) setSelectedCustomer(null);
  };

  const handleAddLog = async () => {
    if (!selectedCustomer) return;
    const res = await fetch(`/api/customers/${selectedCustomer.id}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLog)
    });

    if (res.ok) {
      fetchLogs(selectedCustomer.id);
      setNewLog({ type: 'Call', content: '' });
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div id="customer-crm-container" className="flex h-full bg-stone-50 overflow-hidden">
      {/* Sidebar: Customer List */}
      <div id="customer-sidebar" className="w-80 border-r border-stone-200 bg-white flex flex-col">
        <div className="p-4 border-b border-stone-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Kunden
            </h2>
            <button 
              id="customer-add-btn"
              title="Kunde hinzufügen"
              onClick={() => { setIsAdding(true); setSelectedCustomer(null); setNewCustomer({}); }}
              className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input 
              id="customer-search-input"
              type="text"
              placeholder="Kunden suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-stone-100 border-transparent rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>
        </div>
        <div id="customer-list-scroll" className="flex-1 overflow-y-auto">
          {filteredCustomers.map(customer => (
            <button
              key={customer.id}
              onClick={() => { setSelectedCustomer(customer); setIsAdding(false); }}
              className={`w-full p-4 text-left border-b border-stone-100 hover:bg-stone-50 transition-colors ${selectedCustomer?.id === customer.id ? 'bg-emerald-50 border-l-4 border-l-emerald-600' : ''}`}
            >
              <div className="font-medium text-stone-900">{customer.name}</div>
              {customer.company && <div className="text-xs text-stone-500">{customer.company}</div>}
              <div className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                <Mail className="w-3 h-3" /> {customer.email}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div 
        id="customer-main-content" 
        className="flex-1 overflow-y-auto p-8"
        style={{ 
          backgroundColor: '#f8fafc',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
        }}
      >
        <AnimatePresence mode="wait">
          {isAdding || (selectedCustomer && !isAdding) ? (
            <motion.div
              id="customer-details-panel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="max-w-4xl mx-auto"
            >
              <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden mb-8">
                <div id="customer-details-header" className="p-6 border-b border-stone-200 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">
                    {isAdding ? 'Neuer Kunde' : 'Kundendetails'}
                  </h3>
                  <div className="flex items-center gap-2">
                    {!isAdding && (
                      <button 
                        onClick={() => handleDeleteCustomer(selectedCustomer!.id)}
                        className="p-2 text-stone-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    <button 
                      onClick={handleSaveCustomer}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      Speichern
                    </button>
                  </div>
                </div>
                <div id="customer-details-form" className="p-6 grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Name</label>
                      <input 
                        type="text"
                        value={isAdding ? newCustomer.name || '' : selectedCustomer?.name || ''}
                        onChange={(e) => isAdding ? setNewCustomer({...newCustomer, name: e.target.value}) : setSelectedCustomer({...selectedCustomer!, name: e.target.value})}
                        className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Firma</label>
                      <input 
                        type="text"
                        value={isAdding ? newCustomer.company || '' : selectedCustomer?.company || ''}
                        onChange={(e) => isAdding ? setNewCustomer({...newCustomer, company: e.target.value}) : setSelectedCustomer({...selectedCustomer!, company: e.target.value})}
                        className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Email</label>
                      <input 
                        type="email"
                        value={isAdding ? newCustomer.email || '' : selectedCustomer?.email || ''}
                        onChange={(e) => isAdding ? setNewCustomer({...newCustomer, email: e.target.value}) : setSelectedCustomer({...selectedCustomer!, email: e.target.value})}
                        className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Telefon</label>
                      <input 
                        type="text"
                        value={isAdding ? newCustomer.phone || '' : selectedCustomer?.phone || ''}
                        onChange={(e) => isAdding ? setNewCustomer({...newCustomer, phone: e.target.value}) : setSelectedCustomer({...selectedCustomer!, phone: e.target.value})}
                        className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Adresse</label>
                      <textarea 
                        rows={3}
                        value={isAdding ? newCustomer.address || '' : selectedCustomer?.address || ''}
                        onChange={(e) => isAdding ? setNewCustomer({...newCustomer, address: e.target.value}) : setSelectedCustomer({...selectedCustomer!, address: e.target.value})}
                        className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {!isAdding && selectedCustomer && (
                <div className="grid grid-cols-3 gap-8">
                  <div className="col-span-2 space-y-6">
                    <div id="customer-comm-history" className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                      <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-emerald-600" />
                        Kommunikationsverlauf
                      </h4>
                      <div className="space-y-4 mb-6">
                        <div className="flex gap-2">
                          <select 
                            value={newLog.type}
                            onChange={(e) => setNewLog({...newLog, type: e.target.value})}
                            className="px-3 py-2 bg-stone-100 border-transparent rounded-lg text-sm"
                          >
                            <option>Call</option>
                            <option>Email</option>
                            <option>Meeting</option>
                            <option>Note</option>
                          </select>
                          <textarea 
                            placeholder="Neue Notiz..."
                            value={newLog.content}
                            onChange={(e) => setNewLog({...newLog, content: e.target.value})}
                            rows={1}
                            className="flex-1 px-4 py-2 bg-stone-100 border-transparent rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                          />
                          <button 
                            onClick={handleAddLog}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            Hinzufügen
                          </button>
                        </div>
                      </div>
                      <div className="space-y-4">
                        {logs.map(log => (
                          <div key={log.id} className="flex gap-4 p-4 bg-stone-50 rounded-xl">
                            <div className="mt-1">
                              {log.type === 'Call' && <Phone className="w-4 h-4 text-blue-500" />}
                              {log.type === 'Email' && <Mail className="w-4 h-4 text-purple-500" />}
                              {log.type === 'Meeting' && <Users className="w-4 h-4 text-orange-500" />}
                              {log.type === 'Note' && <MessageSquare className="w-4 h-4 text-stone-500" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold uppercase text-stone-400">{log.type}</span>
                                <span className="text-xs text-stone-400">{new Date(log.date).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm text-stone-700">{log.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div id="customer-project-history-container" className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
                      <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <History className="w-5 h-5 text-emerald-600" />
                        Projekthistorie
                      </h4>
                      <div className="text-center py-8">
                        <Clock className="w-8 h-8 text-stone-200 mx-auto mb-2" />
                        <p className="text-sm text-stone-400">Keine Projekte gefunden</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-stone-400">
              <Users className="w-16 h-16 mb-4 opacity-20" />
              <p>Wählen Sie einen Kunden aus oder erstellen Sie einen neuen.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
