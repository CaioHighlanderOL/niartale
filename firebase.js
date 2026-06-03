import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  enableIndexedDbPersistence,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Central Firebase bootstrap. Keeping this file small makes it easy to swap
// environments later (dev/prod projects, emulator, or injected config).
const firebaseConfig = {
  apiKey: "AIzaSyBQQBCCErJCMa18Z8uKzhlg__ADHrtRiyw",
  authDomain: "niartale-rpg-core.firebaseapp.com",
  projectId: "niartale-rpg-core",
  storageBucket: "niartale-rpg-core.firebasestorage.app",
  messagingSenderId: "870037216952",
  appId: "1:870037216952:web:116c34ac189eb5cb8d5e4d",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);

// Firebase Auth already persists by default in most browsers, but setting it
// explicitly makes the requirement intentional and visible.
await setPersistence(auth, browserLocalPersistence);

// Firestore offline persistence is best-effort: it can fail in private windows
// or when another tab owns persistence. The app still works online if this fails.
export const offlinePersistencePromise = enableIndexedDbPersistence(firestore).catch((error) => {
  console.warn("Firestore offline persistence unavailable:", error.code);
  return null;
});

export {
  addDoc,
  collection,
  createUserWithEmailAndPassword,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onAuthStateChanged,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  signInWithEmailAndPassword,
  signOut,
  updateDoc,
  updateProfile,
  where,
  writeBatch,
};
