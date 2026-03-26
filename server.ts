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
import db, { initDb } from "./db";

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

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId);

async function startServer() {
  try {
    console.log("Starting server process...");
    
    // Initialize database first
    console.log("Calling initDb()...");
    initDb();
    console.log("initDb() finished.");

    const app = express();
    const PORT = 3000;

    console.log("Initializing middleware...");
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

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

  app.get("/api/customers/:id/logs", (req, res) => {
    const { id } = req.params;
    const logs = db.prepare('SELECT * FROM communication_logs WHERE customer_id = ? ORDER BY date DESC').all(id);
    res.json(logs);
  });

  app.post("/api/customers/:id/logs", (req, res) => {
    const { id } = req.params;
    const { type, content } = req.body;
    const result = db.prepare('INSERT INTO communication_logs (customer_id, type, content) VALUES (?, ?, ?)')
      .run(id, type, content);
    res.json({ success: true, id: result.lastInsertRowid });
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
    const { name, description, is_anlage_a } = req.body;
    try {
      const docRef = doc(collection(firestore, "trades"));
      await setDoc(docRef, { name, description, is_anlage_a: is_anlage_a || false });
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
    const { name, description, is_anlage_a } = req.body;
    try {
      await updateDoc(doc(firestore, "trades", id), { name, description, is_anlage_a: is_anlage_a || false });
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
      const rates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    const { trade_id, name, unit, labor_hours, material_price, description, sort_order } = req.body;
    try {
      const docRef = doc(collection(firestore, `trades/${trade_id}/service_items`));
      await setDoc(docRef, { name, unit, labor_hours, material_price, description, sort_order: sort_order || 0 });
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
          sort_order: item.sort_order || 0 
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
    const { trade_id, name, unit, labor_hours, material_price, description, sort_order } = req.body;
    try {
      await updateDoc(doc(firestore, `trades/${trade_id}/service_items`, id), { name, unit, labor_hours, material_price, description, sort_order });
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
        ratesSnapshot.docs.forEach(rateDoc => {
          allRates.push({
            id: rateDoc.id,
            trade_id: tradeDoc.id,
            trade_name: tradeDoc.data().name,
            ...rateDoc.data()
          });
        });
      }
      res.json(allRates);
    } catch (err) {
      res.status(500).json({ success: false, message: "Stundensätze konnten nicht geladen werden." });
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

  app.post("/api/trades/:id/import-csv", upload.single('file'), (req, res) => {
    const { id } = req.params;
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Keine Datei hochgeladen" });
    }

    const items: any[] = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => items.push(data))
      .on('end', () => {
        const insert = db.prepare('INSERT INTO service_items (trade_id, name, unit, labor_hours, material_price, description) VALUES (?, ?, ?, ?, ?, ?)');
        const transaction = db.transaction((items) => {
          for (const item of items) {
            insert.run(
              id, 
              item.name || item.Name || item.leistung || item.Leistung, 
              item.unit || item.Unit || item.einheit || item.Einheit || 'm²', 
              parseFloat(item.labor_hours || item.LaborHours || item.stunden || item.Stunden) || 0, 
              parseFloat(item.material_price || item.MaterialPrice || item.materialpreis || item.Materialpreis) || 0, 
              item.description || item.Description || item.beschreibung || item.Beschreibung || ''
            );
          }
        });

        try {
          transaction(items);
          // Clean up the uploaded file
          fs.unlinkSync(req.file!.path);
          res.json({ success: true });
        } catch (err) {
          console.error("CSV Import Error:", err);
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
  app.get("/api/projects/:id/diaries", (req, res) => {
    const { id } = req.params;
    try {
      const diaries = db.prepare('SELECT * FROM construction_diaries WHERE project_id = ? ORDER BY date DESC').all(id) as any[];
      const diariesWithPresence = diaries.map(diary => {
        const presence = db.prepare('SELECT * FROM diary_presence WHERE diary_id = ?').all(diary.id);
        const attachments = db.prepare('SELECT * FROM diary_attachments WHERE diary_id = ?').all(diary.id);
        return { ...diary, presence, attachments };
      });
      res.json(diariesWithPresence);
    } catch (err) {
      res.status(500).json({ success: false, message: "Bautagebuch konnte nicht geladen werden." });
    }
  });

  app.post("/api/projects/:id/diaries", (req, res) => {
    const { id } = req.params;
    const { date, weather, temperature, work_done, notes, presence } = req.body;
    try {
      const transaction = db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO construction_diaries (project_id, date, weather, temperature, work_done, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, date, weather, temperature, work_done, notes);
        
        const diaryId = result.lastInsertRowid;
        
        if (presence && Array.isArray(presence)) {
          const insertPresence = db.prepare('INSERT INTO diary_presence (diary_id, person_name, role, hours) VALUES (?, ?, ?, ?)');
          for (const p of presence) {
            insertPresence.run(diaryId, p.person_name, p.role, p.hours);
          }
        }
        return diaryId;
      });

      const diaryId = transaction();
      res.json({ success: true, id: diaryId });
    } catch (err) {
      res.status(500).json({ success: false, message: "Tagebucheintrag konnte nicht gespeichert werden." });
    }
  });

  app.get("/api/diaries/:id/attachments", (req, res) => {
    const { id } = req.params;
    const attachments = db.prepare('SELECT * FROM diary_attachments WHERE diary_id = ?').all(id);
    res.json(attachments);
  });

  app.post("/api/diaries/:id/attachments", upload.single('file'), (req, res) => {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: "Keine Datei hochgeladen." });

    const url = `/uploads/${req.file.filename}`;
    const result = db.prepare('INSERT INTO diary_attachments (diary_id, file_path, file_name, file_type) VALUES (?, ?, ?, ?)')
      .run(id, url, req.file.originalname, req.file.mimetype);
    
    res.json({ success: true, id: result.lastInsertRowid, url });
  });

  app.delete("/api/attachments/:id", (req, res) => {
    const { id } = req.params;
    const attachment = db.prepare('SELECT file_path FROM diary_attachments WHERE id = ?').get(id) as { file_path: string } | undefined;
    if (attachment) {
      const filePath = path.join(__dirname, attachment.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    db.prepare('DELETE FROM diary_attachments WHERE id = ?').run(id);
    res.json({ success: true });
  });

  // --- Change Orders ---
  app.get("/api/projects/:id/change-orders", (req, res) => {
    const { id } = req.params;
    const orders = db.prepare('SELECT * FROM change_orders WHERE project_id = ? ORDER BY created_at DESC').all(id);
    res.json(orders);
  });

  app.post("/api/projects/:id/change-orders", (req, res) => {
    const { id } = req.params;
    const { title, description, amount, status } = req.body;
    try {
      const result = db.prepare('INSERT INTO change_orders (project_id, title, description, amount, status) VALUES (?, ?, ?, ?, ?)')
        .run(id, title, description, amount, status || 'pending');
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ success: false, message: "Nachtrag konnte nicht erstellt werden." });
    }
  });

  app.put("/api/change-orders/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      db.prepare('UPDATE change_orders SET status = ? WHERE id = ?').run(status, id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Status konnte nicht aktualisiert werden." });
    }
  });

  // --- Invoices ---
  app.get("/api/invoices/all", (req, res) => {
    const invoices = db.prepare(`
      SELECT i.*, p.name as project_name 
      FROM invoices i 
      JOIN projects p ON i.project_id = p.id 
      ORDER BY i.created_at DESC
    `).all();
    res.json(invoices);
  });

  app.get("/api/projects/:id/invoices", (req, res) => {
    const { id } = req.params;
    const invoices = db.prepare('SELECT * FROM invoices WHERE project_id = ? ORDER BY created_at DESC').all(id);
    res.json(invoices);
  });

  app.post("/api/projects/:id/invoices", (req, res) => {
    const { id } = req.params;
    const { invoice_number, type, amount, status, due_date } = req.body;
    try {
      const result = db.prepare('INSERT INTO invoices (project_id, invoice_number, type, amount, status, due_date) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, invoice_number, type, amount, status || 'draft', due_date);
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ success: false, message: "Rechnung konnte nicht erstellt werden." });
    }
  });

  app.get("/api/invoices/:id/validate-einvoice", (req, res) => {
    const { id } = req.params;
    try {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
      if (!invoice) return res.status(404).json({ success: false, message: "Rechnung nicht gefunden." });
      
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(invoice.project_id) as any;
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(project.customer_id) as any;
      
      const errors = [];
      const warnings = [];
      
      if (!customer?.email) errors.push("Kunden-E-Mail fehlt.");
      if (!customer?.address) errors.push("Kunden-Adresse fehlt.");
      if (!invoice.due_date) errors.push("Zahlungsziel fehlt.");
      if (invoice.amount <= 0) errors.push("Rechnungsbetrag muss größer als 0 sein.");
      
      // Check for company settings
      const settings = db.prepare('SELECT * FROM settings').all().reduce((acc: any, item: any) => {
        acc[item.key] = item.value;
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
      res.status(500).json({ success: false, message: "Validierung fehlgeschlagen." });
    }
  });

  // --- User Roles Management ---

  app.get("/api/roles", (req, res) => {
    const roles = db.prepare('SELECT * FROM user_roles').all();
    res.json(roles.map((r: any) => ({ ...r, permissions: JSON.parse(r.permissions) })));
  });

  app.post("/api/roles", (req, res) => {
    const { name, permissions } = req.body;
    try {
      const result = db.prepare('INSERT INTO user_roles (name, permissions) VALUES (?, ?)')
        .run(name, JSON.stringify(permissions));
      res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
      res.status(500).json({ success: false, message: "Rolle konnte nicht erstellt werden." });
    }
  });

  app.put("/api/roles/:id", (req, res) => {
    const { id } = req.params;
    const { name, permissions } = req.body;
    try {
      db.prepare('UPDATE user_roles SET name = ?, permissions = ? WHERE id = ?')
        .run(name, JSON.stringify(permissions), id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Rolle konnte nicht aktualisiert werden." });
    }
  });

  app.delete("/api/roles/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM user_roles WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Rolle konnte nicht gelöscht werden." });
    }
  });

  // --- Subscription Management ---
  app.post("/api/create-checkout-session", async (req, res) => {
    if (!stripe) return res.status(500).json({ success: false, message: "Stripe ist nicht konfiguriert." });
    
    const { planId, userId } = req.body;
    const planPrices: any = {
      'pro': 'price_pro_id', // Replace with real Stripe Price IDs
      'enterprise': 'price_enterprise_id'
    };

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: planPrices[planId],
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${req.headers.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/pricing`,
        metadata: {
          userId,
          planId
        }
      });

      res.json({ success: true, sessionId: session.id, url: session.url });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get("/api/subscriptions/:userId", (req, res) => {
    const { userId } = req.params;
    const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(userId);
    res.json(sub || { plan_id: 'free', status: 'active' });
  });

  app.post("/api/webhook/stripe", express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).send("Webhook-Fehler");

    const sig = req.headers['stripe-signature'] as string;
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      return res.status(400).send(`Webhook-Fehler: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;
      
      if (userId && planId) {
        db.prepare(`
          INSERT OR REPLACE INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan_id, status, current_period_end)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          userId, 
          session.customer as string, 
          session.subscription as string, 
          planId, 
          'active', 
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Placeholder
        );
      }
    }

    res.json({ received: true });
  });

  app.get("/api/catalog", (req, res) => {
    try {
      const trades = db.prepare('SELECT * FROM trades').all() as any[];
      const catalog = trades.map(trade => {
        const items = db.prepare('SELECT * FROM service_items WHERE trade_id = ? ORDER BY sort_order ASC').all(trade.id);
        return { ...trade, items };
      });
      res.json(catalog);
    } catch (err) {
      res.status(500).json({ success: false, message: "Katalog konnte nicht geladen werden." });
    }
  });

  // --- Settings Management ---
  app.get("/api/settings", (req, res) => {
    try {
      const settings = db.prepare('SELECT * FROM settings').all().reduce((acc: any, item: any) => {
        acc[item.key] = item.value;
        return acc;
      }, {});
      res.json(settings);
    } catch (err) {
      res.status(500).json({ success: false, message: "Einstellungen konnten nicht geladen werden." });
    }
  });

  app.put("/api/settings", (req, res) => {
    const settings = req.body; // Object with key-value pairs
    try {
      const update = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
      const transaction = db.transaction((data) => {
        for (const [key, value] of Object.entries(data)) {
          update.run(key, String(value));
        }
      });
      transaction(settings);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Einstellungen konnten nicht gespeichert werden." });
    }
  });

  // --- User Profile & Auth ---
  app.get("/api/user/profile", (req, res) => {
    const { userId } = req.query; // For demo, we'll use query param
    if (!userId) return res.status(400).json({ success: false, message: "User ID required" });
    
    const user = db.prepare('SELECT * FROM users WHERE id = ? OR google_id = ?').get(userId, userId) as any;
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  });

  app.post("/api/user/profile", (req, res) => {
    const { userId, firstName, lastName, phone, address, email } = req.body;
    try {
      db.prepare(`
        UPDATE users 
        SET first_name = ?, last_name = ?, phone = ?, address = ?, email = ?
        WHERE id = ? OR google_id = ?
      `).run(firstName, lastName, phone, address, email, userId, userId);
      
      // Simulate SMS greeting
      console.log(`Sending SMS greeting to ${phone}: Willkommen bei Los Facility Service, ${firstName}!`);
      
      res.json({ success: true, message: "Profil erfolgreich aktualisiert!" });
    } catch (err) {
      res.status(500).json({ success: false, message: "Fehler beim Aktualisieren des Profils." });
    }
  });

  app.post("/api/auth/google-login", (req, res) => {
    try {
      const { googleId, email, name } = req.body;
      let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId) as any;
      
      if (!user) {
        // Create new user
        const result = db.prepare('INSERT INTO users (google_id, email, role, first_name) VALUES (?, ?, ?, ?)')
          .run(googleId, email, 'Kunde', name ? name.split(' ')[0] : 'User');
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
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
      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

      if (!user) {
        // We don't want to reveal if a user exists or not for security reasons
        return res.json({ success: true, message: "Wenn ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen des Passworts gesendet." });
      }

      const token = crypto.randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 3600000); // 1 hour from now

      db.prepare('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?')
        .run(token, expiry.toISOString(), user.id);

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
      const user = db.prepare('SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > ?')
        .get(token, new Date().toISOString()) as any;

      if (!user) {
        return res.status(400).json({ success: false, message: "Ungültiger oder abgelaufener Token." });
      }

      db.prepare('UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?')
        .run(newPassword, user.id);

      res.json({ success: true, message: "Passwort erfolgreich zurückgesetzt." });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ success: false, message: "Ein Fehler ist aufgetreten." });
    }
  });

  app.get("/api/user/offers-count", (req, res) => {
    const { userId } = req.query;
    const user = db.prepare('SELECT free_offers_used FROM users WHERE id = ? OR google_id = ?').get(userId, userId) as any;
    res.json({ success: true, count: user ? user.free_offers_used : 0 });
  });

  // --- Project & Quote Management ---

  app.get("/api/projects", (req, res) => {
    const projects = db.prepare(`
      SELECT p.*, c.name as customer_name_real 
      FROM projects p 
      LEFT JOIN customers c ON p.customer_id = c.id 
      ORDER BY p.created_at DESC
    `).all();
    res.json(projects);
  });

  app.post("/api/projects", (req, res) => {
    const { userId, name, customer_id, customer_name, customer_address, currency, tax_rate, craftsman_name, craftsman_contact, terms_and_conditions } = req.body;
    try {
      // Check if paid offers are enabled
      const paidEnabled = db.prepare('SELECT value FROM settings WHERE key = ?').get('paid_offers_enabled') as { value: string } | undefined;
      const isPaidEnabled = paidEnabled?.value === 'true';

      if (isPaidEnabled && userId) {
        // Check user's free offer usage and subscription
        const user = db.prepare('SELECT free_offers_used FROM users WHERE id = ? OR google_id = ?').get(userId, userId) as any;
        const sub = db.prepare('SELECT status FROM subscriptions WHERE user_id = ?').get(userId) as any;
        
        if (user && user.free_offers_used >= 1 && (!sub || sub.status !== 'active')) {
          return res.status(403).json({ 
            success: false, 
            message: "Kostenloses Kontingent erschöpft. Bitte Upgrade auf Pro durchführen.",
            limitReached: true
          });
        }
      }

      const result = db.prepare('INSERT INTO projects (name, customer_id, customer_name, customer_address, currency, tax_rate, craftsman_name, craftsman_contact, terms_and_conditions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(name, customer_id || null, customer_name || '', customer_address || '', currency || 'EUR', tax_rate || 19.0, craftsman_name || '', craftsman_contact || '', terms_and_conditions || '');
      
      const projectId = result.lastInsertRowid;

      // Increment free_offers_used if applicable
      if (userId) {
        db.prepare('UPDATE users SET free_offers_used = free_offers_used + 1 WHERE id = ? OR google_id = ?').run(userId, userId);
      }

      res.json({ success: true, id: projectId });
    } catch (err) {
      console.error("Project creation error:", err);
      res.status(500).json({ success: false, message: "Projekt konnte nicht erstellt werden." });
    }
  });

  app.get("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    if (project) {
      const items = db.prepare('SELECT * FROM quote_items WHERE project_id = ? ORDER BY sort_order ASC').all(id);
      
      let totalLaborHours = 0;
      let totalLaborCost = 0;
      let totalMaterialCost = 0;

      // For each item, get labor components and parse special_attributes
      const itemsWithLabor = items.map((item: any) => {
        const labor_components = db.prepare('SELECT * FROM quote_item_labor WHERE quote_item_id = ?').all(item.id) as any[];
        
        let itemLaborCost = 0;
        let itemLaborHours = 0;

        if (labor_components && labor_components.length > 0) {
          labor_components.forEach(comp => {
            let multiplier = 1;
            if (comp.time_unit === 'Tage') multiplier = 8;
            else if (comp.time_unit === 'Wochen') multiplier = 40;
            else if (comp.time_unit === 'Monate') multiplier = 160;

            const hours = comp.quantity * comp.time_value * multiplier;
            itemLaborHours += hours;
            itemLaborCost += hours * comp.hourly_rate;
          });
        } else {
          // Fallback
          const rates = db.prepare('SELECT hourly_rate FROM labor_rates WHERE trade_id = ? AND worker_type = ?').get(item.trade_id, 'Geselle') as { hourly_rate: number } | undefined;
          const rate = rates?.hourly_rate || 52;
          itemLaborHours = item.quantity * (item.labor_hours_per_unit || 0);
          itemLaborCost = itemLaborHours * rate;
        }

        totalLaborHours += itemLaborHours;
        totalLaborCost += itemLaborCost;
        totalMaterialCost += item.quantity * (item.material_price_per_unit || 0);

        let special_attributes = null;
        try {
          if (item.special_attributes) {
            special_attributes = JSON.parse(item.special_attributes);
          }
        } catch (e) {
          console.error("Error parsing special_attributes:", e);
        }
        return { ...item, labor_components, special_attributes, calculated_labor_hours: itemLaborHours, calculated_labor_cost: itemLaborCost };
      });

      res.json({ 
        ...project, 
        items: itemsWithLabor,
        totals: {
          labor_hours: totalLaborHours,
          labor_cost: totalLaborCost,
          material_cost: totalMaterialCost,
          net: totalLaborCost + totalMaterialCost,
          tax: (totalLaborCost + totalMaterialCost) * (project.tax_rate / 100),
          gross: (totalLaborCost + totalMaterialCost) * (1 + project.tax_rate / 100)
        }
      });
    } else {
      res.status(404).json({ success: false, message: "Projekt nicht gefunden." });
    }
  });

  app.put("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    const { name, customer_id, customer_name, customer_address, currency, tax_rate, status, craftsman_name, craftsman_contact, terms_and_conditions, site_setup_enabled, site_setup_price } = req.body;
    try {
      db.prepare(`
        UPDATE projects 
        SET name = COALESCE(?, name),
            customer_id = COALESCE(?, customer_id),
            customer_name = COALESCE(?, customer_name),
            customer_address = COALESCE(?, customer_address),
            currency = COALESCE(?, currency),
            tax_rate = COALESCE(?, tax_rate),
            status = COALESCE(?, status),
            craftsman_name = COALESCE(?, craftsman_name),
            craftsman_contact = COALESCE(?, craftsman_contact),
            terms_and_conditions = COALESCE(?, terms_and_conditions),
            site_setup_enabled = COALESCE(?, site_setup_enabled),
            site_setup_price = COALESCE(?, site_setup_price),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, customer_id, customer_name, customer_address, currency, tax_rate, status, craftsman_name, craftsman_contact, terms_and_conditions, site_setup_enabled, site_setup_price, id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Projekt konnte nicht aktualisiert werden." });
    }
  });

  app.delete("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Projekt konnte nicht gelöscht werden." });
    }
  });

  // Project Images
  app.get("/api/projects/:id/images", (req, res) => {
    const { id } = req.params;
    const images = db.prepare('SELECT * FROM project_images WHERE project_id = ? ORDER BY created_at DESC').all(id);
    res.json(images);
  });

  app.post("/api/projects/:id/images", upload.single('file'), (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "Keine Datei hochgeladen." });

    const url = `/uploads/${req.file.filename}`;
    const result = db.prepare('INSERT INTO project_images (project_id, url, title) VALUES (?, ?, ?)')
      .run(id, url, title || req.file.originalname);
    
    res.json({ success: true, id: result.lastInsertRowid, url });
  });

  app.delete("/api/projects/:id/images/:imageId", (req, res) => {
    const { imageId } = req.params;
    const image = db.prepare('SELECT url FROM project_images WHERE id = ?').get(imageId) as { url: string } | undefined;
    if (image) {
      const filePath = path.join(__dirname, image.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    db.prepare('DELETE FROM project_images WHERE id = ?').run(imageId);
    res.json({ success: true });
  });

  app.post("/api/projects/:id/items", (req, res) => {
    const { id } = req.params;
    const { name, description, unit, quantity, length, width, height, depth, material_price_per_unit, labor_components, sketch_data, sort_order, special_attributes } = req.body;
    
    try {
      const transaction = db.transaction(() => {
        const result = db.prepare(`
          INSERT INTO quote_items (project_id, name, description, unit, quantity, length, width, height, depth, material_price_per_unit, sketch_data, sort_order, special_attributes) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, name, description, unit, quantity || 1, length || null, width || null, height || null, depth || null, material_price_per_unit || 0, sketch_data || null, sort_order || 0, special_attributes ? JSON.stringify(special_attributes) : null);
        
        const itemId = result.lastInsertRowid;
        
        if (labor_components && Array.isArray(labor_components)) {
          const insertLabor = db.prepare(`
            INSERT INTO quote_item_labor (quote_item_id, worker_type, hourly_rate, quantity, time_value, time_unit) 
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const l of labor_components) {
            insertLabor.run(itemId, l.worker_type, l.hourly_rate, l.quantity || 1, l.time_value || 0, l.time_unit || 'Hours');
          }
        }
        return itemId;
      });

      const itemId = transaction();
      res.json({ success: true, id: itemId });
    } catch (err) {
      console.error("Error adding quote item:", err);
      res.status(500).json({ success: false, message: "Position konnte nicht hinzugefügt werden." });
    }
  });

  app.patch("/api/projects/:id/items/:itemId", (req, res) => {
    const { itemId } = req.params;
    const { 
      name, quantity, length, width, height, depth, 
      labor_hours_per_unit, material_price_per_unit, 
      description, sketch_data, special_attributes, 
      labor_components, completion
    } = req.body;
    
    try {
      const transaction = db.transaction(() => {
        // Update basic item info
        db.prepare(`
          UPDATE quote_items 
          SET name = COALESCE(?, name),
              quantity = COALESCE(?, quantity), 
              length = COALESCE(?, length),
              width = COALESCE(?, width),
              height = COALESCE(?, height),
              depth = COALESCE(?, depth),
              labor_hours_per_unit = COALESCE(?, labor_hours_per_unit), 
              material_price_per_unit = COALESCE(?, material_price_per_unit),
              description = COALESCE(?, description),
              sketch_data = COALESCE(?, sketch_data),
              special_attributes = COALESCE(?, special_attributes),
              completion = COALESCE(?, completion)
          WHERE id = ?
        `).run(
          name, quantity, length, width, height, depth, 
          labor_hours_per_unit, material_price_per_unit, 
          description, sketch_data, 
          special_attributes ? JSON.stringify(special_attributes) : null, 
          completion,
          itemId
        );

        // Update labor components if provided
        if (labor_components && Array.isArray(labor_components)) {
          // Delete existing
          db.prepare('DELETE FROM quote_item_labor WHERE quote_item_id = ?').run(itemId);
          
          // Insert new
          const insertLabor = db.prepare(`
            INSERT INTO quote_item_labor (quote_item_id, worker_type, hourly_rate, quantity, time_value, time_unit) 
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          for (const l of labor_components) {
            insertLabor.run(itemId, l.worker_type, l.hourly_rate, l.quantity || 1, l.time_value || 0, l.time_unit || 'Hours');
          }
        }
      });

      transaction();
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating quote item:", err);
      res.status(500).json({ success: false, message: "Position konnte nicht aktualisiert werden." });
    }
  });

  app.delete("/api/projects/:id/items/:itemId", (req, res) => {
    const { itemId } = req.params;
    try {
      db.prepare('DELETE FROM quote_items WHERE id = ?').run(itemId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Position konnte nicht gelöscht werden." });
    }
  });

  app.post("/api/projects/:id/auto-calculate", (req, res) => {
    const { id } = req.params;
    try {
      const items = db.prepare('SELECT * FROM quote_items WHERE project_id = ?').all(id) as any[];
      const catalog = db.prepare('SELECT * FROM service_items').all() as any[];

      const updates = [];
      for (const item of items) {
        const match = catalog.find(c => c.name.toLowerCase() === item.name.toLowerCase());
        if (match) {
          updates.push({
            id: item.id,
            labor: match.labor_hours_per_unit,
            material: match.material_price_per_unit,
            description: match.description
          });
        }
      }

      const updateStmt = db.prepare('UPDATE quote_items SET labor_hours_per_unit = ?, material_price_per_unit = ?, description = COALESCE(description, ?) WHERE id = ?');
      const transaction = db.transaction((data) => {
        for (const u of data) {
          updateStmt.run(u.labor, u.material, u.description, u.id);
        }
      });

      transaction(updates);
      res.json({ success: true, matchedCount: updates.length });
    } catch (err) {
      console.error("Auto-calculate error:", err);
      res.status(500).json({ success: false, message: "Automatische Kalkulation fehlgeschlagen." });
    }
  });

  app.get("/api/invoices/:id/export-zugferd", (req, res) => {
    const { id } = req.params;
    try {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
      if (!invoice) return res.status(404).send("Rechnung nicht gefunden");
      
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(invoice.project_id) as any;
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(project.customer_id) as any;
      const items = db.prepare('SELECT * FROM quote_items WHERE project_id = ?').all(invoice.project_id) as any[];
      const settings = db.prepare('SELECT * FROM settings').all().reduce((acc: any, item: any) => {
        acc[item.key] = item.value;
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

      // Insert items into database
      const insert = db.prepare(`
        INSERT INTO quote_items 
        (project_id, trade_id, name, description, unit, quantity, labor_hours_per_unit, material_price_per_unit) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((itemList) => {
        for (const item of itemList) {
          insert.run(id, 1, item.name, item.description, item.unit, item.quantity, 0, 0);
        }
      });

      transaction(items);

      res.json({ success: true, count: items.length });
    } catch (err) {
      console.error("GAEB Import Error:", err);
      res.status(500).json({ success: false, message: "Fehler beim Verarbeiten der GAEB-Datei." });
    }
  });

  // --- Construction Diaries ---
  app.get("/api/projects/:id/diaries", (req, res) => {
    const { id } = req.params;
    const diaries = db.prepare('SELECT * FROM construction_diaries WHERE project_id = ? ORDER BY date DESC').all(id);
    const diariesWithPresence = diaries.map((d: any) => {
      const presence = db.prepare('SELECT * FROM diary_presence WHERE diary_id = ?').all(d.id);
      return { ...d, presence };
    });
    res.json(diariesWithPresence);
  });

  app.post("/api/projects/:id/diaries", (req, res) => {
    const { id } = req.params;
    const { date, weather, temperature, work_done, notes, presence } = req.body;
    
    const transaction = db.transaction(() => {
      const result = db.prepare('INSERT INTO construction_diaries (project_id, date, weather, temperature, work_done, notes) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, date, weather, temperature, work_done, notes);
      const diaryId = result.lastInsertRowid;

      if (presence && Array.isArray(presence)) {
        const insertPresence = db.prepare('INSERT INTO diary_presence (diary_id, person_name, role, hours) VALUES (?, ?, ?, ?)');
        for (const p of presence) {
          insertPresence.run(diaryId, p.person_name, p.role, p.hours);
        }
      }
      return diaryId;
    });

    const diaryId = transaction();
    res.json({ success: true, id: diaryId });
  });

  app.get("/api/diaries/:id/attachments", (req, res) => {
    const { id } = req.params;
    const attachments = db.prepare('SELECT * FROM diary_attachments WHERE diary_id = ?').all(id);
    res.json(attachments);
  });

  app.post("/api/diaries/:id/attachments", upload.single('file'), (req, res) => {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ success: false, message: "Keine Datei hochgeladen." });

    const filePath = `/uploads/${req.file.filename}`;
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;

    const result = db.prepare('INSERT INTO diary_attachments (diary_id, file_path, file_name, file_type) VALUES (?, ?, ?, ?)')
      .run(id, filePath, fileName, fileType);

    res.json({ success: true, id: result.lastInsertRowid, filePath, fileName });
  });

  app.delete("/api/attachments/:id", (req, res) => {
    const { id } = req.params;
    const attachment = db.prepare('SELECT * FROM diary_attachments WHERE id = ?').get(id) as any;
    if (attachment) {
      const fullPath = path.join(__dirname, attachment.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
      db.prepare('DELETE FROM diary_attachments WHERE id = ?').run(id);
    }
    res.json({ success: true });
  });

  // Serve uploads statically
  app.use("/uploads", express.static(uploadDir));

  // --- Change Orders (Nachträge) ---
  app.get("/api/change-orders/all", (req, res) => {
    const orders = db.prepare('SELECT * FROM change_orders ORDER BY created_at DESC').all();
    res.json(orders);
  });

  app.get("/api/projects/:id/change-orders", (req, res) => {
    const { id } = req.params;
    const orders = db.prepare('SELECT * FROM change_orders WHERE project_id = ? ORDER BY created_at DESC').all(id);
    res.json(orders);
  });

  app.post("/api/projects/:id/change-orders", (req, res) => {
    const { id } = req.params;
    const { title, description, amount, status } = req.body;
    const result = db.prepare('INSERT INTO change_orders (project_id, title, description, amount, status) VALUES (?, ?, ?, ?, ?)')
      .run(id, title, description, amount || 0, status || 'pending');
    res.json({ success: true, id: result.lastInsertRowid });
  });

  app.put("/api/change-orders/:id/status", (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
      db.prepare('UPDATE change_orders SET status = ? WHERE id = ?').run(status, id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Status konnte nicht aktualisiert werden." });
    }
  });

  // --- Invoices ---
  app.get("/api/invoices/all", (req, res) => {
    const invoices = db.prepare(`
      SELECT i.*, p.name as project_name 
      FROM invoices i 
      JOIN projects p ON i.project_id = p.id 
      ORDER BY i.created_at DESC
    `).all();
    res.json(invoices);
  });

  app.get("/api/projects/:id/invoices", (req, res) => {
    const { id } = req.params;
    const invoices = db.prepare('SELECT * FROM invoices WHERE project_id = ? ORDER BY created_at DESC').all(id);
    res.json(invoices);
  });

  app.post("/api/projects/:id/invoices", (req, res) => {
    const { id } = req.params;
    const { invoice_number, type, amount, status, due_date } = req.body;
    const result = db.prepare('INSERT INTO invoices (project_id, invoice_number, type, amount, status, due_date) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, invoice_number, type, amount || 0, status || 'draft', due_date);
    res.json({ success: true, id: result.lastInsertRowid });
  });

  // --- Settings ---
  app.get("/api/settings", async (req, res) => {
    try {
      const snapshot = await getDocs(collection(firestore, "settings"));
      const settingsMap = snapshot.docs.reduce((acc: any, doc) => {
        acc[doc.id] = doc.data().value;
        return acc;
      }, {});
      res.json(settingsMap);
    } catch (err) {
      res.status(500).json({ success: false, message: "Einstellungen konnten nicht geladen werden." });
    }
  });

  app.post("/api/settings", async (req, res) => {
    const { settings } = req.body; // { key: value }
    try {
      const promises = Object.entries(settings).map(([key, value]) => 
        setDoc(doc(firestore, "settings", key), { value })
      );
      await Promise.all(promises);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, message: "Einstellungen konnten nicht gespeichert werden." });
    }
  });

  app.get("/api/invoices/:id/validate-einvoice", (req, res) => {
    const { id } = req.params;
    try {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
      if (!invoice) return res.status(404).json({ success: false, message: "Rechnung nicht gefunden" });

      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(invoice.project_id) as any;
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(project.customer_id) as any;
      const settings = db.prepare('SELECT * FROM settings').all().reduce((acc: any, item: any) => {
        acc[item.key] = item.value;
        return acc;
      }, {});

      const errors: string[] = [];
      const warnings: string[] = [];

      // Seller validation
      if (!settings.company_name) errors.push("Unternehmensname fehlt in den Einstellungen.");
      if (!settings.company_address) errors.push("Unternehmensadresse fehlt.");
      if (!settings.company_tax_id && !settings.company_vat_id) errors.push("Steuernummer oder USt-ID fehlt.");
      if (!settings.company_iban) errors.push("IBAN fehlt.");

      // Buyer validation
      if (!customer) {
        errors.push("Kein Kunde mit diesem Projekt verknüpft.");
      } else {
        if (!customer.name) errors.push("Kundenname fehlt.");
        if (!customer.address) errors.push("Kundenadresse fehlt.");
      }

      // Invoice validation
      if (!invoice.invoice_number) errors.push("Rechnungsnummer fehlt.");
      if (!invoice.due_date) warnings.push("Fälligkeitsdatum fehlt.");

      res.json({
        success: errors.length === 0,
        errors,
        warnings,
        isReady: errors.length === 0
      });
    } catch (err) {
      res.status(500).json({ success: false, message: "Validierung fehlgeschlagen" });
    }
  });

  app.get("/api/projects/:id/export-gaeb", (req, res) => {
    const { id } = req.params;
    try {
      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
      if (!project) return res.status(404).send("Projekt nicht gefunden");
      
      const items = db.prepare('SELECT * FROM quote_items WHERE project_id = ? ORDER BY sort_order ASC').all(id) as any[];
      const trades = db.prepare('SELECT * FROM trades').all() as any[];

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
      const tradeGroups = trades.filter(t => items.some(i => i.trade_id === t.id));
      
      // Handle items without trade
      const itemsWithoutTrade = items.filter(i => !i.trade_id || !trades.some(t => t.id === i.trade_id));
      
      const renderItems = (itemList: any[]) => {
        let itemXml = '<Itemlist>';
        itemList.forEach((item, index) => {
          const laborComponents = db.prepare('SELECT * FROM quote_item_labor WHERE quote_item_id = ?').all(item.id) as any[];
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
        });
        itemXml += '</Itemlist>';
        return itemXml;
      };

      // Render Trade Groups
      tradeGroups.forEach(trade => {
        const tradeItems = items.filter(i => i.trade_id === trade.id);
        xml += `
        <BoQCtgy ID="T${trade.id}">
          <Lbl>${escapeXml(trade.name)}</Lbl>
          <BoQBody>
            ${renderItems(tradeItems)}
          </BoQBody>
        </BoQCtgy>`;
      });

      // Render items without trade at the end
      if (itemsWithoutTrade.length > 0) {
        xml += `
        <BoQCtgy ID="T0">
          <Lbl>Sonstige Leistungen</Lbl>
          <BoQBody>
            ${renderItems(itemsWithoutTrade)}
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
