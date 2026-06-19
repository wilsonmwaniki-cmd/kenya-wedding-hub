import BrandWordmark from "@/components/BrandWordmark";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const LAST_UPDATED = "June 18, 2026";

const sections = [
  {
    title: "Welcome",
    body: [
      "Welcome to Zania Weddings.",
      "These Terms of Service govern your access to and use of the Zania Weddings website, web application, mobile application, tools, services, and related features collectively referred to as the Platform or Service.",
      "By creating an account, accessing the Platform, or using any part of Zania Weddings, you agree to be bound by these Terms. If you do not agree with these Terms, please do not use the Platform.",
    ],
  },
  {
    title: "1. Definitions",
    bullets: [
      "Platform means the Zania Weddings website, web application, mobile application, software, tools, features, content, and related technology made available by Zania Weddings.",
      "Service means any functionality, product, feature, subscription, tool, support offering, or capability provided through the Platform.",
      "User Content means any information, data, text, images, documents, messages, files, guest lists, budgets, timelines, vendor information, contracts, or other content uploaded, created, submitted, stored, shared, or transmitted by users through the Platform.",
      "Vendor means any wedding service provider, business, freelancer, venue, supplier, or other party that offers products or services through or in connection with the Platform.",
      "Planner means a wedding planner, coordinator, planning business, planning team member, or other user who manages or assists with wedding planning activities through the Platform.",
      "Workspace means a wedding project, account area, collaboration environment, organisation space, or other digital area within the Platform where users manage wedding-related information and activities.",
      "Subscription means any recurring or fixed-term paid plan, package, membership, licence, or access arrangement that provides access to paid features or services on the Platform.",
      "AI-assisted Features means any artificial intelligence, machine learning, automated recommendation, content generation, matching, prediction, drafting, analysis, or decision-support functionality made available through the Platform.",
      "User, you, or your means any individual, business, organisation, couple, Planner, Vendor, guest, collaborator, or other person who accesses or uses the Platform.",
    ],
  },
  {
    title: "2. About Zania Weddings",
    body: [
      "Zania Weddings is a wedding management and coordination platform designed to help couples, wedding planners, vendors, and other wedding stakeholders organise wedding-related information, tasks, budgets, timelines, vendor details, guest information, communications, documents, and related planning activities.",
      "Zania Weddings is a digital planning and management tool. We are not a wedding planner, vendor, event organiser, legal adviser, financial adviser, or party to any agreement between couples, planners, vendors, guests, or other third parties unless expressly stated in writing.",
    ],
  },
  {
    title: "3. Who May Use Zania Weddings",
    bullets: [
      "Be at least 18 years old, or have the permission and supervision of a parent or legal guardian.",
      "Have the legal capacity to enter into these Terms.",
      "Provide accurate and complete account information.",
      "Keep your login details secure.",
      "Accept responsibility for all activity that happens under your account.",
      "If you use Zania Weddings on behalf of a business or organisation, you confirm that you have authority to accept these Terms on its behalf.",
    ],
  },
  {
    title: "4. User Accounts",
    bullets: [
      "Provide accurate, current, and complete information.",
      "Update your information when it changes.",
      "Keep your password and account access confidential.",
      "Notify us promptly if you suspect unauthorised access to your account.",
      "Do not share your account in a way that avoids applicable fees, user limits, or access restrictions.",
    ],
    body: [
      "We may suspend or terminate your account if we believe your account information is false, misleading, insecure, abusive, fraudulent, or in breach of these Terms.",
    ],
  },
  {
    title: "5. Types of Users",
    bullets: [
      "Couples planning a wedding.",
      "Wedding planners and planning teams.",
      "Vendors and service providers.",
      "Guests, bridal party members, or family members invited into a wedding workspace.",
      "Administrative users or team members.",
    ],
    body: [
      "Different user types may have different access levels, permissions, features, subscription plans, or responsibilities.",
      "You are responsible for ensuring that any person you invite into a wedding workspace or organisation account has permission to view or manage the information shared with them.",
    ],
  },
  {
    title: "6. Use of the Platform",
    body: [
      "You may use Zania Weddings only for lawful wedding planning, event management, vendor coordination, communication, budgeting, guest management, and related purposes.",
    ],
    bullets: [
      "Violate any law, regulation, or third-party right.",
      "Upload false, misleading, harmful, abusive, defamatory, discriminatory, or unlawful content.",
      "Harass, threaten, abuse, impersonate, or harm another person.",
      "Upload viruses, malware, scripts, or harmful code.",
      "Attempt to gain unauthorised access to the Platform, accounts, systems, or data.",
      "Scrape, copy, reverse engineer, overload, or interfere with the Platform.",
      "Use the Platform to send spam or unsolicited marketing.",
      "Misrepresent your identity, business, qualifications, pricing, services, or availability.",
      "Upload content that infringes copyright, trademarks, privacy rights, or other intellectual property rights.",
      "Use the Platform for fraud, scams, money laundering, or other illegal activity.",
      "Resell, sublicense, or commercially exploit the Platform without our written permission.",
    ],
  },
  {
    title: "7. Wedding Information and User Content",
    body: [
      "You retain ownership of your User Content. By using Zania Weddings, you grant us a limited licence to host, store, process, display, transmit, back up, and use your User Content only as necessary to provide, secure, maintain, improve, and support the Platform.",
    ],
    bullets: [
      "You have the right to upload or share the User Content.",
      "Your User Content is accurate and lawful.",
      "You have obtained any required consent before uploading another person’s personal information.",
      "You do not upload confidential, sensitive, or private information unless necessary for wedding planning and you have permission to do so.",
    ],
  },
  {
    title: "8. Vendor Listings and Vendor Information",
    body: [
      "Vendors are solely responsible for the accuracy of their profiles, prices, availability, services, representations, qualifications, images, portfolio work, and communication.",
      "Unless expressly stated, Zania Weddings does not guarantee a vendor’s work quality, availability, pricing, licensing, compliance, outcome, or performance.",
      "Vendor verification, where offered, is not a guarantee of performance.",
    ],
  },
  {
    title: "9. Relationships Between Couples, Planners, and Vendors",
    bullets: [
      "Vendor delays, cancellations, no-shows, poor performance, or failure to deliver.",
      "Couple or client non-payment.",
      "Planner or vendor disputes.",
      "Incorrect budgets, timelines, guest counts, or task completion.",
      "Wedding day outcomes.",
      "Losses caused by reliance on information entered by users.",
      "Any offline agreement made between users.",
    ],
    body: [
      "Any contract, quotation, booking, payment, refund, cancellation, dispute, or service delivery arrangement between a couple, planner, vendor, venue, guest, or other third party is solely between those parties.",
    ],
  },
  {
    title: "10. Payments, Subscriptions, and Fees",
    body: [
      "Some parts of Zania Weddings may be free, while others may require payment.",
      "By purchasing a paid plan or service, you agree to pay the fees shown at the time of purchase, including any applicable taxes, transaction fees, or payment processing charges.",
      "We may change our prices or introduce new fees from time to time. Where required, we will give reasonable notice before material pricing changes take effect.",
    ],
  },
  {
    title: "11. Billing and Renewals",
    body: [
      "If you subscribe to a recurring plan, your subscription may automatically renew unless you cancel before the renewal date.",
      "Failure to pay may result in suspension, downgrading, or termination of your access to paid features.",
    ],
  },
  {
    title: "12. Cancellations and Refunds",
    bullets: [
      "Subscription fees are billed in advance.",
      "Cancellation takes effect at the end of the current billing period.",
      "We do not provide refunds for unused portions of a billing period.",
      "One-off fees, featured listing fees, lead fees, or digital service fees may be non-refundable once the service has been accessed, used, delivered, or activated.",
    ],
    body: [
      "We may consider refund requests on a case-by-case basis, especially where required by applicable law, where a duplicate payment was made, or where there has been a clear billing error.",
    ],
  },
  {
    title: "13. Free Trials, Beta Access, and Early Access",
    body: [
      "Beta features may be incomplete, experimental, unstable, or changed without notice. You use beta features at your own risk.",
      "Feedback you provide during beta testing may be used by Zania Weddings to improve the Platform without compensation, unless otherwise agreed in writing.",
    ],
  },
  {
    title: "14. AI-Assisted Features",
    body: [
      "AI-assisted outputs are provided for convenience and planning support only. They may be incomplete, inaccurate, inappropriate, outdated, or unsuitable for your specific wedding.",
      "You are responsible for reviewing and confirming any AI-generated suggestions before relying on them.",
      "Zania Weddings does not guarantee that AI-generated recommendations will be correct, complete, culturally appropriate, legally compliant, financially suitable, or operationally practical.",
    ],
  },
  {
    title: "15. Privacy and Data Protection",
    body: [
      "Your use of Zania Weddings is also governed by our Privacy Policy.",
      "We will handle personal data in accordance with applicable data protection laws, including Kenya’s Data Protection Act, 2019, where applicable.",
      "No digital system is completely secure. You acknowledge that you use the Platform with an understanding of these risks.",
    ],
  },
  {
    title: "16. Confidentiality",
    body: [
      "You agree not to misuse, disclose, copy, export, or share information from another user’s wedding workspace unless you have permission.",
      "Planners, vendors, guests, and invited collaborators must respect the confidentiality of information they access through the Platform.",
    ],
  },
  {
    title: "17. Third-Party Services",
    body: [
      "Zania Weddings may rely on third-party services to operate the Platform, including hosting providers, payment processors, analytics tools, email services, SMS or WhatsApp providers, AI service providers, maps, authentication providers, and other technology partners.",
      "We are not responsible for failures, outages, delays, errors, policy changes, data practices, or actions of third-party providers.",
    ],
  },
  {
    title: "18. Communications",
    body: [
      "By using Zania Weddings, you agree that we may send you service-related communications, including account notices, security alerts, payment reminders, product updates, support messages, and important legal notices.",
      "You may opt out of marketing communications using the unsubscribe option or by contacting us.",
    ],
  },
  {
    title: "19. Support and Availability",
    body: [
      "We do not guarantee that the Platform will always be uninterrupted, error-free, secure, or available at all times.",
      "The Platform may be unavailable due to maintenance, updates, technical issues, third-party failures, internet problems, security incidents, or events beyond our control.",
      "Support response times may vary depending on your plan, issue type, and available support capacity.",
    ],
  },
  {
    title: "20. Fair Use and Resource Limits",
    body: [
      "Zania Weddings provides digital resources such as storage, messaging, files, planning tools, timelines, budgets, vendor data, and related features.",
      "You agree to use these resources reasonably and only for genuine wedding planning, vendor management, or event-related purposes.",
      "We may introduce storage limits, file size limits, user limits, workspace limits, message limits, vendor listing limits, or other reasonable restrictions.",
      "If your usage is excessive or harmful, we may contact you, limit features, request that you reduce usage, require a plan upgrade, suspend access, or terminate your account.",
    ],
    bullets: [
      "Use the Platform mainly as a general file storage or backup service.",
      "Upload files unrelated to wedding planning or event management.",
      "Upload excessive, harmful, illegal, or infringing content.",
      "Share accounts to avoid paying applicable fees.",
      "Use automated tools to overload, scrape, export, or abuse the Platform.",
      "Use the Platform in a way that harms performance for other users.",
    ],
  },
  {
    title: "21. Intellectual Property",
    body: [
      "Zania Weddings, including its design, software, branding, name, logo, features, workflows, templates, databases, content, and technology, is owned by Zania Weddings or its licensors and is protected by applicable intellectual property laws.",
      "You may not copy, reproduce, modify, distribute, sell, lease, reverse engineer, or create derivative works from the Platform without our written permission.",
      "You may not use the Zania Weddings name, logo, brand assets, screenshots, or promotional materials in a misleading way or without permission.",
    ],
  },
  {
    title: "22. Templates and Platform Content",
    body: [
      "Zania Weddings may provide templates, checklists, timelines, budget categories, planning guides, vendor questions, suggested workflows, or other content.",
      "These materials are provided for general planning support only. They are not professional advice and may not fit every wedding, culture, budget, religion, venue, family structure, or legal requirement.",
      "You are responsible for adapting any templates or suggestions to your own situation.",
    ],
  },
  {
    title: "23. Feedback and Suggestions",
    body: [
      "If you send us feedback, suggestions, ideas, feature requests, or improvements, you grant Zania Weddings permission to use them without restriction or compensation.",
      "This does not give us ownership of your private wedding data or User Content.",
    ],
  },
  {
    title: "24. Suspension and Termination",
    body: [
      "You may stop using Zania Weddings at any time.",
      "You may request account deletion by contacting us or using account settings where available.",
      "After termination, you may lose access to your account, workspaces, files, messages, vendor leads, planning data, and other content.",
      "We may retain certain information where required for legal, security, fraud prevention, accounting, dispute resolution, or compliance purposes.",
    ],
    bullets: [
      "You breach these Terms.",
      "You fail to pay applicable fees.",
      "We suspect fraud, abuse, misuse, or unlawful activity.",
      "Your use creates risk for other users, the Platform, or third parties.",
      "We are required to do so by law.",
      "We discontinue the Platform or a part of the Service.",
    ],
  },
  {
    title: "25. Account Deletion and Data Export",
    body: [
      "Where available, you may export your data before deleting your account or ending your subscription.",
      "We may provide tools for downloading wedding data, timelines, budgets, guest lists, or other information, depending on your plan and the technical state of the Platform.",
      "Once an account or workspace is deleted, recovery may not be possible.",
      "We may retain backups for a limited period before deletion from backup systems.",
    ],
  },
  {
    title: "26. Disclaimers",
    body: [
      "Zania Weddings is provided on an as is and as available basis.",
      "You use the Platform at your own risk.",
    ],
    bullets: [
      "The Platform will meet your expectations.",
      "The Platform will prevent wedding planning mistakes.",
      "Vendors will perform as expected.",
      "Budgets, timelines, or recommendations will be accurate.",
      "AI-assisted outputs will be correct.",
      "The Platform will be uninterrupted, secure, or error-free.",
      "Defects will always be corrected.",
      "The Platform will be suitable for every wedding, planner, vendor, culture, religion, budget, or event type.",
    ],
  },
  {
    title: "27. Limitation of Liability",
    body: [
      "To the maximum extent permitted by law, Zania Weddings, its founders, employees, contractors, partners, affiliates, and service providers will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages.",
      "Where liability cannot be fully excluded under applicable law, our total liability will be limited to the amount you paid to Zania Weddings for the relevant service in the three months immediately before the claim arose, or Kenya Shillings 100,000, whichever is greater.",
    ],
    bullets: [
      "Loss of profits.",
      "Loss of business.",
      "Loss of data.",
      "Loss of goodwill.",
      "Wedding disruption.",
      "Vendor failure.",
      "Planning errors.",
      "Missed deadlines.",
      "Emotional distress.",
      "Reputational harm.",
      "Payment disputes between users.",
      "Third-party service failures.",
    ],
  },
];

export default function TermsOfService() {
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
              Zania Weddings Terms of Service
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Last updated: {LAST_UPDATED}
            </p>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[70vh] pr-5">
              <div className="space-y-8">
                {sections.map((section) => (
                  <section key={section.title} className="space-y-3">
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
                  </section>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
