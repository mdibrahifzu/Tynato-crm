import type { ReactNode } from "react";

export default function LegalShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "40px 20px", lineHeight: 1.6, fontFamily: "system-ui, sans-serif", color: "#111" }}>
      <p style={{ fontSize: 13, color: "#555" }}>Tynato Technologies · Tynato CRM</p>
      <h1>{title}</h1>
      {children}
      <hr style={{ margin: "32px 0" }} />
      <p style={{ fontSize: 13, color: "#555" }}>
        Tynato Technologies · [LEGAL COMPANY NAME] · [REGISTERED ADDRESS] · [COUNTRY]
        <br />
        Contact: support@tynato.com · Terms · Privacy · Data deletion
      </p>
    </main>
  );
}