import LegalShell from "@/app/components/LegalShell";

export const metadata = { title: "Data Deletion Instructions · Tynato CRM" };

export default function DataDeletionPage() {
  return (
    <LegalShell title="Data Deletion Instructions">
      <p><strong>Last updated:</strong> 22/10/2026</p>
      <p>
        You can delete the data Tynato CRM holds from your Facebook account at any time.
      </p>

      <h2>Option 1: Remove the app from Facebook</h2>
      <ol>
        <li>Open Facebook Settings &amp; privacy, then Settings, then Business integrations
          (or your app settings, depending on your Facebook version).</li>
        <li>Find Tynato CRM and click Remove.</li>
      </ol>
      <p>
        When you remove the app, we automatically disconnect your Meta account, delete the
        access tokens we stored for you, remove your Page and ad account connections, and
        delete the campaign, insight and lead data imported from your Lead Ads.
      </p>

      <h2>Option 2: Email us</h2>
      <p>
        Send an email to <a href="mailto:support@tynato.com">support@tynato.com</a> with the
        subject &quot;Data deletion request&quot; and the email address you use in the CRM. We
        will delete the data described above within 30 days and confirm by email.
      </p>

      <h2>Check the status of a request</h2>
      <p>
        When a deletion is processed, you receive a confirmation code. Enter it on the{" "}
        <a href="/data-deletion-status">status page</a> to see whether it is completed.
      </p>
    </LegalShell>
  );
}