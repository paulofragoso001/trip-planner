import { Resend } from "resend";

type SendCommentEmailInput = {
  to: string;
  commenter: string;
  tripTitle: string;
  itemTitle: string;
  tripUrl?: string;
};

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendCommentEmail({
  to,
  commenter,
  tripTitle,
  itemTitle,
  tripUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
}: SendCommentEmailInput) {
  if (!process.env.RESEND_API_KEY) {
    return;
  }

  await resend.emails.send({
    from: "Trip Planner <onboarding@resend.dev>",
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
