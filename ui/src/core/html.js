/**
 * Safe-by-default string templates for the existing imperative DOM renderer.
 *
 * Every interpolation is escaped unless it is another branded template or an
 * explicitly reviewed raw fragment. DOM writes are centralized in render().
 */

const TEMPLATE_BRAND = Symbol("FrameshiftTemplate");
const RAW_BRAND = Symbol("FrameshiftRawHtml");

/**
 * @typedef {object} TemplateResult
 * @property {typeof TEMPLATE_BRAND} brand
 * @property {string} value
 */

/**
 * @typedef {object} RawHtml
 * @property {typeof RAW_BRAND} brand
 * @property {string} value
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Mark a reviewed, application-owned HTML fragment as trusted.
 *
 * Do not pass API, journal, EDDN, localStorage, or user-entered strings here.
 * This escape hatch exists only for reviewed static SVG/markup fragments.
 *
 * @param {string} value
 * @returns {RawHtml}
 */
export function raw(value) {
  if (typeof value !== "string") {
    throw new TypeError("raw() accepts only a reviewed HTML string.");
  }
  return Object.freeze({ brand: RAW_BRAND, value });
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function interpolate(value) {
  if (value == null || value === false) return "";
  if (Array.isArray(value)) return value.map(interpolate).join("");
  if (
    typeof value === "object" &&
    value !== null &&
    (Reflect.get(value, "brand") === TEMPLATE_BRAND || Reflect.get(value, "brand") === RAW_BRAND)
  ) {
    return String(Reflect.get(value, "value"));
  }
  return escapeHtml(value);
}

/**
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {TemplateResult}
 */
export function html(strings, ...values) {
  let value = strings[0] ?? "";
  for (let index = 0; index < values.length; index += 1) {
    value += interpolate(values[index]) + (strings[index + 1] ?? "");
  }
  return Object.freeze({ brand: TEMPLATE_BRAND, value });
}

/**
 * @param {unknown} template
 * @returns {string}
 */
export function renderToString(template) {
  if (
    typeof template !== "object" ||
    template === null ||
    (Reflect.get(template, "brand") !== TEMPLATE_BRAND &&
      Reflect.get(template, "brand") !== RAW_BRAND)
  ) {
    throw new TypeError("render() requires an html`` or raw() result.");
  }
  return String(Reflect.get(template, "value"));
}

/**
 * The only permitted dynamic innerHTML sink in application modules.
 *
 * @param {Element} target
 * @param {TemplateResult|RawHtml} template
 * @returns {Element}
 */
export function render(target, template) {
  if (!(target instanceof Element)) {
    throw new TypeError("render() target must be a DOM Element.");
  }
  target.innerHTML = renderToString(template);
  return target;
}

/**
 * @param {Element} target
 */
export function clear(target) {
  if (!(target instanceof Element)) {
    throw new TypeError("clear() target must be a DOM Element.");
  }
  target.replaceChildren();
}
