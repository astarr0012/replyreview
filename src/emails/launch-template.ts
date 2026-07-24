/**
 * Beautiful HTML email template for the ReviewReply launch announcement.
 */
export function buildLaunchEmailHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ReviewReply is Live!</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:40px 48px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">🚀 ReviewReply is Live!</h1>
              <p style="margin:8px 0 0;font-size:16px;color:#94a3b8;font-weight:400;">Turn Customer Reviews into Opportunities</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px;">
              <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;">Hi there! 👋</h2>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">
                Great news — <strong style="color:#0f172a;">ReviewReply</strong> is officially live and ready to help you 
                manage customer reviews faster, smarter, and more impactfully than ever before.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">
                You signed up early for early access, and we're thrilled to welcome you as one of our first users. 
                Here's what you can do right now:
              </p>

              <!-- Features Grid -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:0 0 16px;">
                    <table width="100%" cellpadding="14" cellspacing="0" style="background:#f8fafc;border-radius:12px;">
                      <tr>
                        <td width="40" valign="top" style="font-size:20px;text-align:center;">🤖</td>
                        <td>
                          <strong style="font-size:14px;color:#0f172a;">One-Click AI Responses</strong>
                          <p style="margin:2px 0 0;font-size:13px;color:#64748b;">Draft professional, on-brand replies in seconds — in 15+ languages.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 16px;">
                    <table width="100%" cellpadding="14" cellspacing="0" style="background:#f8fafc;border-radius:12px;">
                      <tr>
                        <td width="40" valign="top" style="font-size:20px;text-align:center;">🔔</td>
                        <td>
                          <strong style="font-size:14px;color:#0f172a;">Smart Alerts & Notifications</strong>
                          <p style="margin:2px 0 0;font-size:13px;color:#64748b;">Get notified instantly when new reviews arrive — especially negative ones that need immediate attention.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 16px;">
                    <table width="100%" cellpadding="14" cellspacing="0" style="background:#f8fafc;border-radius:12px;">
                      <tr>
                        <td width="40" valign="top" style="font-size:20px;text-align:center;">📊</td>
                        <td>
                          <strong style="font-size:14px;color:#0f172a;">KPI Analytics Dashboard</strong>
                          <p style="margin:2px 0 0;font-size:13px;color:#64748b;">Track sentiment trends, response rates, and rating distributions at a glance.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 24px;">
                    <table width="100%" cellpadding="14" cellspacing="0" style="background:#f8fafc;border-radius:12px;">
                      <tr>
                        <td width="40" valign="top" style="font-size:20px;text-align:center;">🌐</td>
                        <td>
                          <strong style="font-size:14px;color:#0f172a;">Google & Yelp Sync</strong>
                          <p style="margin:2px 0 0;font-size:13px;color:#64748b;">Connect your business profiles and sync reviews automatically.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 12px;">
                    <a href="https://reviewreply.ctonew.app/dashboard" target="_blank" style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:700;color:#ffffff;background:#0f172a;border-radius:40px;text-decoration:none;letter-spacing:0.3px;">
                      🎯 Go to Dashboard
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 8px;">
                    <a href="https://reviewreply.ctonew.app/dashboard/settings" target="_blank" style="display:inline-block;padding:12px 32px;font-size:14px;font-weight:600;color:#0f172a;background:#ffffff;border:2px solid #e2e8f0;border-radius:40px;text-decoration:none;">
                      💰 View Plans & Pricing
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 24px;">

              <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
                <strong>Getting started is easy:</strong>
              </p>
              <ol style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#475569;">
                <li style="margin-bottom:8px;">Head to the <a href="https://reviewreply.ctonew.app/dashboard/new" style="color:#0f172a;font-weight:600;">Dashboard</a> and generate your first AI-powered response.</li>
                <li style="margin-bottom:8px;">Customize your <a href="https://reviewreply.ctonew.app/dashboard/brand-voice" style="color:#0f172a;font-weight:600;">Brand Voice</a> to match your business personality.</li>
                <li style="margin-bottom:8px;">Connect your <a href="https://reviewreply.ctonew.app/dashboard/locations" style="color:#0f172a;font-weight:600;">Locations</a> to sync with Google and Yelp.</li>
                <li>Upgrade to <strong>Pro</strong> or <strong>Agency</strong> for advanced features!</li>
              </ol>

              <p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">
                Thank you for being part of our early community. We can't wait to see how ReviewReply helps you build stronger customer relationships!
              </p>

              <p style="margin:24px 0 0;font-size:14px;color:#334155;">
                Best regards,<br>
                <strong style="color:#0f172a;">The ReviewReply Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:24px 48px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                You're receiving this because you signed up for early access to ReviewReply.
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">
                <a href="{{UNSUBSCRIBE_URL}}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a> 
                from future marketing emails.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#cbd5e1;">
                © 2026 ReviewReply. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildLaunchEmailText(): string {
  return `🚀 ReviewReply is Live!

Hi there! 👋

Great news — ReviewReply is officially live and ready to help you manage customer reviews faster, smarter, and more impactfully than ever before.

You signed up early for early access, and we're thrilled to welcome you as one of our first users.

Here's what you can do right now:

🤖 One-Click AI Responses — Draft professional, on-brand replies in seconds, in 15+ languages.
🔔 Smart Alerts & Notifications — Get notified instantly when new reviews arrive.
📊 KPI Analytics Dashboard — Track sentiment trends, response rates, and rating distributions.
🌐 Google & Yelp Sync — Connect your business profiles and sync reviews automatically.

👉 Go to Dashboard: https://reviewreply.ctonew.app/dashboard
💰 View Plans & Pricing: https://reviewreply.ctonew.app/dashboard/settings

Getting started is easy:
1. Head to the Dashboard and generate your first AI-powered response.
2. Customize your Brand Voice to match your business personality.
3. Connect your Locations to sync with Google and Yelp.
4. Upgrade to Pro or Agency for advanced features!

Thank you for being part of our early community.

Best regards,
The ReviewReply Team

---
You're receiving this because you signed up for early access to ReviewReply.
To unsubscribe, reply with "unsubscribe" or visit: {{UNSUBSCRIBE_URL}}
© 2026 ReviewReply. All rights reserved.`;
}

export function buildTestEmailHtml(testEmail: string): string {
  return buildLaunchEmailHtml().replace("{{UNSUBSCRIBE_URL}}", `mailto:reviewreply-f2d1f049@ctomail.io?subject=Unsubscribe&body=Please unsubscribe ${encodeURIComponent(testEmail)}`);
}