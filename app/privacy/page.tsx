import LegalShell from "@/app/components/LegalShell";

export const metadata = { title: "Privacy Policy · Tynato CRM" };

export default function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      description="How Tynato CRM handles account information, CRM data and information associated with connected Meta services."
    >
      <p><strong>Last updated:</strong> 22 October 2026</p>
      <p>
        This policy describes the information processed by Tynato CRM at
        {" "}<a href="https://crm.tynato.com">crm.tynato.com</a>. The operator is
        {" "}TYNATO  (“we”, “us”). Confirm this identity
        and the practices below against the deployed service before publishing.
      </p>

      <h2>Information that may be processed</h2>
      <ul>
        <li>Account details such as name and email address.</li>
        <li>Information that users enter into CRM features, such as leads, contacts, notes, call-related records and invoices.</li>
        <li>
          If you connect Meta, information made available through the permissions granted and
          assets selected, which may include a Meta user identifier, Page and ad-account
          identifiers/names, lead form and lead data, and campaign or advertising insights.
        </li>
        <li>Technical and diagnostic information needed to operate and secure the service.</li>
      </ul>

      <h2>Meta permissions and use</h2>
      <p>
        Depending on the Meta features enabled for your account, the app may request
        permissions such as pages_show_list, pages_read_engagement, pages_manage_metadata,
        leads_retrieval, ads_read, business_management, and basic profile or email access.
        The actual permissions requested must match the live Meta Login configuration and
        the features used by the application. Do not treat this list as proof that every
        permission is currently requested or approved.
      </p>
      <p>
        Meta-related information is used to provide the connected CRM features, such as
        displaying available Pages or advertising insights and processing lead information
        where those features are enabled and authorized.
      </p>

      <h2>Sharing and service providers</h2>
      <p>
        Describe here the actual categories of service providers that process information for
        Tynato CRM, the purposes for which they process it, and any other sharing that occurs.
        Do not publish a claim that information is never shared with a provider unless that
        claim has been checked against production data flows, logs and integrations.
      </p>

      <h2>Security</h2>
      <p>
        We apply safeguards intended to protect information. Before publishing, verify and
        describe the actual controls used for Meta tokens, including storage, encryption,
        access restrictions, rotation/revocation and logging. Do not claim a specific
        encryption method unless it is implemented and verified.
      </p>

      <h2>Retention and deletion</h2>
      <p>
        Retention depends on the type of information and the operational or legal purpose for
        which it is processed. To request deletion of Meta-related information, follow the
        <a href="/data-deletion"> Data Deletion Instructions</a>. The policy and actual backend
        deletion process must agree on which tokens, connections, imported records, backups
        and audit records are deleted or retained, and on the applicable timeline.
      </p>

      <h2>Your choices and contact</h2>
      <p>
        You may disconnect a Meta integration using the available CRM controls, where provided,
        and may remove the app through Meta's settings. These actions may revoke access; they
        should not be described as deleting all previously stored CRM data unless the backend
        actually does so.
      </p>
      <p>
        Privacy questions and deletion requests: <a href="mailto:support@tynato.com">support@tynato.com</a>.
      </p>
      
    </LegalShell>
  );
}
