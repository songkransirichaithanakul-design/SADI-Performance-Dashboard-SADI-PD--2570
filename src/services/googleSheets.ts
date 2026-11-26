import type { Project } from '../types';
import {
  buildSheetMatrixFromProjects,
  buildGuideSheetMatrix,
} from '../utils/spreadsheet';

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export const DEFAULT_DATA_SHEET_TITLE = 'ข้อมูลสำหรับนำเข้า';
export const DEFAULT_GUIDE_SHEET_TITLE = 'คำแนะนำการกรอกข้อมูล';

export class GoogleSheetsAuthError extends Error {
  constructor(message = 'เซสชันการเชื่อมต่อ Google หมดอายุ กรุณาเข้าสู่ระบบด้วยบัญชี Google ใหม่อีกครั้ง') {
    super(message);
    this.name = 'GoogleSheetsAuthError';
  }
}

export class GoogleSheetsScopeError extends Error {
  constructor(
    message = 'บัญชี Google ยังไม่ได้อนุญาตสิทธิ์เข้าถึง Google Sheets กรุณากดอนุญาตสิทธิ์ใหม่แล้วติ๊กเครื่องหมายถูก (✓) ในช่อง Google Sheets บนหน้าต่าง Google'
  ) {
    super(message);
    this.name = 'GoogleSheetsScopeError';
  }
}

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
  sheets: SheetTabInfo[];
}

/**
 * Extract Spreadsheet ID from either a full Google Sheets URL or a bare ID string.
 */
export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Fallback for bare ID pasted directly
  if (/^[a-zA-Z0-9-_]{15,120}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function escapeSheetTitle(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

async function sheetsFetch<T>(
  url: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...init, headers });

  if (res.status === 401) {
    throw new GoogleSheetsAuthError();
  }

  if (!res.ok) {
    let apiMessage = '';
    let apiReason = '';
    try {
      const errBody = await res.json();
      apiMessage = errBody?.error?.message || '';
      apiReason = errBody?.error?.details?.[0]?.reason || errBody?.error?.status || '';
    } catch {
      apiMessage = '';
    }

    if (res.status === 403) {
      const lowerMsg = `${apiMessage} ${apiReason}`.toLowerCase();
      if (
        lowerMsg.includes('insufficient authentication scopes') ||
        lowerMsg.includes('access_token_scope_insufficient') ||
        lowerMsg.includes('insufficient permission')
      ) {
        throw new GoogleSheetsScopeError();
      }
      throw new Error(
        `บัญชี Google ของท่านไม่มีสิทธิ์เข้าถึงชีตนี้ กรุณาตรวจสอบว่าเจ้าของไฟล์ได้แชร์สิทธิ์ (Viewer หรือ Editor) ให้บัญชีของท่านแล้ว${
          apiMessage ? ` (${apiMessage})` : ''
        }`
      );
    }
    if (res.status === 404) {
      throw new Error('ไม่พบ Google Sheet ตามลิงก์หรือรหัสที่ระบุ กรุณาตรวจสอบลิงก์ใหม่อีกครั้ง');
    }
    throw new Error(apiMessage || `เกิดข้อผิดพลาดจาก Google Sheets API (HTTP ${res.status})`);
  }

  return (await res.json()) as T;
}

/**
 * Fetch spreadsheet title and actual tab names.
 * Never hardcode "Sheet1" when reading user spreadsheets.
 */
export async function fetchSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken: string
): Promise<SpreadsheetMetadata> {
  const fields = encodeURIComponent(
    'spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title,index)'
  );
  const data = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: Array<{ properties?: { sheetId?: number; title?: string; index?: number } }>;
  }>(`${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}?fields=${fields}`, accessToken);

  const sheets: SheetTabInfo[] = (data.sheets || [])
    .map((s, idx) => ({
      sheetId: s.properties?.sheetId ?? idx,
      title: s.properties?.title || `Sheet${idx + 1}`,
      index: s.properties?.index ?? idx,
    }))
    .sort((a, b) => a.index - b.index);

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl:
      data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    title: data.properties?.title || 'Untitled Spreadsheet',
    sheets,
  };
}

/**
 * Choose the best default tab name from discovered spreadsheet metadata.
 */
export function pickPreferredSheetTitle(sheets: SheetTabInfo[], savedTitle?: string): string {
  if (savedTitle && sheets.some((s) => s.title === savedTitle)) {
    return savedTitle;
  }
  const preferred = [DEFAULT_DATA_SHEET_TITLE, 'ข้อมูลโครงการชุดสมบูรณ์'];
  for (const name of preferred) {
    if (sheets.some((s) => s.title === name)) return name;
  }
  return sheets[0]?.title || DEFAULT_DATA_SHEET_TITLE;
}

/**
 * Read all cell values from a specific sheet tab.
 */
export async function fetchSheetValues(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string
): Promise<unknown[][]> {
  const range = encodeURIComponent(escapeSheetTitle(sheetTitle));
  const data = await sheetsFetch<{ values?: unknown[][] }>(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
    accessToken
  );
  return data.values || [];
}

/**
 * Create a brand-new private Google Sheet pre-formatted with SADI's 16-column schema,
 * current project records, Thai guide sheet, frozen headers, and status dropdown validation.
 */
export async function createStandardSadiSpreadsheet(
  projects: Project[],
  accessToken: string
): Promise<SpreadsheetMetadata> {
  const todayTh = new Date().toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const created = await sheetsFetch<{
    spreadsheetId: string;
    spreadsheetUrl: string;
    properties: { title: string };
    sheets: Array<{ properties: { sheetId: number; title: string; index: number } }>;
  }>(SHEETS_API_BASE, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        title: `SADI 2570 - แบบฟอร์มร่วมกรอกข้อมูลโครงการ (${todayTh})`,
        locale: 'th_TH',
      },
      sheets: [
        {
          properties: {
            title: DEFAULT_DATA_SHEET_TITLE,
            index: 0,
            gridProperties: { frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: DEFAULT_GUIDE_SHEET_TITLE,
            index: 1,
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  const dataMatrix = buildSheetMatrixFromProjects(projects);
  const guideMatrix = buildGuideSheetMatrix();

  // Populate both tabs in a single batchUpdate
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(created.spreadsheetId)}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `${escapeSheetTitle(DEFAULT_DATA_SHEET_TITLE)}!A1`,
            values: dataMatrix,
          },
          {
            range: `${escapeSheetTitle(DEFAULT_GUIDE_SHEET_TITLE)}!A1`,
            values: guideMatrix,
          },
        ],
      }),
    }
  );

  // Style headers and add status dropdown validation on column G (index 6)
  const dataSheetId = created.sheets[0]?.properties?.sheetId ?? 0;
  const guideSheetId = created.sheets[1]?.properties?.sheetId ?? 1;

  try {
    await sheetsFetch(
      `${SHEETS_API_BASE}/${encodeURIComponent(created.spreadsheetId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: dataSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 16,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.04, green: 0.1, blue: 0.22 },
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                    },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            },
            {
              repeatCell: {
                range: {
                  sheetId: guideSheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 5,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.04, green: 0.1, blue: 0.22 },
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                    },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            },
            {
              setDataValidation: {
                range: {
                  sheetId: dataSheetId,
                  startRowIndex: 1,
                  endRowIndex: Math.max(200, projects.length + 50),
                  startColumnIndex: 6,
                  endColumnIndex: 7,
                },
                rule: {
                  condition: {
                    type: 'ONE_OF_LIST',
                    values: [
                      { userEnteredValue: 'อยู่ระหว่างดำเนินการ' },
                      { userEnteredValue: 'ยังไม่ได้ดำเนินการ' },
                      { userEnteredValue: 'ดำเนินการเสร็จแล้ว' },
                    ],
                  },
                  showCustomUi: true,
                  strict: false,
                },
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: dataSheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 16,
                },
              },
            },
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: guideSheetId,
                  dimension: 'COLUMNS',
                  startIndex: 0,
                  endIndex: 5,
                },
              },
            },
          ],
        }),
      }
    );
  } catch {
    // Non-fatal: data is already written cleanly even if optional visual styling fails
  }

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl:
      created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    title: created.properties.title,
    sheets: created.sheets.map((s) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      index: s.properties.index,
    })),
  };
}

/**
 * Replace the target sheet tab contents with the latest 16-column dataset from the app.
 * Must ONLY be invoked after explicit user confirmation in the UI.
 */
export async function pushProjectsToGoogleSheet(
  spreadsheetId: string,
  sheetTitle: string,
  projects: Project[],
  accessToken: string
): Promise<{ updatedRows: number }> {
  const escapedTab = escapeSheetTitle(sheetTitle);
  const clearRange = encodeURIComponent(escapedTab);

  // Clear existing values in the target tab first to prevent stale trailing rows
  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${clearRange}:clear`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );

  const matrix = buildSheetMatrixFromProjects(projects);
  const writeRange = encodeURIComponent(`${escapedTab}!A1`);

  await sheetsFetch(
    `${SHEETS_API_BASE}/${encodeURIComponent(spreadsheetId)}/values/${writeRange}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({
        range: `${escapedTab}!A1`,
        majorDimension: 'ROWS',
        values: matrix,
      }),
    }
  );

  return { updatedRows: projects.length };
}
