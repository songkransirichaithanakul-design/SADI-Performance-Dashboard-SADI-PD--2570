import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Cloud,
  ExternalLink,
  RefreshCw,
  FilePlus2,
  Link2,
  LogOut,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  UploadCloud,
  DownloadCloud,
  X,
  Sheet,
  Copy,
  Check,
  Globe,
} from 'lucide-react';
import type { Project } from '../types';
import {
  ImportParseResult,
  parseGoogleSheetValues,
  parseImportedWorkbookBuffer,
} from '../utils/spreadsheet';
import {
  initGoogleAuth,
  googleSignIn,
  googleSignOut,
  clearCachedAccessToken,
  getGoogleAccessToken,
  MissingSheetsScopeError,
  UnauthorizedDomainError,
} from '../services/googleAuth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  extractSpreadsheetId,
  fetchSpreadsheetMetadata,
  fetchSheetValues,
  createStandardSadiSpreadsheet,
  pushProjectsToGoogleSheet,
  pickPreferredSheetTitle,
  SpreadsheetMetadata,
  GoogleSheetsAuthError,
  GoogleSheetsScopeError,
  DEFAULT_DATA_SHEET_TITLE,
  DEFAULT_GUIDE_SHEET_TITLE,
} from '../services/googleSheets';

const SAVED_SHEET_URL_KEY = 'sadi_gsheet_url_v1';
const SAVED_SHEET_TAB_KEY = 'sadi_gsheet_tab_v1';
const DEFAULT_TEAM_SHEET_URL =
  'https://docs.google.com/spreadsheets/d/1HxtKq6XrT-W6ft6mZ4JtWjbz2OSsSxCXqnHG7EF4D54/edit?gid=1071563626';
const FIREBASE_AUTH_SETTINGS_URL = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

interface GoogleSheetsSyncPanelProps {
  projects: Project[];
  onParsedResult: (result: ImportParseResult) => void;
  onError: (message: string | null) => void;
}

type PendingMutationModal =
  | { type: 'create' }
  | {
      type: 'push';
      spreadsheetId: string;
      spreadsheetTitle: string;
      sheetTitle: string;
      projectCount: number;
    }
  | null;

const GoogleGIcon: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 5.04c1.94 0 3.51.68 4.75 1.81l3.51-3.51C18.12 1.38 15.32 0 12 0 7.31 0 3.25 2.69 1.28 6.6l4.08 3.17C6.35 6.86 8.95 5.04 12 5.04z"
    />
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.72 2.89c2.18-2.01 3.7-4.96 3.7-8.71z"
    />
    <path
      fill="#FBBC05"
      d="M5.36 14.23a7.17 7.17 0 0 1-.38-2.23c0-.77.14-1.52.38-2.23L1.28 6.6A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l4.08-3.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.72-2.89c-1.08.72-2.45 1.16-4.21 1.16-3.05 0-5.65-1.82-6.64-4.73l-4.08 3.17C3.25 21.31 7.31 24 12 24z"
    />
  </svg>
);

export const GoogleSheetsSyncPanel: React.FC<GoogleSheetsSyncPanelProps> = ({
  projects,
  onParsedResult,
  onError,
}) => {
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => getGoogleAccessToken());
  const [needsReauthUser, setNeedsReauthUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [sheetInput, setSheetInput] = useState<string>(() => {
    try {
      return localStorage.getItem(SAVED_SHEET_URL_KEY) || DEFAULT_TEAM_SHEET_URL;
    } catch {
      return DEFAULT_TEAM_SHEET_URL;
    }
  });
  const [metadata, setMetadata] = useState<SpreadsheetMetadata | null>(null);
  const [selectedSheetTitle, setSelectedSheetTitle] = useState<string>(() => {
    try {
      return localStorage.getItem(SAVED_SHEET_TAB_KEY) || '';
    } catch {
      return '';
    }
  });

  const [isLoadingMeta, setIsLoadingMeta] = useState(false);
  const [isPullingData, setIsPullingData] = useState(false);
  const [isPullingDirectLink, setIsPullingDirectLink] = useState(false);
  const [isMutatingSheet, setIsMutatingSheet] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [scopeMissingNotice, setScopeMissingNotice] = useState<boolean>(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [copiedSheetUrl, setCopiedSheetUrl] = useState(false);
  const [lastPulledAt, setLastPulledAt] = useState<string | null>(null);
  const [pendingModal, setPendingModal] = useState<PendingMutationModal>(null);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setNeedsReauthUser(null);
      },
      (signedInWithoutToken) => {
        setAccessToken(null);
        if (signedInWithoutToken) {
          setGoogleUser(signedInWithoutToken);
          setNeedsReauthUser(signedInWithoutToken);
        } else {
          setGoogleUser(null);
          setNeedsReauthUser(null);
        }
      }
    );
    return unsubscribe;
  }, []);

  const persistSheetPreference = (urlOrId: string, tabName?: string) => {
    try {
      if (urlOrId.trim()) {
        localStorage.setItem(SAVED_SHEET_URL_KEY, urlOrId.trim());
      }
      if (tabName) {
        localStorage.setItem(SAVED_SHEET_TAB_KEY, tabName);
      }
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleAuthExpired = (err: unknown) => {
    if (err instanceof GoogleSheetsScopeError || err instanceof MissingSheetsScopeError) {
      clearCachedAccessToken();
      setAccessToken(null);
      if (googleUser) setNeedsReauthUser(googleUser);
      setScopeMissingNotice(true);
      setLocalError(null);
      return true;
    }
    if (err instanceof GoogleSheetsAuthError) {
      clearCachedAccessToken();
      setAccessToken(null);
      if (googleUser) setNeedsReauthUser(googleUser);
      setScopeMissingNotice(false);
      setLocalError(err.message);
      return true;
    }
    return false;
  };

  const handleSignIn = async () => {
    setLocalError(null);
    setStatusMessage(null);
    setScopeMissingNotice(false);
    setUnauthorizedDomain(null);
    onError(null);
    setIsSigningIn(true);
    try {
      const session = await googleSignIn();
      setGoogleUser(session.user);
      setAccessToken(session.accessToken);
      setNeedsReauthUser(null);
      setScopeMissingNotice(false);
      setUnauthorizedDomain(null);
      setStatusMessage(
        `เชื่อมต่อบัญชี Google (${session.user.email || session.user.displayName || 'สำเร็จ'}) พร้อมสิทธิ์ใช้งาน Google Sheets แล้ว`
      );

      // Automatically inspect saved sheet URL if present
      const savedId = extractSpreadsheetId(sheetInput);
      if (savedId) {
        void loadMetadata(savedId, session.accessToken, true);
      }
    } catch (err) {
      if (err instanceof UnauthorizedDomainError) {
        setAccessToken(null);
        setUnauthorizedDomain(err.domain);
      } else if (err instanceof MissingSheetsScopeError) {
        setAccessToken(null);
        setScopeMissingNotice(true);
      } else {
        setLocalError(err instanceof Error ? err.message : 'ไม่สามารถเข้าสู่ระบบด้วยบัญชี Google ได้');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleCopyDomain = async () => {
    if (!unauthorizedDomain) return;
    try {
      await navigator.clipboard.writeText(unauthorizedDomain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2000);
    } catch {
      // Clipboard API may be unavailable in restricted contexts
    }
  };

  const handleCopySheetLink = async () => {
    const id = extractSpreadsheetId(sheetInput);
    const shareUrl = sheetInput.trim().startsWith('http')
      ? sheetInput.trim()
      : id
      ? `https://docs.google.com/spreadsheets/d/${id}/edit`
      : '';
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedSheetUrl(true);
      setTimeout(() => setCopiedSheetUrl(false), 2200);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handlePullFromDirectLink = async () => {
    setLocalError(null);
    setStatusMessage(null);
    onError(null);

    const spreadsheetId = extractSpreadsheetId(sheetInput);
    if (!spreadsheetId) {
      setLocalError(
        'รูปแบบลิงก์หรือรหัส Google Sheet ไม่ถูกต้อง กรุณาวางลิงก์เต็มจากแถบที่อยู่ (เช่น https://docs.google.com/spreadsheets/d/...)'
      );
      return;
    }

    const gidMatch = sheetInput.match(/[?&#]gid=(\d+)/);
    const gidParam = gidMatch?.[1];
    const sourceLabel = `Google Sheet (${spreadsheetId.slice(0, 8)}...)`;

    persistSheetPreference(sheetInput.trim());
    setIsPullingDirectLink(true);
    try {
      let parsed: ImportParseResult | null = null;
      let fallbackError: string | null = null;

      // Strategy 1: Direct browser CORS fetch from Google Visualization CSV export
      // Works on every environment (Dev URL, Shared App URL, Static Preview) with both Editor & Viewer links.
      try {
        const gvizUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${
          gidParam ? `&gid=${gidParam}` : ''
        }&_t=${Date.now()}`;
        const directResp = await fetch(gvizUrl, { method: 'GET', mode: 'cors', cache: 'no-store' });
        const contentType = (directResp.headers.get('content-type') || '').toLowerCase();
        if (directResp.ok && contentType.includes('text/csv')) {
          const csvBuffer = await directResp.arrayBuffer();
          const candidate = parseImportedWorkbookBuffer(csvBuffer, projects, sourceLabel);
          // Accept immediately if it parsed recognized project columns cleanly (or found real duplicate-code errors)
          const isUnrecognizedHeaderError =
            candidate.errors.length > 0 &&
            candidate.errors.some((e) => e.includes('โครงสร้างคอลัมน์ไม่ตรงตามมาตรฐาน'));
          if (!isUnrecognizedHeaderError) {
            parsed = candidate;
          }
        }
      } catch {
        // Silently fall through to server-side multi-tab XLSX pull
      }

      // Strategy 2: Server-side multi-tab XLSX pull fallback
      if (!parsed) {
        try {
          const response = await fetch('/api/sheets/pull-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spreadsheetId }),
          });

          const payload = (await response.json().catch(() => ({}))) as {
            base64?: string;
            fileName?: string;
            error?: string;
          };

          if (response.ok && payload.base64) {
            const binaryString = atob(payload.base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i += 1) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            parsed = parseImportedWorkbookBuffer(
              bytes.buffer,
              projects,
              payload.fileName || sourceLabel
            );
          } else if (payload.error) {
            fallbackError = payload.error;
          }
        } catch {
          // Ignore network error if server proxy is unavailable on static preview
        }
      }

      if (!parsed) {
        setLocalError(
          fallbackError ||
            'ไม่สามารถดึงข้อมูลจากลิงก์ Google Sheet ได้ กรุณาตรวจสอบว่าตั้งค่าแชร์เป็น "ทุกคนที่มีลิงก์" (ใช้ได้ทั้งสิทธิ์แก้ไขได้ และดูได้ ไม่ต้องลดสิทธิ์ทีมงาน) แล้วลองกดดึงข้อมูลอีกครั้ง'
        );
        return;
      }

      if (parsed.errors.length > 0) {
        setLocalError(parsed.errors.join(' '));
        onError(parsed.errors.join(' '));
      } else {
        onParsedResult(parsed);
        setLastPulledAt(
          new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        setStatusMessage(
          `ดึงข้อมูลล่าสุดจากลิงก์ Google Sheet (แท็บ: ${parsed.sheetName}) เรียบร้อยแล้ว — กรุณาตรวจสอบพรีวิวด้านล่างแล้วกดปุ่ม "ยืนยันส่งและแสดงผลข้อมูลทันที"`
        );
      }
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : 'เกิดข้อผิดพลาดระหว่างดึงข้อมูลจากลิงก์ Google Sheet กรุณาลองใหม่อีกครั้ง'
      );
    } finally {
      setIsPullingDirectLink(false);
    }
  };

  const handleSignOut = async () => {
    setLocalError(null);
    setStatusMessage(null);
    setScopeMissingNotice(false);
    setUnauthorizedDomain(null);
    await googleSignOut();
    setGoogleUser(null);
    setAccessToken(null);
    setNeedsReauthUser(null);
    setMetadata(null);
  };

  const loadMetadata = async (
    spreadsheetId: string,
    tokenOverride?: string,
    silent = false
  ): Promise<SpreadsheetMetadata | null> => {
    const token = tokenOverride || accessToken;
    if (!token) {
      setLocalError('กรุณาเข้าสู่ระบบด้วยบัญชี Google ก่อนเชื่อมต่อ Google Sheet');
      return null;
    }
    setIsLoadingMeta(true);
    if (!silent) {
      setLocalError(null);
      setStatusMessage(null);
    }
    try {
      const meta = await fetchSpreadsheetMetadata(spreadsheetId, token);
      setMetadata(meta);
      const chosenTab = pickPreferredSheetTitle(meta.sheets, selectedSheetTitle);
      setSelectedSheetTitle(chosenTab);
      persistSheetPreference(meta.spreadsheetUrl, chosenTab);
      if (!silent) {
        setStatusMessage(`เชื่อมต่อชีต "${meta.title}" สำเร็จ (พบ ${meta.sheets.length} แท็บงาน)`);
      }
      return meta;
    } catch (err) {
      if (!handleAuthExpired(err)) {
        setLocalError(err instanceof Error ? err.message : 'ไม่สามารถตรวจสอบ Google Sheet ได้');
      }
      return null;
    } finally {
      setIsLoadingMeta(false);
    }
  };

  const handleConnectInput = async () => {
    setLocalError(null);
    setStatusMessage(null);
    onError(null);

    const id = extractSpreadsheetId(sheetInput);
    if (!id) {
      setLocalError(
        'รูปแบบลิงก์หรือรหัส Google Sheet ไม่ถูกต้อง กรุณาวางลิงก์เต็มจากแถบที่อยู่ (เช่น https://docs.google.com/spreadsheets/d/...)'
      );
      return;
    }
    await loadMetadata(id);
  };

  const handlePullFromSheet = async () => {
    if (!accessToken) {
      setLocalError('กรุณาเข้าสู่ระบบด้วยบัญชี Google ก่อนดึงข้อมูล');
      return;
    }
    setLocalError(null);
    setStatusMessage(null);
    onError(null);

    let activeMeta = metadata;
    let activeTab = selectedSheetTitle;

    if (!activeMeta) {
      const id = extractSpreadsheetId(sheetInput);
      if (!id) {
        setLocalError('กรุณาวางลิงก์ Google Sheet หรือสร้าง Google Sheet มาตรฐานใหม่ก่อน');
        return;
      }
      activeMeta = await loadMetadata(id, accessToken, true);
      if (!activeMeta) return;
      activeTab = pickPreferredSheetTitle(activeMeta.sheets, selectedSheetTitle);
      setSelectedSheetTitle(activeTab);
    }

    if (!activeTab) {
      setLocalError('กรุณาเลือกแท็บชีตที่ต้องการดึงข้อมูล');
      return;
    }

    setIsPullingData(true);
    try {
      const values = await fetchSheetValues(activeMeta.spreadsheetId, activeTab, accessToken);
      const parsed = parseGoogleSheetValues(values, projects, activeMeta.title, activeTab);

      if (parsed.errors.length > 0) {
        setLocalError(parsed.errors.join(' '));
        onError(parsed.errors.join(' '));
      } else {
        onParsedResult(parsed);
        setLastPulledAt(
          new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        setStatusMessage(
          `ดึงข้อมูลล่าสุดจาก "${activeMeta.title}" (แท็บ: ${activeTab}) เรียบร้อยแล้ว — กรุณาตรวจสอบพรีวิวด้านล่างแล้วกดปุ่ม "ยืนยันส่งและแสดงผลข้อมูลทันที"`
        );
      }
    } catch (err) {
      if (!handleAuthExpired(err)) {
        const msg = err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลจาก Google Sheet ได้';
        setLocalError(msg);
      }
    } finally {
      setIsPullingData(false);
    }
  };

  const executeConfirmedMutation = async () => {
    if (!pendingModal || !accessToken) return;
    setIsMutatingSheet(true);
    setLocalError(null);
    setStatusMessage(null);

    try {
      if (pendingModal.type === 'create') {
        const createdMeta = await createStandardSadiSpreadsheet(projects, accessToken);
        setMetadata(createdMeta);
        setSheetInput(createdMeta.spreadsheetUrl);
        setSelectedSheetTitle(DEFAULT_DATA_SHEET_TITLE);
        persistSheetPreference(createdMeta.spreadsheetUrl, DEFAULT_DATA_SHEET_TITLE);
        setStatusMessage(
          `สร้าง Google Sheet มาตรฐานใหม่ "${createdMeta.title}" สำเร็จ (บรรจุครบ ${projects.length} โครงการ + แท็บคำแนะนำ) ท่านสามารถเปิดชีตและแชร์ให้เจ้าหน้าที่ร่วมกรอกได้ทันที`
        );
      } else if (pendingModal.type === 'push') {
        const result = await pushProjectsToGoogleSheet(
          pendingModal.spreadsheetId,
          pendingModal.sheetTitle,
          projects,
          accessToken
        );
        setStatusMessage(
          `อัปเดตข้อมูลล่าสุดจากระบบ (${result.updatedRows} โครงการ) ลงใน "${pendingModal.spreadsheetTitle}" (แท็บ: ${pendingModal.sheetTitle}) เรียบร้อยแล้ว`
        );
      }
      setPendingModal(null);
    } catch (err) {
      setPendingModal(null);
      if (!handleAuthExpired(err)) {
        setLocalError(
          err instanceof Error ? err.message : 'ไม่สามารถดำเนินการเขียนข้อมูลลง Google Sheets ได้'
        );
      }
    } finally {
      setIsMutatingSheet(false);
    }
  };

  const isAuthenticated = Boolean(googleUser && accessToken);
  const activeSheetId = extractSpreadsheetId(sheetInput);
  const safeOpenSheetUrl = activeSheetId
    ? `https://docs.google.com/spreadsheets/d/${activeSheetId}/edit`
    : null;

  return (
    <div className="space-y-4">
      {/* 3-Step Collaborative Online Sheet Flow */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
        <div className="bg-[#060D1A] border border-cyan-950 rounded-xl p-3.5 flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono font-bold flex items-center justify-center shrink-0">
            1
          </span>
          <div>
            <div className="font-semibold text-white">แชร์ลิงก์ Google Sheet ให้ทีมงานกรอก</div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ส่งลิงก์ Google Sheet ให้เจ้าหน้าที่ช่วยกันกรอก/แก้ไขความก้าวหน้า งบใช้จ่ายจริง และเพิ่มโครงการใหม่พร้อมกันได้
            </p>
          </div>
        </div>
        <div className="bg-[#060D1A] border border-cyan-950 rounded-xl p-3.5 flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono font-bold flex items-center justify-center shrink-0">
            2
          </span>
          <div>
            <div className="font-semibold text-white">กดดึงข้อมูลล่าสุดจากลิงก์ทันที</div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              วางลิงก์แล้วกดดึงข้อมูลได้ทันทีโดยไม่ต้องล็อกอิน Google (ระบบข้ามแถวว่าง "(เพิ่มชื่อโครงการใหม่)" ให้อัตโนมัติ)
            </p>
          </div>
        </div>
        <div className="bg-[#060D1A] border border-cyan-950 rounded-xl p-3.5 flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 font-mono font-bold flex items-center justify-center shrink-0">
            3
          </span>
          <div>
            <div className="font-semibold text-white">ตรวจสอบพรีวิว & ยืนยันแสดงผล</div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              ตรวจสอบรายการที่เปลี่ยนแปลงด้านล่าง แล้วกด "ยืนยันส่งและแสดงผลข้อมูลทันที" เพื่ออัปเดตหน้าแดชบอร์ด
            </p>
          </div>
        </div>
      </div>

      {/* PRIMARY: Direct Google Sheet Link Sync (Always Available — No Firebase Auth Required) */}
      <div className="rounded-xl p-4 sm:p-5 bg-[#060D1A] border-2 border-cyan-600/60 shadow-[0_0_24px_rgba(6,182,212,0.12)] space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0 mt-0.5">
              <Globe className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-xs sm:text-sm text-white flex flex-wrap items-center gap-2">
                <span>ดึงข้อมูลจากลิงก์ Google Sheet ร่วมกรอกโดยตรง (แนะนำ)</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                  พร้อมใช้งานทันที · ไม่ต้องล็อกอิน Google
                </span>
                {lastPulledAt && (
                  <span className="text-[11px] font-mono text-cyan-300">· ดึงล่าสุด {lastPulledAt} น.</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                ใช้ได้ทันทีกับชีตที่ตั้งค่าแชร์แบบ <strong className="text-slate-200">"ทุกคนที่มีลิงก์ (แก้ไขได้ / Editor)"</strong> โดย<strong className="text-emerald-300">ไม่ต้องลดสิทธิ์ของทีมงาน</strong> กดปุ่มสีฟ้าด้านล่างเพื่อดึงข้อมูลล่าสุดมาตรวจสอบและอัปเดตแดชบอร์ด
              </p>
            </div>
          </div>

          {safeOpenSheetUrl && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handleCopySheetLink()}
                className="px-3 py-2 rounded-xl border border-cyan-800/70 bg-[#091224] hover:bg-[#0D1C38] text-cyan-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedSheetUrl ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300">คัดลอกลิงก์แล้ว</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    <span>คัดลอกลิงก์ส่งทีมงาน</span>
                  </>
                )}
              </button>
              <a
                href={safeOpenSheetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-xl border border-emerald-600/60 bg-emerald-950/35 hover:bg-emerald-900/45 text-emerald-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                <span>เปิด Google Sheet</span>
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
            <input
              type="text"
              value={sheetInput}
              onChange={(e) => {
                setSheetInput(e.target.value);
                if (metadata && extractSpreadsheetId(e.target.value) !== metadata.spreadsheetId) {
                  setMetadata(null);
                }
              }}
              placeholder="วางลิงก์ Google Sheet เช่น https://docs.google.com/spreadsheets/d/..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-cyan-800/70 bg-[#091224] text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-400"
            />
          </div>
          <button
            type="button"
            disabled={isPullingDirectLink || !sheetInput.trim()}
            onClick={() => void handlePullFromDirectLink()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-extrabold text-xs inline-flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.28)] cursor-pointer transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {isPullingDirectLink ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <DownloadCloud className="w-4 h-4" />
            )}
            <span>
              {isPullingDirectLink
                ? 'กำลังดึงและตรวจสอบข้อมูล...'
                : 'ดึงข้อมูลล่าสุดจากลิงก์มาอัปเดตทันที'}
            </span>
          </button>
        </div>
      </div>

      {/* OPTIONAL: Google OAuth Workspace (for Private Sheets / Create New Sheet / Push Back to Sheet) */}
      {!isAuthenticated ? (
        <div className="rounded-xl p-4 sm:p-5 bg-[#060D1A]/80 border border-cyan-950 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="font-bold text-xs sm:text-sm text-slate-200">
                {needsReauthUser
                  ? `ยืนยันสิทธิ์เชื่อมต่อบัญชี Google (${needsReauthUser.email || needsReauthUser.displayName})`
                  : 'โหมดเพิ่มเติม: เชื่อมต่อบัญชี Google (สำหรับชีตแบบส่วนตัว / สร้างชีตใหม่ / ส่งข้อมูลกลับลงชีต)'}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {needsReauthUser
                  ? 'ระบบเก็บสิทธิ์ไว้ในหน่วยความจำชั่วคราวเท่านั้น กดปุ่มด้านขวาเพื่อเปิดใช้งานโหมดชีตส่วนตัวและเขียนกลับลงชีต'
                  : 'ไม่จำเป็นต้องล็อกอินหากใช้ช่อง "ดึงข้อมูลจากลิงก์ Google Sheet ร่วมกรอกโดยตรง" ด้านบนแล้ว'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isSigningIn}
              onClick={() => void handleSignIn()}
              className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-xs inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              {isSigningIn ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <GoogleGIcon />}
              <span>{isSigningIn ? 'กำลังเชื่อมต่อบัญชี Google...' : 'Sign in with Google · เชื่อมต่อ Google Sheets'}</span>
            </button>
            {needsReauthUser && (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="px-3 py-2 rounded-lg bg-[#091224] border border-cyan-900/60 text-slate-300 hover:text-white text-xs font-medium cursor-pointer"
              >
                เปลี่ยนบัญชี
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-4 sm:p-5 bg-[#060D1A] border border-emerald-700/50 space-y-4">
          {/* Connected Google Account Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-cyan-950">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
                {(googleUser?.displayName || googleUser?.email || 'G').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-white truncate">
                    {googleUser?.displayName || 'บัญชี Google'}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                    เชื่อมต่อ Google Sheets แล้ว
                  </span>
                </div>
                {googleUser?.email && (
                  <div className="text-[11px] text-slate-400 truncate font-mono">{googleUser.email}</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isMutatingSheet}
                onClick={() => setPendingModal({ type: 'create' })}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-500/60 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
              >
                <FilePlus2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>สร้าง Google Sheet มาตรฐานใหม่ (16 คอลัมน์)</span>
              </button>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-slate-700 bg-[#091224] hover:bg-slate-800 text-slate-300 hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-400" />
                <span>ออกจากบัญชี Google</span>
              </button>
            </div>
          </div>

          {/* Connect Existing Spreadsheet URL / ID Input */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-cyan-200">
              ลิงก์ Google Sheet (URL) หรือรหัส Spreadsheet ID สำหรับร่วมกรอกข้อมูล
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
                <input
                  type="text"
                  value={sheetInput}
                  onChange={(e) => {
                    setSheetInput(e.target.value);
                    if (metadata && extractSpreadsheetId(e.target.value) !== metadata.spreadsheetId) {
                      setMetadata(null);
                    }
                  }}
                  placeholder="วางลิงก์ https://docs.google.com/spreadsheets/d/... หรือกดปุ่มสร้างชีตใหม่ด้านบน"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-cyan-900/70 bg-[#091224] text-white text-xs placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-400"
                />
              </div>
              <button
                type="button"
                disabled={isLoadingMeta || !sheetInput.trim()}
                onClick={() => void handleConnectInput()}
                className="px-4 py-2.5 rounded-xl border border-cyan-700/70 bg-[#0B1B38] hover:bg-[#10264E] text-cyan-200 hover:text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isLoadingMeta ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                )}
                <span>ตรวจสอบและโหลดแท็บชีต</span>
              </button>
            </div>
          </div>

          {/* Discovered Sheet Metadata + Tab Selector + Pull / Push Actions */}
          {metadata && (
            <div className="p-4 rounded-xl bg-[#091224] border border-cyan-800/60 space-y-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                    <Sheet className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-white truncate">
                      {metadata.title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                      <span>พบ {metadata.sheets.length} แท็บงาน</span>
                      {lastPulledAt && (
                        <span className="text-emerald-300 font-mono">· ดึงล่าสุดเวลา {lastPulledAt} น.</span>
                      )}
                    </div>
                  </div>
                </div>

                <a
                  href={metadata.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl border border-cyan-800/70 bg-[#060D1A] hover:bg-[#0B1A34] text-cyan-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0 self-start lg:self-auto"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                  <span>เปิด Google Sheet (แชร์ / แก้ไขออนไลน์)</span>
                </a>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 pt-2 border-t border-cyan-950">
                <div className="w-full lg:w-72">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    เลือกแท็บชีต (Sheet Tab) ที่เก็บตารางโครงการ
                  </label>
                  <select
                    value={selectedSheetTitle}
                    onChange={(e) => {
                      setSelectedSheetTitle(e.target.value);
                      persistSheetPreference(metadata.spreadsheetUrl, e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-cyan-900/70 bg-[#060D1A] text-white text-xs font-medium focus:outline-hidden focus:border-cyan-400 cursor-pointer"
                  >
                    {metadata.sheets.map((tab) => (
                      <option key={tab.sheetId} value={tab.title}>
                        {tab.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={isMutatingSheet || isPullingData || !selectedSheetTitle}
                    onClick={() =>
                      setPendingModal({
                        type: 'push',
                        spreadsheetId: metadata.spreadsheetId,
                        spreadsheetTitle: metadata.title,
                        sheetTitle: selectedSheetTitle,
                        projectCount: projects.length,
                      })
                    }
                    className="px-3.5 py-2.5 rounded-xl border border-amber-600/60 bg-amber-950/30 hover:bg-amber-900/40 text-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                    <span>ส่งข้อมูลจากระบบกลับลงชีตนี้</span>
                  </button>

                  <button
                    type="button"
                    disabled={isPullingData || isMutatingSheet || !selectedSheetTitle}
                    onClick={() => void handlePullFromSheet()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-extrabold text-xs inline-flex items-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.28)] cursor-pointer transition-all disabled:opacity-50"
                  >
                    {isPullingData ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <DownloadCloud className="w-4 h-4" />
                    )}
                    <span>
                      {isPullingData
                        ? 'กำลังดึงและตรวจสอบข้อมูล...'
                        : 'ดึงข้อมูลล่าสุดจาก Google Sheet มาตรวจสอบ'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick pull CTA when user pasted a link but hasn't clicked inspect yet */}
          {!metadata && sheetInput.trim() && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#091224] border border-cyan-950 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>กดปุ่ม "ตรวจสอบและโหลดแท็บชีต" เพื่ออ่านรายชื่อแท็บงานในไฟล์ Google Sheet นี้</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unauthorized Domain Guided Fix Card */}
      {unauthorizedDomain && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/70 text-amber-100 text-xs space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <div className="font-bold text-amber-200">
                  โดเมนนี้ยังไม่ได้เพิ่มในรายการอนุญาตของ Firebase (auth/unauthorized-domain)
                </div>
                <p className="text-[11px] text-amber-100/90 leading-relaxed">
                  ท่านสามารถใช้งานได้ทันที 2 วิธี:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-amber-100/90 text-[11px]">
                  <li>
                    <strong className="text-cyan-300">วิธีด่วน (ไม่ต้องตั้งค่า):</strong> วางลิงก์ Google Sheet ในช่อง{' '}
                    <strong className="text-white">"ดึงข้อมูลจากลิงก์ Google Sheet โดยตรง"</strong> ด้านบน แล้วกดดึงข้อมูลได้ทันที
                  </li>
                  <li>
                    <strong className="text-white">วิธีเปิดใช้ Google Login ถาวรบนโดเมนนี้:</strong> คัดลอกชื่อโดเมนด้านล่าง แล้วนำไปกด{' '}
                    <strong className="text-white">Add domain</strong> ที่ Firebase Console → Authentication → Settings → Authorized domains
                  </li>
                </ol>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setUnauthorizedDomain(null)}
              className="text-amber-400 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="pl-6 flex flex-wrap items-center gap-2">
            <code className="px-2.5 py-1.5 rounded-lg bg-[#060D1A] border border-amber-700/70 text-amber-200 font-mono text-[11px] break-all">
              {unauthorizedDomain}
            </code>
            <button
              type="button"
              onClick={() => void handleCopyDomain()}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-100 font-semibold text-[11px] inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copiedDomain ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>คัดลอกโดเมนแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>คัดลอกโดเมน</span>
                </>
              )}
            </button>
            <a
              href={FIREBASE_AUTH_SETTINGS_URL}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-900 font-bold text-[11px] inline-flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
              <span>เปิดหน้า Firebase Authorized Domains</span>
            </a>
          </div>
        </div>
      )}

      {/* Missing Scope Guided Fix Card */}
      {scopeMissingNotice && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-600/70 text-amber-100 text-xs space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <div className="font-bold text-amber-200">
                  ยังไม่ได้อนุญาตสิทธิ์เข้าถึง Google Sheets (กรุณาติ๊กเครื่องหมายถูกในหน้าต่าง Google)
                </div>
                <ol className="list-decimal list-inside space-y-1 text-amber-100/90 text-[11px]">
                  <li>กดปุ่ม <strong className="text-white">"อนุญาตสิทธิ์ Google Sheets ใหม่"</strong> ด้านล่าง แล้วเลือกบัญชี Google ของท่าน</li>
                  <li>
                    ในหน้าต่างขออนุญาตของ Google ให้ <strong className="text-emerald-300">ติ๊กเครื่องหมายถูก (✓)</strong> หน้าช่อง{' '}
                    <span className="px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700 text-white font-semibold">
                      ดู แก้ไข สร้าง และลบสเปรดชีตทั้งหมดใน Google ชีต
                    </span>
                  </li>
                  <li>กดปุ่ม <strong className="text-white">"ดำเนินการต่อ" (Continue)</strong> จากนั้นจะสามารถสร้างและเชื่อมชีตได้ทันที</li>
                </ol>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setScopeMissingNotice(false)}
              className="text-amber-400 hover:text-white cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="pl-6">
            <button
              type="button"
              disabled={isSigningIn}
              onClick={() => void handleSignIn()}
              className="px-4 py-2 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-bold text-xs inline-flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
            >
              {isSigningIn ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <GoogleGIcon />}
              <span>อนุญาตสิทธิ์ Google Sheets ใหม่</span>
            </button>
          </div>
        </div>
      )}

      {/* Local Error Message */}
      {localError && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{localError}</span>
          </div>
          <button
            type="button"
            onClick={() => setLocalError(null)}
            className="text-rose-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Local Status Feedback */}
      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/35 border border-emerald-700/70 text-emerald-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-emerald-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mandatory Explicit User Confirmation Modal before Mutating/Creating Google Sheets */}
      {pendingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-[#091224] border border-cyan-700/70 shadow-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-cyan-950 pb-3.5">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    pendingModal.type === 'push'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  {pendingModal.type === 'push' ? (
                    <UploadCloud className="w-5 h-5" />
                  ) : (
                    <FilePlus2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-white">
                    {pendingModal.type === 'create'
                      ? 'ยืนยันการสร้าง Google Sheet ใหม่ในบัญชีของท่าน'
                      : 'ยืนยันการเขียนข้อมูลทับลงใน Google Sheet'}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    กรุณาตรวจสอบรายละเอียดก่อนอนุญาตให้ระบบดำเนินการบน Google Sheets
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isMutatingSheet}
                onClick={() => setPendingModal(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pendingModal.type === 'create' ? (
              <div className="space-y-2.5 text-xs text-slate-300 bg-[#060D1A] border border-cyan-950 rounded-xl p-4">
                <div>
                  <span className="text-slate-400">บัญชีที่จะสร้างไฟล์:</span>{' '}
                  <span className="text-white font-semibold font-mono">
                    {googleUser?.email || googleUser?.displayName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">โครงสร้างไฟล์:</span>{' '}
                  <span className="text-cyan-300 font-semibold">
                    2 แท็บงาน ({DEFAULT_DATA_SHEET_TITLE} และ {DEFAULT_GUIDE_SHEET_TITLE})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">ข้อมูลตั้งต้นที่จะเขียนลงชีต:</span>{' '}
                  <span className="text-emerald-300 font-semibold font-mono">
                    {projects.length} โครงการ (ครบ 16 คอลัมน์มาตรฐาน + Dropdown สถานะ)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 pt-1">
                  ไฟล์จะถูกสร้างเป็นแบบส่วนตัว (Private) ใน Google Drive ของท่าน จากนั้นท่านสามารถเปิดชีตเพื่อกดแชร์ให้เจ้าหน้าที่ร่วมกรอกได้
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-slate-300 bg-[#060D1A] border border-amber-800/60 rounded-xl p-4">
                <div>
                  <span className="text-slate-400">ไฟล์ Google Sheet ปลายทาง:</span>{' '}
                  <span className="text-white font-semibold">{pendingModal.spreadsheetTitle}</span>
                </div>
                <div>
                  <span className="text-slate-400">แท็บชีตที่จะเขียนทับ:</span>{' '}
                  <span className="text-amber-300 font-semibold font-mono">{pendingModal.sheetTitle}</span>
                </div>
                <div>
                  <span className="text-slate-400">จำนวนข้อมูลที่จะส่งจากระบบ:</span>{' '}
                  <span className="text-cyan-300 font-semibold font-mono">
                    {pendingModal.projectCount} โครงการ (+1 แถวหัวคอลัมน์มาตรฐาน 16 คอลัมน์)
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-200 text-[11px] flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    ข้อมูลเดิมทั้งหมดในแท็บ "{pendingModal.sheetTitle}" จะถูกล้างและแทนที่ด้วยข้อมูลล่าสุดจากระบบ (ท่านยังสามารถดูประวัติเวอร์ชันย้อนหลังใน Google Sheets ได้)
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isMutatingSheet}
                onClick={() => setPendingModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isMutatingSheet}
                onClick={() => void executeConfirmedMutation()}
                className={`px-5 py-2 rounded-xl text-slate-950 text-xs font-extrabold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                  pendingModal.type === 'push'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300'
                    : 'bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300'
                }`}
              >
                {isMutatingSheet && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isMutatingSheet
                    ? 'กำลังดำเนินการ...'
                    : pendingModal.type === 'create'
                    ? 'ยืนยันสร้าง Google Sheet ใหม่'
                    : 'ยืนยันเขียนข้อมูลลง Google Sheet'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
