/**
 * WhatsApp Cloud API — OTP sender.
 * Uses the same phone-number-id / access token as WhatsApp_Config__mdt in
 * Salesforce. The OTP template must be a Meta "authentication" category
 * template (those require a body {{1}} parameter AND a copy-code button
 * parameter — both receive the code).
 *
 * While the template is not approved yet, set OTP_DEV_MODE=true and the
 * code is printed to the server console instead.
 */

export async function sendOtp(phone10: string, code: string): Promise<void> {
  if (process.env.OTP_DEV_MODE === "true") {
    console.log(`[OTP_DEV_MODE] Code for +91${phone10}: ${code}`);
    return;
  }

  const token = process.env.WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const template = process.env.WA_OTP_TEMPLATE ?? "nn_login_code";
  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp Cloud API is not configured");
  }

  // Meta "authentication" templates carry a copy-code button, and the API
  // rejects the send unless the button parameter is supplied too. If you
  // approved a plain utility template with no button, set
  // WA_OTP_BUTTON=false or the send fails with error 132000.
  const components: unknown[] = [
    { type: "body", parameters: [{ type: "text", text: code }] },
  ];
  if (process.env.WA_OTP_BUTTON !== "false") {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: code }],
    });
  }

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: `+91${phone10}`,
        type: "template",
        template: {
          name: template,
          language: { code: "en_US" },
          components,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`WhatsApp OTP send failed (${res.status}): ${text}`);
  }
}
