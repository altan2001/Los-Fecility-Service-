import { GoogleGenAI } from "@google/genai";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import * as cheerio from "cheerio";
import multer from "multer";
import fs from "fs";
import { Parser } from "xml2js";
import csv from "csv-parser";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { firestore as db, initDb } from "./db.ts";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  query, 
  where, 
  orderBy, 
  limit, 
  writeBatch,
  collectionGroup
} from "firebase/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

function escapeXml(unsafe: string) {
  if (typeof unsafe !== 'string') return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Firebase is already initialized in db.ts
const firestore = db;

async function startServer() {
  try {
    console.log("Starting server process...");
    
    // Initialize database first
    console.log("Calling initDb()...");
    await initDb();
    console.log("initDb() finished.");

    const app = express();
    const PORT = 3000;

    console.log("Initializing middleware...");
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // --- Maintenance Mode Middleware ---
    let maintenanceModeCache: { value: boolean, timestamp: number } | null = null;
    const CACHE_DURATION = 5000; // 5 seconds

    app.use(async (req, res, next) => {
      // Skip for common static extensions to avoid unnecessary DB calls
      const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.map'];
      if (staticExtensions.some(ext => req.path.toLowerCase().endsWith(ext)) || req.path.startsWith('/uploads/')) {
        return next();
      }

      // Always allow these routes to ensure admin can always log in and turn it off
      const allowedPaths = ['/api/settings', '/api/auth', '/admin', '/api/user/profile', '/api/health'];
      if (allowedPaths.some(p => req.path.startsWith(p))) {
        return next();
      }

      try {
        const now = Date.now();
        if (!maintenanceModeCache || (now - maintenanceModeCache.timestamp) > CACHE_DURATION) {
          const maintenanceDoc = await getDoc(doc(firestore, "settings", "maintenance_mode"));
          maintenanceModeCache = {
            value: maintenanceDoc.exists() && maintenanceDoc.data().value === 'true',
            timestamp: now
          };
        }

        if (maintenanceModeCache.value) {
          if (req.path.startsWith('/api/')) {
            return res.status(503).json({ 
              success: false, 
              message: "Die Plattform befindet sich derzeit in Wartungsarbeiten." 
            });
          }
          return res.sendFile(path.join(process.cwd(), "maintenance.html"));
        }
      } catch (err) {
        console.error("Error checking maintenance mode:", err);
      }
      
      next();
    });

    // Stripe Initialization
    const stripe = process.env.STRIPE_SECRET_KEY 
      ? new Stripe(process.env.STRIPE_SECRET_KEY)
      : null;

    // --- API Routes ---

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", company: "Los Facility Service" });
  });

  // Contact Form
  app.post("/api/contact", async (req, res) => {
    const { firstName, lastName, email, message } = req.body;
    console.log(`Contact request from ${firstName} ${lastName} (${email}): ${message}`);
    
    // In a real scenario, use nodemailer here. 
    // For now, we'll simulate success.
    res.json({ success: true, message: "Nachricht erfolgreich gesendet!" });
  });

  // Newsletter
  app.post("/api/newsletter", (req, res) => {
    const { email } = req.body;
    console.log(`Newsletter signup: ${email}`);
    res.json({ success: true, message: "Erfolgreich zum Newsletter angemeldet!" });
  });

  // Auth
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const q = query(collection(firestore, "users"), where("username", "==", username), where("password", "==", password), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const user = snapshot.docs[0].data();
        res.json({ success: true, token: "fake-jwt-token-for-demo", user: { username: user.username, role: user.role } });
      } else {
        res.status(401).json({ success: false, message: "Ungültige Anmeldedaten" });
      }
    } catch (err) {
      res.status(500).json({ success: false, message: "Fehler bei der Anmeldung" });
    }
  });

  // --- Customer Management ---
  app.get("/api/customers", async (req, res) => {
    try {
      const snapshot = await getDocs(query(collection(firestore, "customers"), orderBy("name", "asc")));
      const customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(customers);
    } catch (err) {
      res.status(500).json({ success: false, message: "Kunden konnten nicht geladen werden." });
    }
  });

  app.post("/api/customers", async (req, res) => {
    const { name, company, email, phone, address, notes, category } = req.body;
    try {
      const docRef = doc(collection(firestore, "customers"));
      await setDoc(docRef, { name, company, email, phone, address, notes, category: category || 'Privat', created_at: new Date().toISOString() });
      res.json({ success: true, id: docRef.id });
    } catch (err) {
      res.status(500).json({ success: false, message: "Kunde konnte nicht erstellt werden." });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    const { id } = req.params;
    const { name, company, email, phone, address, notes, category } = req.body;
    try {
      await updateDoc(doc(firestore, "customers", id), { name, company, email, phone, address, notes, category });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Kunde konnte nicht aktualisiert werden." });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await deleteDoc(doc(firestore, "customers", id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Kunde konnte nicht gelöscht werden." });
    }
  });

  app.get("/api/customers/:id/logs", async (req, res) => {
    const { id } = req.params;
    try {
      const logsSnapshot = await getDocs(query(collection(firestore, `customers/${id}/communication_logs`), orderBy('date', 'desc')));
      const logs = logsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(logs);
    } catch (err) {
      res.status(500).json({ success: false, message: "Logs konnten nicht geladen werden." });
    }
  });

  app.post("/api/customers/:id/logs", async (req, res) => {
    const { id } = req.params;
    const { type, content } = req.body;
    try {
      const result = await addDoc(collection(firestore, `customers/${id}/communication_logs`), {
        type,
        content,
        date: new Date().toISOString()
      });
      res.json({ success: true, id: result.id });
    } catch (err) {
      res.status(500).json({ success: false, message: "Log konnte nicht erstellt werden." });
    }
  });

  // Content Management
  app.get("/api/content", async (req, res) => {
    const { keys } = req.query;
    try {
      let snapshot;
      if (keys) {
        const keyList = (keys as string).split(',');
        snapshot = await getDocs(query(collection(firestore, "content"), where("__name__", "in", keyList)));
      } else {
        snapshot = await getDocs(collection(firestore, "content"));
      }
      const contentMap = snapshot.docs.reduce((acc: any, doc) => {
        acc[doc.id] = doc.data().value;
        return acc;
      }, {});
      res.json(contentMap);
    } catch (err) {
      res.status(500).json({ success: false, message: "Inhalt konnte nicht geladen werden." });
    }
  });

  app.get("/api/content/:key", async (req, res) => {
    const { key } = req.params;
    try {
      const docSnap = await getDoc(doc(firestore, "content", key));
      if (docSnap.exists()) {
        res.json({ key, value: docSnap.data().value });
      } else {
        res.status(404).json({ error: "Inhalt nicht gefunden" });
      }
    } catch (err) {
      res.status(500).json({ success: false, message: "Fehler beim Abrufen des Inhalts." });
    }
  });

  app.post("/api/content", async (req, res) => {
    const { content } = req.body; // { key: value }
    try {
      const promises = Object.entries(content).map(([key, value]) => 
        setDoc(doc(firestore, "content", key), { value })
      );
      await Promise.all(promises);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Inhalt konnte nicht gespeichert werden." });
    }
  });

  // Media Management
  app.get("/api/media", async (req, res) => {
    try {
      const snapshot = await getDocs(query(collection(firestore, "media"), orderBy("sort_order", "asc")));
      const media = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(media);
    } catch (err) {
      res.status(500).json({ success: false, message: "Medien konnten nicht geladen werden." });
    }
  });

  app.post("/api/media", async (req, res) => {
    const { type, url, category, title, description, sort_order } = req.body;
    try {
      const docRef = doc(collection(firestore, "media"));
      await setDoc(docRef, { type, url, category, title, description, sort_order: sort_order || 0 });
      res.json({ success: true, id: docRef.id });
    } catch (err) {
      res.status(500).json({ success: false, message: "Medium konnte nicht erstellt werden." });
    }
  });

  app.put("/api/media/:id", async (req, res) => {
    const { id } = req.params;
    const { type, url, category, title, description, sort_order } = req.body;
    try {
      await updateDoc(doc(firestore, "media", id), { type, url, category, title, description, sort_order });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Medium konnte nicht aktualisiert werden." });
    }
  });

  app.delete("/api/media/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await deleteDoc(doc(firestore, "media", id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Medium konnte nicht gelöscht werden." });
    }
  });

  // --- Calculation & Trade Management ---

  app.get("/api/trades", async (req, res) => {
    try {
      const snapshot = await getDocs(query(collection(firestore, "trades"), orderBy("name", "asc")));
      const trades = await Promise.all(snapshot.docs.map(async (tradeDoc) => {
        const serviceItemsSnapshot = await getDocs(collection(firestore, `trades/${tradeDoc.id}/service_items`));
        return { 
          id: tradeDoc.id, 
          ...tradeDoc.data(), 
          service_count: serviceItemsSnapshot.size 
        };
      }));
      res.json(trades);
    } catch (err) {
      res.status(500).json({ success: false, message: "Gewerke konnten nicht geladen werden." });
    }
  });

  app.post("/api/trades", async (req, res) => {
    const { name, description, is_anlage_a, attribute_definitions } = req.body;
    try {
      const docRef = doc(collection(firestore, "trades"));
      await setDoc(docRef, { 
        name, 
        description, 
        is_anlage_a: is_anlage_a || false,
        attribute_definitions: attribute_definitions || []
      });
      const tradeId = docRef.id;
      
      // Initialize default labor rates for the new trade
      const laborRates = [
        { worker_type: 'Meister', hourly_rate: 65.00 },
        { worker_type: 'Geselle', hourly_rate: 52.00 },
        { worker_type: 'Helfer', hourly_rate: 38.00 }
      ];
      
      const promises = laborRates.map(rate => 
        setDoc(doc(collection(firestore, `trades/${tradeId}/labor_rates`)), rate)
      );
      await Promise.all(promises);

      res.json({ success: true, id: tradeId });
    } catch (err) {
      res.status(500).json({ success: false, message: "Gewerk konnte nicht erstellt werden." });
    }
  });

  app.put("/api/trades/:id", async (req, res) => {
    const { id } = req.params;
    const { name, description, is_anlage_a, attribute_definitions } = req.body;
    try {
      await updateDoc(doc(firestore, "trades", id), { 
        name, 
        description, 
        is_anlage_a: is_anlage_a || false,
        attribute_definitions: attribute_definitions || []
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Gewerk konnte nicht aktualisiert werden." });
    }
  });

  app.delete("/api/trades/:id", async (req, res) => {
    const { id } = req.params;
    try {
      // Note: In a real scenario, we should also delete subcollections.
      // Firestore doesn't delete subcollections automatically when a document is deleted.
      await deleteDoc(doc(firestore, "trades", id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Gewerk konnte nicht gelöscht werden." });
    }
  });

  app.get("/api/trades/:id/labor-rates", async (req, res) => {
    const { id } = req.params;
    try {
      const snapshot = await getDocs(collection(firestore, `trades/${id}/labor_rates`));
      let rates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (rates.length === 0) {
        // Initialize default labor rates if missing
        const defaultRates = [
          { worker_type: 'Meister', hourly_rate: 65.00 },
          { worker_type: 'Geselle', hourly_rate: 52.00 },
          { worker_type: 'Helfer', hourly_rate: 38.00 }
        ];
        const promises = defaultRates.map(rate => 
          addDoc(collection(firestore, `trades/${id}/labor_rates`), rate)
        );
        const newDocs = await Promise.all(promises);
        rates = defaultRates.map((rate, index) => ({ id: newDocs[index].id, ...rate }));
      }
      
      res.json(rates);
    } catch (err) {
      res.status(500).json({ success: false, message: "Stundensätze konnten nicht geladen werden." });
    }
  });

  app.get("/api/trades/:id/service-items", async (req, res) => {
    const { id } = req.params;
    try {
      const snapshot = await getDocs(query(collection(firestore, `trades/${id}/service_items`), orderBy("sort_order", "asc")));
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(items);
    } catch (err) {
      res.status(500).json({ success: false, message: "Leistungen konnten nicht geladen werden." });
    }
  });

  app.post("/api/service-items", async (req, res) => {
    const { trade_id, name, unit, labor_hours, material_price, description, sort_order, group } = req.body;
    try {
      const docRef = doc(collection(firestore, `trades/${trade_id}/service_items`));
      await setDoc(docRef, { 
        name, 
        unit, 
        labor_hours, 
        material_price, 
        description, 
        sort_order: sort_order || 0,
        group: group || '' 
      });
      res.json({ success: true, id: docRef.id });
    } catch (err) {
      res.status(500).json({ success: false, message: "Leistung konnte nicht erstellt werden." });
    }
  });

  app.post("/api/service-items/bulk", async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "Items must be an array" });
    }

    try {
      const promises = items.map(item => {
        const docRef = doc(collection(firestore, `trades/${item.trade_id}/service_items`));
        return setDoc(docRef, { 
          name: item.name, 
          unit: item.unit, 
          labor_hours: item.labor_hours || 0, 
          material_price: item.material_price || 0, 
          description: item.description || '', 
          sort_order: item.sort_order || 0,
          group: item.group || ''
        });
      });
      await Promise.all(promises);
      res.json({ success: true, count: items.length });
    } catch (err) {
      console.error("Bulk import error:", err);
      res.status(500).json({ success: false, message: "Bulk import failed" });
    }
  });

  app.put("/api/service-items/:id", async (req, res) => {
    const { id } = req.params;
    const { trade_id, name, unit, labor_hours, material_price, description, sort_order, group } = req.body;
    try {
      await updateDoc(doc(firestore, `trades/${trade_id}/service_items`, id), { 
        name, 
        unit, 
        labor_hours, 
        material_price, 
        description, 
        sort_order,
        group: group || ''
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Leistung konnte nicht aktualisiert werden." });
    }
  });

  app.delete("/api/service-items/:id", async (req, res) => {
    const { id } = req.params;
    const { trade_id } = req.query;
    try {
      await deleteDoc(doc(firestore, `trades/${trade_id}/service_items`, id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Leistung konnte nicht gelöscht werden." });
    }
  });

  app.get("/api/labor-rates/all", async (req, res) => {
    try {
      const tradesSnapshot = await getDocs(collection(firestore, "trades"));
      const allRates: any[] = [];
      
      for (const tradeDoc of tradesSnapshot.docs) {
        const ratesSnapshot = await getDocs(collection(firestore, `trades/${tradeDoc.id}/labor_rates`));
        let rates = ratesSnapshot.docs.map(rateDoc => ({
          id: rateDoc.id,
          trade_id: tradeDoc.id,
          trade_name: tradeDoc.data().name,
          ...rateDoc.data()
        }));

        if (rates.length === 0) {
          const defaultRates = [
            { worker_type: 'Meister', hourly_rate: 65.00 },
            { worker_type: 'Geselle', hourly_rate: 52.00 },
            { worker_type: 'Helfer', hourly_rate: 38.00 }
          ];
          const promises = defaultRates.map(rate => 
            addDoc(collection(firestore, `trades/${tradeDoc.id}/labor_rates`), rate)
          );
          const newDocs = await Promise.all(promises);
          rates = defaultRates.map((rate, index) => ({ 
            id: newDocs[index].id, 
            trade_id: tradeDoc.id,
            trade_name: tradeDoc.data().name,
            ...rate 
          }));
        }
        
        allRates.push(...rates);
      }
      res.json(allRates);
    } catch (err) {
      console.error("Error fetching labor rates:", err);
      res.json([]); // Return empty array to prevent frontend crash
    }
  });

  app.put("/api/labor-rates", async (req, res) => {
    const { rates } = req.body; // Array of { id, trade_id, hourly_rate }
    try {
      const promises = rates.map((rate: any) => 
        updateDoc(doc(firestore, `trades/${rate.trade_id}/labor_rates`, rate.id), { hourly_rate: rate.hourly_rate })
      );
      await Promise.all(promises);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Stundensätze konnten nicht aktualisiert werden." });
    }
  });

  app.post("/api/trades/:id/import-csv", upload.single('file'), async (req, res) => {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Keine Datei hochgeladen" });
    }

    try {
      const tradeDoc = await getDoc(doc(firestore, "trades", id));
      if (!tradeDoc.exists()) {
        return res.status(404).json({ success: false, message: "Gewerk nicht gefunden" });
      }
    } catch (err) {
      return res.status(500).json({ success: false, message: "Fehler beim Prüfen des Gewerks" });
    }

    const items: any[] = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => {
        // Only add rows that have at least a name or leistung field
        const name = data.name || data.Name || data.leistung || data.Leistung;
        if (name && String(name).trim().length > 0) {
          items.push(data);
        }
      })
      .on('end', async () => {
        try {
          const parseNum = (val: any) => {
            if (val === undefined || val === null || String(val).trim() === '') return 0;
            const str = String(val).replace(',', '.').replace(/[^\d.-]/g, '').trim();
            const num = parseFloat(str);
            return isNaN(num) ? 0 : num;
          };

          const batch = writeBatch(firestore);
          let count = 0;
          
          for (const item of items) {
            if (count >= 500) break; // Firestore batch limit

            const docRef = doc(collection(firestore, `trades/${id}/service_items`));
            batch.set(docRef, {
              name: item.name || item.Name || item.leistung || item.Leistung || 'Unbenannt',
              unit: item.unit || item.Unit || item.einheit || item.Einheit || 'm²',
              labor_hours: parseNum(item.labor_hours || item.LaborHours || item.stunden || item.Stunden),
              material_price: parseNum(item.material_price || item.MaterialPrice || item.materialpreis || item.Materialpreis),
              description: item.description || item.Description || item.beschreibung || item.Beschreibung || '',
              group: item.group || item.Group || item.leistungsgruppe || item.Leistungsgruppe || '',
              sort_order: count,
              created_at: new Date().toISOString()
            });
            count++;
          }
          
          if (count > 0) {
            await batch.commit();
          }
          
          // Clean up the uploaded file
          if (req.file) fs.unlinkSync(req.file.path);
          res.json({ success: true, count });
        } catch (err) {
          console.error("CSV Import Error:", err);
          if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
          res.status(500).json({ success: false, message: "Fehler beim Importieren der Daten" });
        }
      })
      .on('error', (err) => {
        console.error("CSV Parsing Error:", err);
        res.status(500).json({ success: false, message: "Fehler beim Parsen der CSV-Datei" });
      });
  });

  app.post("/api/scrape-price", async (req, res) => {
    const { url } = req.body;
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });
      const $ = cheerio.load(response.data);
      
      let price: number | null = null;
      let title: string | null = null;
      let unit: string = 'Stück';

      // 1. Try JSON-LD
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).html() || '{}');
          const findPrice = (obj: any): any => {
            if (obj.price) return obj.price;
            if (obj.offers) {
              if (Array.isArray(obj.offers)) return obj.offers[0].price;
              return obj.offers.price;
            }
            return null;
          };
          const p = findPrice(data);
          if (p) price = typeof p === 'string' ? parseFloat(p.replace(',', '.')) : p;
          if (data.name) title = data.name;
        } catch (e) {}
      });

      // 2. Meta tags
      if (!price) {
        const metaPrice = $('meta[property="product:price:amount"]').attr('content') || 
                          $('meta[itemprop="price"]').attr('content') ||
                          $('meta[name="price"]').attr('content');
        if (metaPrice) price = parseFloat(metaPrice.replace(',', '.'));
      }

      if (!title) {
        title = $('meta[property="og:title"]').attr('content') || 
                $('meta[name="twitter:title"]').attr('content') || 
                $('title').text();
      }

      // 3. Fallback Regex
      if (!price) {
        const html = response.data;
        const priceMatch = html.match(/(\d+[,.]\d{2})\s*€/) || html.match(/price["']?\s*:\s*["']?(\d+[,.]\d{2})/);
        if (priceMatch) price = parseFloat(priceMatch[1].replace(',', '.'));
      }

      if (price) {
        res.json({ 
          success: true, 
          price,
          title: title ? title.trim().substring(0, 100) : "Produkt",
          unit
        });
      } else {
        res.json({ success: false, message: "Preis konnte nicht automatisch extrahiert werden." });
      }
    } catch (err) {
      console.error("Scraping error:", err);
      res.status(500).json({ success: false, message: "Fehler beim Abrufen der Webseite" });
    }
  });

  // --- Construction Diary ---
  app.get("/api/projects/:id/diaries", async (req, res) => {
    const { id } = req.params;
    try {
      const snapshot = await getDocs(query(collection(firestore, `projects/${id}/diaries`), orderBy("date", "desc")));
      const diaries = await Promise.all(snapshot.docs.map(async (diaryDoc) => {
        const diaryData = diaryDoc.data();
        const diaryId = diaryDoc.id;
        
        // Fetch subcollections
        const presenceSnapshot = await getDocs(collection(firestore, `projects/${id}/diaries/${diaryId}/presence`));
        const presence = presenceSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const attachmentsSnapshot = await getDocs(collection(firestore, `projects/${id}/diaries/${diaryId}/attachments`));
        const attachments = attachmentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        
        return { 
          id: diaryId, 
          ...diaryData, 
          presence, 
          attachments 
        };
      }));
      res.json(diaries);
    } catch (err) {
      console.error("Error fetching diaries:", err);
      res.status(500).json({ success: false, message: "Bautagebuch konnte nicht geladen werden." });
    }
  });

  app.post("/api/projects/:id/diaries", async (req, res) => {
    const { id } = req.params;
    const { date, weather, temperature, work_done, notes, presence } = req.body;
    try {
      const diaryRef = doc(collection(firestore, `projects/${id}/diaries`));
      const diaryId = diaryRef.id;
      
      await setDoc(diaryRef, {
        date,
        weather,
        temperature,
        work_done,
        notes,
        created_at: new Date().toISOString()
      });
      
      if (presence && Array.isArray(presence)) {
        const batch = writeBatch(firestore);
        for (const p of presence) {
          const pRef = doc(collection(firestore, `projects/${id}/diaries/${diaryId}/presence`));
          batch.set(pRef, {
            person_name: p.person_name,
            role: p.role,
            hours: p.hours
          });
        }
        await batch.commit();
      }
      
      res.json({ success: true, id: diaryId });
    } catch (err) {
      console.error("Error creating diary:", err);
      res.status(500).json({ success: false, message: "Tagebucheintrag konnte nicht gespeichert werden." });
    }
  });

  app.get("/api/projects/:projectId/diaries/:diaryId/attachments", async (req, res) => {
    const { projectId, diaryId } = req.params;
    try {
      const snapshot = await getDocs(collection(firestore, `projects/${projectId}/diaries/${diaryId}/attachments`));
      const attachments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(attachments);
    } catch (err) {
      res.status(500).json({ success: false, message: "Anhänge konnten nicht geladen werden." });
    }
  });

  app.post("/api/projects/:projectId/diaries/:diaryId/attachments", upload.single('file'), async (req, res) => {
    const { projectId, diaryId } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: "Keine Datei hochgeladen." });

    try {
      const url = `/uploads/${req.file.filename}`;
      const docRef = doc(collection(firestore, `projects/${projectId}/diaries/${diaryId}/attachments`));
      await setDoc(docRef, {
        file_path: url,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        created_at: new Date().toISOString()
      });
      
      res.json({ success: true, id: docRef.id, url });
    } catch (err) {
      res.status(500).json({ success: false, message: "Anhang konnte nicht gespeichert werden." });
    }
  });

  app.delete("/api/projects/:projectId/diaries/:diaryId/attachments/:attachmentId", async (req, res) => {
    const { projectId, diaryId, attachmentId } = req.params;
    try {
      const docRef = doc(firestore, `projects/${projectId}/diaries/${diaryId}/attachments`, attachmentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const attachment = docSnap.data();
        const filePath = path.join(__dirname, attachment.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        await deleteDoc(docRef);
      }
      
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Anhang konnte nicht gelöscht werden." });
    }
  });

  // --- Change Orders ---
  app.get("/api/projects/:id/change-orders", async (req, res) => {
    const { id } = req.params;
    try {
      const snapshot = await getDocs(query(collection(firestore, `projects/${id}/change_orders`), orderBy("created_at", "desc")));
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(orders);
    } catch (err) {
      res.status(500).json({ success: false, message: "Nachträge konnten nicht geladen werden." });
    }
  });

  app.post("/api/projects/:id/change-orders", async (req, res) => {
    const { id } = req.params;
    const { title, description, amount, status } = req.body;
    try {
      const docRef = doc(collection(firestore, `projects/${id}/change_orders`));
      await setDoc(docRef, {
        title,
        description,
        amount: parseFloat(amount) || 0,
        status: status || 'pending',
        created_at: new Date().toISOString()
      });
      res.json({ success: true, id: docRef.id });
    } catch (err) {
      res.status(500).json({ success: false, message: "Nachtrag konnte nicht erstellt werden." });
    }
  });

  app.put("/api/projects/:projectId/change-orders/:orderId/status", async (req, res) => {
    const { projectId, orderId } = req.params;
    const { status } = req.body;
    try {
      await updateDoc(doc(firestore, `projects/${projectId}/change_orders`, orderId), { status });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Status konnte nicht aktualisiert werden." });
    }
  });

  // --- Invoices ---
  app.get("/api/invoices/overdue", async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const snapshot = await getDocs(collectionGroup(firestore, "invoices"));
      const overdueInvoices = [];

      for (const invoiceDoc of snapshot.docs) {
        const data = invoiceDoc.data();
        if (data.status !== 'paid' && data.due_date < today) {
          const projectId = invoiceDoc.ref.parent.parent?.id;
          let project_name = "Unbekanntes Projekt";
          let customer_email = "";
          let customer_name = "";

          if (projectId) {
            const projectDoc = await getDoc(doc(firestore, "projects", projectId));
            if (projectDoc.exists()) {
              const projectData = projectDoc.data();
              project_name = projectData.name;
              
              if (projectData.customer_id) {
                const customerDoc = await getDoc(doc(firestore, "customers", projectData.customer_id));
                if (customerDoc.exists()) {
                  const customerData = customerDoc.data();
                  customer_email = customerData.email;
                  customer_name = customerData.name;
                }
              } else if (projectData.customer_email) {
                customer_email = projectData.customer_email;
                customer_name = projectData.client_name || "Kunde";
              }
            }
          }

          overdueInvoices.push({
            id: invoiceDoc.id,
            project_id: projectId,
            project_name,
            customer_email,
            customer_name,
            ...data
          });
        }
      }

      res.json(overdueInvoices);
    } catch (err) {
      console.error("Error fetching overdue invoices:", err);
      res.status(500).json({ success: false, message: "Überfällige Rechnungen konnten nicht geladen werden." });
    }
  });

  app.post("/api/invoices/:invoiceId/send-reminder", async (req, res) => {
    const { invoiceId } = req.params;
    const { projectId, customMessage } = req.body;

    try {
      const invoiceDoc = await getDoc(doc(firestore, `projects/${projectId}/invoices`, invoiceId));
      if (!invoiceDoc.exists()) return res.status(404).json({ success: false, message: "Rechnung nicht gefunden." });
      const invoice = invoiceDoc.data();

      const projectDoc = await getDoc(doc(firestore, "projects", projectId));
      if (!projectDoc.exists()) return res.status(404).json({ success: false, message: "Projekt nicht gefunden." });
      const project = projectDoc.data();

      let customer_email = project.customer_email;
      let customer_name = project.client_name || "Kunde";

      if (project.customer_id) {
        const customerDoc = await getDoc(doc(firestore, "customers", project.customer_id));
        if (customerDoc.exists()) {
          customer_email = customerDoc.data().email;
          customer_name = customerDoc.data().name;
        }
      }

      if (!customer_email) {
        return res.status(400).json({ success: false, message: "Keine E-Mail-Adresse für diesen Kunden gefunden." });
      }

      // Fetch company settings for the email signature
      const settingsSnapshot = await getDocs(collection(firestore, "settings"));
      const settings = settingsSnapshot.docs.reduce((acc: any, doc) => {
        acc[doc.id] = doc.data().value;
        return acc;
      }, {});

      const companyName = settings.company_name || "Los Facility Service";

      // Configure transporter (using environment variables or settings)
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      const defaultMessage = `
        Sehr geehrte(r) ${customer_name},

        dies ist eine freundliche Erinnerung an Ihre offene Rechnung ${invoice.invoice_number} vom ${new Date(invoice.created_at).toLocaleDateString('de-DE')}.
        Der fällige Betrag beläuft sich auf ${invoice.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}.

        Bitte überweisen Sie den Betrag bis zum ${new Date(invoice.due_date).toLocaleDateString('de-DE')}.

        Falls Sie die Zahlung bereits getätigt haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.

        Mit freundlichen Grüßen,
        Ihr Team von ${companyName}
      `;

      const mailOptions = {
        from: `"${companyName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@example.com'}>`,
        to: customer_email,
        subject: `Zahlungserinnerung: Rechnung ${invoice.invoice_number}`,
        text: customMessage || defaultMessage,
      };

      // In a real scenario, we'd send the email. 
      // If credentials are missing, we'll log it and return a specific message.
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log("Email Reminder (Simulated - No Credentials):", mailOptions);
        // We'll return success but with a warning in the log
        return res.json({ 
          success: true, 
          message: "Erinnerung wurde simuliert (E-Mail-Zugangsdaten fehlen in .env).",
          simulated: true 
        });
      }

      await transporter.sendMail(mailOptions);

      // Log the communication
      if (project.customer_id) {
        await addDoc(collection(firestore, `customers/${project.customer_id}/communication_logs`), {
          type: 'email',
          content: `Zahlungserinnerung für Rechnung ${invoice.invoice_number} gesendet.`,
          date: new Date().toISOString()
        });
      }

      res.json({ success: true, message: "Zahlungserinnerung erfolgreich gesendet!" });
    } catch (err) {
      console.error("Error sending reminder:", err);
      res.status(500).json({ success: false, message: "Fehler beim Senden der Erinnerung." });
    }
  });

  app.get("/api/invoices/all", async (req, res) => {
    try {
      // Use collectionGroup to get all invoices across all projects
      const snapshot = await getDocs(collectionGroup(firestore, "invoices"));
      const invoices = await Promise.all(snapshot.docs.map(async (invoiceDoc) => {
        const data = invoiceDoc.data();
        const projectId = invoiceDoc.ref.parent.parent?.id;
        let project_name = "Unbekanntes Projekt";
        
        if (projectId) {
          const projectDoc = await getDoc(doc(firestore, "projects", projectId));
          if (projectDoc.exists()) {
            project_name = projectDoc.data().name;
          }
        }
        
        return { 
          id: invoiceDoc.id, 
          project_id: projectId,
          project_name,
          ...data 
        };
      }));
      
      // Sort by created_at desc
      invoices.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      res.json(invoices);
    } catch (err) {
      console.error("Error fetching all invoices:", err);
      res.status(500).json({ success: false, message: "Rechnungen konnten nicht geladen werden." });
    }
  });

  app.get("/api/projects/:id/invoices", async (req, res) => {
    const { id } = req.params;
    try {
      const snapshot = await getDocs(query(collection(firestore, `projects/${id}/invoices`), orderBy("created_at", "desc")));
      const invoices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(invoices);
    } catch (err) {
      res.status(500).json({ success: false, message: "Rechnungen konnten nicht geladen werden." });
    }
  });

  app.post("/api/projects/:id/invoices", async (req, res) => {
    const { id } = req.params;
    const { invoice_number, type, amount, status, due_date } = req.body;
    try {
      const docRef = doc(collection(firestore, `projects/${id}/invoices`));
      await setDoc(docRef, {
        invoice_number,
        type,
        amount: parseFloat(amount) || 0,
        status: status || 'draft',
        due_date,
        created_at: new Date().toISOString()
      });
      res.json({ success: true, id: docRef.id });
    } catch (err) {
      res.status(500).json({ success: false, message: "Rechnung konnte nicht erstellt werden." });
    }
  });

  app.get("/api/projects/:projectId/invoices/:invoiceId/validate-einvoice", async (req, res) => {
    const { projectId, invoiceId } = req.params;
    try {
      const invoiceDoc = await getDoc(doc(firestore, `projects/${projectId}/invoices`, invoiceId));
      if (!invoiceDoc.exists()) return res.status(404).json({ success: false, message: "Rechnung nicht gefunden." });
      const invoice = invoiceDoc.data();
      
      const projectDoc = await getDoc(doc(firestore, "projects", projectId));
      if (!projectDoc.exists()) return res.status(404).json({ success: false, message: "Projekt nicht gefunden." });
      const project = projectDoc.data();
      
      let customer: any = null;
      if (project.customer_id) {
        const customerDoc = await getDoc(doc(firestore, "customers", project.customer_id));
        if (customerDoc.exists()) {
          customer = customerDoc.data();
        }
      }
      
      const errors = [];
      const warnings = [];
      
      if (!customer?.email && !project.customer_email) errors.push("Kunden-E-Mail fehlt.");
      if (!customer?.address && !project.customer_address) errors.push("Kunden-Adresse fehlt.");
      if (!invoice.due_date) errors.push("Zahlungsziel fehlt.");
      if (invoice.amount <= 0) errors.push("Rechnungsbetrag muss größer als 0 sein.");
      
      // Check for company settings
      const settingsSnapshot = await getDocs(collection(firestore, "settings"));
      const settings = settingsSnapshot.docs.reduce((acc: any, doc) => {
        acc[doc.id] = doc.data().value;
        return acc;
      }, {});
      
      if (!settings.company_name) errors.push("Eigener Firmenname in den Einstellungen fehlt.");
      if (!settings.tax_id) warnings.push("Steuernummer fehlt (empfohlen).");
      
      res.json({
        success: true,
        isReady: errors.length === 0,
        errors,
        warnings
      });
    } catch (err) {
      console.error("Validation error:", err);
      res.status(500).json({ success: false, message: "Validierung fehlgeschlagen." });
    }
  });

  app.get("/api/projects/:projectId/invoices/:invoiceId/export-xrechnung", async (req, res) => {
    const { projectId, invoiceId } = req.params;
    try {
      const { create } = await import('xmlbuilder2');
      
      const invoiceDoc = await getDoc(doc(firestore, `projects/${projectId}/invoices`, invoiceId));
      if (!invoiceDoc.exists()) return res.status(404).json({ success: false, message: "Rechnung nicht gefunden." });
      const invoice = invoiceDoc.data();
      
      const projectDoc = await getDoc(doc(firestore, "projects", projectId));
      if (!projectDoc.exists()) return res.status(404).json({ success: false, message: "Projekt nicht gefunden." });
      const project = projectDoc.data();
      
      let customer: any = null;
      if (project.customer_id) {
        const customerDoc = await getDoc(doc(firestore, "customers", project.customer_id));
        if (customerDoc.exists()) {
          customer = customerDoc.data();
        }
      }
      
      const settingsSnapshot = await getDocs(collection(firestore, "settings"));
      const settings = settingsSnapshot.docs.reduce((acc: any, doc) => {
        acc[doc.id] = doc.data().value;
        return acc;
      }, {});

      const itemsSnapshot = await getDocs(collection(firestore, `projects/${projectId}/quote_items`));
      const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const taxRate = project.tax_rate || 19.0;
      const netAmount = invoice.amount / (1 + taxRate / 100);
      const taxAmount = invoice.amount - netAmount;

      const root = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('Invoice', { 
          xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
          'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
          'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2'
        })
          .ele('cbc:CustomizationID').txt('urn:cen.eu:en16931:2017#compliant#urn:xoev-de:kosit:standard:xrechnung_2.2').up()
          .ele('cbc:ID').txt(invoice.invoice_number).up()
          .ele('cbc:IssueDate').txt(new Date(invoice.created_at).toISOString().split('T')[0]).up()
          .ele('cbc:InvoiceTypeCode').txt('380').up()
          .ele('cbc:DocumentCurrencyCode').txt(project.currency || 'EUR').up()
          .ele('cac:AccountingSupplierParty')
            .ele('cac:Party')
              .ele('cac:PartyName')
                .ele('cbc:Name').txt(settings.company_name || 'Handwerksmeister').up()
              .up()
              .ele('cac:PostalAddress')
                .ele('cbc:StreetName').txt(settings.company_address || '').up()
                .ele('cac:Country')
                  .ele('cbc:IdentificationCode').txt('DE').up()
                .up()
              .up()
              .ele('cac:PartyTaxScheme')
                .ele('cbc:CompanyID').txt(settings.tax_id || '').up()
                .ele('cac:TaxScheme')
                  .ele('cbc:ID').txt('VAT').up()
                .up()
              .up()
            .up()
          .up()
          .ele('cac:AccountingCustomerParty')
            .ele('cac:Party')
              .ele('cac:PartyName')
                .ele('cbc:Name').txt(customer?.name || project.customer_name || 'Kunde').up()
              .up()
              .ele('cac:PostalAddress')
                .ele('cbc:StreetName').txt(customer?.address || project.customer_address || '').up()
                .ele('cac:Country')
                  .ele('cbc:IdentificationCode').txt('DE').up()
                .up()
              .up()
            .up()
          .up()
          .ele('cac:TaxTotal')
            .ele('cbc:TaxAmount', { currencyID: project.currency || 'EUR' }).txt(taxAmount.toFixed(2)).up()
            .ele('cac:TaxSubtotal')
              .ele('cbc:TaxableAmount', { currencyID: project.currency || 'EUR' }).txt(netAmount.toFixed(2)).up()
              .ele('cbc:TaxAmount', { currencyID: project.currency || 'EUR' }).txt(taxAmount.toFixed(2)).up()
              .ele('cac:TaxCategory')
                .ele('cbc:ID').txt('S').up()
                .ele('cbc:Percent').txt(taxRate.toFixed(2)).up()
                .ele('cac:TaxScheme')
                  .ele('cbc:ID').txt('VAT').up()
                .up()
              .up()
            .up()
          .up()
          .ele('cac:LegalMonetaryTotal')
            .ele('cbc:LineExtensionAmount', { currencyID: project.currency || 'EUR' }).txt(netAmount.toFixed(2)).up()
            .ele('cbc:TaxExclusiveAmount', { currencyID: project.currency || 'EUR' }).txt(netAmount.toFixed(2)).up()
            .ele('cbc:TaxInclusiveAmount', { currencyID: project.currency || 'EUR' }).txt(invoice.amount.toFixed(2)).up()
            .ele('cbc:PayableAmount', { currencyID: project.currency || 'EUR' }).txt(invoice.amount.toFixed(2)).up()
          .up();

      // Add detailed line items
      if (items.length > 0) {
        items.forEach((item: any, index: number) => {
          const itemNet = item.total / (1 + taxRate / 100);
          const itemPrice = item.price / (1 + taxRate / 100);
          
          // Map units to UN/ECE codes
          let unitCode = 'C62'; // Default: One (Pauschal)
          const unit = (item.unit || '').toLowerCase();
          if (unit.includes('m2') || unit.includes('qm')) unitCode = 'MTK';
          else if (unit.includes('m') || unit.includes('lfm')) unitCode = 'MTR';
          else if (unit.includes('stk') || unit.includes('stück')) unitCode = 'H87';
          else if (unit.includes('std') || unit.includes('h')) unitCode = 'HUR';
          else if (unit.includes('kg')) unitCode = 'KGM';
          else if (unit.includes('t')) unitCode = 'TNE';

          root.ele('cac:InvoiceLine')
            .ele('cbc:ID').txt((index + 1).toString()).up()
            .ele('cbc:InvoicedQuantity', { unitCode }).txt(item.quantity.toString()).up()
            .ele('cbc:LineExtensionAmount', { currencyID: project.currency || 'EUR' }).txt(itemNet.toFixed(2)).up()
            .ele('cac:Item')
              .ele('cbc:Name').txt(item.title || 'Leistungsposition').up()
              .ele('cac:ClassifiedTaxCategory')
                .ele('cbc:ID').txt('S').up()
                .ele('cbc:Percent').txt(taxRate.toFixed(2)).up()
                .ele('cac:TaxScheme')
                  .ele('cbc:ID').txt('VAT').up()
                .up()
              .up()
            .up()
            .ele('cac:Price')
              .ele('cbc:PriceAmount', { currencyID: project.currency || 'EUR' }).txt(itemPrice.toFixed(2)).up()
            .up();
        });
      } else {
        // Fallback: Add one line for the total if we don't have detailed items
        root.ele('cac:InvoiceLine')
          .ele('cbc:ID').txt('1').up()
          .ele('cbc:InvoicedQuantity', { unitCode: 'HUR' }).txt('1').up()
          .ele('cbc:LineExtensionAmount', { currencyID: project.currency || 'EUR' }).txt(netAmount.toFixed(2)).up()
          .ele('cac:Item')
            .ele('cbc:Name').txt(invoice.type || 'Bauleistung').up()
            .ele('cac:ClassifiedTaxCategory')
              .ele('cbc:ID').txt('S').up()
              .ele('cbc:Percent').txt(taxRate.toFixed(2)).up()
              .ele('cac:TaxScheme')
                .ele('cbc:ID').txt('VAT').up()
              .up()
            .up()
          .up()
          .ele('cac:Price')
            .ele('cbc:PriceAmount', { currencyID: project.currency || 'EUR' }).txt(netAmount.toFixed(2)).up()
          .up();
      }

      const xml = root.end({ prettyPrint: true });
      
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename=XRechnung_${invoice.invoice_number}.xml`);
      res.send(xml);
      
    } catch (err) {
      console.error("XRechnung export error:", err);
      res.status(500).json({ success: false, message: "XRechnung Export fehlgeschlagen." });
    }
  });

  // --- User Roles Management ---

  app.get("/api/users", async (req, res) => {
    try {
      const snapshot = await getDocs(collection(firestore, "users"));
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json({ success: true, users });
    } catch (err) {
      console.error("Error fetching users:", err);
      res.status(500).json({ success: false, message: "Fehler beim Laden der Benutzer." });
    }
  });

  app.put("/api/users/:id/role", async (req, res) => {
    const { id } = req.params;
    const { roleId } = req.body;
    try {
      await updateDoc(doc(firestore, "users", id), { role: roleId });
      res.json({ success: true, message: "Benutzerrolle erfolgreich aktualisiert." });
    } catch (err) {
      console.error("Error updating user role:", err);
      res.status(500).json({ success: false, message: "Fehler beim Aktualisieren der Benutzerrolle." });
    }
  });

  app.get("/api/roles", async (req, res) => {
    try {
      const rolesSnapshot = await getDocs(collection(firestore, 'user_roles'));
      const roles = rolesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), permissions: JSON.parse((doc.data() as any).permissions || '[]') }));
      res.json(roles);
    } catch (err) {
      console.error('Error fetching roles:', err);
      res.status(500).json({ success: false, message: "Rollen konnten nicht geladen werden." });
    }
  });

  app.post("/api/roles", async (req, res) => {
    const { name, permissions } = req.body;
    try {
      const result = await addDoc(collection(firestore, 'user_roles'), {
        name,
        permissions: JSON.stringify(permissions)
      });
      res.json({ success: true, id: result.id });
    } catch (err) {
      console.error('Error creating role:', err);
      res.status(500).json({ success: false, message: "Rolle konnte nicht erstellt werden." });
    }
  });

  app.put("/api/roles/:id", async (req, res) => {
    const { id } = req.params;
    const { name, permissions } = req.body;
    try {
      await updateDoc(doc(firestore, 'user_roles', id), {
        name,
        permissions: JSON.stringify(permissions)
      });
      res.json({ success: true });
    } catch (err) {
      console.error('Error updating role:', err);
      res.status(500).json({ success: false, message: "Rolle konnte nicht aktualisiert werden." });
    }
  });

  app.delete("/api/roles/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await deleteDoc(doc(firestore, 'user_roles', id));
      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting role:', err);
      res.status(500).json({ success: false, message: "Rolle konnte nicht gelöscht werden." });
    }
  });

  // --- Subscription Management ---
  app.post("/api/create-checkout-session", async (req, res) => {
    if (!stripe) return res.status(500).json({ success: false, message: "Stripe ist nicht konfiguriert." });
    
    const { userId, planId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "User ID erforderlich" });

    try {
      // Find user in Firestore
      let userEmail = '';
      const userDoc = await getDoc(doc(firestore, "users", userId));
      if (userDoc.exists()) {
        userEmail = userDoc.data().email;
      }

      const appUrl = process.env.APP_URL || req.headers.origin || `http://localhost:3000`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: planId === 'pro' ? 'Handwerker-Kalkulationsplattform Profi' : 'Handwerker-Kalkulationsplattform Enterprise',
                description: planId === 'pro' 
                  ? 'Unbegrenzte Projekte, GAEB-Import, E-Rechnung, Bautagebuch' 
                  : 'Alles aus Profi + Mehrbenutzer-Verwaltung & API-Zugriff',
              },
              unit_amount: planId === 'pro' ? 4900 : 9900,
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${appUrl}/admin?session_id={CHECKOUT_SESSION_ID}&tab=settings`,
        cancel_url: `${appUrl}/pricing`,
        client_reference_id: userId,
        customer_email: userEmail || undefined,
        metadata: {
          userId: userId,
          planId: planId
        }
      });

      res.json({ success: true, url: session.url, sessionId: session.id });
    } catch (err: any) {
      console.error("Stripe Checkout Error:", err);
      res.status(500).json({ success: false, message: "Fehler beim Erstellen der Checkout-Session: " + err.message });
    }
  });

  app.get("/api/subscriptions/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
      // Check Firestore
      const userDoc = await getDoc(doc(firestore, "users", userId));
      if (userDoc.exists() && userDoc.data().subscription_status) {
        return res.json({
          plan_id: userDoc.data().plan || 'free',
          status: userDoc.data().subscription_status || 'active'
        });
      }

      res.json({ plan_id: 'free', status: 'active' });
    } catch (err) {
      res.json({ plan_id: 'free', status: 'active' });
    }
  });

  app.post("/api/create-portal-session", async (req, res) => {
    if (!stripe) return res.status(500).json({ success: false, message: "Stripe ist nicht konfiguriert." });
    
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "User ID erforderlich" });

    try {
      // Find user in Firestore to get stripe_customer_id
      let customerId = '';
      const userDoc = await getDoc(doc(firestore, "users", userId));
      if (userDoc.exists()) {
        customerId = userDoc.data().stripe_customer_id;
      }

      if (!customerId) {
        return res.status(400).json({ success: false, message: "Keine Stripe-Kunden-ID gefunden. Bitte zuerst ein Abonnement abschließen." });
      }

      const appUrl = process.env.APP_URL || req.headers.origin || `http://localhost:3000`;

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${appUrl}/admin?tab=settings`,
      });

      res.json({ success: true, url: portalSession.url });
    } catch (err) {
      console.error("Portal session error:", err);
      res.status(500).json({ success: false, message: "Portal konnte nicht erstellt werden." });
    }
  });

  app.post("/api/webhook/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.error("Stripe or Webhook Secret missing");
      return res.status(400).send("Webhook-Fehler: Konfiguration fehlt");
    }

    const sig = req.headers['stripe-signature'] as string;
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      console.error(`Webhook Signature Error: ${err.message}`);
      return res.status(400).send(`Webhook-Fehler: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id || session.metadata?.userId;
      const planId = session.metadata?.planId || 'pro';
      const subscriptionId = session.subscription as string;
      
      if (userId) {
        try {
          // Update Firestore
          await updateDoc(doc(firestore, "users", userId), {
            subscription_status: 'active',
            subscription_id: subscriptionId,
            stripe_customer_id: session.customer as string,
            plan: planId,
            updated_at: new Date().toISOString()
          });

          console.log(`Subscription activated for user ${userId}`);
        } catch (err) {
          console.error(`Error updating subscription for user ${userId}:`, err);
        }
      }
    }

    res.json({ received: true });
  });

  // --- AI & External Services ---
  app.post("/api/ai/analyze-photo", upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const base64Data = fs.readFileSync(req.file.path).toString('base64');

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: req.file.mimetype,
                  data: base64Data,
                },
              },
              {
                text: "Beschreibe den Baufortschritt auf diesem Foto. Was wurde bereits erledigt? Gibt es sichtbare Mängel oder Besonderheiten? Antworte kurz und präzise auf Deutsch.",
              },
            ],
          },
        ],
      });

      fs.unlinkSync(req.file.path);
      res.json({ success: true, analysis: response.text });
    } catch (err) {
      console.error("AI Photo Analysis Error:", err);
      res.status(500).json({ success: false, message: "Fehler bei der KI-Fotoanalyse." });
    }
  });

  app.post("/api/catalog/import-datanorm", upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    try {
      // Datanorm is often ISO-8859-1
      const buffer = fs.readFileSync(req.file.path);
      const content = buffer.toString('latin1'); 
      const lines = content.split(/\r?\n/);
      
      let importedCount = 0;
      const defaultTradeRef = doc(collection(firestore, "trades"));
      await setDoc(defaultTradeRef, { 
        name: "Datanorm Import " + new Date().toLocaleDateString('de-DE'), 
        is_anlage_a: 0, 
        sort_order: 100 
      });
      const currentTradeId = defaultTradeRef.id;

      const batch = writeBatch(firestore);
      const articleMap = new Map<string, any>();
      
      for (const line of lines) {
        const parts = line.split(';');
        const recordType = parts[0];
        
        if (recordType === 'A') {
          const articleNumber = (parts[1] || '').trim();
          const name1 = (parts[3] || '').trim();
          const name2 = (parts[4] || '').trim();
          const unit = (parts[5] || 'Stk').trim();
          
          if (articleNumber) {
            articleMap.set(articleNumber, {
              name: `${name1} ${name2}`.trim() || "Unbenannter Artikel",
              unit: unit,
              articleNumber: articleNumber,
              price: 0
            });
          }
        } else if (recordType === 'P') {
          const articleNumber = (parts[1] || '').trim();
          const priceStr = (parts[2] || '0').replace(',', '.');
          const price = parseFloat(priceStr) || 0;
          
          if (articleNumber && articleMap.has(articleNumber)) {
            const art = articleMap.get(articleNumber);
            art.price = price;
          }
        }
      }

      const articles = Array.from(articleMap.values());
      for (const art of articles) {
        const itemRef = doc(collection(firestore, `trades/${currentTradeId}/service_items`));
        batch.set(itemRef, {
          name: art.name,
          unit: art.unit,
          labor_hours: 0,
          material_price: art.price,
          description: `Art-Nr: ${art.articleNumber}`,
          trade_id: currentTradeId,
          sort_order: importedCount
        });
        importedCount++;
        
        if (importedCount >= 450) break;
      }

      await batch.commit();
      fs.unlinkSync(req.file.path);
      res.json({ success: true, count: importedCount, tradeId: currentTradeId });
    } catch (err) {
      console.error("Datanorm Import Error:", err);
      res.status(500).json({ success: false, message: "Fehler beim Importieren der Datanorm-Datei." });
    }
  });

  app.post("/api/seed-catalog", async (req, res) => {
    try {
      const pilotData = [
        {
          name: 'Maler',
          is_anlage_a: 1,
          items: [
            { name: 'Wandanstrich (Q2)', unit: 'm²', labor_hours: 0.25, material_price: 3.50, description: 'Einfacher Anstrich auf Putz Q2' },
            { name: 'Wandanstrich (Q3)', unit: 'm²', labor_hours: 0.35, material_price: 4.50, description: 'Hochwertiger Anstrich auf Putz Q3' },
            { name: 'Grundierung', unit: 'm²', labor_hours: 0.10, material_price: 1.20, description: 'Tiefengrund lösemittelfrei' }
          ]
        },
        {
          name: 'Fliesenleger',
          is_anlage_a: 1,
          items: [
            { name: 'Bodenfliesen verlegen (Standard)', unit: 'm²', labor_hours: 1.2, material_price: 15.00, description: 'Verlegung im Dünnbettverfahren' },
            { name: 'Wandfliesen verlegen (Nassbereich)', unit: 'm²', labor_hours: 1.5, material_price: 18.00, description: 'Inkl. Abdichtung' },
            { name: 'Verfugung', unit: 'm²', labor_hours: 0.3, material_price: 2.50, description: 'Zementäre Verfugung' }
          ]
        },
        {
          name: 'Elektriker',
          is_anlage_a: 1,
          items: [
            { name: 'Steckdose montieren (UP)', unit: 'Stk', labor_hours: 0.5, material_price: 8.50, description: 'Unterputz-Montage inkl. Einsatz' },
            { name: 'Schalter montieren (UP)', unit: 'Stk', labor_hours: 0.6, material_price: 12.00, description: 'Wechselschalter inkl. Wippe' },
            { name: 'Leitung verlegen (NYM 3x1,5)', unit: 'm', labor_hours: 0.15, material_price: 1.10, description: 'Inkl. Befestigungsmaterial' }
          ]
        },
        {
          name: 'Schreiner',
          is_anlage_a: 1,
          items: [
            { name: 'Zimmertür montieren', unit: 'Stk', labor_hours: 2.5, material_price: 250.00, description: 'Inkl. Zarge und Beschlag' },
            { name: 'Sockelleisten montieren', unit: 'm', labor_hours: 0.2, material_price: 5.50, description: 'Gehrungsschnitt inkl. Montage' },
            { name: 'Einbauschrank (lfm)', unit: 'm', labor_hours: 8.0, material_price: 450.00, description: 'Korpusbau inkl. Fronten' }
          ]
        },
        {
          name: 'SHK',
          is_anlage_a: 1,
          items: [
            { name: 'Waschtisch montieren', unit: 'Stk', labor_hours: 1.5, material_price: 120.00, description: 'Inkl. Armatur und Siphon' },
            { name: 'WC-Anlage montieren', unit: 'Stk', labor_hours: 2.0, material_price: 180.00, description: 'Wand-WC inkl. Sitz' },
            { name: 'Heizkörper montieren', unit: 'Stk', labor_hours: 3.0, material_price: 220.00, description: 'Inkl. Ventil und Thermostat' }
          ]
        }
      ];

      const batch = writeBatch(firestore);
      for (const trade of pilotData) {
        const tradeRef = doc(collection(firestore, "trades"));
        batch.set(tradeRef, { name: trade.name, is_anlage_a: trade.is_anlage_a, sort_order: 0 });
        
        for (const item of trade.items) {
          const itemRef = doc(collection(firestore, `trades/${tradeRef.id}/service_items`));
          batch.set(itemRef, { ...item, sort_order: 0, trade_id: tradeRef.id });
        }
      }
      await batch.commit();
      res.json({ success: true, message: "Pilot-Katalog erfolgreich erstellt." });
    } catch (err) {
      console.error("Seeding Error:", err);
      res.status(500).json({ success: false, message: "Fehler beim Seeden des Katalogs." });
    }
  });

  app.get("/api/catalog", async (req, res) => {
    try {
      const tradesSnapshot = await getDocs(collection(firestore, "trades"));
      const catalog = await Promise.all(tradesSnapshot.docs.map(async (tradeDoc) => {
        const itemsSnapshot = await getDocs(query(collection(firestore, `trades/${tradeDoc.id}/service_items`), orderBy("sort_order", "asc")));
        const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return { id: tradeDoc.id, ...tradeDoc.data(), items };
      }));
      res.json(catalog);
    } catch (err) {
      console.error("Error fetching catalog:", err);
      res.json([]); // Return empty array to prevent frontend crash
    }
  });

  // --- Settings Management ---
  app.get("/api/settings", async (req, res) => {
    try {
      const snapshot = await getDocs(collection(firestore, "settings"));
      const settings = snapshot.docs.reduce((acc: any, doc) => {
        acc[doc.id] = doc.data().value;
        return acc;
      }, {});
      res.json(settings);
    } catch (err) {
      console.error("Error fetching settings:", err);
      res.json({}); // Return empty object to prevent frontend crash
    }
  });

  app.put("/api/settings", async (req, res) => {
    const settings = req.body; // Object with key-value pairs
    try {
      const promises = Object.entries(settings).map(([key, value]) => 
        setDoc(doc(firestore, "settings", key), { value: String(value) })
      );
      await Promise.all(promises);
      
      // Clear maintenance mode cache to ensure immediate effect
      maintenanceModeCache = null;
      
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Einstellungen konnten nicht gespeichert werden." });
    }
  });

  // --- User Profile & Auth ---
  app.get("/api/user/profile", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, message: "User ID required" });
    
    try {
      const userDoc = await getDoc(doc(firestore, "users", userId as string));
      if (userDoc.exists()) {
        return res.json({ success: true, user: { id: userDoc.id, ...userDoc.data() } });
      }

      const q = query(collection(firestore, "users"), where("google_id", "==", userId), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return res.json({ success: true, user: { id: doc.id, ...doc.data() } });
      }

      res.status(404).json({ success: false, message: "User not found" });
    } catch (err) {
      res.status(500).json({ success: false, message: "Fehler beim Laden des Profils." });
    }
  });

  app.post("/api/user/profile", async (req, res) => {
    const { userId, firstName, lastName, phone, address, email } = req.body;
    try {
      let docId = userId;
      const userDoc = await getDoc(doc(firestore, "users", userId));
      if (!userDoc.exists()) {
        const q = query(collection(firestore, "users"), where("google_id", "==", userId), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          docId = snapshot.docs[0].id;
        } else {
          return res.status(404).json({ success: false, message: "User not found" });
        }
      }

      await updateDoc(doc(firestore, "users", docId), {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
        address: address,
        email: email,
        updated_at: new Date().toISOString()
      });
      
      console.log(`Sending SMS greeting to ${phone}: Willkommen bei Los Facility Service, ${firstName}!`);
      res.json({ success: true, message: "Profil erfolgreich aktualisiert!" });
    } catch (err) {
      res.status(500).json({ success: false, message: "Fehler beim Aktualisieren des Profils." });
    }
  });

  app.post("/api/auth/google-login", async (req, res) => {
    try {
      const { googleId, email, name } = req.body;
      const q = query(collection(firestore, "users"), where("google_id", "==", googleId), limit(1));
      const snapshot = await getDocs(q);
      
      let user;
      if (snapshot.empty) {
        const docRef = doc(collection(firestore, "users"));
        user = {
          google_id: googleId,
          email,
          role: 'Kunde',
          first_name: name ? name.split(' ')[0] : 'User',
          created_at: new Date().toISOString(),
          free_offers_used: 0
        };
        await setDoc(docRef, user);
        user.id = docRef.id;
      } else {
        user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      }
      
      const isProfileComplete = !!(user.first_name && user.last_name && user.phone && user.address);
      
      res.json({ 
        success: true, 
        user, 
        isProfileComplete,
        token: "fake-jwt-token-for-demo" 
      });
    } catch (error) {
      console.error("Google login error:", error);
      res.status(500).json({ success: false, message: "Fehler bei der Google-Anmeldung", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // --- Password Reset ---
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.example.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      const q = query(collection(firestore, "users"), where("email", "==", email), limit(1));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return res.json({ success: true, message: "Wenn ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen des Passworts gesendet." });
      }

      const userDoc = snapshot.docs[0];
      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 3600000); // 1 hour from now

      await updateDoc(doc(firestore, "users", userDoc.id), {
        reset_token: token,
        reset_token_expiry: expiry.toISOString()
      });

      const resetUrl = `${req.protocol}://${req.get('host')}/reset-password?token=${token}`;

      const mailOptions = {
        from: process.env.EMAIL_FROM || '"Los Facility Service" <noreply@example.com>',
        to: email,
        subject: 'Passwort zurücksetzen',
        html: `
          <p>Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt.</p>
          <p>Klicken Sie auf den folgenden Link, um Ihr Passwort zurückzusetzen:</p>
          <a href="${resetUrl}">${resetUrl}</a>
          <p>Dieser Link ist 1 Stunde lang gültig.</p>
          <p>Wenn Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail bitte.</p>
        `,
      };

      // In a real scenario, we would send the email. 
      // For now, we'll log the link and simulate success.
      console.log(`Password reset link for ${email}: ${resetUrl}`);
      
      try {
        await transporter.sendMail(mailOptions);
        console.log(`Reset email sent to ${email}`);
      } catch (mailError) {
        console.error("Failed to send reset email:", mailError);
        // We still return success to the user to avoid leaking user existence
      }

      res.json({ success: true, message: "Wenn ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen des Passworts gesendet." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ success: false, message: "Ein Fehler ist aufgetreten." });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      const q = query(collection(firestore, "users"), 
        where("reset_token", "==", token), 
        where("reset_token_expiry", ">", new Date().toISOString()), 
        limit(1)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return res.status(400).json({ success: false, message: "Ungültiger oder abgelaufener Token." });
      }

      const userDoc = snapshot.docs[0];
      await updateDoc(doc(firestore, "users", userDoc.id), {
        password: newPassword,
        reset_token: null,
        reset_token_expiry: null
      });

      res.json({ success: true, message: "Passwort erfolgreich zurückgesetzt." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ success: false, message: "Ein Fehler ist aufgetreten." });
    }
  });

  app.get("/api/user/offers-count", async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.json({ used: 0 });
    
    try {
      const userDoc = await getDoc(doc(firestore, "users", userId as string));
      if (userDoc.exists()) {
        return res.json({ used: userDoc.data().free_offers_used || 0 });
      }

      const q = query(collection(firestore, "users"), where("google_id", "==", userId), limit(1));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return res.json({ used: snapshot.docs[0].data().free_offers_used || 0 });
      }

      res.json({ used: 0 });
    } catch (err) {
      res.json({ used: 0 });
    }
  });

  // --- Project & Quote Management ---

  app.get("/api/projects", async (req, res) => {
    try {
      const snapshot = await getDocs(query(collection(firestore, "projects"), orderBy("created_at", "desc")));
      const projects = await Promise.all(snapshot.docs.map(async (projectDoc) => {
        const data = projectDoc.data();
        let customer_name_real = data.customer_name;
        if (data.customer_id) {
          const customerDoc = await getDoc(doc(firestore, "customers", data.customer_id));
          if (customerDoc.exists()) {
            customer_name_real = customerDoc.data().name;
          }
        }
        return { id: projectDoc.id, ...data, customer_name_real };
      }));
      res.json(projects);
    } catch (err) {
      res.status(500).json({ success: false, message: "Projekte konnten nicht geladen werden." });
    }
  });

  app.post("/api/projects", async (req, res) => {
    const { userId, name, customer_id, customer_name, customer_address, currency, tax_rate, craftsman_name, craftsman_contact, terms_and_conditions, project_manager, tags } = req.body;
    try {
      // Check if paid offers are enabled
      const settingsDoc = await getDoc(doc(firestore, "settings", "paid_offers_enabled"));
      const isPaidEnabled = settingsDoc.exists() && settingsDoc.data().value === 'true';

      if (isPaidEnabled && userId) {
        // Check user's free offer usage and subscription
        let user;
        const userDoc = await getDoc(doc(firestore, "users", userId));
        if (userDoc.exists()) {
          user = { id: userDoc.id, ...userDoc.data() };
        } else {
          const q = query(collection(firestore, "users"), where("google_id", "==", userId), limit(1));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
          }
        }

        const subSnapshot = await getDocs(collection(firestore, `users/${user?.id || userId}/subscriptions`));
        const sub = subSnapshot.empty ? null : subSnapshot.docs[0].data();
        
        if (user && (user.free_offers_used || 0) >= 1 && (!sub || sub.status !== 'active')) {
          return res.status(403).json({ 
            success: false, 
            message: "Kostenloses Kontingent erschöpft. Bitte Upgrade auf Pro durchführen.",
            limitReached: true
          });
        }
      }

      const docRef = doc(collection(firestore, "projects"));
      const projectData = {
        name,
        customer_id: customer_id || null,
        customer_name: customer_name || '',
        customer_address: customer_address || '',
        currency: currency || 'EUR',
        tax_rate: tax_rate || 19.0,
        craftsman_name: craftsman_name || '',
        craftsman_contact: craftsman_contact || '',
        terms_and_conditions: terms_and_conditions || '',
        project_manager: project_manager || '',
        tags: tags || [],
        status: 'Entwurf',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await setDoc(docRef, projectData);
      
      const projectId = docRef.id;

      // Increment free_offers_used if applicable
      if (userId) {
        const q = query(collection(firestore, "users"), where("google_id", "==", userId), limit(1));
        const snapshot = await getDocs(q);
        let docId = userId;
        let currentUsed = 0;
        
        const userDoc = await getDoc(doc(firestore, "users", userId));
        if (userDoc.exists()) {
          currentUsed = userDoc.data().free_offers_used || 0;
        } else if (!snapshot.empty) {
          docId = snapshot.docs[0].id;
          currentUsed = snapshot.docs[0].data().free_offers_used || 0;
        }
        
        await updateDoc(doc(firestore, "users", docId), {
          free_offers_used: currentUsed + 1
        });
      }

      res.json({ success: true, id: projectId });
    } catch (err) {
      console.error("Project creation error:", err);
      res.status(500).json({ success: false, message: "Projekt konnte nicht erstellt werden." });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const projectDoc = await getDoc(doc(firestore, "projects", id));
      if (!projectDoc.exists()) {
        return res.status(404).json({ success: false, message: "Projekt nicht gefunden." });
      }

      const project = { id: projectDoc.id, ...projectDoc.data() } as any;
      const itemsSnapshot = await getDocs(collection(firestore, `projects/${id}/quote_items`));
      const items = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      
      // Sort items by sort_order
      items.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      let totalLaborHours = 0;
      let totalLaborCost = 0;
      let totalMaterialCost = 0;

      const itemsWithLabor = await Promise.all(items.map(async (item: any) => {
        const laborSnapshot = await getDocs(collection(firestore, `projects/${id}/quote_items/${item.id}/labor`));
        const labor_components = laborSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        
        let itemLaborCost = 0;
        let itemLaborHours = 0;

        if (labor_components && labor_components.length > 0) {
          labor_components.forEach(comp => {
            let multiplier = 1;
            if (comp.time_unit === 'Tage' || comp.time_unit === 'Days') multiplier = 8;
            else if (comp.time_unit === 'Wochen' || comp.time_unit === 'Weeks') multiplier = 40;
            else if (comp.time_unit === 'Monate' || comp.time_unit === 'Months') multiplier = 160;

            const hours = (comp.quantity || 0) * (comp.time_value || 0) * multiplier;
            itemLaborHours += hours;
            itemLaborCost += hours * (comp.hourly_rate || 0);
          });
        } else {
          // Fallback
          let rate = 52;
          if (item.trade_id) {
            const laborRateSnapshot = await getDocs(query(
              collection(firestore, `trades/${item.trade_id}/labor_rates`),
              where("worker_type", "==", "Geselle"),
              limit(1)
            ));
            if (!laborRateSnapshot.empty) {
              rate = laborRateSnapshot.docs[0].data().hourly_rate || 52;
            }
          }
          itemLaborHours = (item.quantity || 0) * (item.labor_hours_per_unit || 0);
          itemLaborCost = itemLaborHours * rate;
        }

        totalLaborHours += itemLaborHours;
        totalLaborCost += itemLaborCost;
        totalMaterialCost += (item.quantity || 0) * (item.material_price_per_unit || 0);

        let special_attributes = null;
        try {
          if (item.special_attributes) {
            special_attributes = typeof item.special_attributes === 'string' 
              ? JSON.parse(item.special_attributes) 
              : item.special_attributes;
          }
        } catch (e) {
          console.error("Error parsing special_attributes:", e);
        }
        return { 
          ...item, 
          labor_components, 
          special_attributes, 
          calculated_labor_hours: itemLaborHours, 
          calculated_labor_cost: itemLaborCost 
        };
      }));

      const laborMarkup = project.labor_markup || 0;
      const materialMarkup = project.material_markup || 0;
      const totalLaborWithMarkup = totalLaborCost * (1 + laborMarkup / 100);
      const totalMaterialWithMarkup = totalMaterialCost * (1 + materialMarkup / 100);
      const netTotal = totalLaborWithMarkup + totalMaterialWithMarkup;
      const taxAmount = netTotal * ((project.tax_rate || 19.0) / 100);

      res.json({ 
        ...project, 
        items: itemsWithLabor,
        totals: {
          labor_hours: totalLaborHours,
          labor_cost: totalLaborCost,
          labor_cost_with_markup: totalLaborWithMarkup,
          material_cost: totalMaterialCost,
          material_cost_with_markup: totalMaterialWithMarkup,
          net: netTotal,
          tax: taxAmount,
          gross: netTotal + taxAmount,
          labor_markup: laborMarkup,
          material_markup: materialMarkup
        }
      });
    } catch (err) {
      console.error("Error fetching project details:", err);
      res.status(500).json({ success: false, message: "Fehler beim Laden des Projekts." });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date().toISOString() };
    
    // Remove id and undefined fields to avoid Firestore errors
    delete updateData.id;
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    try {
      await updateDoc(doc(firestore, "projects", id), updateData);
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating project:", err);
      res.status(500).json({ success: false, message: "Projekt konnte nicht aktualisiert werden." });
    }
  });

  app.post("/api/projects/:id/target-price", async (req, res) => {
    const { id } = req.params;
    const { targetPrice, preview } = req.body;

    if (!targetPrice || isNaN(targetPrice)) {
      return res.status(400).json({ success: false, message: "Gültiger Zielpreis erforderlich." });
    }

    try {
      const projectDoc = await getDoc(doc(firestore, "projects", id));
      if (!projectDoc.exists()) {
        return res.status(404).json({ success: false, message: "Projekt nicht gefunden." });
      }

      const project = projectDoc.data();
      const taxRate = project.tax_rate || 19.0;
      const targetNet = targetPrice / (1 + taxRate / 100);

      const itemsSnapshot = await getDocs(collection(firestore, `projects/${id}/quote_items`));
      const items = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      let totalLaborCost = 0;
      let totalMaterialCost = 0;

      for (const item of items) {
        const laborSnapshot = await getDocs(collection(firestore, `projects/${id}/quote_items/${item.id}/labor`));
        const labor_components = laborSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        
        let itemLaborCost = 0;
        if (labor_components && labor_components.length > 0) {
          labor_components.forEach(comp => {
            let multiplier = 1;
            if (comp.time_unit === 'Tage' || comp.time_unit === 'Days') multiplier = 8;
            else if (comp.time_unit === 'Wochen' || comp.time_unit === 'Weeks') multiplier = 40;
            else if (comp.time_unit === 'Monate' || comp.time_unit === 'Months') multiplier = 160;
            const hours = (comp.quantity || 0) * (comp.time_value || 0) * multiplier;
            itemLaborCost += hours * (comp.hourly_rate || 0);
          });
        } else {
          let rate = 52;
          if (item.trade_id) {
            const laborRateSnapshot = await getDocs(query(
              collection(firestore, `trades/${item.trade_id}/labor_rates`),
              where("worker_type", "==", "Geselle"),
              limit(1)
            ));
            if (!laborRateSnapshot.empty) {
              rate = laborRateSnapshot.docs[0].data().hourly_rate || 52;
            }
          }
          itemLaborCost = (item.quantity || 0) * (item.labor_hours_per_unit || 0) * rate;
        }
        totalLaborCost += itemLaborCost;
        totalMaterialCost += (item.quantity || 0) * (item.material_price_per_unit || 0);
      }

      const currentNet = totalLaborCost + totalMaterialCost;
      if (currentNet === 0) {
        return res.status(400).json({ success: false, message: "Projekt hat keine Kosten. Zielpreis kann nicht berechnet werden." });
      }

      // Calculate markup to reach targetNet
      const markup = (targetNet / currentNet - 1) * 100;

      if (!preview) {
        await updateDoc(doc(firestore, "projects", id), {
          labor_markup: markup,
          material_markup: markup,
          updated_at: new Date().toISOString()
        });
      }

      res.json({ success: true, markup, currentNet, targetNet });
    } catch (err) {
      console.error("Error calculating target price:", err);
      res.status(500).json({ success: false, message: "Fehler bei der Zielpreis-Kalkulation." });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    const { id } = req.params;
    try {
      // Note: In a real app, you'd also delete subcollections
      await deleteDoc(doc(firestore, "projects", id));
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting project:", err);
      res.status(500).json({ success: false, message: "Projekt konnte nicht gelöscht werden." });
    }
  });

  // Project Images
  app.get("/api/projects/:id/images", async (req, res) => {
    const { id } = req.params;
    try {
      const snapshot = await getDocs(query(
        collection(firestore, `projects/${id}/images`),
        orderBy("created_at", "desc")
      ));
      const images = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json(images);
    } catch (err) {
      console.error("Error fetching project images:", err);
      res.status(500).json({ success: false, message: "Fehler beim Laden der Bilder." });
    }
  });

  app.post("/api/projects/:id/images", upload.single('file'), async (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "Keine Datei hochgeladen." });

    const url = `/uploads/${req.file.filename}`;
    try {
      const docRef = doc(collection(firestore, `projects/${id}/images`));
      const imageData = {
        url,
        title: title || req.file.originalname,
        created_at: new Date().toISOString()
      };
      await setDoc(docRef, imageData);
      res.json({ success: true, id: docRef.id, url });
    } catch (err) {
      console.error("Error saving project image:", err);
      res.status(500).json({ success: false, message: "Bild konnte nicht gespeichert werden." });
    }
  });

  app.delete("/api/projects/:id/images/:imageId", async (req, res) => {
    const { id, imageId } = req.params;
    try {
      const imageDoc = await getDoc(doc(firestore, `projects/${id}/images`, imageId));
      if (imageDoc.exists()) {
        const image = imageDoc.data();
        const filePath = path.join(process.cwd(), image.url);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        await deleteDoc(doc(firestore, `projects/${id}/images`, imageId));
      }
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting project image:", err);
      res.status(500).json({ success: false, message: "Bild konnte nicht gelöscht werden." });
    }
  });

  // --- Resource Planning Endpoints ---
  app.get("/api/resource-assignments", async (req, res) => {
    try {
      const snapshot = await getDocs(collection(firestore, "resource_assignments"));
      const assignments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json(assignments);
    } catch (err) {
      console.error("Error fetching resource assignments:", err);
      res.status(500).json({ success: false, message: "Fehler beim Laden der Einsatzplanung." });
    }
  });

  app.post("/api/resource-assignments", async (req, res) => {
    try {
      const assignment = req.body;
      const docRef = await addDoc(collection(firestore, "resource_assignments"), {
        ...assignment,
        created_at: new Date().toISOString()
      });
      res.json({ success: true, id: docRef.id });
    } catch (err) {
      console.error("Error creating resource assignment:", err);
      res.status(500).json({ success: false, message: "Fehler beim Erstellen der Einsatzplanung." });
    }
  });

  app.delete("/api/resource-assignments/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await deleteDoc(doc(firestore, "resource_assignments", id));
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting resource assignment:", err);
      res.status(500).json({ success: false, message: "Fehler beim Löschen der Einsatzplanung." });
    }
  });

  app.get("/api/workers", async (req, res) => {
    try {
      const snapshot = await getDocs(collection(firestore, "workers"));
      if (snapshot.empty) {
        const defaultWorkers = [
          { name: 'Max Mustermann', role: 'Meister' },
          { name: 'Erika Musterfrau', role: 'Gesellin' },
          { name: 'Hans Dampf', role: 'Helfer' },
          { name: 'Azubi Tim', role: 'Azubi' }
        ];
        // Seed if empty
        const batch = writeBatch(firestore);
        defaultWorkers.forEach(w => {
          const ref = doc(collection(firestore, "workers"));
          batch.set(ref, w);
        });
        await batch.commit();
        const newSnapshot = await getDocs(collection(firestore, "workers"));
        return res.json(newSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      const workers = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json(workers);
    } catch (err) {
      res.status(500).json({ success: false, message: "Fehler beim Laden der Mitarbeiter." });
    }
  });

  app.post("/api/workers", async (req, res) => {
    try {
      const worker = req.body;
      const docRef = await addDoc(collection(firestore, "workers"), worker);
      res.json({ success: true, id: docRef.id });
    } catch (err) {
      console.error("Error creating worker:", err);
      res.status(500).json({ success: false, message: "Fehler beim Erstellen des Mitarbeiters." });
    }
  });

  app.delete("/api/workers/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await deleteDoc(doc(firestore, "workers", id));
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting worker:", err);
      res.status(500).json({ success: false, message: "Fehler beim Löschen des Mitarbeiters." });
    }
  });

  app.get("/api/projects-simple", async (req, res) => {
    try {
      const snapshot = await getDocs(collection(firestore, "projects"));
      const projects = snapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
      res.json(projects);
    } catch (err) {
      console.error("Error fetching simple projects:", err);
      res.status(500).json({ success: false, message: "Fehler beim Laden der Projekte." });
    }
  });

  app.post("/api/projects/:id/items", async (req, res) => {
    const { id } = req.params;
    const { name, description, unit, quantity, length, width, height, depth, material_price_per_unit, labor_components, sketch_data, sort_order, special_attributes } = req.body;
    
    try {
      const batch = writeBatch(firestore);
      const itemRef = doc(collection(firestore, `projects/${id}/quote_items`));
      const itemId = itemRef.id;

      const itemData = {
        name,
        description: description || '',
        unit: unit || 'Stk',
        quantity: quantity || 1,
        length: length || null,
        width: width || null,
        height: height || null,
        depth: depth || null,
        material_price_per_unit: material_price_per_unit || 0,
        sketch_data: sketch_data || null,
        sort_order: sort_order || 0,
        special_attributes: special_attributes ? (typeof special_attributes === 'string' ? special_attributes : JSON.stringify(special_attributes)) : null,
        created_at: new Date().toISOString()
      };

      batch.set(itemRef, itemData);

      if (labor_components && Array.isArray(labor_components)) {
        for (const l of labor_components) {
          const laborRef = doc(collection(firestore, `projects/${id}/quote_items/${itemId}/labor`));
          batch.set(laborRef, {
            worker_type: l.worker_type || 'Geselle',
            hourly_rate: l.hourly_rate || 52,
            quantity: l.quantity || 1,
            time_value: l.time_value || 0,
            time_unit: l.time_unit || 'Hours'
          });
        }
      }

      await batch.commit();
      res.json({ success: true, id: itemId });
    } catch (err) {
      console.error("Error adding quote item:", err);
      res.status(500).json({ success: false, message: "Position konnte nicht hinzugefügt werden." });
    }
  });

  app.patch("/api/projects/:id/items/:itemId", async (req, res) => {
    const { id, itemId } = req.params;
    const { 
      name, quantity, length, width, height, depth, 
      labor_hours_per_unit, material_price_per_unit, 
      description, sketch_data, special_attributes, 
      labor_components, completion
    } = req.body;
    
    try {
      const batch = writeBatch(firestore);
      const itemRef = doc(firestore, `projects/${id}/quote_items`, itemId);

      const updateData: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updateData.name = name;
      if (quantity !== undefined) updateData.quantity = quantity;
      if (length !== undefined) updateData.length = length;
      if (width !== undefined) updateData.width = width;
      if (height !== undefined) updateData.height = height;
      if (depth !== undefined) updateData.depth = depth;
      if (labor_hours_per_unit !== undefined) updateData.labor_hours_per_unit = labor_hours_per_unit;
      if (material_price_per_unit !== undefined) updateData.material_price_per_unit = material_price_per_unit;
      if (description !== undefined) updateData.description = description;
      if (sketch_data !== undefined) updateData.sketch_data = sketch_data;
      if (special_attributes !== undefined) updateData.special_attributes = typeof special_attributes === 'string' ? special_attributes : JSON.stringify(special_attributes);
      if (completion !== undefined) updateData.completion = completion;

      batch.update(itemRef, updateData);

      if (labor_components && Array.isArray(labor_components)) {
        // Delete existing labor components first
        // Firestore doesn't support deleting a subcollection in a batch easily without knowing IDs
        // So we'll have to do it outside the batch or just use a separate process
        const laborSnapshot = await getDocs(collection(firestore, `projects/${id}/quote_items/${itemId}/labor`));
        for (const d of laborSnapshot.docs) {
          batch.delete(d.ref);
        }
        
        // Insert new
        for (const l of labor_components) {
          const laborRef = doc(collection(firestore, `projects/${id}/quote_items/${itemId}/labor`));
          batch.set(laborRef, {
            worker_type: l.worker_type || 'Geselle',
            hourly_rate: l.hourly_rate || 52,
            quantity: l.quantity || 1,
            time_value: l.time_value || 0,
            time_unit: l.time_unit || 'Hours'
          });
        }
      }

      await batch.commit();
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating quote item:", err);
      res.status(500).json({ success: false, message: "Position konnte nicht aktualisiert werden." });
    }
  });

  app.delete("/api/projects/:id/items/:itemId", async (req, res) => {
    const { id, itemId } = req.params;
    try {
      // Note: In a real app, you'd also delete subcollections
      await deleteDoc(doc(firestore, `projects/${id}/quote_items`, itemId));
      res.json({ success: true });
    } catch (err) {
      console.error("Error deleting quote item:", err);
      res.status(500).json({ success: false, message: "Position konnte nicht gelöscht werden." });
    }
  });

  app.post("/api/projects/:id/auto-calculate", async (req, res) => {
    const { id } = req.params;
    try {
      const itemsSnapshot = await getDocs(collection(firestore, `projects/${id}/quote_items`));
      const items = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      
      // Fetch all service items from all trades
      const tradesSnapshot = await getDocs(collection(firestore, "trades"));
      let catalog: any[] = [];
      for (const tradeDoc of tradesSnapshot.docs) {
        const serviceItemsSnapshot = await getDocs(collection(firestore, `trades/${tradeDoc.id}/service_items`));
        catalog = catalog.concat(serviceItemsSnapshot.docs.map(d => ({ ...d.data(), trade_id: tradeDoc.id })));
      }

      const batch = writeBatch(firestore);
      let matchedCount = 0;

      for (const item of items) {
        const match = catalog.find(c => c.name.toLowerCase() === item.name.toLowerCase());
        if (match) {
          const itemRef = doc(firestore, `projects/${id}/quote_items`, item.id);
          batch.update(itemRef, {
            labor_hours_per_unit: match.labor_hours || 0,
            material_price_per_unit: match.material_price || 0,
            description: item.description || match.description || '',
            trade_id: match.trade_id
          });
          matchedCount++;
        }
      }

      if (matchedCount > 0) {
        await batch.commit();
      }
      
      res.json({ success: true, matchedCount });
    } catch (err) {
      console.error("Auto-calculate error:", err);
      res.status(500).json({ success: false, message: "Automatische Kalkulation fehlgeschlagen." });
    }
  });

  app.get("/api/invoices/:id/export-zugferd", async (req, res) => {
    const { id } = req.params;
    try {
      const invoiceDoc = await getDoc(doc(firestore, "invoices", id));
      if (!invoiceDoc.exists()) return res.status(404).send("Rechnung nicht gefunden");
      const invoice = { id: invoiceDoc.id, ...invoiceDoc.data() } as any;
      
      const projectDoc = await getDoc(doc(firestore, "projects", invoice.project_id));
      if (!projectDoc.exists()) return res.status(404).send("Projekt nicht gefunden");
      const project = { id: projectDoc.id, ...projectDoc.data() } as any;

      const customerDoc = await getDoc(doc(firestore, "customers", project.customer_id));
      const customer = customerDoc.exists() ? { id: customerDoc.id, ...customerDoc.data() } as any : null;

      const itemsSnapshot = await getDocs(collection(firestore, `projects/${invoice.project_id}/quote_items`));
      const items = itemsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

      const settingsSnapshot = await getDocs(collection(firestore, "settings"));
      const settings = settingsSnapshot.docs.reduce((acc: any, d: any) => {
        acc[d.id] = d.data().value;
        return acc;
      }, {});

      // Simple ZUGFeRD-like XML structure (Simplified for demo)
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:zugferd.de:2p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${invoice.invoice_number}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${new Date(invoice.created_at).toISOString().split('T')[0].replace(/-/g, '')}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${settings.company_name || 'KI-Handwerker GmbH'}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${settings.company_address || ''}</ram:LineOne>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${settings.company_vat_id || ''}</ram:ID>
        </ram:SpecifiedTaxRegistration>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${customer?.name || project.customer_name}</ram:Name>
        <ram:PostalTradeAddress>
          <ram:LineOne>${customer?.address || project.customer_address}</ram:LineOne>
          <ram:CountryID>DE</ram:CountryID>
        </ram:PostalTradeAddress>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${new Date(invoice.created_at).toISOString().split('T')[0].replace(/-/g, '')}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>42</ram:TypeCode>
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${settings.company_iban || ''}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>
      </ram:SpecifiedTradeSettlementPaymentMeans>
      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${(invoice.amount * 0.19).toFixed(2)}</ram:CalculatedAmount>
        <ram:BasisAmount>${invoice.amount.toFixed(2)}</ram:BasisAmount>
        <ram:CategoryCode>S</ram:CategoryCode>
        <ram:RateApplicablePercent>19.00</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementMonetarySummation>
        <ram:LineTotalAmount>${invoice.amount.toFixed(2)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${invoice.amount.toFixed(2)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${(invoice.amount * 0.19).toFixed(2)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${(invoice.amount * 1.19).toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${(invoice.amount * 1.19).toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoice.invoice_number}.xml`);
      res.send(xml);
    } catch (err) {
      console.error("ZUGFeRD export error:", err);
      res.status(500).send("Fehler beim Export");
    }
  });

  // --- GAEB Import ---
  const memoryUpload = multer({ storage: multer.memoryStorage() });
  app.post("/api/projects/:id/import-gaeb", memoryUpload.single('file'), async (req, res) => {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: "Keine Datei hochgeladen." });

    try {
      const xmlContent = req.file.buffer.toString('utf-8');
      const parser = new Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(xmlContent);

      // Improved GAEB XML (.x83) parsing logic
      const gaeb = result.GAEB || result.gaeb;
      if (!gaeb) throw new Error("Ungültiges GAEB-Format");

      const items: any[] = [];
      
      // Recursive function to find BoQ items (Teilleistungen)
      const findItems = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        
        // Handle arrays
        if (Array.isArray(obj)) {
          obj.forEach(findItems);
          return;
        }

        // Check for Item (Teilleistung)
        if (obj.Item || obj.item) {
          const itemList = Array.isArray(obj.Item || obj.item) ? (obj.Item || obj.item) : [obj.Item || obj.item];
          itemList.forEach((item: any) => {
            const qty = parseFloat(item.Qty?.Amount || item.qty?.amount || item.Amount || item.amount || "1");
            const unit = item.Qty?.Unit || item.qty?.unit || item.Unit || item.unit || "Stk";
            const label = item.Description?.OutlineText || item.Description?.CompleteText?.DetailText?.TextOutl?.Text || item.Label || "Position";
            const longText = item.Description?.CompleteText?.DetailText?.TextOutl?.Text || "";

            items.push({
              name: label.substring(0, 100),
              description: longText,
              unit: unit,
              quantity: isNaN(qty) ? 1 : qty
            });
          });
        }

        // Recursively check all properties
        Object.values(obj).forEach(val => {
          if (typeof val === 'object') findItems(val);
        });
      };

      findItems(gaeb);

      // Insert items into Firestore
      const batch = writeBatch(firestore);
      for (const item of items) {
        const itemRef = doc(collection(firestore, `projects/${id}/quote_items`));
        batch.set(itemRef, {
          project_id: id,
          trade_id: "1", // Default trade
          name: item.name,
          description: item.description || "",
          unit: item.unit || "Stk",
          quantity: item.quantity || 1,
          labor_hours_per_unit: 0,
          material_price_per_unit: 0,
          sort_order: 0
        });
      }

      if (items.length > 0) {
        await batch.commit();
      }

      res.json({ success: true, count: items.length });
    } catch (err) {
      console.error("GAEB Import Error:", err);
      res.status(500).json({ success: false, message: "Fehler beim Verarbeiten der GAEB-Datei." });
    }
  });

  // Serve uploads statically
  app.use("/uploads", express.static(uploadDir));

  // --- Change Orders (Nachträge) ---
  app.get("/api/change-orders/all", async (req, res) => {
    try {
      const snapshot = await getDocs(collectionGroup(firestore, "change_orders"));
      const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      res.json(orders);
    } catch (err) {
      console.error("Error fetching all change orders:", err);
      res.status(500).json({ success: false, message: "Fehler beim Laden der Nachträge." });
    }
  });

  app.get("/api/projects/:id/export-gaeb", async (req, res) => {
    const { id } = req.params;
    try {
      const projectDoc = await getDoc(doc(firestore, "projects", id));
      if (!projectDoc.exists()) return res.status(404).send("Projekt nicht gefunden");
      const project = projectDoc.data();
      
      const itemsSnapshot = await getDocs(collection(firestore, `projects/${id}/quote_items`));
      const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const tradesSnapshot = await getDocs(collection(firestore, "trades"));
      const trades = tradesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().split(' ')[0];

      // GAEB DA XML 3.2 (.x84) structure
      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<GAEB xmlns="http://www.gaeb.de/GAEB_DA_XML/3.2">
  <GAEBInfo>
    <Version>3.2</Version>
    <Date>${dateStr}</Date>
    <Time>${timeStr}</Time>
    <ProgSystem>Los Facility Quote Builder</ProgSystem>
    <ProgVer>1.0</ProgVer>
  </GAEBInfo>
  <PrjInfo>
    <Name>${escapeXml(project.name)}</Name>
    <Cur>${project.currency || 'EUR'}</Cur>
  </PrjInfo>
  <Award>
    <BoQ>
      <BoQInfo>
        <Name>Angebot</Name>
        <Cur>${project.currency || 'EUR'}</Cur>
      </BoQInfo>
      <BoQBody>`;

      // Group items by trade
      const tradeGroups = trades.filter(t => items.some(i => (i as any).trade_id === t.id));
      
      // Handle items without trade
      const itemsWithoutTrade = items.filter(i => !(i as any).trade_id || !trades.some(t => t.id === (i as any).trade_id));
      
      const renderItems = async (itemList: any[]) => {
        let itemXml = '<Itemlist>';
        for (const item of itemList) {
          const laborSnapshot = await getDocs(collection(firestore, `projects/${id}/quote_items/${item.id}/labor`));
          const laborComponents = laborSnapshot.docs.map(doc => doc.data());
          let laborTotal = 0;
          
          if (laborComponents && laborComponents.length > 0) {
            laborComponents.forEach(comp => {
              let multiplier = 1;
              if (comp.time_unit === 'Tage') multiplier = 8;
              else if (comp.time_unit === 'Wochen') multiplier = 40;
              else if (comp.time_unit === 'Monate') multiplier = 160;
              laborTotal += comp.quantity * comp.time_value * multiplier * comp.hourly_rate;
            });
          } else {
            laborTotal = item.quantity * (item.labor_hours_per_unit || 0) * 52;
          }

          const materialTotal = item.quantity * (item.material_price_per_unit || 0);
          const totalPrice = laborTotal + materialTotal;
          const unitPrice = item.quantity > 0 ? totalPrice / item.quantity : 0;

          itemXml += `
            <Item ID="${item.id}">
              <Qty>${item.quantity.toFixed(3)}</Qty>
              <QU>${escapeXml(item.unit)}</QU>
              <Description>
                <CompleteText>
                  <DetailText>
                    <TextOutl>
                      <Text>${escapeXml(item.name)}</Text>
                    </TextOutl>
                    <TextOutl>
                      <Text>${escapeXml(item.description || '')}</Text>
                    </TextOutl>
                  </DetailText>
                </CompleteText>
              </Description>
              <UP>${unitPrice.toFixed(2)}</UP>
              <IT>${totalPrice.toFixed(2)}</IT>
            </Item>`;
        }
        itemXml += '</Itemlist>';
        return itemXml;
      };

      // Render Trade Groups
      for (const trade of tradeGroups as any[]) {
        const tradeItems = items.filter(i => (i as any).trade_id === trade.id);
        xml += `
        <BoQCtgy ID="T${trade.id}">
          <Lbl>${escapeXml(trade.name)}</Lbl>
          <BoQBody>
            ${await renderItems(tradeItems)}
          </BoQBody>
        </BoQCtgy>`;
      }

      // Render items without trade at the end
      if (itemsWithoutTrade.length > 0) {
        xml += `
        <BoQCtgy ID="T0">
          <Lbl>Sonstige Leistungen</Lbl>
          <BoQBody>
            ${await renderItems(itemsWithoutTrade)}
          </BoQBody>
        </BoQCtgy>`;
      }

      xml += `
      </BoQBody>
    </BoQ>
  </Award>
</GAEB>`;

      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename=project_${id}_export.x84`);
      res.send(xml);
    } catch (err) {
      console.error("GAEB export error:", err);
      res.status(500).send("Fehler beim GAEB-Export");
    }
  });

  // --- Global Error Handler for API ---
  app.use("/api", (err: any, req: any, res: any, next: any) => {
    console.error("API Error:", err);
    res.status(500).json({ 
      success: false, 
      message: "Ein interner Serverfehler ist aufgetreten.",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  });

  // --- Vite / Static Files ---
  console.log("Setting up Vite/Static files...");
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite in development mode...");
    try {
      const vitePromise = createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
        root: process.cwd(),
      });

      // Timeout after 20 seconds
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Vite initialization timed out")), 20000)
      );

      const vite = await Promise.race([vitePromise, timeoutPromise]) as any;
      app.use(vite.middlewares);
      console.log("Vite middleware attached.");
    } catch (viteError) {
      console.error("Vite initialization failed or timed out:", viteError);
      // Fallback: serve static files if Vite fails
      console.log("Falling back to static file serving...");
    }
  } else {
    console.log("Serving static files from dist...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Seed settings if they don't exist
  async function seedSettings() {
    try {
      const settingsSnapshot = await getDocs(collection(firestore, "settings"));
      if (settingsSnapshot.empty) {
        console.log("Seeding default settings to Firestore...");
        const defaultSettings = [
          { id: 'company_name', value: 'Handwerksmeister GmbH' },
          { id: 'company_address', value: 'Musterstraße 1, 12345 Musterstadt' },
          { id: 'tax_id', value: 'DE123456789' },
          { id: 'currency', value: 'EUR' },
          { id: 'default_tax_rate', value: '19.0' },
          { id: 'maintenance_mode', value: 'false' }
        ];
        for (const setting of defaultSettings) {
          await setDoc(doc(firestore, "settings", setting.id), { value: setting.value });
        }
      }
    } catch (err) {
      console.error("Error seeding settings:", err);
    }
  }
  seedSettings();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started and listening on http://0.0.0.0:${PORT}`);
  });
  } catch (error) {
    console.error("FATAL ERROR during server startup:", error);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();
