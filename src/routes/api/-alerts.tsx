import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";

export const getPendingAlerts = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const alerts = await db`
      SELECT
        a.id, a.type, a.priority, a.message, a.email_sent, a.acknowledged, a.created_at,
        r.id as review_id, r.platform, r.author_name, r.rating, r.review_text, r.created_at as review_created_at
      FROM alerts a
      LEFT JOIN reviews r ON a.review_id = r.id
      WHERE a.acknowledged = false
      ORDER BY a.priority DESC, a.created_at DESC
      LIMIT 20
    `;
    const [countResult] = await db`SELECT COUNT(*)::int as count FROM alerts WHERE acknowledged = false`;
    return {
      alerts: (alerts ?? []).map((a: any) => ({
        ...a,
        created_at: String(a.created_at),
        review_created_at: a.review_created_at ? String(a.review_created_at) : null,
      })),
      totalUnread: countResult?.count ?? 0,
    };
  } catch {
    return { alerts: [], totalUnread: 0 };
  }
});

export const createAlert = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    return {
      reviewId: String(d.reviewId ?? ""),
      type: String(d.type ?? "new_review"),
      priority: String(d.priority ?? "normal"),
      message: String(d.message ?? ""),
    };
  })
  .handler(async ({ data }) => {
    if (!data.reviewId) return { ok: false };
    try {
      const db = sql();
      await db`
        INSERT INTO alerts (review_id, type, priority, message)
        VALUES (${data.reviewId}, ${data.type}, ${data.priority}, ${data.message})
        ON CONFLICT DO NOTHING
      `;
      return { ok: true };
    } catch (err) {
      console.error("[createAlert] error:", err);
      return { ok: false };
    }
  });

export const dismissAlert = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    return { alertId: String(d.alertId ?? "") };
  })
  .handler(async ({ data }) => {
    if (!data.alertId) return { ok: false };
    try {
      const db = sql();
      await db`UPDATE alerts SET acknowledged = true, acknowledged_at = NOW() WHERE id = ${data.alertId}`;
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

export const dismissAllAlerts = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const db = sql();
    await db`UPDATE alerts SET acknowledged = true, acknowledged_at = NOW() WHERE acknowledged = false`;
    return { ok: true };
  } catch {
    return { ok: false };
  }
});

export const markEmailSent = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as any;
    return { alertId: String(d.alertId ?? "") };
  })
  .handler(async ({ data }) => {
    if (!data.alertId) return { ok: false };
    try {
      const db = sql();
      await db`UPDATE alerts SET email_sent = true, email_sent_at = NOW() WHERE id = ${data.alertId}`;
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });