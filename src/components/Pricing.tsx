import React from 'react';
import { motion } from 'motion/react';
import { Check, Zap, Shield, Star, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const plans = [
    {
      id: 'free',
      name: 'Basis',
      price: '0',
      description: 'Ideal für private Bauherren und kleine Projekte.',
      features: [
        '1 Projekt inklusive',
        'Standard Gewerke-Masken',
        'Manueller Material-Import',
        'PDF-Angebotserstellung',
        'Einfache Aufmaß-Funktion'
      ],
      cta: 'Kostenlos starten',
      popular: false,
      color: 'slate'
    },
    {
      id: 'pro',
      name: 'Profi',
      price: '49',
      description: 'Für Handwerksbetriebe, die effizient kalkulieren wollen.',
      features: [
        'Unbegrenzte Projekte',
        'KI-Planerkennung (Beta)',
        'Copy & Price Material-Import',
        'GAEB-Import & Export',
        'E-Rechnung (ZUGFeRD/XRechnung)',
        'Bautagebuch & Nachtragsmanagement'
      ],
      cta: 'Jetzt upgraden',
      popular: true,
      color: 'brand'
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '99',
      description: 'Für größere Betriebe mit mehreren Teams.',
      features: [
        'Alles aus Profi',
        'Mehrbenutzer-Verwaltung',
        'Individuelle Leistungsstämme',
        'API-Zugriff',
        'Priorisierter Support',
        'Eigene Subdomain'
      ],
      cta: 'Kontakt aufnehmen',
      popular: false,
      color: 'dark'
    }
  ];

  const handleAction = async (planId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (planId === 'free') {
      navigate('/dashboard');
      return;
    }

    if (planId === 'enterprise') {
      window.location.href = 'mailto:info@los-facility.de?subject=Enterprise Plan Anfrage';
      return;
    }

    // Pro Plan Upgrade
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, planId: 'pro' })
      });
      const data = await response.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.message || 'Fehler beim Starten des Upgrades.');
      }
    } catch (err) {
      console.error('Upgrade Error:', err);
      alert('Ein Fehler ist aufgetreten.');
    }
  };

  return (
    <div className="min-h-screen bg-white pt-32 pb-20 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-black text-brand-dark tracking-tighter mb-6"
          >
            Einfache Tarife für <span className="text-brand-primary italic">echte Macher.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-500 max-w-2xl mx-auto font-medium"
          >
            Wählen Sie den passenden Plan für Ihr Unternehmen. Keine versteckten Kosten, jederzeit kündbar.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * (index + 1) }}
              className={`relative p-8 rounded-[2.5rem] border-2 transition-all duration-500 hover:scale-[1.02] ${
                plan.popular 
                  ? 'border-brand-primary bg-white shadow-2xl shadow-brand-primary/10' 
                  : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-brand-primary text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Am beliebtesten
                </div>
              )}

              <div className="mb-8">
                <h3 className="text-2xl font-black text-brand-dark tracking-tighter mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">{plan.description}</p>
              </div>

              <div className="mb-8 flex items-baseline gap-1">
                <span className="text-5xl font-black text-brand-dark tracking-tighter">€{plan.price}</span>
                <span className="text-slate-400 font-bold text-sm uppercase tracking-widest">/ Monat</span>
              </div>

              <ul className="space-y-4 mb-10">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className={`mt-1 p-0.5 rounded-full ${plan.popular ? 'bg-brand-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                      <Check size={12} strokeWidth={4} />
                    </div>
                    <span className="text-sm font-bold text-slate-600 tracking-tight">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleAction(plan.id)}
                className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  plan.popular
                    ? 'bg-brand-primary text-white hover:bg-brand-dark shadow-lg shadow-brand-primary/20'
                    : 'bg-brand-dark text-white hover:bg-brand-primary'
                }`}
              >
                {plan.cta}
                <ArrowRight size={16} />
              </button>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 p-12 rounded-[3rem] bg-brand-dark text-white overflow-hidden relative">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl text-center md:text-left">
              <h3 className="text-3xl md:text-4xl font-black tracking-tighter mb-4">Noch unsicher?</h3>
              <p className="text-slate-400 font-medium text-lg">Testen Sie unsere Plattform völlig kostenlos für Ihr erstes Projekt. Keine Kreditkarte erforderlich.</p>
            </div>
            <button 
              onClick={() => navigate('/register')}
              className="bg-white text-brand-dark px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all whitespace-nowrap"
            >
              Jetzt kostenlos testen
            </button>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-brand-primary/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
      </div>
    </div>
  );
};

export default Pricing;
