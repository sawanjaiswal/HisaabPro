import { Resend } from 'resend'
import logger from '../lib/logger.js'

/**
 * Dispatch Email OTP for Registration, Login, & Password Reset verification
 * Modeled after VaahanPro's Resend email infrastructure with HisaabPro branding.
 */
export async function sendEmailOtp(
  email: string,
  otp: string,
  fullName?: string
): Promise<{ success: boolean; id?: string }> {
  const name = fullName || email.split('@')[0] || 'Business Owner'
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const fromEmail = (process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || 'onboarding@resend.dev').trim()

  logger.info('email.otp_dispatch', { to: email })

  // If API key is not configured in local/dev environment, simulate success and log
  if (!apiKey) {
    logger.warn('email.resend_mock', {
      message: 'RESEND_API_KEY not configured; logging OTP to development logger',
      email,
      otp,
    })
    return { success: true, id: `mock_email_${Date.now()}` }
  }

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: fromEmail.includes('<') ? fromEmail : `HisaabPro <${fromEmail}>`,
      to: [email],
      subject: `${otp} is your HisaabPro verification code`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; }
              .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
              .header { background: #026F39; padding: 24px; text-align: center; }
              .logo { color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
              .logo span { color: #D4F455; }
              .body { padding: 32px 24px; }
              .title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 8px 0; }
              .text { font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px 0; }
              .otp-box { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
              .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #026F39; font-family: 'SF Mono', Monaco, Menlo, Consolas, monospace; }
              .footer { border-top: 1px solid #f1f5f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #94a3b8; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="header">
                <h1 class="logo">Hisaab<span>Pro</span></h1>
              </div>
              <div class="body">
                <h2 class="title">Verify your email address</h2>
                <p class="text">Hi <strong>${escapeHtml(name)}</strong>,<br>Use the verification code below to complete your HisaabPro authentication:</p>
                
                <div class="otp-box">
                  <div class="otp-code">${otp}</div>
                </div>

                <p class="text" style="font-size: 13px; color: #64748b; margin-bottom: 0;">
                  ⏱️ This OTP is valid for <strong>10 minutes</strong>. Never share this code with anyone.
                </p>
              </div>
              <div class="footer">
                &copy; ${new Date().getFullYear()} HisaabPro &mdash; Smart Billing & Accounting OS for Bharat.
              </div>
            </div>
          </body>
        </html>
      `,
    })

    if (result.error) {
      logger.error('email.resend_api_error', { error: result.error })
      return { success: false }
    }

    return { success: true, id: result.data?.id }
  } catch (err) {
    logger.error('email.resend_dispatch_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
    return { success: false }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
