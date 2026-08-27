/** Validate repository-local links and immutable release artifacts.
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirectories = new Set([".git", "node_modules", "tmp"]);
const failures = [];
const fail = (message) => failures.push(message);
const pass = (message) => console.log(`PASS ${message}`);

const walk = (directory) => {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
};

const files = walk(root);
const markdownFiles = files.filter((file) => file.endsWith(".md"));
const markdownLink = /!?\[[^\]]*\]\(([^)]+)\)/g;

for (const file of markdownFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const match of source.matchAll(markdownLink)) {
    const raw = match[1].trim();
    const bracketed = raw.match(/^<([^>]+)>/);
    const target = bracketed?.[1] ?? raw.split(/\s+["']/)[0];
    if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(target.split("#")[0].split("?")[0]);
    } catch {
      fail(`${path.relative(root, file)} contains an invalid encoded link: ${target}`);
      continue;
    }
    if (!fs.existsSync(path.resolve(path.dirname(file), decoded))) {
      fail(`${path.relative(root, file)} links to missing path: ${decoded}`);
    }
  }
}
if (!failures.length) pass(`local Markdown links (${markdownFiles.length} files)`);

for (const file of files.filter((candidate) => candidate.endsWith(".json"))) {
  try {
    JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(`${path.relative(root, file)} is not valid JSON: ${error.message}`);
  }
}
if (!failures.length) pass("repository JSON syntax");

const secretPatterns = [
  /ghp_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /DEEPSEEK_API_KEY\s*=\s*\S+/,
];
const binaryExtensions = new Set([".pdf", ".png", ".zip", ".pyc"]);
for (const file of files) {
  if (binaryExtensions.has(path.extname(file).toLowerCase()) || fs.statSync(file).size > 2 * 1024 * 1024) continue;
  const source = fs.readFileSync(file, "utf8");
  if (secretPatterns.some((pattern) => pattern.test(source))) {
    fail(`${path.relative(root, file)} contains a credential-like value`);
  }
}
if (!failures.length) pass("credential-pattern scan");

const provenanceSource = fs.readFileSync(path.join(root, "assets", "PROVENANCE.yml"), "utf8");
const provenanceEntry = /  - path: "([^"]+)"[\s\S]*?    sha256: "([0-9a-f]{64})"/g;
let provenanceCount = 0;
for (const match of provenanceSource.matchAll(provenanceEntry)) {
  provenanceCount += 1;
  const [, relative, expected] = match;
  const asset = path.join(root, "assets", relative);
  if (!fs.existsSync(asset)) {
    fail(`PROVENANCE.yml references missing asset: ${relative}`);
    continue;
  }
  const actual = crypto.createHash("sha256").update(fs.readFileSync(asset)).digest("hex");
  if (actual !== expected) fail(`asset provenance checksum mismatch: ${relative}`);
}
if (provenanceCount !== 6) fail(`PROVENANCE.yml contains ${provenanceCount} hashed assets; expected 6`);
if (!failures.length) pass("asset provenance checksums");

const archiveReadme = fs.readFileSync(path.join(root, "archive", "v0.3", "README.md"), "utf8");
const archiveHash = archiveReadme.match(/SHA-256: `([0-9a-f]{64})`/)?.[1];
const archiveDocument = path.join(root, "archive", "v0.3", "WGP-ABF_Whitepaper_v0.3.zh-CN.md");
const actualArchiveHash = crypto.createHash("sha256").update(fs.readFileSync(archiveDocument)).digest("hex");
if (!archiveHash || archiveHash !== actualArchiveHash) fail("v0.3 archive checksum mismatch");
if (!failures.length) pass("v0.3 source archive checksum");

const releaseDirectory = path.join(root, "output", "release");
const checksumPath = path.join(releaseDirectory, "SHA256SUMS.txt");
const artifactLocations = new Map([
  ["WGP-ABF-Whitepaper-v0.5.0-zh-CN.pdf", path.join(root, "output", "pdf", "WGP-ABF-Whitepaper-v0.5.0-zh-CN.pdf")],
  ["WGP-ABF-Whitepaper-v0.5.0-en.pdf", path.join(root, "output", "pdf", "WGP-ABF-Whitepaper-v0.5.0-en.pdf")],
  ["WGP-ABF-Spec-Bundle-v0.5.0.zip", path.join(releaseDirectory, "WGP-ABF-Spec-Bundle-v0.5.0.zip")],
]);

if (!fs.existsSync(checksumPath)) {
  fail("output/release/SHA256SUMS.txt is missing; run scripts/build_release.py");
} else {
  const checksumLines = fs.readFileSync(checksumPath, "utf8").trim().split(/\r?\n/);
  const seen = new Set();
  for (const line of checksumLines) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    if (!match) {
      fail(`invalid SHA256SUMS line: ${line}`);
      continue;
    }
    const [, expected, name] = match;
    const artifact = artifactLocations.get(name);
    if (!artifact || !fs.existsSync(artifact)) {
      fail(`SHA256SUMS references a missing or unexpected artifact: ${name}`);
      continue;
    }
    const actual = crypto.createHash("sha256").update(fs.readFileSync(artifact)).digest("hex");
    if (actual !== expected) fail(`checksum mismatch: ${name}`);
    seen.add(name);
  }
  for (const name of artifactLocations.keys()) {
    if (!seen.has(name)) fail(`SHA256SUMS omits release artifact: ${name}`);
  }
  if (!failures.length) pass("release artifact checksums");
}

const citation = fs.readFileSync(path.join(root, "CITATION.cff"), "utf8");
for (const required of [
  'cff-version: 1.2.0',
  'version: "0.5.0"',
  'repository-code: "https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow"',
]) {
  if (!citation.includes(required)) fail(`CITATION.cff is missing: ${required}`);
}
if (!failures.length) pass("citation metadata");

if (failures.length) {
  for (const message of failures) console.error(`FAIL ${message}`);
  console.error(`\n${failures.length} repository validation failure(s).`);
  process.exit(1);
}
