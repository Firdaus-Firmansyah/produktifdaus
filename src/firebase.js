import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  projectId: "freelance-dashboard-e40ad",
  appId: "1:275641801590:web:0aabda3827f21c67d03857",
  storageBucket: "freelance-dashboard-e40ad.firebasestorage.app",
  apiKey: "AIzaSyD_rcobx1e0mbkwajNZbiTBvxxh9d9Co9E",
  authDomain: "freelance-dashboard-e40ad.firebaseapp.com",
  messagingSenderId: "275641801590",
  measurementId: "G-GMGWW6FE35",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore, Auth, and Storage
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
