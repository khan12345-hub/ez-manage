const BACKEND = process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? '';

/**
 * Resolves a stored file/avatar URL to a fully-qualified URL.
 *
 * - Absolute URLs (http/https/protocol-relative) → returned as-is (BunnyCDN, external)
 * - Relative paths (/uploads/...) → prepend backend base URL (legacy local storage)
 *
 * Also normalises "https//" (missing colon) that older uploads stored in the DB.
 */
export function resolveUrl(url: string | null | undefined): string {
  if (!url) return '';
  // Normalise broken protocol: "https//host" → "https://host"
  let normalized = url;
  if (/^https?\/\//.test(url)) {
    normalized = url.replace('/', ':/');
  }
  if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('//')) {
    return normalized;
  }
  return `${BACKEND}${normalized}`;
}
