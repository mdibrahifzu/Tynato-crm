import LegalShell from "../components/LegalShell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deletion Request Status · Tynato CRM" };

type StatusResponse = {
  found: boolean;
  status?: string;
  requested_at?: string;
  completed_at?: string | null;
};

async function lookup(code: string): Promise<StatusResponse | null> {
  const base = process.env.CRM_API_URL ?? "https://api.tynato.com";
  try {
    const url = new URL("/meta/data-deletion-status", base);
    url.searchParams.set("code", code);
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as StatusResponse;
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
    <LegalShell
      title="Deletion Request Status"
      description="Check the status of a deletion request using the confirmation code supplied by Tynato CRM."
    >
      <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="code" className="sr-only">Confirmation code</label>
        <input
          id="code"
          name="code"
          defaultValue={code}
          placeholder="Enter confirmation code"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="submit"
          className="rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          Check status
        </button>
      </form>

      {!code && <p className="text-slate-600">Enter the confirmation code you received for your deletion request.</p>}
      {code && !validCode && <p role="alert" className="text-red-700">That code format is not valid. Check the code and try again.</p>}
      {validCode && result === null && (
        <p role="status" className="text-amber-800">
          The status service could not be reached. Please try again later or contact
          {" "}<a href="mailto:support@tynato.com">support@tynato.com</a>.
        </p>
      )}
      {validCode && result && !result.found && (
        <p role="status" className="text-slate-700">No deletion request was found for that code.</p>
      )}
      {validCode && result?.found && (
        <dl className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="mt-1 font-semibold text-slate-900">{result.status ?? "Status not provided"}</dd>
          </div>
          {result.requested_at ? <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Request received</dt>
            <dd className="mt-1 text-slate-800">{result.requested_at}</dd>
          </div> : null}
          {result.completed_at ? <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Completed</dt>
            <dd className="mt-1 text-slate-800">{result.completed_at}</dd>
          </div> : null}
        </dl>
      )}
    </LegalShell>
  );
}
