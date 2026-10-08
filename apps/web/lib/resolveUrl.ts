const BACKEND = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? '';

/**
 * Resolves a stored file/avatar URL to a fully-qualified URL.
 *
 * - Absolute URLs (http/https/protocol-relative) → returned as-is (BunnyCDN, external)
 * - Relative paths (/uploads/...) → prepend backend base URL (legacy local storage)
 */
export function resolveUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('//')) return url;
  return `${BACKEND}${url}`;
}
