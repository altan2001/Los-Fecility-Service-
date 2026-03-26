import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

async function check() {
  const snapshot = await getDocs(collection(firestore, 'content'));
  console.log(`Content count: ${snapshot.size}`);
  process.exit(0);
}

check().catch(err => {
  console.error(err);
  process.exit(1);
});
