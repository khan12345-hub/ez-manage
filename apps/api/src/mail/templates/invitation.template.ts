export function invitationTemplate(inviteUrl: string) {
  return {
    subject: "You're invited to join EzManage 🚀",
    html: `
  <div style="margin:0;padding:40px 20px;background:#f4f4f5;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="600"
            cellspacing="0"
            cellpadding="0"
            style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;box-shadow:0 8px 24px rgba(0,0,0,.06);"
          >
            <tr>
              <td
                style="padding:32px;background:linear-gradient(135deg,#2563eb,#4f46e5);text-align:center;"
              >
                <h1
                  style="margin:0;color:#ffffff;font-size:30px;font-weight:700;"
                >
                  EzManage
                </h1>

                <p
                  style="margin:12px 0 0;color:#dbeafe;font-size:16px;"
                >
                  Work together. Stay organized.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:40px;">
                <h2
                  style="margin:0 0 16px;font-size:24px;color:#18181b;"
                >
                  You're invited!
                </h2>

                <p
                  style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#52525b;"
                >
                  You've been invited to join
                  <strong>EzManage</strong>.
                  Accept the invitation to start collaborating with your team,
                  manage tasks, and stay productive.
                </p>

                <table
                  role="presentation"
                  cellspacing="0"
                  cellpadding="0"
                  style="margin:32px auto;"
                >
                  <tr>
                    <td
                      align="center"
                      bgcolor="#2563eb"
                      style="border-radius:10px;"
                    >
                      <a
                        href="${inviteUrl}"
                        style="
                          display:inline-block;
                          padding:14px 28px;
                          color:#ffffff;
                          text-decoration:none;
                          font-size:16px;
                          font-weight:600;
                        "
                      >
                        Accept Invitation
                      </a>
                    </td>
                  </tr>
                </table>

                <p
                  style="margin:24px 0 8px;font-size:14px;color:#71717a;"
                >
                  Or copy and paste this link into your browser:
                </p>

                <p
                  style="
                    margin:0;
                    padding:12px;
                    background:#f4f4f5;
                    border-radius:8px;
                    word-break:break-all;
                    font-size:13px;
                    color:#3f3f46;
                  "
                >
                  ${inviteUrl}
                </p>

                <hr
                  style="margin:32px 0;border:none;border-top:1px solid #e4e4e7;"
                />

                <p
                  style="margin:0;font-size:13px;color:#71717a;line-height:1.6;"
                >
                  If you weren't expecting this invitation, you can safely
                  ignore this email.
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:24px;
                  text-align:center;
                  background:#fafafa;
                  color:#a1a1aa;
                  font-size:12px;
                "
              >
                © ${new Date().getFullYear()} EzManage. All rights reserved.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
  `,

    text: `
You've been invited to join EzManage.

Accept your invitation:
${inviteUrl}
    `,
  };
}
