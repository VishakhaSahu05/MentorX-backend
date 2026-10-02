/**
 * Email delivery for call recordings.
 *
 * Uses SMTP via nodemailer so it works with Gmail App Passwords or any provider
 * without signing up for a new API service.
 *
 * We deliberately send a SECURE EXPIRING LINK rather than attaching the file:
 * a 720p recording is far larger than the ~25MB attachment ceiling every mail
 * provider enforces, and attachments would also bypass our access control.
 */

const nodemailer = require("nodemailer");

let cachedTransporter = null;

const isEmailConfigured = () =>
  Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );

const getTransporter = () => {
  if (cachedTransporter) return cachedTransporter;
  if (!isEmailConfigured()) return null;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    // 465 is implicit TLS; 587 upgrades via STARTTLS
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransporter;
};

const formatDuration = (totalSeconds) => {
  if (!totalSeconds || totalSeconds < 0) return "unknown length";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const buildHtml = ({
  recipientName,
  otherName,
  startedAt,
  durationSec,
  downloadUrl,
  expiryHours,
}) => {
  const when = startedAt
    ? new Date(startedAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "recently";

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1e21;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;border:1px solid #e4e6eb;">
      <h1 style="margin:0 0 4px;font-size:20px;">Your MentorX call recording is ready</h1>
      <p style="margin:0 0 20px;color:#606770;font-size:14px;">
        Hi ${escapeHtml(recipientName)}, the recording of your call with
        ${escapeHtml(otherName)} has finished processing.
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:22px;">
        <tr>
          <td style="padding:8px 0;color:#606770;">Call with</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(otherName)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#606770;border-top:1px solid #e4e6eb;">Recorded</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e4e6eb;">${escapeHtml(when)}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#606770;border-top:1px solid #e4e6eb;">Duration</td>
          <td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #e4e6eb;">${escapeHtml(formatDuration(durationSec))}</td>
        </tr>
      </table>

      <a href="${downloadUrl}"
         style="display:block;text-align:center;background:#f97316;color:#ffffff;text-decoration:none;padding:13px 20px;border-radius:999px;font-weight:600;font-size:15px;">
        Download recording
      </a>

      <p style="margin:18px 0 0;color:#8a8d91;font-size:12px;line-height:1.5;">
        This private link expires in about ${expiryHours} hours and is intended only
        for the two people on the call. You can always get a fresh link from the
        call history inside MentorX.
      </p>
    </div>
  </body>
</html>`;
};

/**
 * Send the recording link to one participant.
 * Returns true on success; never throws, so a mail outage cannot fail the
 * recording pipeline (the caller records the error instead).
 */
const sendRecordingEmail = async ({
  to,
  recipientName,
  otherName,
  startedAt,
  durationSec,
  downloadUrl,
  expirySeconds,
}) => {
  const transporter = getTransporter();
  if (!transporter) {
    return {
      sent: false,
      error:
        "SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASS to enable recording emails)",
    };
  }

  const expiryHours = Math.max(1, Math.round((expirySeconds || 0) / 3600));

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `MentorX <${process.env.SMTP_USER}>`,
      to,
      subject: `Your MentorX call recording with ${otherName} is ready`,
      text:
        `Hi ${recipientName},\n\n` +
        `The recording of your MentorX call with ${otherName} is ready.\n` +
        `Duration: ${formatDuration(durationSec)}\n\n` +
        `Download (link expires in about ${expiryHours} hours):\n${downloadUrl}\n\n` +
        `This private link is intended only for the participants of the call.\n`,
      html: buildHtml({
        recipientName,
        otherName,
        startedAt,
        durationSec,
        downloadUrl,
        expiryHours,
      }),
    });
    return { sent: true };
  } catch (err) {
    console.error("[email] Failed to send recording email:", err.message);
    return { sent: false, error: err.message };
  }
};

module.exports = { sendRecordingEmail, isEmailConfigured, formatDuration };
