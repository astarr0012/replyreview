import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { useState } from "react";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
  { value: "vi", label: "Vietnamese" },
  { value: "th", label: "Thai" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "tr", label: "Turkish" },
  { value: "auto", label: "🌐 Auto-detect (match review language)" },
];

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German",
  zh: "Chinese", ja: "Japanese", ko: "Korean", pt: "Portuguese",
  it: "Italian", ru: "Russian", ar: "Arabic", vi: "Vietnamese",
  th: "Thai", nl: "Dutch", pl: "Polish", tr: "Turkish",
};

const generateResponse = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    return {
      reviewText: String(d.reviewText ?? ""),
      rating: Number(d.rating ?? 5),
      platform: String(d.platform ?? "google"),
      tone: String(d.tone ?? "professional"),
      businessName: String(d.businessName ?? ""),
      authorName: String(d.authorName ?? ""),
      language: String(d.language ?? "en"),
    };
  })
  .handler(async ({ data }) => {
    const { reviewText, rating, platform, tone, businessName, authorName, language } = data;
    if (!reviewText) return { ok: false, response: "", message: "Review text is required." };

    const toneGuide: Record<string, string> = {
      warm: "Warm and friendly — like greeting a regular customer.",
      professional: "Polished and professional — respectful and well-composed.",
      apologetic: "Apologetic and sincere — acknowledge the issue and offer to make it right.",
      enthusiastic: "Enthusiastic and energetic — excited about the feedback.",
    };

    const languageInstructions = language === "auto"
      ? `First, detect which language the customer's review is written in. Then write the response in that same language.`
      : `Write the response in ${LANGUAGE_NAMES[language] || "English"}. The response must be entirely in ${LANGUAGE_NAMES[language] || "English"} — do not mix languages.`;

    const systemPrompt = `You are an expert at writing review responses for local businesses. Write a ${tone} response. ${toneGuide[tone] || toneGuide.professional}
The response should be under 150 words, sound human (not robotic), and match the voice of a real business owner.
${businessName ? `The business is: ${businessName}.` : ""}
${languageInstructions}
Never mention that you are an AI. Never use generic phrases like "We appreciate your feedback" as openers unless they fit naturally.`;

    const userPrompt = `Write a response to this ${rating}-star ${platform} review from ${authorName || "a customer"}:\n\n"${reviewText}"`;

    try {
      let draft = "";
      let isFallback = !process.env.OPENAI_API_KEY;

      if (!isFallback) {
        try {
          const OpenAI = (await import("openai")).default;
          const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            max_tokens: 300,
            temperature: 0.7,
          });
          draft = completion.choices[0]?.message?.content?.trim() ?? "";
        } catch (err) {
          console.error("[generateResponse] openai call failed, using fallback:", err);
          isFallback = true;
        }
      }

      if (isFallback || !draft) {
        const name = authorName || "Valued Customer";
        if (tone === "warm") {
          draft = `Thank you so much, ${name}! We're thrilled you had a great experience${businessName ? ` at ${businessName}` : ""}. Your kind words mean the world to our team, and we look forward to welcoming you back soon!`;
        } else if (tone === "apologetic") {
          draft = `${name}, I'm sorry your visit${businessName ? ` to ${businessName}` : ""} didn't meet expectations. We take all feedback seriously and would love the opportunity to make this right. Please contact us directly so we can address your concerns.`;
        } else if (tone === "enthusiastic") {
          draft = `Wow, ${name}! Thank you for the incredible feedback! We're over the moon to hear you had such an amazing time${businessName ? ` with us at ${businessName}` : ""}. You absolutely made our day!`;
        } else {
          // professional
          draft = `Dear ${name}, thank you for taking the time to share your feedback${businessName ? ` regarding ${businessName}` : ""}. We appreciate your support and strive to maintain the highest standards of service for all our guests. We hope to see you again soon.`;
        }
      }

      // Save the review and response to the database
      try {
        const db = sql();
        const [review] = await db`
          INSERT INTO reviews (user_id, platform, author_name, rating, review_text)
          VALUES ('00000000-0000-0000-0000-000000000000', ${platform}, ${authorName || "Valued Customer"}, ${rating}, ${reviewText})
          RETURNING id
        `;
        if (review) {
                    await db`
                      INSERT INTO responses (user_id, review_id, ai_generated_text, tone, status)
                      VALUES ('00000000-0000-0000-0000-000000000000', ${review.id}, ${draft}, ${tone}, 'draft')
                      RETURNING id
                    `;
                    // Auto-create alert for negative reviews
                    if (rating <= 2) {
                      const alertMsg = `Negative ${rating}-star review from ${authorName || "a customer"} on ${platform} needs immediate attention.`;
                      await db`
                        INSERT INTO alerts (review_id, type, priority, message)
                        VALUES (${review.id}, 'negative_review', 'high', ${alertMsg})
                        ON CONFLICT DO NOTHING
                      `;
                    } else {
                      await db`
                        INSERT INTO alerts (review_id, type, priority, message)
                        VALUES (${review.id}, 'new_review', 'normal', ${`New ${rating}-star review received from ${authorName || "a customer"} on ${platform}.`})
                        ON CONFLICT DO NOTHING
                      `;
                    }
                  }
                } catch (dbErr) {
                  console.error("[generateResponse] db error:", dbErr);
                  // Non-blocking — still return the draft
                }

      return { ok: true, response: draft, message: "", reviewId: review?.id || null };
    } catch (err: any) {
      console.error("[generateResponse] general error:", err);
      return { ok: false, response: "", message: err.message || "Failed to generate response." };
    }
  });

const approveAndPost = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    return {
      responseText: String(d.responseText ?? ""),
      reviewText: String(d.reviewText ?? ""),
      platform: String(d.platform ?? "google"),
      authorName: String(d.authorName ?? ""),
      rating: Number(d.rating ?? 5),
      alertId: String(d.alertId ?? ""),
    };
  })
  .handler(async ({ data }) => {
    try {
      const db = sql();
      // Find matching response by joining reviews + responses where review matches
      const [existing] = await db`
        SELECT rs.id, rs.review_id
        FROM responses rs
        JOIN reviews r ON rs.review_id = r.id
        WHERE r.review_text = ${data.reviewText}
          AND r.platform = ${data.platform}
          AND r.author_name = ${data.authorName}
          AND r.rating = ${data.rating}
          AND rs.status = 'draft'
        ORDER BY rs.created_at DESC
        LIMIT 1
      `;
      if (existing) {
        // Update response status to posted
        await db`UPDATE responses SET status = 'posted', edited_text = ${data.responseText} WHERE id = ${existing.id}`;
        // Acknowledge the specific alert (if alertId provided) or all alerts for this review
        if (data.alertId) {
          await db`UPDATE alerts SET acknowledged = true WHERE id = ${data.alertId}`;
        } else {
          await db`UPDATE alerts SET acknowledged = true WHERE review_id = ${existing.review_id}`;
        }
        return { ok: true, message: "Response approved, marked as posted, and alert resolved!" };
      }
      return { ok: false, message: "No matching draft response found to approve." };
    } catch (err: any) {
      console.error("[approveAndPost] error:", err);
      return { ok: false, message: err.message || "Failed to approve response." };
    }
  });

export const Route = createFileRoute("/dashboard/new")({
  component: NewResponse,
});

function NewResponse() {
  const search = Route.useSearch();
  const [form, setForm] = useState({
    platform: (search as any).platform || "google",
    rating: (search as any).rating || "5",
    authorName: (search as any).authorName || "",
    reviewText: (search as any).reviewText || "",
    tone: "professional" as string,
    businessName: "",
    language: "en" as string,
  });
  const [result, setResult] = useState<{ ok: boolean; response: string; message: string; reviewId?: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveMsg, setApproveMsg] = useState<string | null>(null);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setApproveMsg(null);
    const res = await generateResponse({ data: form });
    setResult(res);
    setLoading(false);
  }

  async function handleApprove() {
    if (!result?.response) return;
    setApproveLoading(true);
    setApproveMsg(null);
    const res = await approveAndPost({
      data: {
        responseText: result.response,
        reviewText: form.reviewText,
        platform: form.platform,
        authorName: form.authorName,
        rating: Number(form.rating),
        alertId: (search as any).alertId || "",
      },
    });
    setApproveMsg(res.message);
    setApproveLoading(false);
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">New Response</h1>
      <p className="mt-2 text-slate-600">Paste a review and let AI draft the perfect reply.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Platform</label>
              <select value={form.platform} onChange={(e) => update("platform", e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                <option value="google">Google</option>
                <option value="yelp">Yelp</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Rating</label>
              <select value={form.rating} onChange={(e) => update("rating", e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} Star{n > 1 ? "s" : ""}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Author Name</label>
            <input type="text" value={form.authorName} onChange={(e) => update("authorName", e.target.value)}
              placeholder="Sarah M."
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Review Text *</label>
            <textarea rows={5} value={form.reviewText} onChange={(e) => update("reviewText", e.target.value)}
              placeholder="Paste the customer review here..."
              required
              className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Tone</label>
              <select value={form.tone} onChange={(e) => update("tone", e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                <option value="warm">Warm & Friendly</option>
                <option value="professional">Professional</option>
                <option value="apologetic">Apologetic</option>
                <option value="enthusiastic">Enthusiastic</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Language</label>
              <select value={form.language} onChange={(e) => update("language", e.target.value)}
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200">
                {LANGUAGES.filter((l) => l.value !== "auto").map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
                <option value="auto" className="border-t border-slate-200">🌐 Auto-detect</option>
              </select>
              {form.language !== "auto" && (
                <p className="mt-1 text-xs text-slate-400">Response will be in {LANGUAGE_NAMES[form.language] || "English"}</p>
              )}
              {form.language === "auto" && (
                <p className="mt-1 text-xs text-amber-600">Matches the review's language</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Business Name</label>
              <input type="text" value={form.businessName} onChange={(e) => update("businessName", e.target.value)}
                placeholder="Your Cafe"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60">
            {loading ? "Generating..." : "Generate Response"}
          </button>
        </form>

        <div>
          <label className="block text-sm font-medium text-slate-700">AI Draft</label>
          <div className="mt-1 min-h-[300px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
              </div>
            ) : result?.ok && result.response ? (
              <div>
                <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3.5 py-2 text-xs font-medium text-emerald-800 shadow-sm border border-emerald-200/50">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-emerald-600"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                  Auto-saved as draft on your Dashboard and History!
                </div>
                {form.language !== "en" && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-sky-50 px-3.5 py-2 text-xs font-medium text-sky-700 border border-sky-200/50">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4 text-sky-600"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" /></svg>
                    Response generated in {form.language === "auto" ? "auto-detected" : LANGUAGE_NAMES[form.language] || "English"}
                  </div>
                )}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{result.response}</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(result.response)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    Copy to clipboard
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={approveLoading}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    {approveLoading ? "Approving..." : "Approve & Mark as Posted"}
                  </button>
                </div>
                {approveMsg && (
                  <p className={`mt-2 text-xs font-medium ${approveMsg.includes("posted") ? "text-emerald-700" : "text-red-600"}`}>
                    {approveMsg}
                  </p>
                )}
                <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-blue-800">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 flex-shrink-0 text-blue-600"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                    In Pro/Agency, this action will automatically post the response directly to your Google Maps or Yelp business page.
                  </p>
                </div>
              </div>
            ) : result?.ok === false ? (
              <p className="text-sm text-red-600">{result.message || "Something went wrong."}</p>
            ) : (
              <p className="text-sm text-slate-400">Your AI-generated response will appear here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}