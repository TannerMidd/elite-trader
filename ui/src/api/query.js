/**
 * @typedef {string|number|boolean|null|undefined} QueryScalar
 * @typedef {QueryScalar|readonly QueryScalar[]} QueryValue
 */

/**
 * Build a same-origin API URL without leaking `undefined` or `null` into the
 * query string. Arrays use the comma-separated convention used by the server.
 *
 * @param {string} path
 * @param {Record<string, QueryValue>} [parameters]
 * @returns {string}
 */
export function withQuery(path, parameters = {}) {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(parameters)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      const members = value.filter((member) => member !== null && member !== undefined);
      if (members.length > 0) query.set(name, members.join(","));
      continue;
    }
    query.set(name, String(value));
  }
  const encoded = query.toString();
  return encoded ? `${path}?${encoded}` : path;
}

/**
 * Encode a dynamic path component and reject missing identifiers early.
 *
 * @param {string|number} value
 * @returns {string}
 */
export function pathSegment(value) {
  const segment = String(value).trim();
  if (!segment) throw new TypeError("An API path identifier is required.");
  return encodeURIComponent(segment);
}
