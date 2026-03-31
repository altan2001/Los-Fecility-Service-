import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import Admin from './Admin';
import { 
  Hammer, 
  Droplets, 
  Layers, 
  Wind, 
  Paintbrush, 
  CheckCircle2, 
  FileText,
  Phone, 
  Mail, 
  MapPin,
  Calculator,
  Plus,
  Minus,
  Download,
  Globe,
  ArrowRight,
  Menu,
  X,
  ChevronRight,
  Star,
  ArrowUpRight,
  ArrowDown,
  Shield,
  Clock,
  Zap,
  HardHat,
  Construction,
  Video,
  LayoutDashboard,
  LogOut,
  Users,
  Key,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence, useScroll, useTransform } from 'motion/react';
import { Accordion } from './components/Accordion';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import MyProjects from './components/MyProjects';
import LiveCalculator from './components/LiveCalculator';
import ServiceCatalog from './components/ServiceCatalog';
import QuoteBuilder from './components/QuoteBuilder';
import Pricing from './components/Pricing';

import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, query, orderBy } from 'firebase/firestore';

// --- Types ---
export interface CalcPosition {
  id: string;
  name: string;
  unit: string;
  labor_hours: number;
  material_price: number;
  quantity: number;
}

export interface TradeAttributeDefinition {
  id: string;
  label: string;
  type: 'select' | 'number' | 'boolean' | 'text';
  options?: string[];
  unit?: string;
}

export interface Trade {
  id: string;
  name: string;
  description: string;
  is_anlage_a?: number;
  attribute_definitions?: TradeAttributeDefinition[];
}

export interface LaborRate {
  id: string;
  worker_type: 'Meister' | 'Geselle' | 'Helfer';
  hourly_rate: number;
}

export type ContentMap = { [key: string]: string };
export type MediaItem = {
  id: string;
  type: 'image' | 'video';
  url: string;
  category: string;
  title: string;
  description: string;
  sort_order: number;
};

// --- Auth Context ---
interface AuthContextType {
  user: any;
  isAdmin: boolean;
  permissions: any;
  loading: boolean;
  handleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [permissions, setPermissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async (firebaseUser: any) => {
    try {
      const res = await fetch(`/api/user/profile?userId=${firebaseUser.uid}`);
      const data = await res.json();
      if (data.success) {
        setUser({ ...firebaseUser, ...data.user });
        
        const adminEmail = "altankg@gmail.com";
        let isUserAdmin = firebaseUser.email === adminEmail && firebaseUser.emailVerified;
        
        // Fetch role permissions if user has a role
        if (data.user.role) {
          const rolesRes = await fetch('/api/roles');
          const rolesData = await rolesRes.json();
          if (rolesData.success) {
            const userRole = rolesData.roles.find((r: any) => r.id === data.user.role);
            if (userRole) {
              setPermissions(userRole.permissions);
              // If user has any edit permission or is explicitly admin, allow admin access
              if (userRole.name.toLowerCase() === 'admin' || 
                  Object.values(userRole.permissions).some((p: any) => p.edit || p.delete)) {
                isUserAdmin = true;
              }
            }
          }
        }

        if (!isUserAdmin && data.user.role === 'admin') {
          isUserAdmin = true;
        }
        setIsAdmin(isUserAdmin);
      } else {
        setUser(firebaseUser);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setUser(firebaseUser);
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    if (auth.currentUser) {
      await fetchUser(auth.currentUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchUser(firebaseUser);
      } else {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Login Fehler:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout Fehler:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, permissions, loading, handleLogin, handleLogout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function App() {
  const [customCss, setCustomCss] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) {
          console.error(`Fehler beim Laden des benutzerdefinierten CSS: Server antwortete mit Status ${res.status}`);
          return;
        }
        const data = await res.json();
        if (data && data.custom_css) {
          const css = data.custom_css;
          
          // Einfache Validierung: Prüfen, ob es sich um gültigen CSS-Code handelt (kein HTML)
          if (typeof css !== 'string') {
            console.error('Ungültiges CSS-Format: Erwartete einen String.');
            return;
          }
          
          if (css.trim().startsWith('<')) {
            console.error('Ungültiger CSS-Code erkannt: Der Inhalt scheint HTML zu sein.');
            return;
          }

          setCustomCss(css);
        }
      } catch (err) {
        console.error('Kritischer Fehler beim Laden des benutzerdefinierten CSS:', err);
      }
    };
    fetchSettings();
  }, []);

  return (
    <AuthProvider>
      <Router>
        {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}
        <Routes>
          <Route path="/admin" element={<Admin activeTabDefault="quotes" />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/admin/quotes" element={<Admin activeTabDefault="quotes" />} />
          <Route path="/admin/rates" element={<Admin activeTabDefault="rates" />} />
          <Route path="/impressum" element={<LegalPage title="Impressum" content={<ImpressumContent />} />} />
          <Route path="/datenschutz" element={<LegalPage title="Datenschutz" content={<DatenschutzContent />} />} />
          <Route path="/agb" element={<LegalPage title="AGB" content={<AGBContent />} />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<MainSite />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', text: data.message });
      } else {
        setStatus({ type: 'error', text: data.message });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-accent flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Key size={32} />
          </div>
          <h1 className="text-3xl font-black text-brand-dark tracking-tighter mb-2">Passwort vergessen?</h1>
          <p className="text-slate-500">Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen zu erhalten.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input 
            label="E-Mail-Adresse" 
            type="email" 
            placeholder="ihre@email.de" 
            required 
            value={email}
            onChange={e => setEmail(e.target.value)}
          />

          {status && (
            <div className={`p-4 rounded-xl flex items-start gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {status.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5" /> : <AlertCircle size={18} className="mt-0.5" />}
              <p className="text-sm font-medium">{status.text}</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-brand-primary text-white font-bold py-4 rounded-xl hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? 'Wird gesendet...' : 'Link senden'}
          </button>

          <div className="text-center">
            <Link to="/" className="text-sm font-bold text-brand-primary hover:underline">
              Zurück zum Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', text: 'Die Passwörter stimmen nicht überein.' });
      return;
    }
    if (newPassword.length < 6) {
      setStatus({ type: 'error', text: 'Das Passwort muss mindestens 6 Zeichen lang sein.' });
      return;
    }

    setIsLoading(true);
    setStatus(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: 'success', text: data.message });
        setTimeout(() => navigate('/'), 3000);
      } else {
        setStatus({ type: 'error', text: data.message });
      }
    } catch (err) {
      setStatus({ type: 'error', text: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-brand-accent flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-xl text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-black text-brand-dark mb-4">Ungültiger Link</h1>
          <p className="text-slate-500 mb-8">Dieser Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen.</p>
          <Link to="/" className="bg-brand-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-brand-primary/90 transition-all inline-block">
            Zur Startseite
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-accent flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Shield size={32} />
          </div>
          <h1 className="text-3xl font-black text-brand-dark tracking-tighter mb-2">Neues Passwort</h1>
          <p className="text-slate-500">Wählen Sie ein neues, sicheres Passwort für Ihr Konto.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input 
            label="Neues Passwort" 
            type="password" 
            placeholder="••••••••" 
            required 
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
          />
          <Input 
            label="Passwort bestätigen" 
            type="password" 
            placeholder="••••••••" 
            required 
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
          />

          {status && (
            <div className={`p-4 rounded-xl flex items-start gap-3 ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              {status.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5" /> : <AlertCircle size={18} className="mt-0.5" />}
              <p className="text-sm font-medium">{status.text}</p>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-brand-primary text-white font-bold py-4 rounded-xl hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? 'Wird gespeichert...' : 'Passwort speichern'}
          </button>
        </form>
      </div>
    </div>
  );
}

function MainSite() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isAdmin, handleLogin: authLogin, handleLogout: authLogout, refreshUser } = useAuth();
  const [content, setContent] = useState<ContentMap>({});
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [contactForm, setContactForm] = useState({ firstName: '', lastName: '', email: '', message: '' });
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [formStatus, setFormStatus] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const { scrollY } = useScroll();
  const [isScrolled, setIsScrolled] = useState(false);

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '', address: '', email: '' });
  const [calculatorUsed, setCalculatorUsed] = useState(() => localStorage.getItem('calculator_used') === 'true');

  useEffect(() => {
    if (user) {
      localStorage.setItem('calculator_used', 'true');
      setCalculatorUsed(true);
    }
  }, [user]);

  useEffect(() => {
    if (user && !user.first_name && !user.last_name) {
      // Check if profile is complete
      const checkProfile = async () => {
        try {
          const res = await fetch(`/api/user/profile?userId=${user.uid}`);
          const data = await res.json();
          if (data.success && !data.user.first_name) {
            setProfileForm({
              firstName: data.user.first_name || user.displayName?.split(' ')[0] || '',
              lastName: data.user.last_name || user.displayName?.split(' ')[1] || '',
              phone: data.user.phone || '',
              address: data.user.address || '',
              email: data.user.email || user.email || ''
            });
            setIsProfileModalOpen(true);
          }
        } catch (err) {
          console.error('Error checking profile completion:', err);
        }
      };
      checkProfile();
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.uid,
          ...profileForm
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsProfileModalOpen(false);
        // Refresh user data
        await refreshUser();
      }
    } catch (err) {
      console.error('Profile update error:', err);
    }
  };

  const handleLogin = () => {
    setIsLoginModalOpen(true);
  };

  const handleGoogleLogin = async () => {
    try {
      await authLogin();
      setIsLoginModalOpen(false);
    } catch (err) {
      console.error('Login Fehler:', err);
    }
  };

  const handleLogout = async () => {
    await authLogout();
  };

  useEffect(() => {
    return scrollY.onChange((latest) => {
      setIsScrolled(latest > 50);
    });
  }, [scrollY]);

  useEffect(() => {
    // Fetch content and media from Firestore
    const contentUnsubscribe = onSnapshot(collection(db, 'content'), (snapshot) => {
      const contentMap: ContentMap = {};
      snapshot.forEach((doc) => {
        contentMap[doc.id] = doc.data().value;
      });
      setContent(contentMap);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'content'));

    const mediaUnsubscribe = onSnapshot(query(collection(db, 'media'), orderBy('sort_order', 'asc')), (snapshot) => {
      const mediaList: MediaItem[] = [];
      snapshot.forEach((doc) => {
        mediaList.push({ id: doc.id, ...doc.data() } as MediaItem);
      });
      setMedia(mediaList);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'media'));

    return () => {
      contentUnsubscribe();
      mediaUnsubscribe();
    };
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      const data = await res.json();
      if (data.success) {
        setFormStatus({ type: 'success', text: data.message });
        setContactForm({ firstName: '', lastName: '', email: '', message: '' });
      }
    } catch (err) {
      setFormStatus({ type: 'error', text: 'Fehler beim Senden.' });
    }
  };

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newsletterEmail })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        setNewsletterEmail('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const t = (key: string, fallback: string) => content[key] || fallback;
  const getMedia = (category: string) => media.filter(m => m.category === category);

  return (
    <div className="min-h-screen bg-brand-paper font-sans text-brand-dark selection:bg-brand-primary/20 scroll-smooth">
      {/* Login Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative z-10 overflow-hidden"
            >
              <button 
                onClick={() => setIsLoginModalOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-brand-dark transition-colors"
              >
                <X size={24} />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users size={32} />
                </div>
                <h3 className="text-3xl font-black text-brand-dark tracking-tighter">Willkommen zurück</h3>
                <p className="text-slate-500">Melden Sie sich an, um fortzufahren.</p>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-4 bg-white border border-slate-200 py-4 rounded-xl font-bold text-brand-dark hover:bg-slate-50 transition-all shadow-sm"
                >
                  <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                  Mit Google anmelden
                </button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                    <span className="bg-white px-4 text-slate-400">Oder mit E-Mail</span>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={(e) => {
                  e.preventDefault();
                  // For demo purposes, we'll just show an alert
                  alert('E-Mail-Login ist in dieser Demo nur für Google-Konten vorkonfiguriert. Bitte nutzen Sie Google Login.');
                }}>
                  <Input label="E-Mail" placeholder="ihre@email.de" type="email" required />
                  <Input label="Passwort" placeholder="••••••••" type="password" required />
                  
                  <div className="flex justify-end">
                    <Link 
                      to="/forgot-password" 
                      onClick={() => setIsLoginModalOpen(false)}
                      className="text-sm font-bold text-brand-primary hover:underline"
                    >
                      Passwort vergessen?
                    </Link>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-brand-primary text-white font-bold py-4 rounded-xl hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20"
                  >
                    Anmelden
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Completion Modal */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-brand-dark/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-8 md:p-12">
                <div className="mb-8">
                  <h3 className="text-3xl font-black text-brand-dark tracking-tighter mb-2">Profil vervollständigen</h3>
                  <p className="text-slate-500 font-medium">Bitte geben Sie Ihre Daten an, um Angebote erstellen zu können.</p>
                </div>
                
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Vorname</label>
                      <input 
                        required
                        type="text"
                        value={profileForm.firstName}
                        onChange={e => setProfileForm({ ...profileForm, firstName: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Nachname</label>
                      <input 
                        required
                        type="text"
                        value={profileForm.lastName}
                        onChange={e => setProfileForm({ ...profileForm, lastName: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">E-Mail</label>
                    <input 
                      required
                      type="email"
                      value={profileForm.email}
                      onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Handynummer</label>
                    <input 
                      required
                      type="tel"
                      placeholder="+49 123 4567890"
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all"
                    />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Adresse</label>
                    <textarea 
                      required
                      rows={2}
                      value={profileForm.address}
                      onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none transition-all resize-none"
                    />
                  </div>
                  
                  <button 
                    type="submit"
                    className="w-full py-4 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20 mt-4"
                  >
                    Profil speichern
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modern Navigation */}
      <motion.nav 
        id="main-nav"
        className="fixed top-0 w-full z-50 transition-all duration-300 h-20 flex items-center border-b border-transparent data-[scrolled=true]:border-slate-200 bg-white/0 data-[scrolled=true]:bg-white/90"
        data-scrolled={isScrolled}
      >
        <div className="max-w-7xl mx-auto px-6 w-full flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-primary flex items-center justify-center text-white rounded-xl shadow-lg shadow-brand-primary/20">
              <Construction size={24} />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-black tracking-tight leading-none uppercase text-brand-dark">Los Facility Service</span>
              <span className="text-[9px] tracking-[0.2em] font-bold text-brand-secondary uppercase mt-1">Bausanierung & Renovierung</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8 text-sm font-semibold tracking-tight">
              <a href="#start" className="hover:text-brand-primary transition-colors">Startseite</a>
              <a href="#ueber-uns" className="hover:text-brand-primary transition-colors">Über uns</a>
              <a href="#leistungen" className="hover:text-brand-primary transition-colors">Leistungen</a>
              <a href="#leistungskatalog" className="hover:text-brand-primary transition-colors">Katalog</a>
              <a href="#projekte" className="hover:text-brand-primary transition-colors">Projekte</a>
              <a href="#karriere" className="hover:text-brand-primary transition-colors">Karriere</a>
              <Link to="/pricing" className="hover:text-brand-primary transition-colors">Preise</Link>
              <a href="#kalkulator" className="px-6 py-3 bg-brand-primary text-white rounded-full hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20">Live-Kalkulator</a>
              <a href="#kontakt" className="hover:text-brand-primary transition-colors">Kontakt</a>
            </div>

            {/* Login/Admin - Visible on all devices */}
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-2 md:gap-4">
                  {user && (
                    <a 
                      href="#meine-projekte" 
                      className="text-xs md:text-sm font-bold px-3 py-1.5 md:px-4 md:py-2 bg-brand-accent text-brand-primary rounded-lg hover:bg-brand-primary hover:text-white transition-all flex items-center gap-2"
                    >
                      <FileText size={14} className="hidden md:block" />
                      Meine Projekte
                    </a>
                  )}
                  {isAdmin && (
                    <Link 
                      to="/admin" 
                      className="text-xs md:text-sm font-bold px-3 py-1.5 md:px-4 md:py-2 bg-brand-dark text-white rounded-lg hover:bg-brand-primary transition-all flex items-center gap-2"
                    >
                      <LayoutDashboard size={14} className="hidden md:block" />
                      Admin
                    </Link>
                  )}
                  <button 
                    onClick={handleLogout} 
                    className="text-[10px] md:text-xs text-slate-400 hover:text-red-500 font-bold uppercase tracking-wider"
                  >
                    Abmelden
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin} 
                  className="text-xs md:text-sm font-bold px-4 py-2 border border-slate-200 rounded-lg hover:border-brand-primary hover:text-brand-primary transition-all flex items-center gap-2"
                >
                  <Users size={16} />
                  Anmelden
                </button>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button className="lg:hidden p-2 text-brand-dark" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 bg-white z-40 pt-24 px-6 flex flex-col gap-6 text-3xl font-black uppercase tracking-tighter"
          >
            <a href="#start" onClick={() => setIsMenuOpen(false)}>Startseite</a>
            <a href="#ueber-uns" onClick={() => setIsMenuOpen(false)}>Über uns</a>
            <a href="#leistungen" onClick={() => setIsMenuOpen(false)}>Leistungen</a>
            <a href="#leistungskatalog" onClick={() => setIsMenuOpen(false)}>Katalog</a>
            <a href="#kalkulator" onClick={() => setIsMenuOpen(false)}>Live-Kalkulator</a>
            {user && <a href="#meine-projekte" onClick={() => setIsMenuOpen(false)}>Meine Projekte</a>}
            <a href="#projekte" onClick={() => setIsMenuOpen(false)}>Projekte</a>
            <a href="#karriere" onClick={() => setIsMenuOpen(false)}>Karriere</a>
            <Link to="/pricing" onClick={() => setIsMenuOpen(false)}>Preise</Link>
            <a href="#kontakt" onClick={() => setIsMenuOpen(false)}>Kontakt</a>
            <div className="mt-8 pt-8 border-t border-slate-100">
              {user ? (
                <div className="flex flex-col gap-4">
                  {isAdmin && (
                    <Link 
                      to="/admin" 
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center gap-3 text-brand-primary"
                    >
                      <LayoutDashboard size={24} />
                      Admin Panel
                    </Link>
                  )}
                  <button 
                    onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                    className="flex items-center gap-3 text-red-500"
                  >
                    <LogOut size={24} />
                    Abmelden
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => { handleLogin(); setIsMenuOpen(false); }}
                  className="flex items-center gap-3 text-brand-dark"
                >
                  <Users size={24} />
                  Anmelden
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section - Split Modern Layout */}
      <section id="start" className="relative min-h-screen pt-16 pb-8 flex items-center overflow-hidden bg-brand-accent">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-brand-secondary/5 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold uppercase tracking-widest mb-6">
              <Shield size={14} />
              Meistergeführter Fachbetrieb
            </div>
            <h1 className="text-6xl md:text-8xl font-black text-brand-dark mb-8 leading-[0.9] tracking-tighter text-balance">
              {t('hero_title', 'Wir bauen Zukunft auf festem Grund.')}
            </h1>
            <p className="text-xl text-slate-500 mb-10 max-w-xl leading-relaxed">
              {t('hero_subtitle', 'Von der ersten Planung bis zur finalen Abnahme – Los Facility Service ist Ihr Partner für hochwertige Bausanierung, Trockenbau und moderne Wasserinstallation in Maisach und Umgebung.')}
            </p>
            <div className="flex flex-wrap gap-4">
              <a 
                href="#kalkulator"
                className="px-8 py-4 bg-brand-primary text-white rounded-2xl font-bold hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20 flex items-center gap-3"
              >
                Kostenlos kalkulieren
                <ArrowRight size={20} />
              </a>
              <a 
                href="#leistungen"
                className="px-8 py-4 bg-white text-brand-dark border border-slate-200 rounded-2xl font-bold hover:border-brand-primary transition-all"
              >
                Unsere Leistungen
              </a>
            </div>
            
            <div className="mt-16 flex items-center gap-8">
              <div className="flex -space-x-3">
                <div className="w-12 h-12 rounded-full border-4 border-white bg-brand-primary flex items-center justify-center text-white text-[10px] font-bold">TOP</div>
                <div className="w-12 h-12 rounded-full border-4 border-white bg-brand-secondary flex items-center justify-center text-white text-[10px] font-bold">PRO</div>
                <div className="w-12 h-12 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center text-brand-dark text-[10px] font-bold">24/7</div>
              </div>
              <div>
                <div className="flex gap-1 text-amber-400 mb-1">
                  {[1, 2, 3, 4, 5].map(i => <Star key={i} size={14} fill="currentColor" />)}
                </div>
                <p className="text-sm font-bold text-slate-600">Über 250+ zufriedene Kunden</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            <div className="relative z-10 rounded-[2.5rem] overflow-hidden shadow-2xl shadow-brand-primary/10 aspect-[4/5] border-8 border-white">
              <img 
                src="https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&q=80" 
                className="w-full h-full object-cover"
                alt="Construction worker"
              />
            </div>
            {/* Floating Stats */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -right-10 top-20 z-20 glass-card p-6 rounded-3xl shadow-xl hidden md:block border-l-4 border-brand-secondary"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-secondary/20 text-brand-secondary rounded-2xl flex items-center justify-center">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-2xl font-black text-brand-dark">100%</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Qualitätsgarantie</p>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
              className="absolute -left-10 bottom-20 z-20 glass-card p-6 rounded-3xl shadow-xl hidden md:block border-l-4 border-brand-primary"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-brand-primary/20 text-brand-primary rounded-2xl flex items-center justify-center">
                  <Clock size={24} />
                </div>
                <div>
                  <p className="text-2xl font-black text-brand-dark">Termintreu</p>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Zuverlässige Planung</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* About Us Section */}
      <section id="ueber-uns" className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative">
              <div className="rounded-[2.5rem] overflow-hidden shadow-2xl aspect-video">
                <img 
                  src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&q=80" 
                  className="w-full h-full object-cover"
                  alt="Team at work"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute -bottom-6 -right-6 bg-brand-primary text-white p-8 rounded-3xl shadow-xl">
                <p className="text-4xl font-black tracking-tighter">10+</p>
                <p className="text-xs font-bold uppercase tracking-widest">Jahre Erfahrung</p>
              </div>
            </div>
            <div>
              <h2 className="text-sm font-bold text-brand-secondary uppercase tracking-[0.3em] mb-4">Über uns</h2>
              <h3 className="text-4xl md:text-5xl font-black text-brand-dark tracking-tighter mb-6">
                {t('about_title', 'Qualität, die man sieht.')}
              </h3>
              <p className="text-lg text-slate-500 mb-8 leading-relaxed">
                {t('about_text', 'Seit über 10 Jahren stehen wir für erstklassige Handwerkskunst. Los Facility Service ist Ihr zuverlässiger Partner für alle Belange rund um Bausanierung, Wasserinstallation und Trockenbau.')}
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-brand-accent rounded-2xl border border-slate-100">
                  <h4 className="font-bold text-brand-dark mb-2">Meisterbetrieb</h4>
                  <p className="text-sm text-slate-500">Geführt von erfahrenen Handwerksmeistern.</p>
                </div>
                <div className="p-6 bg-brand-accent rounded-2xl border border-slate-100">
                  <h4 className="font-bold text-brand-dark mb-2">Termintreue</h4>
                  <p className="text-sm text-slate-500">Wir halten uns an Absprachen und Zeitpläne.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section - Modern Bento Grid */}
      <section id="leistungen" className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-sm font-bold text-brand-secondary uppercase tracking-[0.3em] mb-4">Unsere Expertise</h2>
              <h3 className="text-5xl md:text-6xl font-black text-brand-dark tracking-tighter leading-tight">
                Gewerke & Leistungen <br/>auf höchstem Niveau.
              </h3>
            </div>
            <p className="text-slate-500 max-w-xs font-medium leading-relaxed">
              Wir vereinen traditionelles Handwerk mit modernster Technik für nachhaltige Ergebnisse.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <ServiceCard 
              className="md:col-span-8"
              title="Bausanierung & Modernisierung"
              desc="Wir verwandeln alte Bausubstanz in moderne Lebensräume. Von der Entkernung bis zum Finish."
              items={["Komplette Kernsanierung", "Feuchtigkeitsschutz", "Energetische Sanierung"]}
              img="https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80"
              icon={<Hammer size={24} className="text-brand-primary" />}
            />
            <ServiceCard 
              className="md:col-span-4"
              title="Wasserinstallation"
              desc="Präzise Installationen für Bad und Küche."
              items={["Neuinstallation", "Sanitär-Sanierung", "Armaturen"]}
              img="https://images.unsplash.com/photo-1585704032915-c3400ca1f963?auto=format&fit=crop&q=80"
              icon={<Droplets size={24} className="text-brand-secondary" />}
            />
            <ServiceCard 
              className="md:col-span-4"
              title="Flüssigboden"
              desc="Die innovative Lösung für perfekte Böden."
              items={["Fugenlos", "Hygienisch", "Langlebig"]}
              img="https://images.unsplash.com/photo-1531834685032-c34bfad1f902?auto=format&fit=crop&q=80"
              icon={<Layers size={24} className="text-brand-primary" />}
            />
            <ServiceCard 
              className="md:col-span-8"
              title="Trockenbau & Rigips"
              desc="Flexible Raumgestaltung nach Ihren Wünschen. Schnell, sauber und effizient."
              items={["Akustikdecken", "Trennwände", "Dachausbau"]}
              img="https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?auto=format&fit=crop&q=80"
              icon={<Wind size={24} className="text-brand-secondary" />}
            />
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-10 bg-brand-dark text-white overflow-hidden relative">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-brand-primary via-transparent to-transparent" />
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-brand-secondary font-bold uppercase tracking-widest mb-4">Der Ablauf</h2>
            <h3 className="text-4xl md:text-6xl font-black tracking-tighter">In 4 Schritten zum Ziel</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative">
            <div className="absolute top-1/2 left-0 w-full h-px bg-white/10 hidden md:block -translate-y-1/2" />
            <ProcessStep number="01" title="Beratung" desc="Kostenlose Erstberatung und Bedarfsanalyse vor Ort." />
            <ProcessStep number="02" title="Planung" desc="Detaillierte Kalkulation und Zeitplanerstellung." />
            <ProcessStep number="03" title="Umsetzung" desc="Fachgerechte Ausführung durch unser Expertenteam." />
            <ProcessStep number="04" title="Abnahme" desc="Gemeinsame Begehung und Übergabe Ihres Projekts." />
          </div>
        </div>
      </section>

      {/* My Projects Section - Only for logged in users */}
      {user && (
        <section id="meine-projekte" className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-sm font-bold text-brand-secondary uppercase tracking-[0.3em] mb-4">Ihre Übersicht</h2>
              <h3 className="text-4xl md:text-5xl font-black text-brand-dark tracking-tighter mb-6">
                Meine Projekte & Kalkulationen.
              </h3>
              <p className="text-slate-500 max-w-2xl mx-auto font-medium">
                Hier finden Sie alle Ihre gespeicherten Projekte, Angebote und den aktuellen Status Ihrer Bauvorhaben.
              </p>
            </div>
            <MyProjects />
          </div>
        </section>
      )}

      {/* Service Catalog Section */}
      <section id="leistungskatalog" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-sm font-bold text-brand-secondary uppercase tracking-[0.3em] mb-4">Leistungskatalog</h2>
            <h3 className="text-4xl md:text-5xl font-black text-brand-dark tracking-tighter mb-6">
              Transparente Preise & Leistungen.
            </h3>
            <p className="text-slate-500 max-w-2xl mx-auto">
              Hier finden Sie eine Übersicht aller verfügbaren Leistungen. Nutzen Sie unseren Live-Kalkulator weiter unten für ein individuelles Angebot.
            </p>
          </div>
          <ServiceCatalog />
        </div>
      </section>

      {/* Calculator Section - Modern Tool UI */}
      <section id="kalkulator" className="py-10 bg-brand-accent">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-white rounded-[3rem] shadow-2xl shadow-brand-primary/5 overflow-hidden border border-slate-100">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="lg:col-span-8 p-8 md:p-12">
                <div className="mb-10">
                  <h2 className="text-4xl font-black text-brand-dark tracking-tighter mb-4">Live-Kalkulator</h2>
                  <p className="text-slate-500 font-medium">Wählen Sie Ihre Leistungen und erhalten Sie sofort eine Schätzung.</p>
                </div>
                {!user && calculatorUsed ? (
                  <div className="bg-slate-50 rounded-[2rem] p-12 text-center border-2 border-dashed border-slate-200">
                    <div className="w-20 h-20 bg-brand-primary/10 text-brand-primary rounded-3xl flex items-center justify-center mx-auto mb-8">
                      <Key size={40} />
                    </div>
                    <h3 className="text-3xl font-black text-brand-dark tracking-tighter mb-4">Anmeldung erforderlich</h3>
                    <p className="text-slate-500 font-medium mb-8 max-w-md mx-auto">
                      Sie haben bereits eine Kalkulation erstellt. Um den Kalkulator weiterhin nutzen zu können, melden Sie sich bitte an.
                    </p>
                    <button 
                      onClick={() => setIsLoginModalOpen(true)}
                      className="bg-brand-primary text-white px-10 py-4 rounded-2xl font-bold hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20 uppercase tracking-widest"
                    >
                      Jetzt anmelden
                    </button>
                  </div>
                ) : (
                  <LiveCalculator 
                    isLoggedIn={!!user} 
                    onDownloadAttempt={() => setIsLoginModalOpen(true)} 
                  />
                )}
              </div>
              <div className="lg:col-span-4 bg-brand-dark p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-brand-primary/20 text-brand-primary rounded-2xl flex items-center justify-center mb-10">
                    <Calculator size={32} />
                  </div>
                  <h3 className="text-3xl font-black tracking-tighter mb-6">Warum kalkulieren?</h3>
                  <ul className="space-y-6 text-white/70 font-medium">
                    <li className="flex gap-4">
                      <Zap className="text-brand-secondary shrink-0" size={20} />
                      <span>Sofortige Preistransparenz ohne Wartezeit.</span>
                    </li>
                    <li className="flex gap-4">
                      <Zap className="text-brand-secondary shrink-0" size={20} />
                      <span>Individuell auf Ihr Projekt angepasst.</span>
                    </li>
                    <li className="flex gap-4">
                      <Zap className="text-brand-secondary shrink-0" size={20} />
                      <span>Basis für ein detailliertes Festpreisangebot.</span>
                    </li>
                  </ul>
                </div>
                <div className="mt-20 p-8 bg-white/5 rounded-3xl border border-white/10 relative z-10">
                  <p className="text-xs font-bold text-brand-secondary uppercase tracking-widest mb-2">Support benötigt?</p>
                  <p className="text-sm text-white/50 mb-6">Unsere Experten helfen Ihnen gerne bei der Kalkulation.</p>
                  <a href="tel:017624757550" className="flex items-center gap-3 font-bold hover:text-brand-primary transition-colors">
                    <Phone size={18} />
                    0176 24757550
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Detailed Trades Section */}
      <section id="gewerke-details" className="py-10 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-sm font-bold text-brand-secondary uppercase tracking-[0.3em] mb-4">Gewerke im Detail</h2>
            <h3 className="text-5xl font-black text-brand-dark tracking-tighter">Professionelle Ausführung aller Gewerke.</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
            <TradeDetail 
              title="Bausanierung & Maurerarbeiten"
              desc="Unsere Bausanierung umfasst die komplette Wiederherstellung und Modernisierung Ihrer Immobilie. Wir kümmern uns um statische Korrekturen, Wanddurchbrüche und die fachgerechte Instandsetzung von Mauerwerk. Dabei achten wir besonders auf den Erhalt historischer Substanz bei gleichzeitiger energetischer Optimierung."
              features={["Kernsanierung", "Mauerwerksinstandsetzung", "Betonsanierung", "Abdichtungstechnik"]}
            />
            <TradeDetail 
              title="Sanitär- & Wasserinstallation"
              desc="Von der Rohrverlegung bis zur Montage hochwertiger Design-Armaturen. Wir planen und realisieren Ihr Traumbad oder modernisieren veraltete Leitungsnetze. Unsere Installationen entsprechen den neuesten DIN-Normen und garantieren langfristige Sicherheit und Hygiene."
              features={["Badmodernisierung", "Rohrleitungsbau", "Trinkwasserhygiene", "Wartung & Service"]}
            />
            <TradeDetail 
              title="Trockenbau & Innenausbau"
              desc="Mit modernen Trockenbausystemen schaffen wir neue Räume in Rekordzeit. Ob Dachgeschossausbau, Akustikoptimierung oder Brandschutz – wir nutzen hochwertige Rigips-Systeme für perfekte Oberflächen und optimale Schallisolierung."
              features={["Dachgeschossausbau", "Schallschutzwände", "Abgehängte Decken", "Brandschutzsysteme"]}
            />
            <TradeDetail 
              title="Maler- & Bodenbelagsarbeiten"
              desc="Der letzte Schliff für Ihr Projekt. Wir bieten kreative Wandgestaltung, hochwertige Anstriche und innovative Bodenlösungen wie Flüssigboden oder klassische Beläge. Unsere Materialien sind emissionsarm und sorgen für ein gesundes Raumklima."
              features={["Kreativtechniken", "Fassadenanstrich", "Flüssigboden-Systeme", "Tapezierarbeiten"]}
            />
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="projekte" className="py-10 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-sm font-bold text-brand-secondary uppercase tracking-[0.3em] mb-4">Impressionen</h2>
              <h3 className="text-5xl font-black text-brand-dark tracking-tighter">Qualität, die man sieht.</h3>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {getMedia('gallery').length > 0 ? (
              getMedia('gallery').map(item => (
                <GalleryImage 
                  key={item.id} 
                  src={item.url} 
                  type={item.type}
                  alt={item.title} 
                  className={item.sort_order % 3 === 0 ? 'md:row-span-2' : ''} 
                />
              ))
            ) : (
              <>
                <GalleryImage src="https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80" alt="Bausanierung" />
                <GalleryImage src="https://images.unsplash.com/photo-1585704032915-c3400ca1f963?auto=format&fit=crop&q=80" className="md:row-span-2" alt="Wasserinstallation" />
                <GalleryImage src="https://images.unsplash.com/photo-1531834685032-c34bfad1f902?auto=format&fit=crop&q=80" alt="Flüssigboden" />
                <GalleryImage src="https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?auto=format&fit=crop&q=80" alt="Trockenbau" />
                <GalleryImage src="https://images.unsplash.com/photo-1589939705384-5185138a047a?auto=format&fit=crop&q=80" alt="Malerarbeiten" />
                <GalleryImage src="https://images.unsplash.com/photo-1503387762-592dee58c460?auto=format&fit=crop&q=80" alt="Sanierung" />
                <GalleryImage src="https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80" alt="Badezimmer" />
                <GalleryImage src="https://images.unsplash.com/photo-1530124560676-1adc4220aaad?auto=format&fit=crop&q=80" alt="Werkzeuge" />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Careers Section */}
      <section id="karriere" className="py-10 bg-brand-accent">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-sm font-bold text-brand-secondary uppercase tracking-[0.3em] mb-4">Karriere</h2>
            <h3 className="text-4xl md:text-5xl font-black text-brand-dark tracking-tighter">Werden Sie Teil unseres Teams.</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center mb-6">
                <HardHat size={24} />
              </div>
              <h4 className="text-xl font-bold text-brand-dark mb-2">Anlagenmechaniker SHK (m/w/d)</h4>
              <p className="text-slate-500 text-sm mb-6">Für unsere Projekte im Bereich Wasser- und Heizungsinstallation.</p>
              <a href="#kontakt" className="text-brand-primary font-bold flex items-center gap-2 hover:gap-3 transition-all">
                Jetzt bewerben <ArrowRight size={16} />
              </a>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-brand-secondary/10 text-brand-secondary rounded-xl flex items-center justify-center mb-6">
                <Paintbrush size={24} />
              </div>
              <h4 className="text-xl font-bold text-brand-dark mb-2">Maler & Lackierer (m/w/d)</h4>
              <p className="text-slate-500 text-sm mb-6">Kreative Köpfe für hochwertige Wandgestaltung und Fassaden.</p>
              <a href="#kontakt" className="text-brand-primary font-bold flex items-center gap-2 hover:gap-3 transition-all">
                Jetzt bewerben <ArrowRight size={16} />
              </a>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center mb-6">
                <Hammer size={24} />
              </div>
              <h4 className="text-xl font-bold text-brand-dark mb-2">Trockenbaumonteur (m/w/d)</h4>
              <p className="text-slate-500 text-sm mb-6">Spezialisten für modernen Innenausbau und Akustik.</p>
              <a href="#kontakt" className="text-brand-primary font-bold flex items-center gap-2 hover:gap-3 transition-all">
                Jetzt bewerben <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-sm font-bold text-brand-primary uppercase tracking-[0.3em] mb-4">FAQ</h2>
            <h3 className="text-4xl md:text-5xl font-black text-brand-dark tracking-tighter">Häufig gestellte Fragen.</h3>
          </div>
          
          <div className="space-y-4">
            {[
              {
                id: '1',
                title: 'Welche Gewerke decken Sie ab?',
                content: 'Wir sind ein vielseitiger Meisterbetrieb und decken Bausanierung, Wasserinstallation, Flüssigboden, Trockenbau sowie Malerarbeiten ab. Durch unser breites Netzwerk können wir auch gewerkeübergreifende Projekte schlüsselfertig realisieren.',
                icon: <Construction size={20} />
              },
              {
                id: '2',
                title: 'Wie schnell erhalte ich ein Angebot?',
                content: 'Nach einer ersten Besichtigung oder der Übermittlung Ihrer Pläne erstellen wir in der Regel innerhalb von 3-5 Werktagen ein detailliertes und transparentes Angebot für Sie.',
                icon: <Clock size={20} />
              },
              {
                id: '3',
                title: 'Bieten Sie auch Notfalldienste an?',
                content: 'Ja, insbesondere im Bereich der Wasserinstallation und bei dringenden Sanierungsfällen stehen wir unseren Kunden zeitnah zur Verfügung. Kontaktieren Sie uns am besten direkt telefonisch.',
                icon: <Phone size={20} />
              },
              {
                id: '4',
                title: 'In welchem Umkreis sind Sie tätig?',
                content: 'Unser Hauptsitz ist in Maisach. Wir sind primär im Landkreis Fürstenfeldbruck sowie im Großraum München und Augsburg für unsere Kunden im Einsatz.',
                icon: <MapPin size={20} />
              }
            ].map(item => (
              <Accordion 
                key={item.id}
                title={
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center">
                      {item.icon}
                    </div>
                    <span className="font-bold text-brand-dark">{item.title}</span>
                  </div>
                }
              >
                <p className="text-slate-500 leading-relaxed">{item.content}</p>
              </Accordion>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section - Modern Form */}
      <section id="kontakt" className="py-10 bg-brand-dark text-white relative overflow-hidden">
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-brand-secondary/5 rounded-full blur-3xl -mb-48 -mr-48" />
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 relative z-10">
          <div>
            <h2 className="text-brand-secondary font-bold uppercase tracking-widest mb-4">Kontakt</h2>
            <h3 className="text-4xl font-black tracking-tighter mb-8">Lassen Sie uns über Ihr Projekt sprechen.</h3>
            
            <div className="space-y-8">
              <ContactInfo icon={<MapPin className="text-brand-primary" />} title="Besuchen Sie uns" content="Kandlerstr 4, 82216 Maisach" />
              <ContactInfo icon={<Mail className="text-brand-secondary" />} title="Schreiben Sie uns" content="sol.dienstleistungen@gmx.de" />
              <ContactInfo icon={<Phone className="text-brand-primary" />} title="Rufen Sie an" content="0176 24757550" />
            </div>
          </div>
          
          <div className="bg-white rounded-[2.5rem] p-12 text-brand-dark shadow-2xl border-t-8 border-brand-primary">
            <form onSubmit={handleContactSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input 
                  label="Vorname" 
                  placeholder="Max" 
                  value={contactForm.firstName}
                  onChange={e => setContactForm({ ...contactForm, firstName: e.target.value })}
                />
                <Input 
                  label="Nachname" 
                  placeholder="Mustermann" 
                  value={contactForm.lastName}
                  onChange={e => setContactForm({ ...contactForm, lastName: e.target.value })}
                  className="bg-slate-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-brand-primary transition-all w-full"
                />
              </div>
              <Input 
                label="E-Mail" 
                placeholder="max@beispiel.de" 
                type="email" 
                value={contactForm.email}
                onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
              />
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nachricht</label>
                <textarea 
                  rows={4} 
                  value={contactForm.message}
                  onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-brand-primary transition-all resize-none"
                  placeholder="Wie können wir Ihnen helfen?"
                ></textarea>
              </div>
              <button type="submit" className="w-full bg-brand-primary text-white py-5 rounded-2xl font-bold hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20 uppercase tracking-widest">
                Anfrage senden
              </button>
              {formStatus && (
                <p className={`text-center font-bold ${formStatus.type === 'success' ? 'text-brand-secondary' : 'text-red-500'}`}>
                  {formStatus.text}
                </p>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="main-footer" className="bg-brand-dark text-white pt-10 pb-6 border-t border-white/5 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_bottom_left,_var(--tw-gradient-stops))] from-brand-primary/5 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* Column 1: Leistungen */}
            <div>
              <h4 className="text-xs font-bold mb-6 tracking-tight uppercase text-brand-secondary">Leistungen</h4>
              <ul className="space-y-3 text-sm font-medium text-white/50">
                <li>Bausanierung</li>
                <li>Wasserinstallation</li>
                <li>Flüssigboden</li>
                <li>Trockenbau</li>
                <li>Malerarbeiten</li>
              </ul>
              <div className="mt-8 flex gap-4">
                <a href="#" className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center hover:bg-brand-primary transition-colors">
                  <Globe size={16} />
                </a>
                <a href="#" className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center hover:bg-brand-secondary transition-colors">
                  <Mail size={16} />
                </a>
                <a href="#" className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center hover:bg-brand-primary transition-colors">
                  <Phone size={16} />
                </a>
              </div>
            </div>

            {/* Column 2: Navigation */}
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-brand-primary flex items-center justify-center text-white rounded-lg shadow-lg">
                  <Construction size={16} />
                </div>
                <span className="text-lg font-black tracking-tighter uppercase">Los Facility</span>
              </div>
              <h4 className="text-xs font-bold mb-6 tracking-tight uppercase text-brand-secondary">Navigation</h4>
              <ul className="space-y-3 text-sm font-medium text-white/50">
                <li><a href="#start" className="hover:text-brand-primary transition-colors">Startseite</a></li>
                <li><a href="#ueber-uns" className="hover:text-brand-primary transition-colors">Über uns</a></li>
                <li><a href="#leistungen" className="hover:text-brand-primary transition-colors">Leistungen</a></li>
                <li><a href="#leistungskatalog" className="hover:text-brand-primary transition-colors">Katalog</a></li>
                <li><a href="#projekte" className="hover:text-brand-primary transition-colors">Projekte</a></li>
                <li><a href="#karriere" className="hover:text-brand-primary transition-colors">Karriere</a></li>
                <li><a href="#kalkulator" className="hover:text-brand-primary transition-colors">Kalkulator</a></li>
                <li><a href="#kontakt" className="hover:text-brand-primary transition-colors">Kontakt</a></li>
              </ul>
            </div>

            {/* Column 3: Öffnungszeiten & Newsletter */}
            <div>
              <h4 className="text-xs font-bold mb-6 tracking-tight uppercase text-brand-secondary">Öffnungszeiten</h4>
              <table className="w-full text-xs text-white/50 mb-8">
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-2 pr-2 font-bold text-white/70">Mo - Fr</td>
                    <td className="py-2">08:00 - 18:00</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-white/70">Sa</td>
                    <td className="py-2">09:00 - 13:00</td>
                  </tr>
                </tbody>
              </table>
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold mb-2 tracking-tight uppercase text-brand-secondary">Newsletter</h4>
                <form onSubmit={handleNewsletterSubmit} className="relative">
                  <input 
                    type="email" 
                    required
                    value={newsletterEmail}
                    onChange={e => setNewsletterEmail(e.target.value)}
                    placeholder="E-Mail" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-xs outline-none focus:border-brand-primary transition-all"
                  />
                  <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-primary hover:text-brand-secondary transition-colors">
                    <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">
              © 2024 LOS FACILITY SERVICE | MEISTERBETRIEB | MAISACH
            </p>
            <div className="flex gap-8 text-[10px] font-bold text-white/30 uppercase tracking-widest">
              <Link to="/impressum" className="hover:text-white transition-colors">Impressum</Link>
              <Link to="/datenschutz" className="hover:text-white transition-colors">Datenschutz</Link>
              <Link to="/agb" className="hover:text-white transition-colors">AGB</Link>
              <Link to="/admin" className="hover:text-white transition-colors">Admin</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function LegalPage({ title, content }: { title: string, content: React.ReactNode }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-brand-paper font-sans text-brand-dark">
      <nav className="fixed top-0 w-full z-50 bg-white border-b border-slate-200 h-20 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full flex justify-between items-center">
          <Link to="/" className="flex items-center gap-4">
            <div className="w-10 h-10 bg-brand-dark flex items-center justify-center text-white rounded-lg">
              <Construction size={20} />
            </div>
            <span className="text-lg font-black tracking-tight uppercase">Los Facility</span>
          </Link>
          <Link to="/" className="text-sm font-bold text-brand-primary uppercase tracking-widest flex items-center gap-2">
            <ArrowRight size={16} className="rotate-180" />
            Zurück
          </Link>
        </div>
      </nav>
      <main className="pt-40 pb-24 max-w-4xl mx-auto px-6">
        <h1 className="text-5xl font-black mb-12 tracking-tighter">{title}</h1>
        <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed space-y-8">
          {content}
        </div>
      </main>
    </div>
  );
}

function ImpressumContent() {
  return (
    <>
      <section>
        <h2 className="text-xl font-bold text-brand-dark mb-4">Angaben gemäß § 5 TMG</h2>
        <p>Los Facility Service<br />Hauptstraße 1<br />82216 Maisach</p>
      </section>
      <section>
        <h2 className="text-xl font-bold text-brand-dark mb-4">Vertreten durch</h2>
        <p>Geschäftsführer: [Name des Geschäftsführers]</p>
      </section>
      <section>
        <h2 className="text-xl font-bold text-brand-dark mb-4">Kontakt</h2>
        <p>Telefon: +49 123 456789<br />E-Mail: info@los-facility.de</p>
      </section>
      <section>
        <h2 className="text-xl font-bold text-brand-dark mb-4">Umsatzsteuer-ID</h2>
        <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz:<br />DE 123 456 789</p>
      </section>
    </>
  );
}

function DatenschutzContent() {
  return (
    <>
      <section>
        <h2 className="text-xl font-bold text-brand-dark mb-4">1. Datenschutz auf einen Blick</h2>
        <p>Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren personenbezogenen Daten passiert, wenn Sie diese Website besuchen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich identifiziert werden können.</p>
      </section>
      <section>
        <h2 className="text-xl font-bold text-brand-dark mb-4">2. Datenerfassung auf unserer Website</h2>
        <p>Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber. Dessen Kontaktdaten können Sie dem Impressum dieser Website entnehmen.</p>
      </section>
    </>
  );
}

function AGBContent() {
  return (
    <>
      <section>
        <h2 className="text-xl font-bold text-brand-dark mb-4">§ 1 Geltungsbereich</h2>
        <p>Für die Geschäftsbeziehung zwischen Los Facility Service und dem Kunden gelten ausschließlich die nachfolgenden Allgemeinen Geschäftsbedingungen in ihrer zum Zeitpunkt der Bestellung gültigen Fassung.</p>
      </section>
      <section>
        <h2 className="text-xl font-bold text-brand-dark mb-4">§ 2 Vertragsschluss</h2>
        <p>Die Präsentation der Leistungen auf der Website stellt kein rechtlich bindendes Angebot dar, sondern eine Aufforderung zur Bestellung.</p>
      </section>
    </>
  );
}

function TradeDetail({ title, desc, features }: { title: string, desc: string, features: string[] }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="group"
    >
      <h4 className="text-2xl font-black text-brand-dark mb-6 tracking-tight group-hover:text-brand-primary transition-colors">{title}</h4>
      <p className="text-slate-500 font-medium leading-relaxed mb-8">{desc}</p>
      <ul className="grid grid-cols-2 gap-4">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-700">
            <div className="w-1.5 h-1.5 bg-brand-secondary rounded-full" />
            {f}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function GalleryImage({ src, className, alt = "Gallery", type = 'image' }: { src: string, className?: string, alt?: string, type?: 'image' | 'video' }) {
  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={`rounded-3xl overflow-hidden shadow-2xl relative ${className}`}
    >
      {type === 'video' ? (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
          <video src={src} className="w-full h-full object-cover" controls />
          <div className="absolute top-4 right-4 bg-brand-primary text-white p-2 rounded-lg">
            <Video size={16} />
          </div>
        </div>
      ) : (
        <img src={src} className="w-full h-full object-cover" alt={alt} />
      )}
    </motion.div>
  );
}

function ServiceCard({ title, desc, items, img, icon, className }: { title: string, desc: string, items: string[], img: string, icon: React.ReactNode, className?: string }) {
  return (
    <motion.div 
      whileHover={{ y: -12, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={`relative group rounded-[2.5rem] overflow-hidden min-h-[400px] shadow-xl hover:shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] transition-all duration-500 ${className}`}
    >
      <img src={img} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={title} />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/40 to-transparent" />
      <div className="absolute inset-0 p-10 flex flex-col justify-end text-white">
        <div className="w-12 h-12 bg-brand-primary rounded-xl flex items-center justify-center mb-6 shadow-lg">
          {icon}
        </div>
        <h4 className="text-3xl font-black tracking-tighter mb-4">{title}</h4>
        <p className="text-white/70 font-medium mb-6 line-clamp-2 group-hover:line-clamp-none transition-all">{desc}</p>
        <ul className="flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          {items.map((item, i) => (
            <li key={i} className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

function ProcessStep({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="relative z-10 group">
      <div className="w-16 h-16 bg-brand-dark border border-white/10 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-brand-primary group-hover:border-brand-primary transition-all duration-500 shadow-xl">
        <span className="text-2xl font-black text-brand-primary group-hover:text-white">{number}</span>
      </div>
      <h4 className="text-xl font-black mb-4 tracking-tight">{title}</h4>
      <p className="text-white/50 font-medium leading-relaxed">{desc}</p>
    </div>
  );
}

function ProjectCard({ img, title, category }: { img: string, title: string, category: string }) {
  return (
    <motion.div whileHover={{ y: -10 }} className="group cursor-pointer">
      <div className="rounded-[2.5rem] overflow-hidden aspect-square mb-6 shadow-xl shadow-brand-dark/5">
        <img src={img} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt={title} />
      </div>
      <p className="text-xs font-bold text-brand-primary uppercase tracking-widest mb-2">{category}</p>
      <h4 className="text-2xl font-black text-brand-dark tracking-tighter">{title}</h4>
    </motion.div>
  );
}

function ContactInfo({ icon, title, content }: { icon: React.ReactNode, title: string, content: string }) {
  return (
    <div className="flex gap-6 items-start">
      <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-brand-primary shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-xl font-medium">{content}</p>
      </div>
    </div>
  );
}

function Input({ label, placeholder, type = "text", value, onChange, className = "", required = false }: { label: string, placeholder: string, type?: string, value?: string, onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void, className?: string, required?: boolean }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</label>
      <input 
        type={type} 
        value={value}
        onChange={onChange}
        required={required}
        className={`w-full bg-slate-50 border-none rounded-2xl p-4 outline-none focus:ring-2 focus:ring-brand-primary transition-all ${className}`}
        placeholder={placeholder}
      />
    </div>
  );
}


