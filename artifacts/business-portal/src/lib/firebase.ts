import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env["VITE_FIREBASE_API_KEY"] ?? "AIzaSyDBKgHSM-f34RZZdzORAO0ADcBYhYEKojA",
  authDomain: import.meta.env["VITE_FIREBASE_AUTH_DOMAIN"] ?? "metapp-b4642.firebaseapp.com",
  projectId: import.meta.env["VITE_FIREBASE_PROJECT_ID"] ?? "metapp-b4642",
  storageBucket:
    import.meta.env["VITE_FIREBASE_STORAGE_BUCKET"] ?? "metapp-b4642.firebasestorage.app",
  messagingSenderId: import.meta.env["VITE_FIREBASE_MESSAGING_SENDER_ID"] ?? "572463722097",
  appId: import.meta.env["VITE_FIREBASE_APP_ID"] ?? "",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
