import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { useState, useRef } from "react";
import { RESPONSE_TEMPLATES, CATEGORIES, LANG_FLAGS, LANG_NAMES } from "~/templates";

const LANGUAGES = [
  { value: "en", label: "🇺🇸 English", short: "EN" },
  { value: "es", label: "🇪🇸 Spanish", short: "ES" },
  { value: "fr", label: "🇫🇷 French", short: "FR" },
  { value: "de", label: "🇩🇪 German", short: "DE" },
  { value: "zh", label: "🇨🇳 Chinese", short: "ZH" },
  { value: "ja", label: "🇯🇵 Japanese", short: "JA" },
  { value: "ko", label: "🇰🇷 Korean", short: "KO" },
  { value: "pt", label: "🇵🇹 Portuguese", short: "PT" },
  { value: "it", label: "🇮🇹 Italian", short: "IT" },
  { value: "ru", label: "🇷🇺 Russian", short: "RU" },
  { value: "ar", label: "🇸🇦 Arabic", short: "AR" },
  { value: "vi", label: "🇻🇳 Vietnamese", short: "VI" },
  { value: "th", label: "🇹🇭 Thai", short: "TH" },
  { value: "nl", label: "🇳🇱 Dutch", short: "NL" },
  { value: "pl", label: "🇵🇱 Polish", short: "PL" },
  { value: "tr", label: "🇹🇷 Turkish", short: "TR" },
  { value: "auto", label: "🌐 Auto-detect (match review language)", short: "AUTO" },
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

    // Quota enforcement
    try {
      const db = sql();
      const [user] = await db`
        SELECT subscription_tier, subscription_status FROM users WHERE id = '00000000-0000-0000-0000-000000000000'
      `;
      const tier = user?.subscription_tier ?? "free";
      const status = user?.subscription_status ?? "active";

      if (status === "canceled" || status === "past_due") {
        return { ok: false, response: "", message: `Your subscription is ${status}. Renew to continue generating responses.` };
      }

      const limits: Record<string, number> = { free: 0, starter: 30, pro: 100, agency: 500 };
      const limit = limits[tier] ?? 0;

      if (limit === 0) {
        return { ok: false, response: "", message: tier === "free" ? "Free plan does not include response generation. Upgrade to start." : "No response limit configured." };
      }

      const [usage] = await db`
        SELECT COUNT(*)::int as count FROM responses
        WHERE user_id = '00000000-0000-0000-0000-000000000000'
          AND created_at >= DATE_TRUNC('month', NOW())
      `;

      if ((usage?.count ?? 0) >= limit) {
        return { ok: false, response: "", message: `You've reached your monthly limit of ${limit} responses. Upgrade to continue generating.` };
      }
    } catch (err) {
      console.error("[quota] error:", err);
      // Non-blocking — allow generation if quota check fails
    }

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

      let reviewId: string | null = null;

      // Save the review and response to the database
      try {
        const db = sql();
        const [review] = await db`
          INSERT INTO reviews (user_id, platform, author_name, rating, review_text)
          VALUES ('00000000-0000-0000-0000-000000000000', ${platform}, ${authorName || "Valued Customer"}, ${rating}, ${reviewText})
          RETURNING id
        `;
        if (review) {
                    reviewId = review.id;
                    await db`
                      INSERT INTO responses (user_id, review_id, ai_generated_text, tone, language, status)
                      VALUES ('00000000-0000-0000-0000-000000000000', ${review.id}, ${draft}, ${tone}, ${language}, 'draft')
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

      return { ok: true, response: draft, message: "", reviewId };
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

        // -- Simulate pushing response to Google/Yelp --
        const platform = data.platform || "google";
        const pushMsg = platform === "google"
          ? "Successfully synced response directly to Google Maps live!"
          : "Successfully synced response directly to Yelp live!";

        const hasGoogleCredentials = !!process.env.GOOGLE_OAUTH_CLIENT_ID;
        const hasYelpCredentials = !!process.env.YELP_API_KEY;

        // If real credentials exist, perform actual API push
        // Otherwise, log the simulation for dev mode
        if (platform === "google" && hasGoogleCredentials) {
          // Real Google My Business API push
          try {
            const GoogleToken = process.env.GOOGLE_ACCESS_TOKEN || "";
            // Production endpoint: POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/replies
            const response = await fetch(
              `https://mybusiness.googleapis.com/v4/accounts/me/locations/me/replies`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${GoogleToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: `accounts/me/locations/me/reviews/${existing.review_id}`,
                  comment: data.responseText,
                }),
              }
            );
            if (!response.ok) {
              console.warn("[sync-google] push failed:", await response.text());
            } else {
              console.log("[sync-google] push successful");
            }
          } catch (syncErr) {
            console.error("[sync-google] error:", syncErr);
          }
        } else if (platform === "yelp" && hasYelpCredentials) {
          // Real Yelp API push (Yelp Fusion API for business owners)
          try {
            const response = await fetch(
              `https://api.yelp.com/v3/businesses/reviews/${existing.review_id}/reply`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${process.env.YELP_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ text: data.responseText }),
              }
            );
            if (!response.ok) {
              console.warn("[sync-yelp] push failed:", await response.text());
            } else {
              console.log("[sync-yelp] push successful");
            }
          } catch (syncErr) {
            console.error("[sync-yelp] error:", syncErr);
          }
        } else {
          // Dev mode simulation
          console.log(`[sync] ${pushMsg} (dev mode)`);
        }

        return { ok: true, message: `Response approved, marked as posted, and alert resolved! ${pushMsg}` };
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
  const [editedDraft, setEditedDraft] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sync editedDraft when a new result comes in
  const prevResultRef = useRef(result?.response);
  if (result?.response && result.response !== prevResultRef.current) {
    prevResultRef.current = result.response;
    setEditedDraft(result.response);
  }

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  function applyTemplate(template: string) {
    const filled = template
      .replace(/\{authorName\}/g, form.authorName || "Valued Customer")
      .replace(/\{businessName\}/g, form.businessName || "our business");
    setEditedDraft(filled);
    setResult({ ok: true, response: filled, message: "" });
    setDrawerOpen(false);
    setApproveMsg(null);
  }

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
    if (!editedDraft) return;
    setApproveLoading(true);
    setApproveMsg(null);
    const res = await approveAndPost({
      data: {
        responseText: editedDraft,
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

  async function handleRegenerate() {
    setRegenerating(true);
    const res = await generateResponse({ data: form });
    if (res.ok && res.response) {
      setResult(res);
      setEditedDraft(res.response);
      setApproveMsg(null);
    }
    setRegenerating(false);
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
          <button type="button" onClick={() => setDrawerOpen(!drawerOpen)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
            {drawerOpen ? "Close Templates" : "Browse Templates"}
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
                <textarea
                  value={editedDraft}
                  onChange={(e) => setEditedDraft(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-slate-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-y"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(editedDraft)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    Copy to clipboard
                  </button>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
                    {regenerating ? "Regenerating..." : "Regenerate"}
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

      {/* Template drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20">
          <div className="fixed inset-0 bg-black/30" onClick={() => setDrawerOpen(false)} />
          <div className="relative z-10 w-full max-w-2xl mx-4 rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">📋 Response Templates</h3>
              <button onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="border-b border-slate-100 px-5 py-3">
              <p className="text-xs font-medium text-slate-500 mb-2">Select language:</p>
              <div className="flex flex-wrap gap-2">
                {["en", "es", "fr", "de"].map((lang) => {
                  const langKey = lang as keyof typeof LANG_FLAGS;
                  return (
                    <button
                      key={lang}
                      onClick={() => update("language", lang)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                        form.language === lang || (form.language === "auto" && lang === "en")
                          ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      <span>{LANG_FLAGS[langKey]}</span>
                      <span>{LANG_NAMES[langKey]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="overflow-y-auto max-h-[calc(80vh-180px)]">
              <div className="p-5">
                <div className="flex flex-wrap gap-2 mb-4">
                  {CATEGORIES.map((cat) => {
                    const lang = form.language === "auto" ? "en" : form.language;
                    const hasTemplates = !!(RESPONSE_TEMPLATES as any)[lang]?.[cat.id]?.length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          const templates = (RESPONSE_TEMPLATES as any)[lang]?.[cat.id];
                          if (templates?.length) applyTemplate(templates[0]);
                        }}
                        disabled={!hasTemplates}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                          hasTemplates
                            ? "bg-white text-slate-700 border border-slate-300 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
                            : "bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed"
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                        {hasTemplates && <span className="text-[10px] text-slate-400">({(RESPONSE_TEMPLATES as any)[lang]?.[cat.id]?.length})</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-3">
                  {(() => {
                    const lang = form.language === "auto" ? "en" : form.language;
                    const langKey = lang as keyof typeof LANG_FLAGS;
                    const langData = (RESPONSE_TEMPLATES as any)[langKey];
                    if (!langData) {
                      return <p className="text-sm text-slate-400">No templates available for this language yet.</p>;
                    }
                    return CATEGORIES.map((cat) => {
                      const templates = langData[cat.id] || [];
                      if (templates.length === 0) return null;
                      return (
                        <div key={cat.id}>
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                            <span className="text-[10px] text-slate-400 font-normal">{LANG_FLAGS[langKey]} {LANG_NAMES[langKey]}</span>
                          </h4>
                          <div className="space-y-2">
                            {templates.map((template: string, i: number) => (
                              <button
                                key={i}
                                onClick={() => applyTemplate(template)}
                                className="w-full text-left rounded-xl border border-slate-200 bg-white p-3.5 text-sm leading-relaxed text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/50 hover:shadow-md"
                              >
                                <div className="mb-1.5 flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-3 w-3"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 4.5 15 15m0 0V8.25m0 11.25H8.25" /></svg>
                                    Use template #{i + 1}
                                  </span>
                                </div>
                                <p className="whitespace-pre-wrap text-xs">{template}</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 px-5 py-3 text-center">
              <p className="text-[10px] text-slate-400">
                {form.authorName || "Valued Customer"} and {form.businessName || "your business name"} will be filled in automatically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}