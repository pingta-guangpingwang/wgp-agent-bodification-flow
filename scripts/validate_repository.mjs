/** Validate repository-local links and immutable release artifacts.
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
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

const packageMetadata = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (packageMetadata.version !== "0.6.0") fail(`package.json version is ${packageMetadata.version}; expected 0.6.0`);
else pass("package version 0.6.0");

const schemaNames = [
  "abir.schema.json",
  "assembly-recipe.schema.json",
  "recipe-diff.schema.json",
  "runtime-event.schema.json",
  "evaluation.schema.json",
  "standard-part-descriptor.schema.json",
  "module-data-contract.schema.json",
];
for (const name of schemaNames) {
  const schema = JSON.parse(fs.readFileSync(path.join(root, "spec", name), "utf8"));
  const expectedId = `https://raw.githubusercontent.com/pingta-guangpingwang/wgp-agent-bodification-flow/v0.6.0/spec/${name}`;
  if (schema.$id !== expectedId) fail(`${name} has non-release $id: ${schema.$id}`);
  if (!schema.properties?.format?.const?.endsWith("/0.6")) fail(`${name} does not belong to the /0.6 format family`);
}
if (!failures.length) pass("seven tag-pinned /0.6 schemas");

const home = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const currentLink of [
  "releases/tag/v0.6.0",
  "whitepaper/WGP-ABF_Whitepaper_v0.6.zh-CN.md",
  "whitepaper/WGP-ABF_Whitepaper_v0.6.en.md",
  "output/pdf/WGP-ABF-Whitepaper-v0.6.0-zh-CN.pdf",
  "output/pdf/WGP-ABF-Whitepaper-v0.6.0-en.pdf",
]) {
  if (!home.includes(currentLink)) fail(`README.md is missing current release link: ${currentLink}`);
}
if (!failures.length) pass("current README release links");

const releaseAssetBase = "https://github.com/pingta-guangpingwang/wgp-agent-bodification-flow/releases/download/v0.6.0";
const releaseAssetUrls = [
  `${releaseAssetBase}/WGP-ABF-Whitepaper-v0.6.0-zh-CN.pdf`,
  `${releaseAssetBase}/WGP-ABF-Whitepaper-v0.6.0-en.pdf`,
  `${releaseAssetBase}/WGP-ABF-Spec-Bundle-v0.6.0.zip`,
  `${releaseAssetBase}/WGP-ABF-v0.6.0-SHA256SUMS.txt`,
];
for (const readmeName of ["README.md", "README.zh-CN.md", "README.en.md"]) {
  const source = fs.readFileSync(path.join(root, readmeName), "utf8");
  for (const releaseAssetUrl of releaseAssetUrls) {
    if (!source.includes(releaseAssetUrl)) {
      fail(`${readmeName} is missing release asset URL: ${releaseAssetUrl}`);
    }
  }
}
if (!failures.length) pass("current direct release-asset links in all README editions");

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
  /github_pat_[A-Za-z0-9_]{20,}/,
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
if (provenanceCount !== 12) fail(`PROVENANCE.yml contains ${provenanceCount} hashed assets; expected 12`);
if (!failures.length) pass("asset provenance checksums");

const archiveReadme = fs.readFileSync(path.join(root, "archive", "v0.3", "README.md"), "utf8");
const archiveHash = archiveReadme.match(/SHA-256: `([0-9a-f]{64})`/)?.[1];
const archiveDocument = path.join(root, "archive", "v0.3", "WGP-ABF_Whitepaper_v0.3.zh-CN.md");
const actualArchiveHash = crypto.createHash("sha256").update(fs.readFileSync(archiveDocument)).digest("hex");
if (!archiveHash || archiveHash !== actualArchiveHash) fail("v0.3 archive checksum mismatch");
if (!failures.length) pass("v0.3 source archive checksum");

const releaseDirectory = path.join(root, "output", "release");
const checksumName = "WGP-ABF-v0.6.0-SHA256SUMS.txt";
const checksumPath = path.join(releaseDirectory, checksumName);
const artifactLocations = new Map([
  ["WGP-ABF-Whitepaper-v0.6.0-zh-CN.pdf", path.join(root, "output", "pdf", "WGP-ABF-Whitepaper-v0.6.0-zh-CN.pdf")],
  ["WGP-ABF-Whitepaper-v0.6.0-en.pdf", path.join(root, "output", "pdf", "WGP-ABF-Whitepaper-v0.6.0-en.pdf")],
  ["WGP-ABF-Spec-Bundle-v0.6.0.zip", path.join(releaseDirectory, "WGP-ABF-Spec-Bundle-v0.6.0.zip")],
]);
const bundlePath = artifactLocations.get("WGP-ABF-Spec-Bundle-v0.6.0.zip");

if (!fs.existsSync(checksumPath)) {
  fail(`output/release/${checksumName} is missing; run scripts/build_release.py`);
} else {
  const checksumSource = fs.readFileSync(checksumPath, "utf8");
  if (!checksumSource.endsWith("\n") || checksumSource.endsWith("\n\n") || checksumSource.includes("\r")) {
    fail(`${checksumName} must use canonical LF-terminated lines`);
  }
  const checksumLines = checksumSource.endsWith("\n")
    ? checksumSource.slice(0, -1).split("\n")
    : checksumSource.split("\n");
  if (checksumLines.length !== artifactLocations.size) {
    fail(`${checksumName} must contain exactly ${artifactLocations.size} entries`);
  }
  const seen = new Set();
  const listedNames = [];
  for (const line of checksumLines) {
    const match = line.match(/^([0-9a-f]{64})  (.+)$/);
    if (!match) {
      fail(`invalid SHA256SUMS line: ${line}`);
      continue;
    }
    const [, expected, name] = match;
    listedNames.push(name);
    const artifact = artifactLocations.get(name);
    if (!artifact || !fs.existsSync(artifact)) {
      fail(`SHA256SUMS references a missing or unexpected artifact: ${name}`);
      continue;
    }
    if (seen.has(name)) {
      fail(`SHA256SUMS contains a duplicate artifact name: ${name}`);
      continue;
    }
    const actual = crypto.createHash("sha256").update(fs.readFileSync(artifact)).digest("hex");
    if (actual !== expected) fail(`checksum mismatch: ${name}`);
    seen.add(name);
  }
  for (const name of artifactLocations.keys()) {
    if (!seen.has(name)) fail(`SHA256SUMS omits release artifact: ${name}`);
  }
  const expectedOrder = [...artifactLocations.keys()];
  if (listedNames.length === expectedOrder.length && listedNames.some((name, index) => name !== expectedOrder[index])) {
    fail(`${checksumName} artifact names are not in canonical order`);
  }
  if (!failures.length) pass("release artifact checksums");
}

if (!fs.existsSync(bundlePath)) {
  fail("output/release/WGP-ABF-Spec-Bundle-v0.6.0.zip is missing; run scripts/build_release.py");
} else {
  const candidates = process.env.PYTHON
    ? [[process.env.PYTHON, []]]
    : process.platform === "win32"
      ? [["py", ["-3"]], ["python", []]]
      : [["python3", []], ["python", []]];
  let interpreter;
  for (const [command, prefixArguments] of candidates) {
    const probe = spawnSync(command, [...prefixArguments, "-c", "import sys; raise SystemExit(sys.version_info < (3, 10))"], {
      cwd: root,
      encoding: "utf8",
    });
    if (probe.error?.code === "ENOENT" || probe.status !== 0) continue;
    interpreter = [command, prefixArguments];
    break;
  }
  if (!interpreter) {
    fail("release bundle verifier could not find Python 3");
  } else {
    const [command, prefixArguments] = interpreter;
    const verifier = spawnSync(
      command,
      [...prefixArguments, "-B", "scripts/verify_release_bundle.py", "--local-index"],
      { cwd: root, encoding: "utf8" },
    );
    if (verifier.status !== 0) {
      const detail = `${verifier.stdout ?? ""}\n${verifier.stderr ?? ""}`.trim().split(/\r?\n/).at(-1);
      fail(`release bundle verifier failed${detail ? `: ${detail}` : ""}`);
    } else if (!failures.length) {
      pass("release bundle exact-membership and staged-index-byte verification");
    }
  }
}

const citation = fs.readFileSync(path.join(root, "CITATION.cff"), "utf8");
for (const required of [
  'cff-version: 1.2.0',
  'version: "0.6.0"',
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
