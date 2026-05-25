import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.MAIL_FROM || "FridgeMate <onboarding@resend.dev>";

let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Configure it in the server environment to enable outgoing email."
    );
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendResetCodeEmail(to: string, code: string): Promise<void> {
  const { error } = await getResendClient().emails.send({
    from,
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

  if (error) {
    throw new Error(`Failed to send reset code email: ${error.message}`);
  }
}
