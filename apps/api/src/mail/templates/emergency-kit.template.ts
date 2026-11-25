/**
 * EZ Manage "Emergency Kit" — the branded account-recovery document emailed at sign-up (styled after
 * 1Password's Emergency Kit). It carries the sign-in address, the person's email, and their Account
 * Recovery Key, with a blank line for them to write in their own password and print/store it safely.
 *
 * The Recovery Key is a backup credential (reset a forgotten password), NOT an encryption factor — so
 * the QR encodes only the sign-in address + email (a setup shortcut), never the key itself.
 */
const esc = (t: string) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function emergencyKitTemplate(opts: {
  firstName: string;
  email: string;
  recoveryKey: string;
  signInUrl: string;     // e.g. https://app.ezmanage.com
  recoverUrl: string;    // e.g. https://app.ezmanage.com/recover
  supportEmail: string;
  qrCid?: string | null; // content-id of the attached QR image, if any
}): { html: string; text: string } {
  const { firstName, email, recoveryKey, signInUrl, recoverUrl, supportEmail, qrCid } = opts;
  const created = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const brandRed = '#B4151E', softRed = '#FBEDEE', ink = '#1f2937', muted = '#6b7280', line = '#e5e7eb';

  const qrBlock = qrCid
    ? `<img src="cid:${esc(qrCid)}" width="150" height="150" alt="Setup code" style="display:block;border:0;" />`
    : `<div style="width:150px;height:150px;border:1px dashed ${line};border-radius:8px;"></div>`;

  const html = `
<div style="margin:0;padding:32px 16px;background:#eef0f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,0.08);">

    <!-- Red header band -->
    <div style="margin:28px 28px 0;background:${brandRed};border-radius:12px;padding:22px 26px;">
      <table style="width:100%;border-collapse:collapse;"><tr>
        <td style="vertical-align:middle;width:46px;">
          <div style="width:40px;height:40px;background:#ffffff;border-radius:9px;text-align:center;line-height:40px;font-size:22px;">🛡️</div>
        </td>
        <td style="vertical-align:middle;padding-left:12px;color:#ffffff;">
          <span style="font-size:24px;font-weight:800;letter-spacing:-0.2px;">EZ Manage</span>
          <span style="font-size:24px;font-weight:400;"> Emergency Kit</span>
        </td>
      </tr></table>
    </div>
    <p style="text-align:center;color:${brandRed};font-size:13.5px;margin:12px 0 0;">Created for ${esc(firstName || 'you')} on ${esc(created)}.</p>

    <!-- Intro -->
    <div style="padding:20px 32px 0;">
      <p style="color:${ink};font-size:14.5px;line-height:1.6;margin:8px 0 2px;">
        If you ever get locked out of your account, you'll need these details to get back in —
        <b>including your Account Recovery Key, which we cannot recover for you.</b>
      </p>
      <ol style="color:${ink};font-size:14px;line-height:1.7;padding-left:20px;margin:10px 0 0;">
        <li>Print this Emergency Kit, or save it offline.</li>
        <li>Write your account password in the blank below so you don't forget it.</li>
        <li>Store it somewhere safe (with your important documents, or in private cloud storage).</li>
      </ol>
    </div>

    <!-- Account details card -->
    <div style="margin:22px 32px 0;background:${softRed};border-radius:12px;padding:22px 24px;">
      <p style="text-align:center;color:${brandRed};font-size:16px;font-weight:700;margin:0 0 16px;">EZ Manage Account Details</p>

      <p style="margin:0 0 5px;font-size:11px;font-weight:700;color:${muted};text-transform:uppercase;letter-spacing:0.06em;">Sign-in address</p>
      <div style="background:#ffffff;border-radius:8px;padding:11px 14px;margin:0 0 14px;font-size:14px;color:${ink};word-break:break-all;">${esc(signInUrl)}</div>

      <p style="margin:0 0 5px;font-size:11px;font-weight:700;color:${muted};text-transform:uppercase;letter-spacing:0.06em;">Email address</p>
      <div style="background:#ffffff;border-radius:8px;padding:11px 14px;margin:0 0 14px;font-size:14px;color:${ink};word-break:break-all;">${esc(email)}</div>

      <p style="margin:0 0 5px;font-size:11px;font-weight:700;color:${muted};text-transform:uppercase;letter-spacing:0.06em;">Account Recovery Key</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 14px;"><tr>
        <td style="background:#ffffff;border-radius:8px 0 0 8px;padding:11px 14px;font-size:14.5px;font-weight:700;font-family:'SFMono-Regular',Consolas,monospace;letter-spacing:1px;color:${ink};word-break:break-all;">${esc(recoveryKey)}</td>
        <td style="background:#ffffff;border-radius:0 8px 8px 0;padding:11px 12px;width:26px;text-align:right;font-size:18px;">🔑</td>
      </tr></table>

      <p style="margin:0 0 5px;font-size:11px;font-weight:700;color:${muted};text-transform:uppercase;letter-spacing:0.06em;">Password</p>
      <div style="background:#ffffff;border:1px solid #f2d5d7;border-radius:8px;padding:16px 14px;"></div>
    </div>

    <!-- Help + QR -->
    <table style="width:100%;border-collapse:collapse;margin:24px 0 0;padding:0 32px;">
      <tr>
        <td style="vertical-align:top;padding:0 16px 0 32px;">
          <p style="margin:0 0 8px;font-size:15px;font-weight:700;color:${ink};">Need help?</p>
          <p style="margin:0;font-size:13.5px;color:${muted};line-height:1.6;">Contact EZ Manage at:<br/>
            <a href="mailto:${esc(supportEmail)}" style="color:${brandRed};text-decoration:none;">${esc(supportEmail)}</a>
          </p>
          <p style="margin:16px 0 0;font-size:15px;font-weight:700;color:${ink};">Reset a forgotten password</p>
          <p style="margin:0;font-size:13.5px;color:${muted};line-height:1.6;">Go to <a href="${esc(recoverUrl)}" style="color:${brandRed};text-decoration:none;">${esc(recoverUrl)}</a> and enter your email and the key above.</p>
        </td>
        <td style="vertical-align:top;width:150px;padding:0 32px 0 0;text-align:center;">
          ${qrBlock}
          <p style="margin:8px 0 0;font-size:12px;font-weight:700;color:${ink};">Setup Code</p>
          <p style="margin:2px 0 0;font-size:11.5px;color:${muted};line-height:1.5;">Scan to open EZ Manage with your email filled in.</p>
        </td>
      </tr>
    </table>

    <div style="margin:26px 32px 0;background:#fff8f8;border:1px solid #f2d5d7;border-radius:8px;padding:13px 16px;">
      <p style="margin:0;font-size:12.5px;color:#8a1f26;line-height:1.55;">Anyone with this key and your email can reset your password — do not share it. EZ Manage will never ask you for it.</p>
    </div>

    <div style="border-top:1px solid ${line};background:#fafafa;padding:18px 32px;margin-top:26px;text-align:center;">
      <p style="margin:0;color:${muted};font-size:12.5px;">This Emergency Kit was sent automatically when your EZ Manage account was created.</p>
    </div>
  </div>
</div>`;

  const text = [
    `EZ Manage — Emergency Kit`,
    `Created for ${firstName || 'you'} on ${created}.`,
    '',
    `If you get locked out, you'll need these to get back in — including your Account Recovery Key, which we cannot recover for you.`,
    '',
    `Sign-in address:        ${signInUrl}`,
    `Email address:          ${email}`,
    `Account Recovery Key:   ${recoveryKey}`,
    `Password:               ______________________  (write your own password here)`,
    '',
    `Forgot your password? Go to ${recoverUrl} and enter your email and this key.`,
    `Need help? ${supportEmail}`,
    '',
    `Anyone with this key and your email can reset your password — do not share it.`,
  ].join('\n');

  return { html, text };
}
