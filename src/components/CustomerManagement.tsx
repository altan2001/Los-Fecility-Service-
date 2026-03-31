import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Mail, 
  Phone, 
  Building2, 
  Trash2, 
  Edit3, 
  X,
  Save,
  User,
  CheckCircle2,
  Download,
  Zap,
  MessageSquare,
  History,
  Clock,
  Calendar,
  ChevronRight
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
  category: string;
  last_contact?: string;
}

interface CommunicationLog {
  id: number;
  customer_id: number;
  type: 'Call' | 'Email' | 'Meeting' | 'Note';
  content: string;
  date: string;
}

export default function CustomerManagement() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Customer | null, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    category: 'Privat'
  });

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddData, setQuickAddData] = useState({ name: '', email: '', phone: '', category: 'Privat' });

  // Multi-selection state
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);

  // Communication Logs State
  const [selectedCustomerForLogs, setSelectedCustomerForLogs] = useState<Customer | null>(null);
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logFormData, setLogFormData] = useState({ type: 'Call', content: '' });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(data);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddData.name) return;

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quickAddData)
      });
      if (res.ok) {
        fetchCustomers();
        setQuickAddData({ name: '', email: '', phone: '', category: 'Privat' });
        setShowQuickAdd(false);
        setSuccessMessage('Kunde schnell hinzugefügt!');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error('Error quick adding customer:', err);
    }
  };

  const handleOpenModal = (customer: Customer | null = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData(customer);
    } else {
      setEditingCustomer(null);
      setFormData({
        name: '',
        company: '',
        email: '',
        phone: '',
        address: '',
        notes: '',
        category: 'Privat'
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingCustomer ? 'PUT' : 'POST';
    const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : '/api/customers';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        fetchCustomers();
        handleCloseModal();
        setSuccessMessage(editingCustomer ? 'Kunde aktualisiert' : 'Kunde erfolgreich angelegt');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error('Error saving customer:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Möchten Sie diesen Kunden wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCustomers(prev => prev.filter(c => c.id !== id));
        setSuccessMessage('Kunde gelöscht');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error('Error deleting customer:', err);
    }
  };

  const exportToCsv = () => {
    const headers = ['ID', 'Name', 'Firma', 'E-Mail', 'Telefon', 'Adresse', 'Kategorie', 'Notizen'];
    const rows = filteredCustomers.map(c => [
      c.id,
      c.name,
      c.company,
      c.email,
      c.phone,
      c.address,
      c.category,
      c.notes
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Add BOM for UTF-8 to ensure Excel handles German characters correctly
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kundenliste_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchLogs = async (customerId: number) => {
    setLogLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/logs`);
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLogLoading(false);
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerForLogs || !logFormData.content) return;

    try {
      const res = await fetch(`/api/customers/${selectedCustomerForLogs.id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logFormData)
      });
      if (res.ok) {
        fetchLogs(selectedCustomerForLogs.id);
        fetchCustomers(); // Refresh to update last contact date
        setLogFormData({ ...logFormData, content: '' });
        setSuccessMessage('Log-Eintrag erstellt');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      console.error('Error adding log:', err);
    }
  };

  const handleOpenLogs = (customer: Customer) => {
    setSelectedCustomerForLogs(customer);
    fetchLogs(customer.id);
  };

  const toggleCustomerSelection = (id: number) => {
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAllSelection = () => {
    if (selectedCustomerIds.length === filteredCustomers.length) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(filteredCustomers.map(c => c.id));
    }
  };

  const handleBulkLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCustomerIds.length === 0 || !logFormData.content) return;

    setLogLoading(true);
    try {
      const promises = selectedCustomerIds.map(id => 
        fetch(`/api/customers/${id}/logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logFormData)
        })
      );
      await Promise.all(promises);
      
      fetchCustomers(); // Refresh to update last contact dates
      setLogFormData({ ...logFormData, content: '' });
      setSelectedCustomerIds([]);
      setSuccessMessage(`${selectedCustomerIds.length} Log-Einträge erstellt`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error adding bulk logs:', err);
    } finally {
      setLogLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (aValue === bValue) return 0;
    if (aValue === null || aValue === undefined) return 1;
    if (bValue === null || bValue === undefined) return -1;
    
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (key: keyof Customer) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <div id="customer-management-container" className="space-y-6 relative">
      {/* Success Message Toast */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="fixed top-24 left-1/2 z-[110] bg-brand-secondary text-white px-6 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-2"
          >
            <CheckCircle2 size={20} />
            {successMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Actions */}
      <div id="customer-management-header" className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            id="customer-management-search-input"
            type="text"
            placeholder="Kunden suchen (Name, Firma, E-Mail)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <select 
            id="customer-management-category-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-sm text-slate-600"
          >
            <option value="all">Alle Kategorien</option>
            <option value="Privat">Privat</option>
            <option value="Geschäftlich">Geschäftlich</option>
            <option value="VIP">VIP</option>
          </select>
          <button 
            id="customer-management-export-btn"
            onClick={exportToCsv}
            className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all w-full md:w-auto justify-center"
            title="Kundenliste als CSV exportieren"
          >
            <Download size={20} />
            <span>Export</span>
          </button>
          <button 
            id="customer-management-quick-add-toggle"
            onClick={() => setShowQuickAdd(!showQuickAdd)}
            className={`flex items-center gap-2 px-6 py-3 ${showQuickAdd ? 'bg-brand-secondary text-white' : 'bg-brand-accent text-brand-primary'} rounded-2xl font-bold hover:opacity-90 transition-all w-full md:w-auto justify-center`}
          >
            <Zap size={20} /> Quick Add
          </button>
          <button 
            id="customer-management-new-customer-btn"
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-6 py-3 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20 w-full md:w-auto justify-center"
          >
            <Plus size={20} /> Neuer Kunde
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedCustomerIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-brand-dark text-white p-6 rounded-[2rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border-t-4 border-brand-primary"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-brand-primary/20 text-brand-primary rounded-2xl flex items-center justify-center font-black">
                {selectedCustomerIds.length}
              </div>
              <div>
                <p className="font-black tracking-tight">Kunden ausgewählt</p>
                <button 
                  onClick={() => setSelectedCustomerIds([])}
                  className="text-xs font-bold text-brand-primary uppercase tracking-widest hover:text-white transition-colors"
                >
                  Auswahl aufheben
                </button>
              </div>
            </div>

            <form onSubmit={handleBulkLog} className="flex-1 flex flex-col md:flex-row gap-4 w-full">
              <div className="w-full md:w-48">
                <select 
                  value={logFormData.type}
                  onChange={e => setLogFormData({...logFormData, type: e.target.value})}
                  className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-sm text-white"
                >
                  <option value="Call" className="text-brand-dark">Anruf</option>
                  <option value="Email" className="text-brand-dark">E-Mail</option>
                  <option value="Meeting" className="text-brand-dark">Meeting</option>
                  <option value="Note" className="text-brand-dark">Notiz</option>
                </select>
              </div>
              <div className="flex-1">
                <input 
                  required
                  type="text"
                  value={logFormData.content}
                  onChange={e => setLogFormData({...logFormData, content: e.target.value})}
                  placeholder="Sammel-Log für alle ausgewählten Kunden..."
                  className="w-full px-6 py-3 bg-white/10 border border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium text-sm text-white placeholder:text-white/30"
                />
              </div>
              <button 
                type="submit"
                disabled={logLoading}
                className="px-8 py-3 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 whitespace-nowrap"
              >
                {logLoading ? 'Speichern...' : 'Bulk Log erstellen'}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Add Form */}
      <AnimatePresence>
        {showQuickAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form 
              onSubmit={handleQuickAdd}
              className="bg-white p-6 rounded-[2rem] shadow-sm border border-brand-secondary/20 flex flex-col md:flex-row gap-4 items-end"
            >
              <div className="flex-1 space-y-2 w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Name</label>
                <input 
                  required
                  type="text"
                  placeholder="Name des Kunden"
                  value={quickAddData.name}
                  onChange={e => setQuickAddData({...quickAddData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-secondary/20 transition-all font-medium"
                />
              </div>
              <div className="flex-1 space-y-2 w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-Mail</label>
                <input 
                  type="email"
                  placeholder="email@beispiel.de"
                  value={quickAddData.email}
                  onChange={e => setQuickAddData({...quickAddData, email: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-secondary/20 transition-all font-medium"
                />
              </div>
              <div className="flex-1 space-y-2 w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Telefon</label>
                <input 
                  type="tel"
                  placeholder="Telefonnummer"
                  value={quickAddData.phone}
                  onChange={e => setQuickAddData({...quickAddData, phone: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-secondary/20 transition-all font-medium"
                />
              </div>
              <div className="flex-1 space-y-2 w-full">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Kategorie</label>
                <select 
                  value={quickAddData.category}
                  onChange={e => setQuickAddData({...quickAddData, category: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-brand-secondary/20 transition-all font-medium"
                >
                  <option value="Privat">Privat</option>
                  <option value="Geschäftlich">Geschäftlich</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>
              <button 
                type="submit"
                className="px-8 py-2 bg-brand-secondary text-white rounded-xl font-bold hover:bg-brand-dark transition-all shadow-lg shadow-brand-secondary/20 h-[42px]"
              >
                Hinzufügen
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Table */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div id="customer-management-table-container" className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 w-10">
                  <input 
                    type="checkbox"
                    checked={selectedCustomerIds.length === filteredCustomers.length && filteredCustomers.length > 0}
                    onChange={toggleAllSelection}
                    className="w-5 h-5 rounded-lg border-slate-300 text-brand-primary focus:ring-brand-primary/20"
                  />
                </th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-brand-primary transition-colors" onClick={() => handleSort('name')}>
                  Kunde / Firma {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-brand-primary transition-colors" onClick={() => handleSort('category')}>
                  Kategorie {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-brand-primary transition-colors" onClick={() => handleSort('last_contact' as any)}>
                  Letzter Kontakt {sortConfig.key === 'last_contact' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                </th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest">Kontakt</th>
                <th className="px-8 py-5 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
                  </td>
                </tr>
              ) : filteredCustomers.map((customer) => (
                <tr key={customer.id} className={`hover:bg-slate-50/30 transition-colors group ${selectedCustomerIds.includes(customer.id) ? 'bg-brand-accent/30' : ''}`}>
                  <td className="px-8 py-5">
                    <input 
                      type="checkbox"
                      checked={selectedCustomerIds.includes(customer.id)}
                      onChange={() => toggleCustomerSelection(customer.id)}
                      className="w-5 h-5 rounded-lg border-slate-300 text-brand-primary focus:ring-brand-primary/20"
                    />
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-brand-accent rounded-2xl flex items-center justify-center text-brand-primary font-bold text-lg">
                        {customer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-brand-dark">{customer.name}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-1">
                          <Building2 size={12} /> {customer.company || 'Privatkunde'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      customer.category === 'VIP' ? 'bg-amber-100 text-amber-600' :
                      customer.category === 'Geschäftlich' ? 'bg-blue-100 text-blue-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {customer.category || 'Privat'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    {customer.last_contact ? (
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-brand-dark">
                          {new Date(customer.last_contact).toLocaleDateString('de-DE')}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {new Date(customer.last_contact).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Kein Kontakt</span>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600 font-medium flex items-center gap-2">
                        <Mail size={14} className="text-slate-400" /> {customer.email}
                      </p>
                      <p className="text-sm text-slate-600 font-medium flex items-center gap-2">
                        <Phone size={14} className="text-slate-400" /> {customer.phone}
                      </p>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleOpenLogs(customer)}
                        className="p-2 bg-slate-50 text-slate-400 hover:bg-brand-accent hover:text-brand-primary rounded-xl transition-all"
                        title="Kommunikations-Logs"
                      >
                        <MessageSquare size={18} />
                      </button>
                      <button 
                        onClick={() => handleOpenModal(customer)}
                        className="p-2 bg-slate-50 text-slate-400 hover:bg-brand-primary hover:text-white rounded-xl transition-all"
                      >
                        <Edit3 size={18} />
                      </button>
                      <button 
                        onClick={() => handleDelete(customer.id)}
                        className="p-2 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-8 py-20 text-center text-slate-400 italic">
                    Keine Kunden gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Communication Logs Modal */}
      <AnimatePresence>
        {selectedCustomerForLogs && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCustomerForLogs(null)}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-3xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedCustomerForLogs(null)}
                    className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                  >
                    <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                    Zurück
                  </button>
                  <div>
                    <h3 className="text-2xl font-black text-brand-dark tracking-tighter">
                      Kommunikations-Logs
                    </h3>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {selectedCustomerForLogs.name}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedCustomerForLogs(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* New Log Form */}
                <form onSubmit={handleAddLog} className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                  <h4 className="text-sm font-black text-brand-dark uppercase tracking-widest">Neuer Eintrag</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Typ</label>
                      <select 
                        value={logFormData.type}
                        onChange={e => setLogFormData({...logFormData, type: e.target.value})}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-sm"
                      >
                        <option value="Call">Anruf</option>
                        <option value="Email">E-Mail</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Note">Notiz</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Inhalt</label>
                      <textarea 
                        required
                        value={logFormData.content}
                        onChange={e => setLogFormData({...logFormData, content: e.target.value})}
                        placeholder="Was wurde besprochen?"
                        rows={3}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium text-sm resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="submit"
                      className="px-6 py-2 bg-brand-primary text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand-primary/20"
                    >
                      Eintrag speichern
                    </button>
                  </div>
                </form>

                {/* Logs List */}
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-brand-dark uppercase tracking-widest flex items-center gap-2">
                    <History size={16} /> Historie
                  </h4>
                  {logLoading ? (
                    <div className="py-10 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto"></div>
                    </div>
                  ) : logs.length > 0 ? (
                    <div className="space-y-3">
                      {logs.map(log => (
                        <div key={log.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            log.type === 'Call' ? 'bg-blue-50 text-blue-600' :
                            log.type === 'Email' ? 'bg-purple-50 text-purple-600' :
                            log.type === 'Meeting' ? 'bg-emerald-50 text-emerald-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {log.type === 'Call' && <Phone size={18} />}
                            {log.type === 'Email' && <Mail size={18} />}
                            {log.type === 'Meeting' && <Users size={18} />}
                            {log.type === 'Note' && <Edit3 size={18} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {log.type === 'Call' ? 'Anruf' : 
                                 log.type === 'Email' ? 'E-Mail' : 
                                 log.type === 'Meeting' ? 'Meeting' : 'Notiz'}
                              </span>
                              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                                <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(log.date).toLocaleDateString('de-DE')}</span>
                                <span className="flex items-center gap-1"><Clock size={10} /> {new Date(log.date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                            <p className="text-sm text-brand-dark font-medium leading-relaxed">{log.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center text-slate-400 italic text-sm">
                      Noch keine Log-Einträge vorhanden.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleCloseModal}
                    className="flex items-center gap-2 bg-white text-slate-400 hover:text-brand-primary border border-slate-100 hover:border-brand-primary/20 px-3 py-1.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-sm group"
                  >
                    <ChevronRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                    Zurück
                  </button>
                  <h3 className="text-2xl font-black text-brand-dark tracking-tighter">
                    {editingCustomer ? 'Kunde bearbeiten' : 'Neuer Kunde'}
                  </h3>
                </div>
                <button onClick={handleCloseModal} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Vollständiger Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
                        placeholder="Max Mustermann"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Firma (Optional)</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({...formData, company: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
                        placeholder="Beispiel GmbH"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">E-Mail Adresse</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        required
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
                        placeholder="max@beispiel.de"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Telefonnummer</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                      <input 
                        required
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
                        placeholder="+49 123 456789"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Kategorie</label>
                    <select 
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium"
                    >
                      <option value="Privat">Privat</option>
                      <option value="Geschäftlich">Geschäftlich</option>
                      <option value="VIP">VIP</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Adresse</label>
                  <textarea 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium resize-none"
                    placeholder="Straße, Hausnummer, PLZ, Ort"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Notizen</label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all font-medium resize-none"
                    placeholder="Zusätzliche Informationen zum Kunden..."
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Abbrechen
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-8 py-4 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-dark transition-all shadow-xl shadow-brand-primary/20 flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {editingCustomer ? 'Aktualisieren' : 'Kunden anlegen'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
