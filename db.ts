import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, setDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));

const firebaseApp = initializeApp(firebaseConfig);
export const firestore = getFirestore(firebaseApp, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(firebaseApp);

export async function initDb() {
  console.log("Firebase initialized. Starting database seeding...");
  
  try {
    const defaultTrades = [
      {
        id: 'maler',
        name: 'Malerarbeiten',
        description: 'Anstrich, Tapezieren und Oberflächengestaltung',
        is_anlage_a: true,
        items: [
          {
            name: 'Wandanstrich Innen (weiß)',
            unit: 'm²',
            labor_hours: 0.25,
            material_price: 4.50,
            description: 'Standard Innenanstrich mit Dispersionsfarbe inkl. Abkleben',
            group: 'Anstricharbeiten'
          }
        ]
      },
      {
        id: 'bodenleger',
        name: 'Bodenleger',
        description: 'Verlegen von Parkett, Laminat, Vinyl und Teppich',
        is_anlage_a: false,
        items: [
          {
            name: 'Vinylboden verlegen',
            unit: 'm²',
            labor_hours: 0.50,
            material_price: 15.00,
            description: 'Verlegen von Klick-Vinyl inkl. Trittschalldämmung',
            group: 'Bodenbeläge'
          }
        ]
      },
      {
        id: 'fliesenleger',
        name: 'Fliesenleger',
        description: 'Verlegen von Wand- und Bodenfliesen',
        is_anlage_a: true,
        items: [
          {
            name: 'Wandfliesen verlegen (Standard)',
            unit: 'm²',
            labor_hours: 0.80,
            material_price: 25.00,
            description: 'Verlegen von Wandfliesen bis 30x60cm inkl. Verfugung',
            group: 'Fliesenarbeiten'
          }
        ]
      }
    ];

    for (const tradeData of defaultTrades) {
      const tradeRef = doc(firestore, "trades", tradeData.id);
      const tradeSnap = await getDoc(tradeRef);
      
      if (!tradeSnap.exists()) {
        console.log(`Seeding trade: ${tradeData.name}`);
        await setDoc(tradeRef, {
          name: tradeData.name,
          description: tradeData.description,
          is_anlage_a: tradeData.is_anlage_a,
          created_at: new Date().toISOString()
        });

        // Seed labor rates for this trade
        const laborRates = [
          { worker_type: 'Meister', hourly_rate: 65.00 },
          { worker_type: 'Geselle', hourly_rate: 52.00 },
          { worker_type: 'Helfer', hourly_rate: 38.00 }
        ];
        
        for (const rate of laborRates) {
          const rateRef = doc(collection(firestore, `trades/${tradeData.id}/labor_rates`));
          await setDoc(rateRef, rate);
        }

        // Seed service items for this trade
        for (const item of tradeData.items) {
          const itemRef = doc(collection(firestore, `trades/${tradeData.id}/service_items`));
          await setDoc(itemRef, {
            ...item,
            sort_order: 0,
            created_at: new Date().toISOString()
          });
        }
      }
    }

    console.log("Database seeding completed successfully.");

    // Seed a default project for the user
    const projectsRef = collection(firestore, "projects");
    const projectsSnap = await getDocs(query(projectsRef, limit(1)));
    
    if (projectsSnap.empty) {
      console.log("Seeding default project...");
      const projectRef = doc(projectsRef);
      await setDoc(projectRef, {
        name: 'Musterprojekt: Renovierung Wohnzimmer',
        customer_name: 'Max Mustermann',
        address: 'Musterstraße 1, 12345 Musterstadt',
        status: 'Angebot',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const positions = [
        {
          name: 'Wandanstrich Innen (weiß)',
          unit: 'm²',
          labor_hours: 0.25,
          material_price: 4.50,
          quantity: 45,
          tradeName: 'Malerarbeiten',
          worker_type: 'Geselle'
        },
        {
          name: 'Vinylboden verlegen',
          unit: 'm²',
          labor_hours: 0.50,
          material_price: 15.00,
          quantity: 25,
          tradeName: 'Bodenleger',
          worker_type: 'Geselle'
        },
        {
          name: 'Wandfliesen verlegen (Standard)',
          unit: 'm²',
          labor_hours: 0.80,
          material_price: 25.00,
          quantity: 12,
          tradeName: 'Fliesenleger',
          worker_type: 'Meister'
        }
      ];

      for (const pos of positions) {
        const posRef = doc(collection(firestore, `projects/${projectRef.id}/positions`));
        await setDoc(posRef, {
          ...pos,
          created_at: new Date().toISOString()
        });
      }
      console.log("Default project seeded.");
    }
  } catch (error) {
    console.error("Error during database seeding:", error);
  }
}

export default firestore;
