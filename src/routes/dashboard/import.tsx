import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { useState, useRef } from "react";

const USER_ID = "00000000-0000-0000-0000-000000000000";

const importReviews = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    return {
      csvText: String(d.csvText ?? ""),
    };
  })
  .handler(async ({ data }) => {
    const { csvText } = data;
    if (!csvText.trim()) {
      return { ok: false, imported: 0, errors: ["CSV file is empty."] };
    }

    const lines = csvText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      return { ok: false, imported: 0, errors: ["CSV must have a header row and at least one data row."] };
    }

    // Parse header
    const header = parseCSVLine(lines[0]);
    const colMap: Record<string, number> = {};
    header.forEach((h, i) => {
      const key = h.toLowerCase().replace(/[^a-z0-9]/g, "_");
      colMap[key] = i;
    });

    // Validate required columns exist
    const platformCol = colMap["platform"] ?? colMap["source"] ?? -1;
    const authorCol = colMap["author_name"] ?? colMap["author_name_"] ?? colMap["author"] ?? colMap["name"] ?? -1;
    const ratingCol = colMap["rating"] ?? colMap["stars"] ?? -1;
    const textCol = colMap["review_text"] ?? colMap["review_text_"] ?? colMap["text"] ?? colMap["review"] ?? colMap["comment"] ?? -1;
    const dateCol = colMap["date"] ?? colMap["created_at"] ?? colMap["created"] ?? colMap["date_"] ?? -1;

    const missing: string[] = [];
    if (platformCol < 0) missing.push("Platform");
    if (authorCol < 0) missing.push("Author Name");
    if (ratingCol < 0) missing.push("Rating");
    if (textCol < 0) missing.push("Review Text");
    if (missing.length > 0) {
      return { ok: false, imported: 0, errors: [`Missing columns: ${missing.join(", ")}. Expected: Platform, Author Name, Rating, Review Text, Date (optional)`] };
    }

    // Parse data rows
    const errors: string[] = [];
    const validRows: { platform: string; author_name: string; rating: number; review_text: string; date: string | null }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]);
      const rowNum = i + 1;

      const platform = String(row[platformCol] ?? "").trim().toLowerCase();
      const authorName = String(row[authorCol] ?? "").trim();
      const ratingRaw = String(row[ratingCol] ?? "").trim();
      const reviewText = String(row[textCol] ?? "").trim();
      const dateRaw = dateCol >= 0 ? String(row[dateCol] ?? "").trim() : null;

      // Validate platform
      if (!["google", "yelp"].includes(platform)) {
        errors.push(`Row ${rowNum}: Invalid platform "${platform || "(empty)"}". Must be "google" or "yelp".`);
        continue;
      }

      // Validate rating
      const rating = parseInt(ratingRaw, 10);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        errors.push(`Row ${rowNum}: Invalid rating "${ratingRaw}". Must be a number between 1 and 5.`);
        continue;
      }

      // Validate review text
      if (!reviewText) {
        errors.push(`Row ${rowNum}: Review text is empty.`);
        continue;
      }

      validRows.push({
        platform,
        author_name: authorName || "Anonymous",
        rating,
        review_text: reviewText,
        date: dateRaw,
      });
    }

    if (validRows.length === 0) {
      return { ok: false, imported: 0, errors: errors.length > 0 ? errors : ["No valid rows found to import."] };
    }

    // Bulk insert
    try {
      const db = sql();
      let imported = 0;
      for (const row of validRows) {
        try {
          if (row.date) {
            // Try to parse the date
            const parsed = new Date(row.date);
            if (!isNaN(parsed.getTime())) {
              await db`
                INSERT INTO reviews (user_id, platform, author_name, rating, review_text, created_at)
                VALUES (${USER_ID}, ${row.platform}, ${row.author_name}, ${row.rating}, ${row.review_text}, ${parsed.toISOString()})
              `;
            } else {
              await db`
                INSERT INTO reviews (user_id, platform, author_name, rating, review_text)
                VALUES (${USER_ID}, ${row.platform}, ${row.author_name}, ${row.rating}, ${row.review_text})
              `;
            }
          } else {
            await db`
              INSERT INTO reviews (user_id, platform, author_name, rating, review_text)
              VALUES (${USER_ID}, ${row.platform}, ${row.author_name}, ${row.rating}, ${row.review_text})
            `;
          }
          imported++;
        } catch (insertErr) {
          errors.push(`Row ${lines.indexOf(lines[validRows.indexOf(row) + 1]) + 1}: DB insert failed — ${String(insertErr)}`);
        }
      }
      return { ok: true, imported, errors: errors.length > 0 ? errors.slice(0, 20) : [] };
    } catch (err) {
      return { ok: false, imported: 0, errors: [`Database error: ${String(err)}`] };
    }
  });

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export const Route = createFileRoute("/dashboard/import")({
  component: ImportPage,
});

function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; imported: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const text = await file.text();
      const res = await importReviews({ data: { csvText: text } });
      setResult(res);
      if (res.ok && fileRef.current) {
        fileRef.current.value = "";
        setFile(null);
      }
    } catch (err) {
      setResult({ ok: false, imported: 0, errors: [`Failed to read file: ${String(err)}`] });
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Bulk Import Reviews</h1>
      <p className="mt-2 text-slate-600">
        Upload a CSV file to import multiple reviews at once. Columns: <strong>Platform</strong>, <strong>Author Name</strong>, <strong>Rating</strong>, <strong>Review Text</strong>, <strong>Date</strong> (optional).
      </p>

      {/* Template download hint */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-400">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <div>
            <p className="text-sm font-medium text-slate-700">CSV Format</p>
            <p className="mt-1 text-xs text-slate-500">
              Header row must include: <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">Platform,Author Name,Rating,Review Text,Date</code>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Example: <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">google,John Doe,5,Great service!,2026-01-15</code>
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Platform: <strong>google</strong> or <strong>yelp</strong>. Rating: 1-5. Date is optional (YYYY-MM-DD format).
            </p>
          </div>
        </div>
      </div>

      {/* Upload area */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-slate-700">Select CSV File</label>
        <div className="mt-2 flex items-center gap-4">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
          />
        </div>
        {file && (
          <p className="mt-2 text-sm text-slate-500">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {/* Import button */}
      <div className="mt-6">
        <button
          onClick={handleImport}
          disabled={!file || loading}
          className="inline-flex items-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Importing...
            </>
          ) : (
            "Import Reviews"
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className={`mt-8 rounded-2xl border p-6 ${
          result.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
        }`}>
          <div className="flex items-center gap-3">
            {result.ok ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-emerald-600">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-red-600">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            )}
            <div>
              <p className={`text-lg font-semibold ${result.ok ? "text-emerald-800" : "text-red-800"}`}>
                {result.ok
                  ? `Successfully imported ${result.imported} review${result.imported !== 1 ? "s" : ""}!`
                  : "Import failed"}
              </p>
              <p className="text-sm text-slate-600">
                {result.imported > 0 && `${result.imported} review${result.imported !== 1 ? "s" : ""} added to your account.`}
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-red-700">
                {result.errors.length} warning{result.errors.length !== 1 ? "s" : ""}:
              </p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li key={i} className="text-xs text-red-600">• {err}</li>
                ))}
              </ul>
            </div>
          )}

          {result.ok && (
            <div className="mt-4 flex gap-3">
              <a
                href="/dashboard"
                className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                View Dashboard
              </a>
              <button
                onClick={() => { setResult(null); setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Import More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}