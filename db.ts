import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log("Connecting to database at:", path.join(__dirname, 'database.sqlite'));
const db = new Database(path.join(__dirname, 'database.sqlite'));

export function initDb() {
  console.log("Initializing database tables...");
  try {
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'admin'
  );

  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    description TEXT,
    is_anlage_a INTEGER DEFAULT 0 -- 1 if master is required
  );

  CREATE TABLE IF NOT EXISTS labor_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER,
    worker_type TEXT, -- 'Meister', 'Geselle', 'Helfer'
    hourly_rate REAL,
    FOREIGN KEY(trade_id) REFERENCES trades(id)
  );

  CREATE TABLE IF NOT EXISTS service_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trade_id INTEGER,
    name TEXT,
    unit TEXT, -- 'm²', 'm', 'Stk', 'Std'
    labor_hours REAL, -- Time needed per unit
    material_price REAL, -- Material cost per unit
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(trade_id) REFERENCES trades(id)
  );

  CREATE TABLE IF NOT EXISTS content (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, -- 'image' or 'video'
    url TEXT,
    category TEXT, -- 'hero', 'service', 'gallery'
    title TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    permissions TEXT -- JSON string
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    category TEXT DEFAULT 'Privat',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS communication_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    type TEXT, -- 'Call', 'Email', 'Meeting', 'Note'
    content TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    name TEXT NOT NULL,
    customer_name TEXT, -- Fallback/Legacy
    customer_address TEXT, -- Fallback/Legacy
    craftsman_name TEXT,
    craftsman_contact TEXT,
    status TEXT DEFAULT 'Entwurf',
    currency TEXT DEFAULT 'EUR',
    tax_rate REAL DEFAULT 19.0,
    terms_and_conditions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS quote_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    service_item_id INTEGER,
    trade_id INTEGER,
    name TEXT NOT NULL,
    description TEXT,
    unit TEXT, -- 'm²', 'm', 'Stk', 'Std', 'Pkg', etc.
    quantity REAL DEFAULT 1,
    length REAL,
    width REAL,
    height REAL,
    depth REAL,
    labor_hours_per_unit REAL DEFAULT 0, -- Legacy/Simple
    material_price_per_unit REAL DEFAULT 0,
    sketch_data TEXT, -- JSON or Base64 sketch
    special_attributes TEXT, -- JSON string for trade-specific fields
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY(service_item_id) REFERENCES service_items(id) ON DELETE SET NULL,
    FOREIGN KEY(trade_id) REFERENCES trades(id)
  );

  CREATE TABLE IF NOT EXISTS quote_item_labor (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_item_id INTEGER NOT NULL,
    worker_type TEXT, -- 'Meister', 'Geselle', 'Helfer'
    hourly_rate REAL,
    quantity INTEGER DEFAULT 1, -- Number of people
    time_value REAL, -- e.g. 5
    time_unit TEXT, -- 'Hours', 'Days', 'Weeks', 'Months'
    FOREIGN KEY(quote_item_id) REFERENCES quote_items(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS construction_diaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    date DATE NOT NULL,
    weather TEXT,
    temperature REAL,
    work_done TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS diary_presence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diary_id INTEGER NOT NULL,
    person_name TEXT,
    role TEXT,
    hours REAL,
    FOREIGN KEY(diary_id) REFERENCES construction_diaries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS diary_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    diary_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(diary_id) REFERENCES construction_diaries(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS change_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    amount REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    invoice_number TEXT UNIQUE,
    type TEXT, -- 'Abschlagsrechnung', 'Schlussrechnung', 'Rechnung'
    status TEXT DEFAULT 'draft', -- 'draft', 'sent', 'paid'
    amount REAL,
    due_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS project_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan_id TEXT, -- 'free', 'pro', 'enterprise'
    status TEXT, -- 'active', 'canceled', 'past_due'
    current_period_end DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

  // Ensure category column exists in customers table
  try {
    db.exec("ALTER TABLE customers ADD COLUMN category TEXT DEFAULT 'Privat'");
  } catch (e) {
    // Column already exists or other error
  }

  // Ensure special_attributes column exists in quote_items table
  try {
    db.exec("ALTER TABLE quote_items ADD COLUMN special_attributes TEXT");
  } catch (e) {
    // Column already exists or other error
  }

  // Ensure completion column exists in quote_items table
  try {
    db.exec("ALTER TABLE quote_items ADD COLUMN completion INTEGER DEFAULT 0");
  } catch (e) {
    // Column already exists or other error
  }

  // Ensure is_anlage_a column exists in trades table
  try {
    db.exec("ALTER TABLE trades ADD COLUMN is_anlage_a INTEGER DEFAULT 0");
  } catch (e) {
    // Column already exists or other error
  }

// Seed default data if empty
const roleCount = db.prepare('SELECT count(*) as count FROM user_roles').get() as { count: number };
if (roleCount.count === 0) {
  const defaultRoles = [
    { 
      name: 'Superadmin', 
      permissions: JSON.stringify({ 
        content: { view: true, edit: true }, 
        media: { view: true, edit: true, delete: true },
        calc: { view: true, edit: true },
        settings: { view: true, edit: true }
      }) 
    },
    { 
      name: 'Content Manager', 
      permissions: JSON.stringify({ 
        content: { view: true, edit: true }, 
        media: { view: true, edit: true, delete: true },
        calc: { view: true, edit: false },
        settings: { view: false, edit: false }
      }) 
    },
    { 
      name: 'Bauleiter', 
      permissions: JSON.stringify({ 
        content: { view: true, edit: false }, 
        media: { view: true, edit: false, delete: false },
        calc: { view: true, edit: true },
        settings: { view: false, edit: false }
      }) 
    },
    { 
      name: 'Kalkulator', 
      permissions: JSON.stringify({ 
        content: { view: true, edit: false }, 
        media: { view: true, edit: false, delete: false },
        calc: { view: true, edit: true },
        settings: { view: false, edit: false }
      }) 
    },
    { 
      name: 'Kunde', 
      permissions: JSON.stringify({ 
        content: { view: true, edit: false }, 
        media: { view: true, edit: false, delete: false },
        calc: { view: false, edit: false },
        settings: { view: false, edit: false }
      }) 
    }
  ];
  const insertRole = db.prepare('INSERT INTO user_roles (name, permissions) VALUES (?, ?)');
  defaultRoles.forEach(role => insertRole.run(role.name, role.permissions));
}

const userCount = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
if (userCount.count === 0) {
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', 'admin123', 'superadmin');
}

const contentCount = db.prepare('SELECT count(*) as count FROM content').get() as { count: number };
if (contentCount.count === 0) {
  const defaultContent = [
    ['hero_title', 'Meisterhafte Sanierung für Ihr Zuhause.'],
    ['hero_subtitle', 'Wir sind Ihr Partner für hochwertige Bausanierung, Wasserinstallation und Trockenbau in Maisach und Umgebung.'],
    ['about_title', 'Qualität, die man sieht.'],
    ['about_text', 'Seit über 10 Jahren stehen wir für erstklassige Handwerkskunst.'],
    ['contact_email', 'info@los-facility.de'],
    ['contact_phone', '+49 123 456789'],
    ['contact_address', 'Hauptstraße 1, 82216 Maisach']
  ];
  const insert = db.prepare('INSERT INTO content (key, value) VALUES (?, ?)');
  defaultContent.forEach(([key, value]) => insert.run(key, value));

  // Seed Trades if empty
  console.log("Checking if trades need seeding...");
  const tradeCount = db.prepare('SELECT count(*) as count FROM trades').get() as { count: number };
  if (tradeCount.count === 0) {
    console.log("Seeding trades and service items...");
    const trades = [
      { name: 'Maler & Lackierer', desc: 'Innen- und Außenanstriche, Tapezierarbeiten, Fassadengestaltung', anlageA: 1 },
      { name: 'Sanitär & Heizung', desc: 'Wasserinstallation, Heizungsbau, Bad-Sanierung, Rohrreinigung', anlageA: 1 },
      { name: 'Trockenbau', desc: 'Ständerwände, Deckenabhängung, Dachausbau, Brandschutz', anlageA: 0 },
      { name: 'Elektrotechnik', desc: 'Elektroinstallation, Smart Home, Beleuchtung, PV-Anlagen', anlageA: 1 },
      { name: 'Bausanierung', desc: 'Kernsanierung, Mauerwerk, Verputzarbeiten, Betonsanierung', anlageA: 0 },
      { name: 'Fliesenleger', desc: 'Boden- und Wandfliesen, Mosaik, Natursteinverlegung', anlageA: 0 },
      { name: 'Bodenleger', desc: 'Parkett, Laminat, Vinyl, Teppichboden', anlageA: 0 },
      { name: 'Dacharbeiten', desc: 'Umfassende Dachsanierung und -wartung', anlageA: 1 },
      { name: 'Maurer & Betonbauer', desc: 'Hochbau, Fundamente, Mauerwerk, Betonarbeiten', anlageA: 1 },
      { name: 'Zimmerer', desc: 'Holzbau, Dachstühle, Fachwerksanierung', anlageA: 1 },
      { name: 'Stuckateur', desc: 'Putzarbeiten, Stuckelemente, Wärmedämmung', anlageA: 1 },
      { name: 'Glaser', desc: 'Fensterbau, Verglasungen, Spiegel', anlageA: 1 },
      { name: 'Schreiner / Tischler', desc: 'Innenausbau, Möbelbau, Fenster und Türen', anlageA: 1 },
      { name: 'Metallbauer', desc: 'Stahlbau, Schlosserarbeiten, Geländer', anlageA: 1 },
      { name: 'Feinwerkmechaniker', desc: 'Präzisionsteile, Maschinenbau', anlageA: 1 },
      { name: 'Informationstechniker', desc: 'IT-Systeme, Netzwerke, Kommunikation', anlageA: 1 },
      { name: 'Kälteanlagenbauer', desc: 'Klimaanlagen, Kühlzellen', anlageA: 1 },
      { name: 'Brunnenbauer', desc: 'Brunnenbohrung, Wasserförderung', anlageA: 1 },
      { name: 'Steinmetz & Steinbildhauer', desc: 'Natursteinarbeiten, Grabmale, Restaurierung', anlageA: 1 },
      { name: 'Gärtner', desc: 'Garten- und Landschaftsbau, Pflanzenpflege', anlageA: 0 },
      { name: 'Gerüstbau', desc: 'Sicherer und effizienter Gerüstaufbau für Fassadenarbeiten', anlageA: 1 }
    ];

    const insertTrade = db.prepare('INSERT OR IGNORE INTO trades (name, description, is_anlage_a) VALUES (?, ?, ?)');
    const insertLabor = db.prepare('INSERT OR IGNORE INTO labor_rates (trade_id, worker_type, hourly_rate) VALUES (?, ?, ?)');
    const insertService = db.prepare('INSERT OR IGNORE INTO service_items (trade_id, name, unit, labor_hours, material_price, description) VALUES (?, ?, ?, ?, ?, ?)');

    trades.forEach(t => {
      console.log(`Seeding trade: ${t.name}`);
      insertTrade.run(t.name, t.desc, t.anlageA);
      const tradeRow = db.prepare('SELECT id FROM trades WHERE name = ?').get(t.name) as any;
      if (tradeRow) {
        const tradeId = tradeRow.id;
        // Default hourly rates
        insertLabor.run(tradeId, 'Meister', 65.00);
        insertLabor.run(tradeId, 'Geselle', 52.00);
        insertLabor.run(tradeId, 'Helfer', 38.00);

        // Initial service items for all trades
        if (t.name === 'Maler & Lackierer') {
          insertService.run(tradeId, 'Innenanstrich (Standard)', 'm²', 0.25, 4.50, 'Zweifacher Anstrich mit Dispersionsfarbe');
          insertService.run(tradeId, 'Fassadenanstrich', 'm²', 0.45, 8.20, 'Wetterfester Anstrich inklusive Grundierung');
          insertService.run(tradeId, 'Tapezieren (Raufaser)', 'm²', 0.60, 3.50, 'Inklusive Kleister und Zuschnitt');
          insertService.run(tradeId, 'Vliestapete anbringen', 'm²', 0.75, 12.00, 'Hochwertige Vliestapeten professionell und blasenfrei anbringen, inklusive Spezialkleber und Vorbereitung des Untergrunds.');
          insertService.run(tradeId, 'Grundierung', 'm²', 0.10, 1.50, 'Tiefengrund zur Untergrundvorbereitung');
          insertService.run(tradeId, 'Spachtelarbeiten (Q2)', 'm²', 0.35, 2.80, 'Standardverspachtelung für Tapeten');
          insertService.run(tradeId, 'Spachtelarbeiten (Q3)', 'm²', 0.55, 4.20, 'Erhöhte Anforderungen für glatte Anstriche');
          insertService.run(tradeId, 'Lackieren (Türen/Zargen)', 'Stk', 1.50, 12.00, 'Schleifen und Lackieren von Innentüren');
          insertService.run(tradeId, 'Heizkörper lackieren', 'Stk', 1.20, 8.50, 'Speziallack für Heizkörper');
          insertService.run(tradeId, 'Schimmelbeseitigung', 'm²', 1.20, 25.00, 'Fachgerechte Sanierung von Schimmelbefall inkl. Desinfektion und Spezialanstrich.');
          insertService.run(tradeId, 'Lasurarbeiten Holzfassade', 'm²', 0.70, 10.50, 'Reinigung und zweifacher Lasurauftrag auf Holzoberflächen im Außenbereich.');
        } else if (t.name === 'Sanitär & Heizung') {
          insertService.run(tradeId, 'Waschtisch Montage', 'Stk', 2.50, 150.00, 'Inklusive Armatur und Siphon');
          insertService.run(tradeId, 'WC Montage (Wand-hängend)', 'Stk', 3.00, 220.00, 'Inklusive Schallschutzset');
          insertService.run(tradeId, 'Duschkabine Montage', 'Stk', 5.00, 450.00, 'Echtglas-Kabine inklusive Abdichtung');
          insertService.run(tradeId, 'Badewanne einbauen', 'Stk', 6.00, 650.00, 'Inklusive Wannenträger und Ablaufgarnitur');
          insertService.run(tradeId, 'Rohrleitung Kupfer (15mm)', 'm', 0.80, 12.50, 'Inklusive Fittinge und Pressen');
          insertService.run(tradeId, 'Heizkörper Montage', 'Stk', 2.00, 180.00, 'Anschluss an bestehende Leitung');
          insertService.run(tradeId, 'Fußbodenheizung (Tacker-System)', 'm²', 1.50, 35.00, 'Verlegung der Systemplatten und Rohre');
          insertService.run(tradeId, 'Duscharmatur wechseln', 'Stk', 1.20, 95.00, 'Austausch von Aufputz-Mischbatterien inkl. Dichtungen.');
          insertService.run(tradeId, 'Wartung Gastherme', 'Stk', 2.00, 45.00, 'Jährliche Inspektion, Reinigung und Abgasmessung.');
          insertService.run(tradeId, 'Klimagerät Montage (Split)', 'Stk', 6.00, 850.00, 'Installation von Innen- und Außeneinheit inkl. Kältemittelleitung.');
          insertService.run(tradeId, 'Spezialreinigung', 'm²', 0.30, 2.50, 'Spezialreinigung von Sanitäranlagen oder Heizungskomponenten');
        } else if (t.name === 'Trockenbau') {
          insertService.run(tradeId, 'Ständerwand (einfach beplankt)', 'm²', 0.80, 18.50, 'Metallständerwerk mit 12.5mm Gipskarton');
          insertService.run(tradeId, 'Ständerwand (doppelt beplankt)', 'm²', 1.30, 28.00, 'Erhöhter Schallschutz durch Doppelbeplankung');
          insertService.run(tradeId, 'Decke abhängen (Gipskarton)', 'm²', 1.20, 22.00, 'Unterkonstruktion und Beplankung');
          insertService.run(tradeId, 'Dachschrägenverkleidung Gipskarton', 'm²', 1.20, 20.00, 'Professionelle Verkleidung von Dachschrägen inklusive Spachteln und Schleifen (Q2)');
          insertService.run(tradeId, 'Dämmung (Mineralwolle)', 'm²', 0.20, 6.50, 'Wärme- und Schallschutzdämmung');
          insertService.run(tradeId, 'Türöffnung in Ständerwand', 'Stk', 1.50, 45.00, 'Inklusive UA-Profile für Stabilität');
          insertService.run(tradeId, 'Vorsatzschale (direkt)', 'm²', 0.70, 15.50, 'Verkleidung von bestehendem Mauerwerk');
        } else if (t.name === 'Elektrotechnik') {
          insertService.run(tradeId, 'Steckdose setzen (UP)', 'Stk', 0.50, 8.50, 'Unterputz-Montage inklusive Einsatz');
          insertService.run(tradeId, 'Lichtschalter setzen', 'Stk', 0.60, 9.20, 'Wechsel- oder Serienschalter');
          insertService.run(tradeId, 'Leitung verlegen (NYM 3x1.5)', 'm', 0.15, 1.20, 'Unterputz oder im Rohr');
          insertService.run(tradeId, 'Sicherungskasten (bestückt)', 'Stk', 8.00, 450.00, 'Inklusive FI-Schutzschalter und LS-Schalter');
          insertService.run(tradeId, 'LED-Spot Einbau', 'Stk', 0.80, 25.00, 'Inklusive Bohrung in Trockenbau');
          insertService.run(tradeId, 'Netzwerkdose (CAT 7)', 'Stk', 1.20, 18.50, 'Inklusive Auflegen der Adern');
        } else if (t.name === 'Bausanierung') {
          insertService.run(tradeId, 'Abbruch Mauerwerk (Ziegel)', 'm³', 4.50, 0.00, 'Händischer Abbruch inklusive Schuttschuttrutsche');
          insertService.run(tradeId, 'Abbruch Fliesen', 'm²', 0.80, 0.00, 'Entfernen von Wand- oder Bodenfliesen');
          insertService.run(tradeId, 'Innenputz (Gips)', 'm²', 0.50, 5.50, 'Einlagiger Gipsputz, geglättet');
          insertService.run(tradeId, 'Zementputz (Feuchtraum)', 'm²', 0.70, 7.20, 'Wasserabweisender Putz für Bäder');
          insertService.run(tradeId, 'Estrich verlegen (Zement)', 'm²', 0.80, 12.00, 'Schwimmender Estrich auf Dämmung');
          insertService.run(tradeId, 'Mauerdurchbruch (tragend)', 'Stk', 12.00, 250.00, 'Inklusive Abstützung und Stahlträger');
        } else if (t.name === 'Fliesenleger') {
          insertService.run(tradeId, 'Wandfliesen verlegen', 'm²', 1.80, 35.00, 'Standardformat bis 30x60cm');
          insertService.run(tradeId, 'Bodenfliesen verlegen', 'm²', 2.00, 40.00, 'Standardformat inklusive Verfugung');
          insertService.run(tradeId, 'Großformatfliesen (60x120)', 'm²', 2.80, 65.00, 'Verlegung mit Nivelliersystem');
          insertService.run(tradeId, 'Abdichtung (Bad)', 'm²', 0.40, 15.00, 'Flüssigabdichtung inklusive Dichtbänder');
          insertService.run(tradeId, 'Silikonfuge ziehen', 'm', 0.15, 2.50, 'Pilzhemmendes Sanitärsilikon');
          insertService.run(tradeId, 'Mosaikfliesen verlegen', 'm²', 3.50, 55.00, 'Auf Netz geklebte Mosaike');
          insertService.run(tradeId, 'Sockelleisten setzen', 'lfm', 0.30, 8.00, 'Zuschnitt und Montage von Fliesensockeln inkl. Silikonfuge.');
          insertService.run(tradeId, 'Nivellierung Untergrund', 'm²', 0.40, 12.00, 'Ausgleich von Bodenunebenheiten mit selbstverlaufender Spachtelmasse.');
        } else if (t.name === 'Bodenleger') {
          insertService.run(tradeId, 'Laminat verlegen', 'm²', 0.60, 18.00, 'Inklusive Trittschalldämmung');
          insertService.run(tradeId, 'Parkett verlegen (schwimmend)', 'm²', 1.00, 45.00, 'Fertigparkett mit Klick-System');
          insertService.run(tradeId, 'Parkett verkleben', 'm²', 1.50, 65.00, 'Vollflächige Verklebung auf Estrich');
          insertService.run(tradeId, 'Vinylboden verlegen', 'm²', 0.70, 25.00, 'Klick-Vinyl inklusive Unterlage');
          insertService.run(tradeId, 'Sockelleisten montieren', 'm', 0.20, 4.50, 'Geschraubt oder geklebt');
          insertService.run(tradeId, 'Boden ausgleichen (Nivelliermasse)', 'm²', 0.30, 12.50, 'Bis 5mm Schichtstärke');
        } else if (t.name === 'Dacharbeiten') {
          insertService.run(tradeId, 'Dachziegel austauschen', 'Stk', 0.50, 15.00, 'Austausch beschädigter Tondachziegel');
          insertService.run(tradeId, 'Dachrinne reinigen', 'm', 0.15, 0.00, 'Säuberung von Laub und Schmutz');
          insertService.run(tradeId, 'Flachdachabdichtung (Bitumen)', 'm²', 1.20, 28.00, 'Zweilagige Abdichtung mit Bitumenschweißbahnen');
          insertService.run(tradeId, 'Dachinspektion', 'Std', 1.00, 0.00, 'Allgemeine Prüfung auf Dichtigkeit und Schäden');
          insertService.run(tradeId, 'Dachfenster Einbau', 'Stk', 5.00, 650.00, 'Montage von Schwingfenstern inkl. Eindeckrahmen und Dämmset.');
          insertService.run(tradeId, 'Firstziegel trocken verlegen', 'lfm', 0.80, 28.00, 'Montage von Firstrollen und Firstziegeln mit Klammern.');
        }
      }
    });
  }
}

    console.log("Ensuring specific items exist...");
    // Ensure specific items exist (for updates to existing databases)
const dachTrade = db.prepare('SELECT id FROM trades WHERE name = ?').get('Dacharbeiten') as { id: number } | undefined;
if (!dachTrade) {
  const result = db.prepare('INSERT INTO trades (name, description) VALUES (?, ?)').run('Dacharbeiten', 'Umfassende Dachsanierung und -wartung');
  const tradeId = result.lastInsertRowid;
  const insertLabor = db.prepare('INSERT INTO labor_rates (trade_id, worker_type, hourly_rate) VALUES (?, ?, ?)');
  insertLabor.run(tradeId, 'Meister', 65.00);
  insertLabor.run(tradeId, 'Geselle', 52.00);
  insertLabor.run(tradeId, 'Helfer', 38.00);
}

const trockenbauTrade = db.prepare('SELECT id FROM trades WHERE name = ?').get('Trockenbau') as { id: number } | undefined;
if (trockenbauTrade) {
  const itemExists = db.prepare('SELECT id FROM service_items WHERE trade_id = ? AND name = ?').get(trockenbauTrade.id, 'Dachschrägenverkleidung Gipskarton');
  if (!itemExists) {
    db.prepare('INSERT INTO service_items (trade_id, name, unit, labor_hours, material_price, description) VALUES (?, ?, ?, ?, ?, ?)')
      .run(
        trockenbauTrade.id, 
        'Dachschrägenverkleidung Gipskarton', 
        'm²', 
        1.2, 
        20.0, 
        'Professionelle Verkleidung von Dachschrägen inklusive Spachteln und Schleifen (Q2)'
      );
  }
}

const malerTrade = db.prepare('SELECT id FROM trades WHERE name = ?').get('Maler & Lackierer') as { id: number } | undefined;
if (malerTrade) {
  db.prepare('UPDATE service_items SET description = ? WHERE trade_id = ? AND name = ?')
    .run(
      'Hochwertige Vliestapeten professionell und blasenfrei anbringen, inklusive Spezialkleber und Vorbereitung des Untergrunds.',
      malerTrade.id,
      'Vliestapete anbringen'
    );
}

const dachTradeFinal = db.prepare('SELECT id FROM trades WHERE name = ?').get('Dacharbeiten') as { id: number } | undefined;
if (dachTradeFinal) {
  const insertService = db.prepare('INSERT OR IGNORE INTO service_items (trade_id, name, unit, labor_hours, material_price, description) VALUES (?, ?, ?, ?, ?, ?)');
  insertService.run(dachTradeFinal.id, 'Dachziegel austauschen', 'Stk', 0.50, 15.00, 'Austausch beschädigter Tondachziegel');
  insertService.run(dachTradeFinal.id, 'Dachrinne reinigen', 'm', 0.15, 0.00, 'Säuberung von Laub und Schmutz');
  insertService.run(dachTradeFinal.id, 'Flachdachabdichtung (Bitumen)', 'm²', 1.20, 28.00, 'Zweilagige Abdichtung mit Bitumenschweißbahnen');
  insertService.run(dachTradeFinal.id, 'Dachinspektion', 'Std', 1.00, 0.00, 'Allgemeine Prüfung auf Dichtigkeit und Schäden');
}

// Cleanup unwanted trades and add Gerüstbau for existing databases
const tradesToDelete = [
  'Goldschmied', 'Uhrmacher', 'Orthopädietechniker', 'Zahntechniker', 'Augenoptiker', 
  'Hörgeräteakustiker', 'Friseur', 'Gebäudereiniger', 'Schornsteinfeger', 'Fleischer', 
  'Bäcker', 'Konditor', 'Brauer & Mälzer', 'Weinküfer', 'Müller', 'Sattler', 
  'Raumausstatter', 'Buchbinder', 'Drucker', 'Fotograf', 'Kraftfahrzeugmechatroniker', 
  'Zweiradmechaniker', 'Landmaschinenmechaniker', 'Karosserie- & Fahrzeugbauer', 
  'Boots- & Schiffbauer', 'Segelmacher', 'Forstwirt', 'Fischwirt'
];

tradesToDelete.forEach(name => {
  const trade = db.prepare('SELECT id FROM trades WHERE name = ?').get(name) as { id: number } | undefined;
  if (trade) {
    // Delete associated items first to avoid foreign key constraint errors
    db.prepare('DELETE FROM service_items WHERE trade_id = ?').run(trade.id);
    db.prepare('DELETE FROM labor_rates WHERE trade_id = ?').run(trade.id);
    db.prepare('DELETE FROM quote_items WHERE trade_id = ?').run(trade.id);
    db.prepare('DELETE FROM trades WHERE id = ?').run(trade.id);
  }
});

const geruestbauExists = db.prepare('SELECT id FROM trades WHERE name = ?').get('Gerüstbau');
if (!geruestbauExists) {
  const result = db.prepare('INSERT INTO trades (name, description, is_anlage_a) VALUES (?, ?, ?)')
    .run('Gerüstbau', 'Sicherer und effizienter Gerüstaufbau für Fassadenarbeiten', 1);
  const tradeId = result.lastInsertRowid;
  const insertLabor = db.prepare('INSERT INTO labor_rates (trade_id, worker_type, hourly_rate) VALUES (?, ?, ?)');
  insertLabor.run(tradeId, 'Meister', 65.00);
  insertLabor.run(tradeId, 'Geselle', 52.00);
  insertLabor.run(tradeId, 'Helfer', 38.00);
}

console.log("Database initialization complete.");
  } catch (err) {
    console.error("Database initialization failed:", err);
    throw err;
  }
}

export default db;
