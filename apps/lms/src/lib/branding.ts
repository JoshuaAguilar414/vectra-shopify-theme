export type LmsBranding = {
  tenant: "vectra";
  productName: string;
  clientName: string;
  vendorName: string;
  vendorUrl: string;
  description: string;
  mailFromName: string;
};

export function getBranding(): LmsBranding {
  const productName = process.env.LMS_PRODUCT_NAME || "VECTRA Academy";
  return {
    tenant: "vectra",
    productName,
    clientName: process.env.LMS_CLIENT_NAME || "VECTRA International",
    vendorName: process.env.LMS_VENDOR_NAME || "VECTRA",
    vendorUrl: process.env.LMS_VENDOR_URL || "https://vectra-intl.com/",
    description: process.env.LMS_DESCRIPTION || "VECTRA International learning management system",
    mailFromName: process.env.LMS_MAIL_FROM_NAME || productName
  };
}
