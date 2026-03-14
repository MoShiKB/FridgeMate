import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendResetCodeEmail(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: `"FridgeMate" <${process.env.SMTP_USER}>`,
    to,
    subject: "FridgeMate - Password Reset Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #2A9D8F;">FridgeMate</h2>
        <p>You requested a password reset. Use the code below to reset your password:</p>
        <div style="background: #f4f4f4; border-radius: 8px; padding: 16px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #333;">${code}</span>
        </div>
        <p style="color: #888; font-size: 13px;">This code expires in 15 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `,
  });
}
