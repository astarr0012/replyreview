import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { buildLaunchEmailHtml, buildLaunchEmailText } from "~/emails/launch-template";

const INBOX_EMAIL = "reviewreply-f2d1f049@ctomail.io";

/* Get waitlist count and campaign history */
export const getCampaignOverview = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const [waitlistCount] = await db`SELECT COUNT(*)::int as count FROM waitlist`;
    const campaigns = await db`
      SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT 10
    `;
    const logs = await db`
      SELECT el.*, ec.type as campaign_type
      FROM email_log el
      LEFT JOIN email_campaigns ec ON el.campaign_id = ec.id
      ORDER BY el.sent_at DESC NULLS LAST
      LIMIT 20
    `;
    return {
      waitlistCount: waitlistCount?.count ?? 0,
      campaigns: (campaigns ?? []).map((c: any) => ({ ...c, created_at: String(c.created_at) })),
      logs: (logs ?? []).map((l: any) => ({ ...l, sent_at: l.sent_at ? String(l.sent_at) : null })),
    };
  } catch {
    return { waitlistCount: 0, campaigns: [], logs: [] };
  }
});

/* Send a test email to a single recipient (prepares and logs) */
export const prepareTestEmail = createServerFn({ method: "POST" })
  .validator((data: any) => ({
    email: String(data.email ?? "").trim().toLowerCase(),
  }))
  .handler(async ({ data }) => {
    if (!data.email || !data.email.includes("@")) {
      return { ok: false, message: "Please provide a valid email address." };
    }

    const subject = "🚀 ReviewReply is Live: Turn Customer Reviews into Opportunities";
    const html = buildLaunchEmailHtml().replace("{{UNSUBSCRIBE_URL}}", `mailto:${INBOX_EMAIL}?subject=Unsubscribe&body=Please unsubscribe ${encodeURIComponent(data.email)}`);
    const text = buildLaunchEmailText().replace("{{UNSUBSCRIBE_URL}}", `mailto:${INBOX_EMAIL}?subject=Unsubscribe&body=Please unsubscribe ${encodeURIComponent(data.email)}`);

    try {
      const db = sql();
      const [campaign] = await db`
        INSERT INTO email_campaigns (type, subject, sent_to, recipient_count, success_count, fail_count)
        VALUES ('test', ${subject}, ${data.email}, 1, 0, 0)
        RETURNING id
      `;

      await db`
        INSERT INTO email_log (campaign_id, email, status)
        VALUES (${campaign.id}, ${data.email}, 'pending')
      `;

      return {
        ok: true,
        message: `Test email prepared for ${data.email}. Use the sendEmail tool to deliver it.`,
        campaignId: campaign.id,
        email: data.email,
        subject,
        html,
        text,
      };
    } catch (err: any) {
      return { ok: false, message: err.message || "Failed to prepare test email." };
    }
  });

/* Prepare launch campaign for all waitlist subscribers */
export const prepareLaunchCampaign = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const db = sql();
    const subscribers = await db`SELECT email FROM waitlist ORDER BY created_at ASC`;

    if (!subscribers || subscribers.length === 0) {
      return { ok: false, message: "No waitlist subscribers found." };
    }

    // Check for existing launch_announcement campaign
    const [existing] = await db`
      SELECT id, recipient_count FROM email_campaigns WHERE type = 'launch_announcement' ORDER BY created_at DESC LIMIT 1
    `;

    if (existing && (existing.recipient_count ?? 0) > 0) {
      return { ok: false, message: `A launch announcement was already sent to ${existing.recipient_count} subscribers.` };
    }

    const emails = subscribers.map((s: any) => s.email);
    const subject = "🚀 ReviewReply is Live: Turn Customer Reviews into Opportunities";
    const html = buildLaunchEmailHtml().replaceAll("{{UNSUBSCRIBE_URL}}", `mailto:${INBOX_EMAIL}?subject=Unsubscribe&body=Please unsubscribe `);
    const text = buildLaunchEmailText().replaceAll("{{UNSUBSCRIBE_URL}}", `mailto:${INBOX_EMAIL}?subject=Unsubscribe&body=Please unsubscribe `);

    // Create the campaign record
    const [campaign] = await db`
      INSERT INTO email_campaigns (type, subject, sent_to, recipient_count, success_count, fail_count)
      VALUES ('launch_announcement', ${subject}, 'all', ${emails.length}, 0, 0)
      RETURNING id
    `;

    // Log all pending sends
    for (const email of emails) {
      await db`
        INSERT INTO email_log (campaign_id, email, status)
        VALUES (${campaign.id}, ${email}, 'pending')
      `;
    }

    return {
      ok: true,
      message: `Launch campaign prepared for ${emails.length} subscribers. Ready to send!`,
      campaignId: campaign.id,
      totalEmails: emails.length,
      emails,
      subject,
      html,
      text,
    };
  } catch (err: any) {
    return { ok: false, message: err.message || "Failed to prepare campaign." };
  }
});

/* Mark emails as sent (called after actually sending) */
export const markEmailsSent = createServerFn({ method: "POST" })
  .validator((data: any) => ({
    campaignId: String(data.campaignId ?? ""),
    successCount: Number(data.successCount ?? 0),
    failCount: Number(data.failCount ?? 0),
  }))
  .handler(async ({ data }) => {
    try {
      const db = sql();
      await db`
        UPDATE email_campaigns SET success_count = ${data.successCount}, fail_count = ${data.failCount}
        WHERE id = ${data.campaignId}
      `;
      await db`
        UPDATE email_log SET status = 'sent', sent_at = NOW()
        WHERE campaign_id = ${data.campaignId} AND status = 'pending'
      `;
      return { ok: true, message: "Campaign marked as sent." };
    } catch {
      return { ok: false, message: "Failed to update campaign." };
    }
  });

/* Simulate campaign without sending (dry run) */
export const simulateLaunchCampaign = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const db = sql();
    const subscribers = await db`SELECT email, created_at FROM waitlist ORDER BY created_at ASC`;
    return {
      ok: true,
      total: subscribers?.length ?? 0,
      subscribers: subscribers ?? [],
      subject: "🚀 ReviewReply is Live: Turn Customer Reviews into Opportunities",
      preview: "Would send beautiful HTML launch email to all subscribers.",
    };
  } catch {
    return { ok: false, total: 0, subscribers: [], subject: "", preview: "" };
  }
});