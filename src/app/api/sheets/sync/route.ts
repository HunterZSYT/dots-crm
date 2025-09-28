import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs"; // googleapis needs Node

function extractSpreadsheetId(input: string) {
  const m = String(input).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m?.[1]) return m[1];
  const id = String(input).trim();
  return /^[a-zA-Z0-9-_]+$/.test(id) ? id : null;
}

function readCreds() {
  // 1) Whole JSON in one var (no newline problems)
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      const o = JSON.parse(json);
      return { clientEmail: o.client_email as string, privateKey: String(o.private_key ?? "") };
    } catch {/* fall through */}
  }

  // 2) Base64-encoded PEM + email
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_B64;
  if (b64) {
    const pem = Buffer.from(b64, "base64").toString("utf8").replace(/\r/g, "").trim();
    return { clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "", privateKey: pem };
  }

  // 3) Raw PEM + email (often with literal \n)
  let pem = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
  pem = pem.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
  return { clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "", privateKey: pem };
}

export async function POST(req: Request) {
  try {
    const { spreadsheet, title, headers, rows } = await req.json();

    if (!spreadsheet || !Array.isArray(headers) || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheet);
    if (!spreadsheetId) {
      return NextResponse.json({ error: "Invalid spreadsheet URL or ID" }, { status: 400 });
    }

    const { clientEmail, privateKey } = readCreds();
    if (!clientEmail || !privateKey) {
      return NextResponse.json(
        { error: "Missing Google service account envs (JSON or EMAIL/KEY)" },
        { status: 500 }
      );
    }
    if (!privateKey.includes("BEGIN PRIVATE KEY")) {
      return NextResponse.json(
        { error: "Private key is not a PKCS8 PEM (expect -----BEGIN PRIVATE KEY-----)" },
        { status: 500 }
      );
    }

    const jwt = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
      ],
    });
    const sheets = google.sheets({ version: "v4", auth: jwt });

    // 1) Add a fresh sheet/tab
    const add = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: (title?.slice(0, 80) || `Export ${new Date().toISOString().slice(0, 10)}`),
              },
            },
          },
        ],
      },
    });
    const sheetProps = add.data.replies?.[0]?.addSheet?.properties;
    const sheetTitle = sheetProps?.title;
    const sheetId = sheetProps?.sheetId;
    if (!sheetTitle || sheetId == null) {
      return NextResponse.json({ error: "Failed to add sheet" }, { status: 500 });
    }

    // 2) Write the data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetTitle}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers, ...rows] },
    });

    // 3) Auto-resize columns
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          { autoResizeDimensions: { dimensions: { sheetId, dimension: "COLUMNS", startIndex: 0 } } },
        ],
      },
    });

    return NextResponse.json({ ok: true, sheetTitle });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Sync failed" }, { status: 500 });
  }
}
