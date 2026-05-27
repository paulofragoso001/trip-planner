import "server-only";

import { Resend } from "resend";

type SendCommentEmailInput = {
  to: string;
  commenter: string;
  tripTitle: string;
  itemTitle: string;
  tripUrl?: string;
};

type SendTripInviteEmailInput = {
  inviterName?: string;
  role: string;
  to: string;
  tripTitle: string;
  tripUrl: string;
};

const fallbackFromEmail = "Wayline <onboarding@resend.dev>";

function createResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  return apiKey ? new Resend(apiKey) : null;
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL || fallbackFromEmail;
}

export async function sendCommentEmail({
  to,
  commenter,
  tripTitle,
  itemTitle,
  tripUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
}: SendCommentEmailInput) {
  const resend = createResendClient();

  if (!resend) {
    return;
  }

  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: `${commenter} commented on your trip`,
    html: `
      <div style="font-family:sans-serif;padding:20px">
        <h2 style="margin-bottom:8px">New comment on your trip</h2>
        <p><strong>${escapeHtml(commenter)}</strong> commented on:</p>
        <p style="font-size:16px">${escapeHtml(itemTitle)}</p>
        <p style="color:#666">${escapeHtml(tripTitle)}</p>
        <a
          href="${escapeHtml(tripUrl)}"
          style="display:inline-block;margin-top:12px;padding:10px 16px;background:black;color:white;text-decoration:none;border-radius:6px"
        >
          View Trip
        </a>
      </div>
    `
  });
}

export async function sendTripInviteEmail({
  inviterName = "A Wayline user",
  role,
  to,
  tripTitle,
  tripUrl
}: SendTripInviteEmailInput) {
  const resend = createResendClient();

  if (!resend) {
    return { reason: "RESEND_API_KEY is not configured.", sent: false as const };
  }

  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  await resend.emails.send({
    from: getFromEmail(),
    to,
    subject: `${inviterName} invited you to ${tripTitle}`,
    html: `
      <div style="font-family:sans-serif;padding:20px">
        <h2 style="margin-bottom:8px">You were invited to a Wayline trip</h2>
        <p><strong>${escapeHtml(inviterName)}</strong> invited you as ${articleFor(roleLabel)} <strong>${escapeHtml(roleLabel)}</strong>.</p>
        <p style="font-size:16px">${escapeHtml(tripTitle)}</p>
        <a
          href="${escapeHtml(tripUrl)}"
          style="display:inline-block;margin-top:12px;padding:10px 16px;background:black;color:white;text-decoration:none;border-radius:6px"
        >
          Open trip
        </a>
      </div>
    `
  });

  return { sent: true as const };
}

function articleFor(value: string) {
  return /^[aeiou]/i.test(value) ? "an" : "a";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
