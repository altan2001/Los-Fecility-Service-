import { TradeAttributeDefinition } from '../App';

export const PILOT_TRADE_ATTRIBUTES: Record<string, TradeAttributeDefinition[]> = {
  'Maler': [
    {
      id: 'untergrund',
      label: 'Untergrundbeschaffenheit',
      type: 'select',
      options: ['Putz (Q2)', 'Putz (Q3)', 'Beton', 'Gipskarton (Q2)', 'Gipskarton (Q3)', 'Altbeschichtung']
    },
    {
      id: 'glanzgrad',
      label: 'Glanzgrad',
      type: 'select',
      options: ['Stumpfmatt', 'Matt', 'Seidenglänzend', 'Hochglänzend']
    },
    {
      id: 'farbwunsch',
      label: 'Farbwunsch (RAL/NCS)',
      type: 'text'
    },
    {
      id: 'geruest',
      label: 'Gerüst erforderlich',
      type: 'boolean'
    }
  ],
  'Fliesenleger': [
    {
      id: 'fliesenformat',
      label: 'Fliesenformat',
      type: 'select',
      options: ['Mosaik (<10cm)', 'Standard (30-60cm)', 'Großformat (>60cm)', 'XXL (>120cm)']
    },
    {
      id: 'verlegemuster',
      label: 'Verlegemuster',
      type: 'select',
      options: ['Kreuzfuge', 'Halbverband', 'Wilder Verband', 'Fischgrät', 'Modular']
    },
    {
      id: 'untergrund',
      label: 'Untergrund / Abdichtung',
      type: 'select',
      options: ['Estrich', 'Wandputz (Nassbereich)', 'Wandputz (Trockenbereich)', 'Altfliesen', 'Trockenestrich']
    },
    {
      id: 'fugenbreite',
      label: 'Fugenbreite',
      type: 'number',
      unit: 'mm'
    }
  ],
  'Elektriker': [
    {
      id: 'montageart',
      label: 'Montageart',
      type: 'select',
      options: ['Unterputz', 'Aufputz', 'Hohlwand', 'Beton-Einbau']
    },
    {
      id: 'schlitzanteil',
      label: 'Schlitzanteil (Mauerwerk)',
      type: 'number',
      unit: '%'
    },
    {
      id: 'materialbeistellung',
      label: 'Materialbeistellung durch Kunden',
      type: 'boolean'
    },
    {
      id: 'brandschutz',
      label: 'Brandschutzanforderungen',
      type: 'boolean'
    }
  ],
  'Schreiner': [
    {
      id: 'holzart',
      label: 'Holzart / Dekor',
      type: 'select',
      options: ['Fichte/Tanne', 'Eiche', 'Buche', 'Ahorn', 'Nussbaum', 'MDF Grundiert', 'Dekorspanplatte']
    },
    {
      id: 'oberflaeche',
      label: 'Oberflächenfinish',
      type: 'select',
      options: ['Roh', 'Geölt/Gewachst', 'Klarlackiert', 'Farblackiert (RAL)', 'Gebeizt']
    },
    {
      id: 'beschlag',
      label: 'Beschlagsqualität',
      type: 'select',
      options: ['Standard', 'Premium (Soft-Close)', 'High-End (Elektrisch)']
    }
  ],
  'SHK': [
    {
      id: 'rohrmaterial',
      label: 'Rohrleitungssystem',
      type: 'select',
      options: ['Kupfer (Press)', 'Kupfer (Löt)', 'Mehrschichtverbundrohr', 'Edelstahl', 'C-Stahl']
    },
    {
      id: 'daemmstandard',
      label: 'Dämmstandard (GEG)',
      type: 'select',
      options: ['GEG 50%', 'GEG 100%', 'Trinkwasser kalt (DIN)', 'Keine Dämmung']
    },
    {
      id: 'montagehoehe',
      label: 'Montagehöhe (OKFF)',
      type: 'number',
      unit: 'cm'
    },
    {
      id: 'vorwand',
      label: 'Vorwandsystem erforderlich',
      type: 'boolean'
    }
  ],
  'Garten- & Landschaftsbau': [
    {
      id: 'bodenklasse',
      label: 'Bodenklasse (DIN 18300)',
      type: 'select',
      options: ['Klasse 1-2 (Oberboden)', 'Klasse 3-4 (Leicht/Mittelschwer)', 'Klasse 5 (Schwer)', 'Klasse 6-7 (Fels)']
    },
    {
      id: 'pflasterart',
      label: 'Pflaster- / Plattenart',
      type: 'select',
      options: ['Betonstein', 'Naturstein (Granit)', 'Naturstein (Basalt)', 'Keramikplatten', 'Klinker']
    },
    {
      id: 'verlegeart',
      label: 'Verlegeart',
      type: 'select',
      options: ['Ungebundene Bauweise (Splitt)', 'Gebundene Bauweise (Mörtel)', 'Stelzlager']
    },
    {
      id: 'entwaesserung',
      label: 'Entwässerung / Gefälle erforderlich',
      type: 'boolean'
    },
    {
      id: 'pflanzqualitaet',
      label: 'Pflanzqualität',
      type: 'select',
      options: ['Standard (Baumarkt)', 'Baumschule (Güteklasse A)', 'Solitärpflanzen']
    }
  ]
};
