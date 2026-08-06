export function notificationEmailTemplate(
  to,
  subject,
  title,
  message,
  url,
) {
  return {
    to,
    subject,
    html: `
<div style="
  margin:0;
  padding:40px 20px;
  background:#f5f7fb;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
">
  <div style="
    max-width:600px;
    margin:0 auto;
    background:#ffffff;
    border:1px solid #e5e7eb;
    border-radius:16px;
    overflow:hidden;
    box-shadow:0 4px 16px rgba(0,0,0,0.05);
  ">

    <!-- Header -->
    <div style="
      padding:28px 32px;
      background:linear-gradient(135deg,#111827,#1f2937);
      text-align:center;
    ">
      <h1 style="
        margin:0;
        color:#ffffff;
        font-size:24px;
        font-weight:700;
      ">
        EzManage
      </h1>

      <p style="
        margin:10px 0 0;
        color:#d1d5db;
        font-size:14px;
      ">
        You've received a new notification
      </p>
    </div>

    <!-- Body -->
    <div style="padding:36px 32px;">

      <h2 style="
        margin:0 0 16px;
        font-size:22px;
        color:#111827;
        font-weight:700;
      ">
        ${title}
      </h2>

      <div style="
        background:#f9fafb;
        border:1px solid #e5e7eb;
        border-left:4px solid #2563eb;
        border-radius:10px;
        padding:18px;
        margin-bottom:28px;
      ">
        <p style="
          margin:0;
          color:#374151;
          font-size:15px;
          line-height:1.7;
        ">
          ${message}
        </p>
      </div>

      <div style="text-align:center;">
        <a
          href="${url}"
          style="
            display:inline-block;
            background:#2563eb;
            color:#ffffff;
            text-decoration:none;
            padding:14px 28px;
            border-radius:10px;
            font-size:15px;
            font-weight:600;
          "
        >
          Open in EzManage →
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="
      border-top:1px solid #e5e7eb;
      background:#fafafa;
      padding:20px 32px;
      text-align:center;
    ">
      <p style="
        margin:0;
        color:#6b7280;
        font-size:13px;
        line-height:1.6;
      ">
        This notification was sent automatically by
        <strong>EzManage</strong>.
      </p>

      <p style="
        margin:8px 0 0;
        color:#9ca3af;
        font-size:12px;
      ">
        If the button doesn't work, copy and paste this link into your browser:
      </p>

      <p style="
        margin:8px 0 0;
        word-break:break-all;
        font-size:12px;
      ">
        <a
          href="${url}"
          style="color:#2563eb;text-decoration:none;"
        >
          ${url}
        </a>
      </p>
    </div>

  </div>
</div>
`,

    text: `${title}\n\n${message}\n\nOpen EzManage: ${url}`,
  };
}
