/** Minimal RFC 8785-compatible canonical JSON for parsed JSON values.
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from "node:crypto";

const assertUnicodeScalarString = (value) => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new TypeError("Canonical JSON rejects lone UTF-16 high surrogates");
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError("Canonical JSON rejects lone UTF-16 low surrogates");
    }
  }
};

const canonicalJson = (value) => {
  if (value === null) return "null";
  if (typeof value === "string") {
    assertUnicodeScalarString(value);
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.keys(value).sort().map((key) => {
      assertUnicodeScalarString(key);
      if (value[key] === undefined) throw new TypeError(`Canonical JSON rejects undefined at property ${key}`);
      return `${JSON.stringify(key)}:${canonicalJson(value[key])}`;
    });
    return `{${entries.join(",")}}`;
  }
  throw new TypeError(`Canonical JSON rejects ${typeof value}`);
};

const sha256 = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;

const canonicalHashWithout = (value, hashField) => {
  const copy = structuredClone(value);
  delete copy[hashField];
  return sha256(canonicalJson(copy));
};

export { canonicalHashWithout, canonicalJson, sha256 };
