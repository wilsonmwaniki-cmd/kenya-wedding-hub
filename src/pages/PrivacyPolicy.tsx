import BrandWordmark from "@/components/BrandWordmark";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const EFFECTIVE_DATE = "June 18, 2026";
const LAST_UPDATED = "June 18, 2026";

const sections = [
  {
    title: "Introduction",
    body: [
      "Welcome to Zania.",
      "Zania is a wedding planning and wedding management platform designed to help couples, wedding planners, vendors, and other wedding stakeholders organise wedding-related tasks, timelines, budgets, vendor bookings, guest information, communication, and other planning activities in one shared workspace.",
      "This Privacy Policy explains how Zania collects, uses, stores, shares, and protects your personal data when you use our website, mobile application, platform, services, communication channels, or any related features.",
      "For purposes of this Privacy Policy, Zania, we, us, or our refers to Scarlet Plume, operating the Zania wedding planning platform in Kenya.",
      "By using Zania, creating an account, submitting information, communicating with us, or using any of our services, you acknowledge that you have read and understood this Privacy Policy.",
    ],
  },
  {
    title: "Definitions",
    bullets: [
      "Personal Data means any information relating to an identified or identifiable natural person, including information that can directly or indirectly identify an individual.",
      "Processing means any operation or set of operations performed on Personal Data, whether by automated or non-automated means, including collection, recording, organisation, storage, adaptation, retrieval, consultation, use, disclosure, sharing, transmission, restriction, deletion, or destruction.",
      "Data Controller means a natural or legal person, public authority, agency, or other body that determines the purpose and means of Processing Personal Data. Depending on the circumstances, Zania may act as a Data Controller in relation to Personal Data processed through its services.",
      "Data Processor means a natural or legal person, public authority, agency, or other body that Processes Personal Data on behalf of a Data Controller. Third-party service providers engaged by Zania may act as Data Processors.",
      "User means any individual who accesses, registers for, uses, or interacts with Zania, including couples, wedding planners, vendors, venues, administrators, guests, and invited collaborators.",
      "Vendor means any business, service provider, venue, supplier, or professional offering wedding-related products or services through or in connection with Zania.",
      "Wedding Workspace means a shared digital environment within Zania used to organise, manage, and collaborate on wedding planning activities, including tasks, budgets, timelines, guest information, communications, documents, vendor interactions, and related content.",
    ],
  },
  {
    title: "Legal Framework",
    body: [
      "Zania is committed to handling personal data in accordance with applicable data protection laws, including the Constitution of Kenya, the Data Protection Act, 2019, the Data Protection General Regulations, 2021, and any other applicable laws, regulations, or guidance issued by the Office of the Data Protection Commissioner in Kenya.",
    ],
  },
  {
    title: "Personal Data We Collect",
    subsectionTitle: "Account Information",
    subsectionBullets: [
      "Full name",
      "Email address",
      "Phone number",
      "Password or authentication details",
      "Account type, such as couple, planner, vendor, venue, or administrator",
      "Profile photo, if provided",
      "Business name, if registering as a vendor or planner",
      "Location or service area",
      "Communication preferences",
    ],
    extraSections: [
      {
        title: "Wedding Planning Information",
        bullets: [
          "Wedding date",
          "Wedding location or venue",
          "Wedding budget",
          "Guest count",
          "Guest list information",
          "Family or bridal party details",
          "Wedding timeline",
          "Planning tasks and checklists",
          "Vendor preferences",
          "Notes, comments, messages, and planning updates",
          "Uploaded files, images, mood boards, quotations, invoices, contracts, or other documents",
          "Cultural, religious, or event preferences where you choose to provide them",
        ],
      },
      {
        title: "Vendor and Planner Information",
        bullets: [
          "Business name",
          "Contact person's name",
          "Email address",
          "Phone number",
          "Business location",
          "Business category",
          "Portfolio images or videos",
          "Service descriptions",
          "Price ranges or packages",
          "Availability information",
          "Ratings, reviews, or feedback",
          "Verification documents, where applicable",
          "Payment or billing details, where applicable",
        ],
      },
      {
        title: "Communication Data",
        bullets: [
          "Messages sent through the platform",
          "Emails, WhatsApp messages, SMS, or other communication",
          "Customer support requests",
          "Feedback, complaints, or inquiries",
          "Notifications and reminders sent to you",
        ],
      },
      {
        title: "Payment and Transaction Data",
        body: [
          "If payments, subscriptions, vendor bookings, commissions, or other financial transactions are enabled on Zania, we may collect billing details, transaction references, subscription status, payment confirmation details, and invoice or receipt information.",
          "We do not intentionally store full card details or mobile money PINs. Payments may be processed by third-party payment providers, who handle payment data under their own privacy and security terms.",
        ],
      },
      {
        title: "Technical and Usage Data",
        bullets: [
          "IP address",
          "Device type",
          "Browser type",
          "Operating system",
          "App version",
          "Login activity",
          "Pages or features used",
          "Error reports",
          "Crash logs",
          "Analytics data",
          "Approximate location derived from device or network information",
          "Cookies or similar tracking technologies, where applicable",
        ],
      },
    ],
  },
  {
    title: "How We Collect Personal Data",
    bullets: [
      "Directly from you when you create an account, complete forms, upload information, or communicate with us.",
      "From couples, planners, vendors, or collaborators who add you to a wedding workspace.",
      "From vendors or planners who create business profiles.",
      "From your use of our website, app, or platform.",
      "From third-party service providers such as payment processors, analytics providers, hosting providers, or communication tools.",
      "From publicly available sources, where relevant for vendor verification or business listing purposes.",
    ],
  },
  {
    title: "Why We Use Your Personal Data",
    extraSections: [
      {
        title: "To Provide Zania Services",
        bullets: [
          "Create and manage your account",
          "Help couples plan and organise weddings",
          "Help planners manage wedding projects",
          "Help vendors create and manage listings",
          "Enable vendor discovery and communication",
          "Manage wedding budgets, timelines, guest lists, tasks, and checklists",
          "Allow collaboration between couples, planners, vendors, and other invited users",
          "Send reminders, updates, and notifications",
          "Provide customer support",
        ],
      },
      {
        title: "To Improve Zania",
        bullets: [
          "Understand how users interact with Zania",
          "Improve platform features and user experience",
          "Fix bugs and technical issues",
          "Develop new features",
          "Improve vendor matching, search, planning tools, and recommendations",
          "Analyse aggregated trends in wedding planning activity",
        ],
      },
      {
        title: "To Communicate With You",
        bullets: [
          "Send account-related updates",
          "Send planning reminders",
          "Respond to inquiries",
          "Provide support",
          "Send important service notices",
          "Send marketing updates, offers, or newsletters where permitted by law or where you have opted in",
        ],
      },
      {
        title: "To Protect Users and the Platform",
        bullets: [
          "Prevent fraud",
          "Detect misuse of the platform",
          "Protect user accounts",
          "Enforce our Terms of Use",
          "Resolve disputes",
          "Verify vendors or business listings",
          "Maintain platform security",
        ],
      },
      {
        title: "To Comply With Legal Obligations",
        bullets: [
          "Comply with applicable laws",
          "Respond to lawful requests from regulators, courts, or authorities",
          "Keep accounting, tax, or transaction records",
          "Comply with data protection obligations",
          "Report or investigate security incidents",
        ],
      },
    ],
  },
  {
    title: "Legal Basis for Processing Personal Data",
    body: [
      "We process personal data only where we have a lawful basis to do so. Depending on the context, our legal basis may include your consent, performance of a contract with you, compliance with a legal obligation, our legitimate business interests provided they do not override your rights and freedoms, protection of vital interests where applicable, or performance of a task carried out in the public interest where applicable.",
      "Where we rely on consent, you may withdraw your consent at any time, subject to legal or contractual limitations.",
    ],
  },
  {
    title: "Sensitive Personal Data",
    body: [
      "Some wedding planning information may reveal sensitive personal details, such as religious, cultural, family, or personal preferences. We do not require users to provide sensitive personal data unless it is necessary for a specific planning purpose or voluntarily provided by the user.",
      "Where sensitive personal data is provided, we will handle it with appropriate care and only use it for the purpose for which it was provided, or as otherwise permitted by law.",
    ],
  },
  {
    title: "Children's Personal Data",
    body: [
      "Zania is not intended for use by children as account holders. However, wedding planning information may sometimes include details about children, such as flower girls, page boys, junior bridal party members, or young guests.",
      "Users should only provide children's personal data where necessary for wedding planning purposes and where they have the authority to do so. We will handle children's data carefully and will not knowingly use it for unrelated marketing purposes.",
    ],
  },
  {
    title: "Sharing of Personal Data",
    extraSections: [
      {
        title: "Wedding Collaborators",
        body: [
          "If you are part of a wedding workspace, your information may be visible to other authorised users in that workspace, such as the couple, planner, vendors, or invited collaborators, depending on your role and permissions.",
        ],
      },
      {
        title: "Vendors and Planners",
        body: [
          "Where you request vendor services, submit inquiries, make bookings, or share planning information, relevant data may be shared with the vendor, planner, or service provider involved.",
        ],
      },
      {
        title: "Service Providers",
        bullets: [
          "Hosting providers",
          "Database providers",
          "Cloud storage providers",
          "Payment processors",
          "SMS, email, or WhatsApp communication providers",
          "Analytics providers",
          "Customer support tools",
          "Security and fraud prevention tools",
          "Development, maintenance, and technical service providers",
        ],
        body: [
          "These service providers are only authorised to process personal data as necessary to provide services to Zania and are expected to maintain appropriate confidentiality and security measures.",
        ],
      },
      {
        title: "Legal and Regulatory Authorities",
        body: [
          "We may disclose personal data where required by law, court order, regulatory requirement, legal process, or where necessary to protect our rights, users, platform, or the public.",
        ],
      },
      {
        title: "Business Transfers",
        body: [
          "If Zania is involved in a merger, acquisition, investment, restructuring, sale of assets, or transfer of business, personal data may be transferred as part of that transaction, subject to appropriate safeguards.",
        ],
      },
    ],
  },
  {
    title: "International Data Transfers",
    body: [
      "Some of our service providers may store or process data outside Kenya. Where personal data is transferred outside Kenya, we will take reasonable steps to ensure that such transfers comply with applicable data protection laws and that appropriate safeguards are in place.",
      "These safeguards may include contractual protections, security measures, adequacy considerations, consent where applicable, or other lawful transfer mechanisms recognised under Kenyan data protection law.",
    ],
  },
  {
    title: "Data Retention",
    body: [
      "We retain personal data only for as long as necessary to fulfil the purposes described in this Privacy Policy, comply with legal obligations, resolve disputes, enforce agreements, and protect the security and integrity of the platform.",
      "Where personal data reaches the end of its applicable retention period, we will securely delete or irreversibly anonymise it. If deletion or anonymisation is not immediately feasible due to technical, backup, archival, legal, or regulatory constraints, the data will be securely archived, access will be restricted, and the data will be retained only until deletion or anonymisation can be completed.",
    ],
    bullets: [
      "Account data is retained for as long as your account remains active and for up to 24 months after account closure or inactivity.",
      "Wedding planning data is retained while the wedding workspace remains active and for up to 36 months after the wedding date or workspace closure.",
      "Vendor, planner, and business profile data is retained while the profile remains active and for up to 24 months after deactivation.",
      "Payment, billing, invoice, commission, and transaction records are retained for at least 7 years from the relevant transaction date, or longer where required by law.",
      "Customer support records, complaints, inquiries, and dispute resolution files are retained for up to 5 years after the matter is closed.",
      "Marketing preferences and consent records are retained while you remain subscribed and for up to 3 years after you unsubscribe or withdraw consent.",
      "Technical logs, security records, analytics data, and fraud prevention information are generally retained for between 12 and 24 months depending on the nature of the data and operational requirements.",
    ],
  },
  {
    title: "Your Rights",
    body: [
      "Subject to applicable law, you have rights in relation to your personal data.",
      "To exercise your rights, please contact us using the contact details provided in this Privacy Policy.",
      "We may need to verify your identity before responding to your request. We may also decline or limit requests where permitted by law, such as where we need to retain certain information for legal, contractual, security, or legitimate business reasons.",
    ],
    bullets: [
      "Be informed about how your personal data is used",
      "Access your personal data",
      "Request correction of inaccurate or incomplete data",
      "Request deletion of your personal data",
      "Object to certain processing",
      "Restrict processing of your personal data",
      "Withdraw consent where processing is based on consent",
      "Request transfer of your personal data, where applicable",
      "Lodge a complaint with the Office of the Data Protection Commissioner in Kenya",
    ],
  },
  {
    title: "Account Deletion",
    body: [
      "You may request deletion of your Zania account by contacting us at hello@zaniaweddings.com or through any account deletion feature made available in the platform.",
      "When you request account deletion, we will take reasonable steps to delete or anonymise your personal data, unless we are required or permitted to retain certain information for legal, tax, accounting, dispute resolution, fraud prevention, platform security, or legitimate business purposes.",
      "If your data appears in a shared wedding workspace, deletion may affect only your account and personal profile, while some shared planning records may remain available to other authorised workspace users where necessary for continuity of the wedding project.",
    ],
  },
  {
    title: "Marketing Communications",
    body: [
      "We may send you marketing communications about Zania, wedding planning tips, vendor updates, offers, platform news, or related services where permitted by law or where you have opted in.",
      "You may opt out of marketing communications at any time by using the unsubscribe link, changing your communication preferences, or contacting us directly.",
      "Even if you opt out of marketing messages, we may still send you important service, security, legal, or account-related communications.",
    ],
  },
  {
    title: "Cookies and Analytics",
    body: [
      "Zania may use cookies, pixels, analytics tools, or similar technologies to support the platform.",
      "You may control cookies through your browser settings. However, disabling some cookies may affect the functionality of the platform.",
      "Where required, we will request your consent before using non-essential cookies or tracking technologies.",
    ],
    bullets: [
      "Keep you logged in",
      "Remember preferences",
      "Understand usage patterns",
      "Improve platform performance",
      "Detect technical issues",
      "Measure marketing effectiveness",
      "Improve user experience",
    ],
  },
  {
    title: "Security of Personal Data",
    body: [
      "We take reasonable technical, organisational, and administrative measures to protect personal data against unauthorised access, loss, misuse, alteration, disclosure, or destruction.",
      "However, no system is completely secure. Users are responsible for keeping their login details confidential and for notifying us immediately if they suspect unauthorised access to their account.",
    ],
    bullets: [
      "Access controls",
      "Password protection",
      "Secure hosting",
      "Encryption where appropriate",
      "Role-based permissions",
      "Monitoring and logging",
      "Backups",
      "Staff or contractor confidentiality obligations",
      "Security reviews and platform maintenance",
    ],
  },
  {
    title: "Data Breaches",
    body: [
      "If we become aware of a personal data breach that may affect your rights or freedoms, we will take reasonable steps to investigate, contain, and address the breach.",
      "Where required by law, we will notify the Office of the Data Protection Commissioner and affected users within the applicable legal timelines.",
    ],
  },
  {
    title: "Third-Party Links and Services",
    body: [
      "Zania may contain links to third-party websites, vendor pages, payment providers, social media pages, or external services.",
      "We are not responsible for the privacy practices, content, security, or policies of third-party services. We encourage you to read the privacy policies of any third-party services you access through Zania.",
    ],
  },
  {
    title: "Vendor Listings, Reviews, and Public Information",
    body: [
      "If you create a vendor, planner, or venue profile on Zania, some of your business information may be publicly visible or visible to Zania users.",
      "You should not upload personal data, client images, or wedding content unless you have the right or permission to do so.",
    ],
    bullets: [
      "Business name",
      "Service category",
      "Location or service area",
      "Portfolio images",
      "Price range or package information",
      "Contact information, where you choose to display it",
      "Reviews, ratings, or testimonials",
      "Business description",
    ],
  },
  {
    title: "User-Generated Content",
    body: [
      "Users may upload content such as notes, images, documents, guest lists, vendor quotations, contracts, mood boards, reviews, comments, and messages.",
      "You are responsible for ensuring that any content you upload does not violate another person's privacy, confidentiality, intellectual property rights, or applicable law.",
      "We may remove content that violates our Terms of Use, this Privacy Policy, applicable law, or the rights of others.",
    ],
  },
  {
    title: "Use of Aggregated or Anonymised Data",
    body: [
      "We may use aggregated or anonymised data for research, analytics, reporting, product development, market insights, or business purposes.",
      "For example, we may analyse general wedding planning trends, average budgets, popular vendor categories, common planning timelines, or regional demand patterns.",
      "Where data is anonymised, it will not reasonably identify you as an individual.",
    ],
  },
  {
    title: "Changes to This Privacy Policy",
    body: [
      "We may update this Privacy Policy from time to time to reflect changes in our services, legal requirements, technology, business operations, or data processing practices.",
      "Any updates will be posted on our website or platform and will become effective on the date indicated at the top of this Privacy Policy. Where required by law, we will provide additional notice or obtain consent before implementing material changes.",
    ],
  },
  {
    title: "Contact Us / Data Protection Officer",
    body: [
      "If you have any questions about this Privacy Policy, wish to exercise your data protection rights, submit a complaint, or contact us regarding the processing of your personal data, please contact Zania using the details below:",
      "Data Controller: Scarlet Plume (Zania)",
      "Email: hello@zaniaweddings.com",
      "For privacy, account, or data protection requests, you can contact us through that address.",
    ],
  },
];

type Section = {
  title: string;
  body?: string[];
  bullets?: string[];
  subsectionTitle?: string;
  subsectionBullets?: string[];
  extraSections?: Array<{
    title: string;
    body?: string[];
    bullets?: string[];
  }>;
};

function PolicySection({ section }: { section: Section }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl text-foreground">{section.title}</h2>
      {section.body?.map((paragraph) => (
        <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
          {paragraph}
        </p>
      ))}
      {section.bullets ? (
        <ul className="space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
          {section.bullets.map((bullet) => (
            <li key={bullet} className="list-disc">
              {bullet}
            </li>
          ))}
        </ul>
      ) : null}
      {section.subsectionTitle ? (
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{section.subsectionTitle}</h3>
          {section.subsectionBullets ? (
            <ul className="space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
              {section.subsectionBullets.map((bullet) => (
                <li key={bullet} className="list-disc">
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {section.extraSections?.map((subsection) => (
        <div key={subsection.title} className="space-y-2">
          <h3 className="text-base font-semibold text-foreground">{subsection.title}</h3>
          {subsection.body?.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
              {paragraph}
            </p>
          ))}
          {subsection.bullets ? (
            <ul className="space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
              {subsection.bullets.map((bullet) => (
                <li key={bullet} className="list-disc">
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-warm px-4 py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex justify-center">
          <BrandWordmark size="md" />
        </div>
        <Card className="border-border/50 shadow-warm">
          <CardHeader className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#c2724f]">
              Legal
            </p>
            <CardTitle className="font-display text-3xl text-foreground">
              Zania Privacy Policy
            </CardTitle>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Effective date: {EFFECTIVE_DATE}</p>
              <p>Last updated: {LAST_UPDATED}</p>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[70vh] pr-5">
              <div className="space-y-8">
                {sections.map((section) => (
                  <PolicySection key={section.title} section={section} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
