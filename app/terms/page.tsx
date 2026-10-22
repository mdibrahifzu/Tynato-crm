import LegalShell from "@/app/components/LegalShell";

export const metadata = { title: "Terms of Service · Tynato CRM" };

export default function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      description="Terms governing access to and use of Tynato CRM."
    >
      <p><strong>Last updated:</strong> 22 October 2026</p>
      <p>
        These Terms of Service govern use of Tynato CRM, operated by
        {" "}TYNATO (“Tynato”, “we”, “us”).
        Do not publish this page until the legal business name and applicable terms have been reviewed.
      </p>

      <h2>Using the service</h2>
      <p>
        You must use the service lawfully, keep your account credentials secure, and ensure
        that you have the necessary rights and permissions for information and assets you
        add or connect. You are responsible for the accuracy and lawful use of information
        submitted through your account.
      </p>

      <h2>Connected third-party services</h2>
      <p>
        If you connect a Meta account, Page, lead form or advertising account, your use of
        those services remains subject to the applicable Meta terms and policies. You must
        have authority to connect the relevant assets. Features available in Tynato CRM depend
        on the permissions granted and the assets accessible to the connecting account.
      </p>

      <h2>Availability and changes</h2>
      <p>
        Features may change, be unavailable, or depend on third-party services. We will
        provide notices of material changes where required by applicable law.
      </p>

      <h2>Privacy and deletion</h2>
      <p>
        Our handling of information is described in the <a href="/privacy">Privacy Policy</a>.
        For information about requesting deletion, see <a href="/data-deletion">Data Deletion Instructions</a>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms can be sent to <a href="mailto:support@tynato.com">support@tynato.com</a>.
      </p>
      
    </LegalShell>
  );
}
