import { getApp, getApps, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  OAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  reauthenticateWithCredential,
  updatePassword,
  type Auth,
  type User,
} from "firebase/auth";

let authPromise: Promise<Auth> | undefined;

export function getMetAuth(): Promise<Auth> {
  if (!authPromise) {
    authPromise = (async () => {
      const response = await fetch("/api/venue-manager/firebase-config", { credentials: "include" });
      if (!response.ok) throw new Error("Met sign-in is temporarily unavailable. Please try again.");
      const config = await response.json() as { apiKey: string; authDomain: string; projectId: string };
      if (!config.apiKey || !config.authDomain || !config.projectId) throw new Error("Met sign-in is not configured yet.");
      return getAuth(getApps().length ? getApp() : initializeApp(config));
    })().catch((error: unknown) => { authPromise = undefined; throw error; });
  }
  return authPromise;
}

export async function metPasswordSignIn(email: string, password: string): Promise<User> {
  return (await signInWithEmailAndPassword(await getMetAuth(), email, password)).user;
}

export async function metPasswordCreate(email: string, password: string): Promise<User> {
  return (await createUserWithEmailAndPassword(await getMetAuth(), email, password)).user;
}

export async function metSendVerification(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function metRefreshVerification(user: User): Promise<boolean> {
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}

export async function metSocialSignIn(provider: "google" | "apple"): Promise<User> {
  const auth = await getMetAuth();
  return (await signInWithPopup(auth, provider === "google" ? new GoogleAuthProvider() : new OAuthProvider("apple.com"))).user;
}

export async function metResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(await getMetAuth(), email);
}

export async function metSignOut(): Promise<void> {
  const auth = await getMetAuth();
  await signOut(auth);
}

export async function metChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = (await getMetAuth()).currentUser;
  if (!user?.email) throw new Error("Sign in with your Met email and password to change your password.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
}

export function metAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Sign-in window closed. Please try again.";
  if (code === "auth/popup-blocked") return "Your browser blocked the sign-in window. Allow popups and try again.";
  if (code === "auth/operation-not-allowed") return "This sign-in method is not available for your Met account.";
  if (code === "auth/account-exists-with-different-credential") return "This email uses another Met sign-in method. Choose that method instead.";
  if (code === "auth/email-already-in-use") return "This email already has a Met account. Choose “I already have a Met account” below.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") return "Email or password not recognized. Try another Met sign-in method or reset your password.";
  if (code === "auth/weak-password") return "Choose a stronger password for your Met account.";
  if (code === "auth/unauthorized-domain") return "This domain is not authorized for Met sign-in. Contact support.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a moment and try again.";
  return error instanceof Error ? error.message : "Sign-in failed. Please try again.";
}