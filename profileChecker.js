// profileChecker.js
// Server-side port of the userscript's formatSlug() + checkProfile() logic.
// No CORS concerns here since this runs in Node, not a browser — so we don't
// need GM_xmlhttpRequest, we can just use fetch directly.

const PROFILE_BASE_URL = 'https://tester.test.io/profile_pages/';
const REQUEST_TIMEOUT_MS = 8000;

export function formatSlug(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/\./g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Checks whether a Test IO profile exists for a given display name.
 * @param {string} name
 * @returns {Promise<{name: string, slug: string, url: string, found: boolean, timedOut?: boolean}>}
 */
export async function checkProfile(name) {
  const slug = formatSlug(name);
  const url = PROFILE_BASE_URL + slug;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    return { name, slug, url, found: res.status === 200 };
  } catch (err) {
    const timedOut = err.name === 'AbortError';
    return { name, slug, url, found: false, timedOut };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Checks a batch of names in parallel, same as Promise.all(names.map(checkProfile))
 * in the original script.
 * @param {string[]} names
 */
export async function checkProfiles(names) {
  return Promise.all(names.map(checkProfile));
}
