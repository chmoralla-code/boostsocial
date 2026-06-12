const DEFAULT_ADMIN_EMAILS = ["admin@boostsocial.com"];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function getAllowedAdminEmails() {
  const configured = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => normalize(email))
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  return DEFAULT_ADMIN_EMAILS;
}

export function getAllowedAdminDomain() {
  return process.env.ADMIN_EMAIL_DOMAIN ? normalize(process.env.ADMIN_EMAIL_DOMAIN) : "";
}

export function isAdminEmail(email?: string | null) {
  if (!email) return false;

  const normalizedEmail = normalize(email);
  const allowedEmails = getAllowedAdminEmails();
  if (allowedEmails.includes(normalizedEmail)) {
    return true;
  }

  const allowedDomain = getAllowedAdminDomain();
  return Boolean(allowedDomain && normalizedEmail.endsWith(`@${allowedDomain}`));
}
