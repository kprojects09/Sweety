import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Configuration parsed from firebase-applet-config.json
const firebaseConfig = {
  projectId: "powerful-freehold-r4dh4",
  appId: "1:1086963064222:web:8a9e8f71d91cd6f7048a8f",
  apiKey: "AIzaSyDOrJjvP0Betob-uJq5iaoVnlmooIh3xoE",
  authDomain: "powerful-freehold-r4dh4.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-remixmahipersona-61ca28ca-38d4-44e1-bdf7-c5a2677efdba",
  storageBucket: "powerful-freehold-r4dh4.firebasestorage.app",
  messagingSenderId: "1086963064222"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
