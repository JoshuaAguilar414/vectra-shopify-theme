import nodemailer from "nodemailer";
import { getBranding } from "@/lib/branding";

async function sendEmail(input: { to: string; subject: string; text: string; html: string }): Promise<boolean> {
  const branding = getBranding();
  const from =
    process.env.MAIL_FROM ||
    process.env.SMTP_FROM ||
    `${branding.mailFromName} <noreply@example.com>`;

  const brevoKey = process.env.BREVO_API_KEY || process.env.SENDINBLUE_API_KEY;
  if (brevoKey) {
    return sendViaBrevoApi({
      apiKey: brevoKey,
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html
    });
  }

  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text
      })
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend email failed: ${response.status} ${detail}`);
    }
    return true;
  }

  if (!process.env.SMTP_HOST) return false;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html
  });
  return true;
}

async function sendViaBrevoApi(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const sender = parseFromAddress(input.from);
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": input.apiKey,
      accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      sender,
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Brevo API email failed: ${response.status} ${detail}`);
  }
  return true;
}

function parseFromAddress(from: string): { email: string; name?: string } {
  const match = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].replace(/^["']|["']$/g, "").trim();
    return name ? { email: match[2].trim(), name } : { email: match[2].trim() };
  }
  return { email: from.trim() };
}

export async function sendInvitationEmail(input: {
  to: string;
  learnerName: string;
  activationUrl: string;
}): Promise<boolean> {
  const { productName } = getBranding();
  const subject = `Activate your ${productName} account`;
  const text = `Hello ${input.learnerName},\n\nYour ${productName} training account is ready. Sign in here:\n${input.activationUrl}`;
  const html = `<p>Hello ${escapeHtml(input.learnerName)},</p><p>Your ${escapeHtml(productName)} training account is ready.</p><p><a href="${escapeHtml(input.activationUrl)}">Sign in to Shopify</a></p>`;
  return sendEmail({ to: input.to, subject, text, html });
}

export async function sendAssignmentReminderEmail(input: {
  to: string;
  learnerName: string;
  courseTitle: string;
  loginUrl: string;
}): Promise<boolean> {
  const { productName } = getBranding();
  const subject = `Reminder: start your ${input.courseTitle} training`;
  const text = `Hello ${input.learnerName},\n\nYour ${productName} course "${input.courseTitle}" was assigned more than 3 days ago and has not been started yet.\n\nSign in to begin:\n${input.loginUrl}`;
  const html = `<p>Hello ${escapeHtml(input.learnerName)},</p><p>Your ${escapeHtml(productName)} course <strong>${escapeHtml(input.courseTitle)}</strong> was assigned more than 3 days ago and has not been started yet.</p><p><a href="${escapeHtml(input.loginUrl)}">Sign in and start training</a></p>`;
  return sendEmail({ to: input.to, subject, text, html });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    })[character] || character
  );
}
