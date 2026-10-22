import LegalShell from "@/app/components/LegalShell";

export const metadata = { title: "Terms of Service · Tynato CRM" };

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service">
      <p><strong>Last updated:</strong> [DATE]</p>
      <p>
        These terms govern your use of Tynato CRM, provided by Tynato Technologies. By using
        the service you agree to them.
      </p>
      <h2>Use of the service</h2>
      <p>
        You may use Tynato CRM to manage your customers, leads and connected Meta assets. You
        are responsible for the accuracy of the data you add and for having the right to share
        the Meta Pages and ad accounts you connect.
      </p>
      <h2>Meta platform</h2>
      <p>
        Use of Meta data is also subject to Meta's Platform Terms and Developer Policies. You
        can disconnect Meta at any time, and request deletion as described in our privacy
        policy.
      </p>
      <h2>Availability and changes</h2>
      <p>
        We may update the service and these terms. Material changes are announced in the app.
      </p>
      <h2>Contact</h2>
      <p>support@tynato.com</p>
    </LegalShell>
  );
}