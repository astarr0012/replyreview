import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { useState } from "react";

const USER_ID = "00000000-0000-0000-0000-000000000000";

const getUserInfo = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const [user] = await db`
      SELECT subscription_tier, subscription_status, name, email, business_name
      FROM users WHERE id = ${USER_ID}
    `;
    return user ? {
      tier: user.subscription_tier,
      status: user.subscription_status,
      name: user.name,
      email: user.email,
      businessName: user.business_name,
    } : { tier: "free", status: "inactive", name: "", email: "", businessName: "" };
  } catch {
    return { tier: "free", status: "inactive", name: "", email: "", businessName: "" };
  }
});

const submitTicket = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    return {
      subject: String(d.subject ?? "").trim(),
      message: String(d.message ?? "").trim(),
      priority: String(d.priority ?? "normal"),
    };
  })
  .handler(async ({ data }) => {
    const { subject, message, priority } = data;
    if (!subject) return { ok: false, message: "Subject is required." };
    if (!message) return { ok: false, message: "Message is required." };

    try {
      const db = sql();
      const [ticket] = await db`
        INSERT INTO support_tickets (user_id, subject, message, priority, status)
        VALUES (${USER_ID}, ${subject}, ${message}, ${priority}, 'open')
        RETURNING id
      `;

      // Send email alert for priority tickets
      if (priority === "high" || priority === "urgent") {
        try {
          const { reviewreplyInbox } = await import("~/routes/api/-alerts");
          // Email alert will be sent via the alert system
          await db`
            INSERT INTO alerts (review_id, type, priority, message)
            VALUES (NULL, 'response_due', ${priority === "urgent" ? "urgent" : "high"},
              ${`Priority support ticket from ${data.subject}: ${message.substring(0, 100)}...`})
            ON CONFLICT DO NOTHING
          `;
        } catch (alertErr) {
          console.error("[support] alert creation error:", alertErr);
        }
      }

      return { ok: true, message: "Support ticket submitted successfully.", ticketId: ticket.id };
    } catch (err) {
      console.error("[submitTicket] error:", err);
      return { ok: false, message: "Failed to submit ticket. Please try again." };
    }
  });

export const Route = createFileRoute("/dashboard/support")({
  component: SupportPage,
  loader: () => getUserInfo(),
});

function SupportPage() {
  const userInfo = Route.useLoaderData();
  const isAgency = userInfo.tier === "agency";
  const [form, setForm] = useState({ subject: "", message: "", priority: "normal" });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    const res = await submitTicket({ data: { ...form, priority: isAgency ? "urgent" : "normal" } });
    setResult(res);
    if (res.ok) setForm({ subject: "", message: "", priority: "normal" });
    setSubmitting(false);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Support</h1>
          <p className="mt-2 text-slate-600">
            {isAgency
              ? "You're on the Agency plan. Submit a priority ticket and we'll respond within 1 hour."
              : "Submit a support request and we'll get back to you as soon as possible."}
          </p>
        </div>
        {isAgency && (
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-amber-400 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-amber-500">
              <path fillRule="evenodd" d="M12 1.5a9.75 9.75 0 0 1 9.75 9.75c0 3.12-1.464 5.904-3.745 7.772l1.503 1.503a.75.75 0 0 1-.53 1.28H5.022a.75.75 0 0 1-.53-1.28l1.503-1.503A9.726 9.726 0 0 1 2.25 11.25 9.75 9.75 0 0 1 12 1.5ZM12 6a.75.75 0 0 1 .75.75v5.25a.75.75 0 0 1-1.5 0V6.75A.75.75 0 0 1 12 6Zm0 9a1.125 1.125 0 1 1 0 2.25 1.125 1.125 0 0 1 0-2.25Z" clipRule="evenodd" />
            </svg>
            Priority Support
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">1-HR SLA</span>
          </span>
        )}
      </div>

      {/* Agency priority badge explanation */}
      {isAgency && (
        <div className="mt-6 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Priority Support — 1-Hour Response SLA</p>
              <p className="mt-1 text-xs text-amber-700">
                As an Agency plan subscriber, your tickets are flagged as urgent and routed to our senior support team.
                We guarantee a first response within 1 hour during business hours (Mon-Fri 9am-6pm ET).
                Your ticket will also trigger an immediate notification to our support team.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Support form */}
      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-slate-700">
            Subject <span className="text-red-500">*</span>
          </label>
          <input
            id="subject"
            type="text"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder={isAgency ? "Urgent: Billing issue with my account" : "How can we help?"}
            required
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-slate-700">
            Message <span className="text-red-500">*</span>
          </label>
          <textarea
            id="message"
            rows={5}
            value={form.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            placeholder="Describe your issue in detail..."
            required
          />
        </div>

        {/* Contact info display */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Your Contact Info</p>
          <div className="mt-2 text-sm text-slate-700">
            <p><span className="font-medium">Name:</span> {userInfo.name || "Not set"}</p>
            <p><span className="font-medium">Email:</span> {userInfo.email || "Not set"}</p>
            {userInfo.businessName && <p><span className="font-medium">Business:</span> {userInfo.businessName}</p>}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`inline-flex items-center rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition disabled:opacity-60 ${
            isAgency ? "bg-amber-600 hover:bg-amber-500" : "bg-slate-900 hover:bg-slate-800"
          }`}
        >
          {submitting ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Submitting...
            </>
          ) : (
            isAgency ? "Submit Priority Ticket" : "Submit Request"
          )}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className={`mt-6 rounded-2xl border p-5 ${
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
            <p className={`text-sm font-semibold ${result.ok ? "text-emerald-800" : "text-red-800"}`}>
              {result.ok
                ? (isAgency
                    ? "Your priority ticket has been submitted. Our team will respond within 1 hour."
                    : "Your support request has been submitted. We'll get back to you soon.")
                : result.message}
            </p>
          </div>
        </div>
      )}

      {/* Standard support info for non-Agency */}
      {!isAgency && (
        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Need faster support?</h3>
          <p className="mt-2 text-sm text-slate-600">
            Upgrade to the <strong>Agency</strong> plan for priority support with a 1-hour response SLA,
            plus multi-location management, white-label options, and more.
          </p>
          <a
            href="/dashboard/settings"
            className="mt-4 inline-flex items-center rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-400"
          >
            Upgrade to Agency
          </a>
        </div>
      )}
    </div>
  );
}