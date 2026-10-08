export function welcomeEmailTemplate(
  firstName: string,
  email: string,
  tempPassword: string,
  frontendUrl: string,
): { html: string; text: string } {
  const loginUrl = `${frontendUrl}/login`;
  const resetUrl = `${frontendUrl}/forgot-password`;

  const html = `
<div style="margin:0;padding:40px 20px;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.05);">

    <!-- Header -->
    <div style="padding:28px 32px;background:linear-gradient(135deg,#111827,#1f2937);text-align:center;">
      <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">EzManage</h1>
      <p style="margin:10px 0 0;color:#d1d5db;font-size:14px;">Your account has been created</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;font-size:20px;color:#111827;font-weight:700;">Welcome, ${firstName}!</h2>
      <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
        A team member has added you to a workspace on EzManage. Use the credentials below to log in.
      </p>

      <!-- Credentials box -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-left:4px solid #10b981;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
        <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Your login details</p>
        <table style="border-collapse:collapse;width:100%;">
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#6b7280;width:100px;">Email</td>
            <td style="padding:6px 0;font-size:14px;font-weight:600;color:#111827;">${email}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;font-size:14px;color:#6b7280;">Password</td>
            <td style="padding:6px 0;font-size:15px;font-weight:700;color:#111827;font-family:monospace;letter-spacing:0.05em;">${tempPassword}</td>
          </tr>
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${loginUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">
          Log in to EzManage →
        </a>
      </div>

      <!-- Security note -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.5;">
          <strong>Security tip:</strong> This is a temporary password. After logging in, go to
          <strong>Settings → Change Password</strong> or use
          <a href="${resetUrl}" style="color:#d97706;">Forgot Password</a> to set your own.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #e5e7eb;background:#fafafa;padding:20px 32px;text-align:center;">
      <p style="margin:0;color:#6b7280;font-size:13px;">
        This email was sent automatically by <strong>EzManage</strong> because you were added to a workspace.
      </p>
    </div>

  </div>
</div>
`;

  const text = [
    `Welcome to EzManage, ${firstName}!`,
    '',
    'A team member has added you to a workspace. Use these credentials to log in:',
    '',
    `Email:    ${email}`,
    `Password: ${tempPassword}`,
    '',
    `Log in: ${loginUrl}`,
    '',
    'After logging in, please change your password via Settings or Forgot Password.',
  ].join('\n');

  return { html, text };
}
