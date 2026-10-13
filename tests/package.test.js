import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPackage,
  listZipEntries,
  RUNTIME_FILES,
  validatePackageInputs,
  verifyPackage,
} from "../scripts/package-extension.js";

const temporaryDirectories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(tmpdir(), "dreaming-package-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function fixtureDirectory() {
  const directory = await temporaryDirectory();
  for (const file of [...RUNTIME_FILES, "package.json"]) {
    await mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await copyFile(path.join(process.cwd(), file), path.join(directory, file));
  }
  return directory;
}

async function updateJson(directory, file, update) {
  const filePath = path.join(directory, file);
  const value = JSON.parse(await readFile(filePath, "utf8"));
  update(value);
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    force: true,
    recursive: true,
  })));
});

describe("beta packaging", () => {
  it("validates manifest references and matching versions", async () => {
    const result = await validatePackageInputs(process.cwd());

    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.files).toEqual(RUNTIME_FILES);
  });

  it("creates an archive containing exactly the runtime allowlist", async () => {
    const directory = await temporaryDirectory();
    const output = path.join(directory, "extension.zip");

    await createPackage(process.cwd(), output);

    expect(listZipEntries(await readFile(output))).toEqual(RUNTIME_FILES);
  });

  it("creates byte-identical archives from unchanged inputs", async () => {
    const directory = await temporaryDirectory();
    const first = path.join(directory, "first.zip");
    const second = path.join(directory, "second.zip");

    await createPackage(process.cwd(), first);
    await createPackage(process.cwd(), second);

    expect(await readFile(second)).toEqual(await readFile(first));
  });

  it("rejects malformed ZIP structures", async () => {
    expect(() => listZipEntries(Buffer.alloc(10))).toThrow("end-of-central-directory");

    const directory = await temporaryDirectory();
    const output = path.join(directory, "extension.zip");
    const archive = await createPackage(process.cwd(), output);
    const corrupted = Buffer.from(archive);
    const endOffset = corrupted.length - 22;
    const centralOffset = corrupted.readUInt32LE(endOffset + 16);
    corrupted.writeUInt32LE(0, centralOffset);
    expect(() => listZipEntries(corrupted)).toThrow("central-directory entry");
  });

  it("rejects mismatched and malformed versions", async () => {
    const mismatch = await fixtureDirectory();
    await updateJson(mismatch, "package.json", (value) => { value.version = "9.9.9"; });
    await expect(validatePackageInputs(mismatch)).rejects.toThrow("Version mismatch");

    const malformed = await fixtureDirectory();
    await updateJson(malformed, "manifest.json", (value) => { value.version = "0.4"; });
    await updateJson(malformed, "package.json", (value) => { value.version = "0.4"; });
    await expect(validatePackageInputs(malformed)).rejects.toThrow("Unsupported extension version");
  });

  it("rejects manifest references outside the runtime allowlist", async () => {
    const directory = await fixtureDirectory();
    await updateJson(directory, "manifest.json", (value) => { value.options_ui.page = "unexpected.html"; });
    await expect(validatePackageInputs(directory)).rejects.toThrow("outside the runtime allowlist");
  });

  it("rejects missing files and invalid icon dimensions", async () => {
    const missing = await fixtureDirectory();
    await rm(path.join(missing, "src/core.js"));
    await expect(validatePackageInputs(missing)).rejects.toThrow();

    const invalidIcon = await fixtureDirectory();
    await writeFile(path.join(invalidIcon, "icons/icon-16.png"), Buffer.alloc(24));
    await expect(validatePackageInputs(invalidIcon)).rejects.toThrow("Icon dimensions");
  });

  it("rejects archives whose entries differ from the allowlist", async () => {
    const directory = await temporaryDirectory();
    const output = path.join(directory, "extension.zip");
    const archive = await createPackage(process.cwd(), output);
    const altered = Buffer.from(archive.toString("binary").replaceAll("manifest.json", "xanifest.json"), "binary");
    await writeFile(output, altered);

    await expect(verifyPackage(process.cwd(), output)).rejects.toThrow("differ from runtime allowlist");
  });
});
