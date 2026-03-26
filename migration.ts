import sqliteDb from './db.ts';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

async function migrate() {
  console.log("Starting migration from SQLite to Firestore (Content, Media, Settings)...");

  // 1. Migrate Content
  console.log("Migrating content...");
  const content = sqliteDb.prepare('SELECT * FROM content').all() as any[];
  let batch = writeBatch(firestore);
  let count = 0;
  for (const item of content) {
    batch.set(doc(firestore, 'content', item.key), { value: item.value });
    count++;
    if (count % 500 === 0) {
      await batch.commit();
      batch = writeBatch(firestore);
    }
  }
  await batch.commit();
  console.log(`Migrated ${count} content items.`);

  // 2. Migrate Media
  console.log("Migrating media...");
  const media = sqliteDb.prepare('SELECT * FROM media').all() as any[];
  batch = writeBatch(firestore);
  count = 0;
  for (const item of media) {
    const { id, ...data } = item;
    batch.set(doc(firestore, 'media', id.toString()), data);
    count++;
    if (count % 500 === 0) {
      await batch.commit();
      batch = writeBatch(firestore);
    }
  }
  await batch.commit();
  console.log(`Migrated ${count} media items.`);

  // 3. Migrate Trades
  console.log("Migrating trades...");
  const trades = sqliteDb.prepare('SELECT * FROM trades').all() as any[];
  for (const trade of trades) {
    const { id, ...tradeData } = trade;
    const tradeId = id.toString();
    await setDoc(doc(firestore, 'trades', tradeId), {
      ...tradeData,
      is_anlage_a: !!tradeData.is_anlage_a
    });

    // Subcollection: labor_rates
    const laborRates = sqliteDb.prepare('SELECT * FROM labor_rates WHERE trade_id = ?').all(id) as any[];
    batch = writeBatch(firestore);
    for (const rate of laborRates) {
      const { id: rateId, trade_id, ...rateData } = rate;
      batch.set(doc(firestore, `trades/${tradeId}/labor_rates`, rateId.toString()), rateData);
    }
    await batch.commit();

    // Subcollection: service_items
    const serviceItems = sqliteDb.prepare('SELECT * FROM service_items WHERE trade_id = ?').all(id) as any[];
    batch = writeBatch(firestore);
    count = 0;
    for (const item of serviceItems) {
      const { id: itemId, trade_id, ...itemData } = item;
      batch.set(doc(firestore, `trades/${tradeId}/service_items`, itemId.toString()), itemData);
      count++;
      if (count % 500 === 0) {
        await batch.commit();
        batch = writeBatch(firestore);
      }
    }
    await batch.commit();
    console.log(`Migrated trade ${tradeData.name} with ${serviceItems.length} items.`);
  }

  // 4. Migrate Settings
  console.log("Migrating settings...");
  const settings = sqliteDb.prepare('SELECT * FROM settings').all() as any[];
  batch = writeBatch(firestore);
  for (const item of settings) {
    batch.set(doc(firestore, 'settings', item.key), { value: item.value });
  }
  await batch.commit();
  console.log(`Migrated ${settings.length} settings.`);

  console.log("Migration complete (Content, Media, Settings)!");
  process.exit(0);
}

import { setDoc } from 'firebase/firestore';

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
