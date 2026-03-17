import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = "Closechain AI <onboarding@resend.dev>";
const APP_URL = process.env.APP_URL || "https://closechain.replit.app";

export async function sendVerificationEmail(
  to: string,
  firstName: string,
  token: string,
  origin: string,
): Promise<void> {
  const verifyUrl = `${origin}/api/auth/verify-email?token=${token}`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Verify your Closechain AI account",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:32px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Closechain AI
              </p>
              <p style="margin:4px 0 0;font-size:13px;color:#93c5fd;">
                Construction Closeout Management
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#0f172a;">
                Verify your email address
              </h1>
              <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6;">
                Hi ${firstName}, thanks for signing up! Click the button below to verify your email address and activate your account.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td style="background:#1e3a5f;border-radius:8px;">
                    <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                      Verify my email →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">
                This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
              </p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;word-break:break-all;">
                Or copy this link: ${verifyUrl}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f1f5f9;padding:20px 40px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
                © 2026 Closechain AI · For General Contractors
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
