/**
 * Assign a key onto a plain record, guarding the one key that is unsafe to
 * store normally on plain objects: `__proto__`.
 *
 * Attribute and element records are plain `{}` objects rather than
 * null-prototype objects. Null-prototype objects (via `Object.create(null)`
 * or a `{ __proto__: null }` literal) get a unique dictionary-mode map per
 * object in V8, which makes the store site's inline cache churn on every
 * record. On large parse functions that churn permanently blocks
 * optimization ("delaying optimization, IC changed"), costing up to 7x
 * throughput for elements with a single attribute. Plain objects share
 * hidden classes, so store sites stay monomorphic and the parsers optimize
 * normally.
 *
 * A normal `record['__proto__'] = value` store on a plain object would walk
 * the `Object.prototype.__proto__` setter instead of creating an own
 * property (losing the entry, or mutating the record's prototype when the
 * value is an object or `null`), so that key is defined explicitly. This
 * keeps the prototype-pollution guarantees: dangerous names become own
 * properties and `Object.prototype` is never touched.
 */
export function setOwnProperty<T>(
  target: Record<string, T>,
  key: string,
  value: NoInfer<T>,
): void {
  if (key === '__proto__') {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } else {
    target[key] = value;
  }
}
