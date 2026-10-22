import LegalShell from "@/app/components/LegalShell";

export const metadata = { title: "Privacy Policy · Tynato CRM" };

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <p><strong>Last updated:</strong> [DATE]</p>
      <p>
        This Privacy Policy explains how Tynato Technologies (&quot;we&quot;, &quot;us&quot;)
        collects, uses and protects information in Tynato CRM (crm.tynato.com).
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>Account information: name, email address and login details.</li>
        <li>CRM data you add: leads, contacts, notes, call recordings and invoices.</li>
        <li>
          Meta (Facebook) data, only if you connect your account: your Facebook user ID,
          the IDs and names of the Pages and ad accounts you choose to share, an encrypted
          access token, campaign and ad performance insights, and lead form submissions from
          Lead Ads on those Pages.
        </li>
      </ul>

      <h2>Meta permissions we request</h2>
      <p>
        We request pages_show_list, pages_read_engagement, pages_manage_metadata,
        leads_retrieval, ads_read, business_management, and basic profile and email. We use
        them only to read the Pages, lead forms, leads and ad accounts you choose to share,
        and to receive new lead notifications for those Pages. We never create, edit, pause
        or delete ads or Page content.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To show ad performance and manage leads inside your CRM.</li>
        <li>To operate, secure and improve the service.</li>
      </ul>
      <p>
        We do not sell your data, do not use Meta data for advertising, and do not share
        Meta data with third parties, except infrastructure providers that process it on our
        behalf under confidentiality obligations, or when required by law. Meta data is never
        sent to our email provider; that provider receives only system alert emails.
      </p>

      <h2>Security</h2>
      <p>
        Access tokens are encrypted and stored on our servers, and are never exposed in the
        browser. Data is encrypted in transit and access is restricted.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        We keep Meta data while your connection is active. When you disconnect Meta in the
        CRM, or remove the app from Facebook, we delete your access token, your Page and ad
        account links, campaign and insight data, and the leads imported from your Lead Ads.
        You can also request deletion by email. See our{" "}
        <a href="/data-deletion">Data Deletion Instructions</a>.
      </p>

      <h2>Contact</h2>
      <p>support@tynato.com</p>
    </LegalShell>
  );
}