export type VendorEnquiryEmail = {
  enquiryId: string;
  idempotencyKey: string;
  responseToken: string;
  recipientName: string;
  recipientEmail: string;
  senderName: string;
  subject: string;
  message: string;
};

export type VendorEnquiryDeliveryResult = {
  ok: boolean;
  provider: "resend";
  providerMessageId: string | null;
  error: string | null;
};

export type VendorEnquiryDelivery = (
  email: VendorEnquiryEmail,
) => Promise<VendorEnquiryDeliveryResult>;

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export const deliverVendorEnquiryWithResend: VendorEnquiryDelivery = async (email) => {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "Zania <hello@planwithzania.com>";
  if (!apiKey) {
    return { ok: false, provider: "resend", providerMessageId: null, error: "Email delivery is not configured." };
  }

  const safeRecipient = htmlEscape(email.recipientName);
  const safeSender = htmlEscape(email.senderName);
  const safeMessage = htmlEscape(email.message).replaceAll("\n", "<br />");
  const appUrl = (Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("SITE_URL") || "https://www.planwithzania.com").replace(/\/$/, "");
  const responseUrl = `${appUrl}/vendor-enquiry/respond/${encodeURIComponent(email.responseToken)}`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `zania-vendor-enquiry/${email.idempotencyKey}`,
      },
      body: JSON.stringify({
        from,
        to: [email.recipientEmail],
        subject: email.subject,
        text: `${email.message}\n\nRespond securely: ${responseUrl}\n\nSent by ${email.senderName} through Zania.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #292524; line-height: 1.65;">
            <h1 style="font-family: Georgia, serif; font-size: 24px;">Vendor enquiry</h1>
            <p>Hi ${safeRecipient},</p>
            <p>${safeMessage}</p>
            <p style="margin: 28px 0;">
              <a href="${responseUrl}" style="display: inline-block; border-radius: 8px; background: #c64f2b; color: white; padding: 12px 18px; text-decoration: none; font-weight: 600;">Respond to this enquiry</a>
            </p>
            <p style="margin-top: 28px; color: #57534e;">Sent by <strong>${safeSender}</strong> through Zania.</p>
            <p style="font-size: 12px; color: #78716c;">This response link expires after 30 days. The enquiry and any indicative amount do not confirm a booking or a formal quote.</p>
          </div>
        `,
      }),
    });
    if (!response.ok) {
      console.error("vendor enquiry Resend error", response.status, await response.text());
      return { ok: false, provider: "resend", providerMessageId: null, error: "The email provider did not accept this enquiry." };
    }
    const payload = await response.json().catch(() => ({}));
    return {
      ok: true,
      provider: "resend",
      providerMessageId: typeof payload?.id === "string" ? payload.id : null,
      error: null,
    };
  } catch (error) {
    console.error("vendor enquiry delivery error", error);
    return { ok: false, provider: "resend", providerMessageId: null, error: "The email provider could not be reached." };
  }
};
