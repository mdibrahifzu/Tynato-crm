import LegalShell from "@/app/components/LegalShell";

export const metadata = { title: "Data Deletion Instructions · Tynato CRM" };

export default function DataDeletionPage() {
  return (
    <LegalShell
      title="Data Deletion Instructions"
      description="How to request deletion of information associated with your Tynato CRM Meta connection."
    >
      <p><strong>Last updated:</strong> 22 October 2026</p>
      <p>
        You can request deletion of information associated with your Tynato CRM Meta
        connection by following the steps below.
      </p>

      <h2>Option 1: Remove the app through Meta</h2>
      <ol>
        <li>Open Facebook settings and find Business Integrations or the connected-apps area (the exact menu name may vary).</li>
        <li>Find the Tynato CRM app and choose the option to remove it.</li>
      </ol>
      <p>
        Removing the app can revoke its authorization. If you also need previously imported
        information deleted from Tynato CRM, submit a deletion request using the contact
        option below unless the live service clearly confirms that removal automatically
        triggers and completes that deletion.
      </p>

      <h2>Option 2: Email a deletion request</h2>
      <p>
        Email <a href="mailto:support@tynato.com?subject=Data%20deletion%20request">support@tynato.com</a>
        {" "}with the subject “Data deletion request”. Identify the CRM account and the Meta
        connection involved, but do not email passwords, access tokens or other secrets.
      </p>
      <p>
        We will confirm receipt and explain any verification or follow-up needed. The business
        owner must set and publish a response/deletion timeline that the team can reliably meet;
        do not publish a specific deadline until that process is approved and operational.
      </p>

      <h2>What should be included in a deletion process?</h2>
      <p>
        The operational procedure should identify the relevant Meta token and connection,
        linked Page/ad-account records, imported Meta data, applicable backups and any records
        that must be retained for legal or security reasons. The request should be tracked to
        completion and the requester informed of the outcome.
      </p>

      <h2>Check request status</h2>
      <p>
        If your request workflow issued a confirmation code and the status service is enabled,
        use the <a href="/data-deletion-status">Data Deletion Status</a> page. A status page
        must not be advertised as operational until its backend endpoint and response behavior
        have been tested.
      </p>
    </LegalShell>
  );
}
