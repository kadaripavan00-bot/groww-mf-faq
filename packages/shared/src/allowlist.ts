// Official source domains. Mirrored client/server; changing this changes
// what the citation validator accepts, so it lives in shared/.
export const ALLOWLISTED_HOSTS = ["groww.in", "amfiindia.com", "sebi.gov.in"];

export function isAllowlistedUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ALLOWLISTED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}
