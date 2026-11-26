import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

/**
 * OAuth scopes configured for this AI Studio applet.
 * Must stay strictly aligned with provisioned Google Sheets scope.
 */
export const GOOGLE_SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// In-memory OAuth access token cache ONLY.
// NEVER persist OAuth access tokens to localStorage or sessionStorage.
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface GoogleAuthSession {
  user: User;
  accessToken: string;
}

/**
 * Subscribe to Firebase auth state changes.
 * Clears the in-memory token automatically on sign-out.
 */
export function initGoogleAuth(
  onReady: (user: User, accessToken: string) => void,
  onNeedsAuth: (signedInUserWithoutToken: User | null) => void
): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (isSigningIn) return;
    if (user && cachedAccessToken) {
      onReady(user, cachedAccessToken);
    } else if (user) {
      // User is remembered by Firebase Auth, but OAuth access token is only kept in memory
      onNeedsAuth(user);
    } else {
      cachedAccessToken = null;
      onNeedsAuth(null);
    }
  });
}

export class MissingSheetsScopeError extends Error {
  constructor(
    message = 'บัญชี Google ของท่านยังไม่ได้ติ๊กเครื่องหมายถูก (✓) อนุญาตสิทธิ์เข้าถึง Google Sheets ในหน้าต่างยืนยันสิทธิ์ของ Google'
  ) {
    super(message);
    this.name = 'MissingSheetsScopeError';
  }
}

async function hasGrantedSheetsScope(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) return true; // Defer to Sheets API if tokeninfo is unavailable
    const info = (await res.json()) as { scope?: string };
    if (!info.scope) return true;
    const granted = info.scope.split(/\s+/);
    return granted.includes('https://www.googleapis.com/auth/spreadsheets');
  } catch {
    return true;
  }
}

/**
 * Interactive Google Sign-In via Firebase popup requesting the Google Sheets scope.
 * Uses prompt='consent select_account' so Google always displays the Google Sheets permission checkbox.
 */
export async function googleSignIn(): Promise<GoogleAuthSession> {
  isSigningIn = true;
  try {
    const provider = new GoogleAuthProvider();
    GOOGLE_SHEETS_SCOPES.forEach((scope) => provider.addScope(scope));
    provider.setCustomParameters({
      prompt: 'consent select_account',
      include_granted_scopes: 'true',
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error('ไม่ได้รับสิทธิ์เข้าถึง Google Sheets จากบัญชี Google กรุณาลองเข้าสู่ระบบอีกครั้ง');
    }

    const scopeGranted = await hasGrantedSheetsScope(accessToken);
    if (!scopeGranted) {
      cachedAccessToken = null;
      throw new MissingSheetsScopeError();
    }

    cachedAccessToken = accessToken;
    return { user: result.user, accessToken };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      throw new Error('ยกเลิกการเข้าสู่ระบบด้วยบัญชี Google');
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตป๊อปอัปสำหรับเว็บไซต์นี้แล้วลองใหม่อีกครั้ง');
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('ไม่สามารถเข้าสู่ระบบด้วยบัญชี Google ได้ในขณะนี้');
  } finally {
    isSigningIn = false;
  }
}

export function getGoogleAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearCachedAccessToken(): void {
  cachedAccessToken = null;
}

export async function googleSignOut(): Promise<void> {
  cachedAccessToken = null;
  await signOut(auth);
}
