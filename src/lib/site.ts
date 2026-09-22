// Only the site URL lives here (it's tied to the deployment). Everything else — store name, contact
// details, bundle pricing, homepage text — is edited in Admin → Settings (see lib/settings.ts).
export const site = {
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
};

export { telHref, waLink, bundleOffFor } from "./settings-shared";
