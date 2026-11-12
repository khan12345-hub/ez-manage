/**
 * Where to send a signed-in user from the login/guest pages: the `?redirect=`
 * target when it is a safe same-site path (e.g. a public form link), else the
 * dashboard. Shared by useLogin and the login/guest guards so they can't race
 * each other to different destinations.
 */
export function postLoginPath(search?: string): string {
  const qs = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const redirect = new URLSearchParams(qs).get("redirect");
  const isSafe = !!redirect && redirect.startsWith("/") && !redirect.startsWith("//") && !redirect.startsWith("/\\");
  return isSafe ? redirect! : "/home";
}
