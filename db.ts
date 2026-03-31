import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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

export function initDb() {
  console.log("Firebase initialized. Migration to Firestore complete.");
}

export default firestore;
