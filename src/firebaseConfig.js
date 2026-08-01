import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// --- KONFIGURACJA FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCmfjCLK4zpMW95PQ5JnRosdFtwzRLcB80",
  authDomain: "aplikacje-lw.firebaseapp.com",
  projectId: "aplikacje-lw",
  storageBucket: "aplikacje-lw.appspot.com",
  messagingSenderId: "1091933939899",
  appId: "1:1091933939899:web:5b3c12c392b3e513ed855c",
  measurementId: "G-C5S0J6J0CR"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'turniej-orzel';

export { app, auth, db, appId };