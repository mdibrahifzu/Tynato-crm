import LegalShell from "../components/LegalShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deletion Status · Tynato CRM" };

type StatusResponse = {
  found: boolean;
  status?: string;
  requested_at?: string;
  completed_at?: string | null;
};

async function lookup(code: string): Promise<StatusResponse | null> {
  const base = process.env.CRM_API_URL ?? "https://api.tynato.com";
  try {
    const res = await fetch(
      `${base}/meta/data-deletion-status?code=${encodeURIComponent(code)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as StatusResponse;
  } catch {
    return null;
  }
}

export default async function DataDeletionStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code: rawCode } = await searchParams;
  const code = (rawCode ?? "").trim();
  const validCode = /^[a-f0-9]{8,64}$/i.test(code);
  const result = validCode ? await lookup(code) : null;

  return (
    <LegalShell title="Data Deletion Status">
      <form method="GET" style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <input
          name="code"
          defaultValue={code}
          placeholder="Confirmation code"
          style={{ flex: 1, padding: 10, border: "1px solid #bbb", borderRadius: 6 }}
        />
        <button type="submit" style={{ padding: "10px 16px", borderRadius: 6 }}>
          Check status
        </button>
      </form>

      {!code && <p>Enter the confirmation code you received after your deletion request.</p>}
      {code && !validCode && <p>That code is not valid. Check it and try again.</p>}
      {validCode && result === null && (
        <p>The status service is unavailable right now. Please try again shortly.</p>
      )}
      {validCode && result && !result.found && <p>No deletion request was found for this code.</p>}
      {validCode && result?.found && (
        <div>
          <p><strong>Status:</strong> {result.status}</p>
          {result.requested_at && <p><strong>Requested:</strong> {result.requested_at}</p>}
          {result.completed_at && <p><strong>Completed:</strong> {result.completed_at}</p>}
        </div>
      )}
    </LegalShell>
  );
}