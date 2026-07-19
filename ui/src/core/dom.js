/** Small, checked DOM helpers shared by feature modules. */

const SAFE_STYLE_PROPERTIES = new Set([
  "background",
  "backgroundColor",
  "color",
  "display",
  "height",
  "left",
  "opacity",
  "right",
  "top",
  "transform",
  "width",
]);

/**
 * @template {Element} T
 * @param {string} id
 * @param {Document|DocumentFragment} [root]
 * @returns {T|null}
 */
export function byId(id, root = document) {
  if (root instanceof Document) {
    return /** @type {T|null} */ (root.getElementById(id));
  }
  return /** @type {T|null} */ (root.querySelector(`#${CSS.escape(id)}`));
}

/**
 * @template {Element} T
 * @param {string} id
 * @param {Document|DocumentFragment} [root]
 * @returns {T}
 */
export function requireById(id, root = document) {
  const element = byId(id, root);
  if (!element) throw new Error(`Required element #${id} is missing.`);
  return /** @type {T} */ (element);
}

/**
 * @param {string|Element} target
 * @param {unknown} value
 */
export function setText(target, value) {
  const element = typeof target === "string" ? requireById(target) : target;
  element.textContent = value == null ? "" : String(value);
}

/**
 * Apply the standard positive/negative semantic color to an optional value.
 *
 * @param {string|HTMLElement} target
 * @param {number|null|undefined} value
 */
export function colorSign(target, value) {
  const element =
    typeof target === "string" ? /** @type {HTMLElement} */ (requireById(target)) : target;
  element.style.color = value == null ? "" : value >= 0 ? "var(--good)" : "var(--bad)";
}

/**
 * @param {Element} element
 * @param {boolean} visible
 * @param {string} [hiddenClass]
 */
export function setVisible(element, visible, hiddenClass = "hidden") {
  element.classList.toggle(hiddenClass, !visible);
}

/**
 * Accept same-origin relative URLs and explicit HTTP(S) URLs only.
 *
 * @param {string|URL} value
 * @param {string} [base]
 * @returns {string}
 */
export function safeUrl(value, base = window.location.href) {
  const source = String(value).trim();
  if (!source) return "";
  const url = new URL(source, base);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError(`Blocked unsafe URL protocol: ${url.protocol}`);
  }
  return source.startsWith("/") || source.startsWith("#") || source.startsWith("?")
    ? source
    : url.href;
}

/**
 * @param {HTMLAnchorElement} anchor
 * @param {string|URL} value
 */
export function setSafeHref(anchor, value) {
  anchor.href = safeUrl(value);
}

/**
 * Set a dynamic style without permitting declaration injection or URL loads.
 *
 * @param {HTMLElement|SVGElement} element
 * @param {string} property
 * @param {string|number} value
 */
export function setStyleValue(element, property, value) {
  if (!SAFE_STYLE_PROPERTIES.has(property) && !property.startsWith("--")) {
    throw new TypeError(`Dynamic style property is not allowlisted: ${property}`);
  }
  const text = String(value);
  if (/url\s*\(|expression\s*\(|[;\u0000-\u001f]/iu.test(text)) {
    throw new TypeError("Dynamic style value contains unsafe syntax.");
  }
  if (property.startsWith("--")) {
    element.style.setProperty(property, text);
  } else {
    Reflect.set(element.style, property, text);
  }
}

/**
 * @param {HTMLElement|SVGElement} element
 * @param {"width"|"height"|"left"|"top"|"right"} property
 * @param {number} value
 */
export function setPercentStyle(element, property, value) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  setStyleValue(element, property, `${percent}%`);
}
