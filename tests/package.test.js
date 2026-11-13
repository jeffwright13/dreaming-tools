import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createPackage,
  extractZip,
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

describe("release packaging", () => {
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

  // A release ZIP is what was tested and published; rebuilding it from
  // changed sources must not silently replace it.
  describe("protecting an existing release archive", () => {
    it("accepts a rebuild with identical contents", async () => {
      const directory = await temporaryDirectory();
      const output = path.join(directory, "extension.zip");
      const first = await createPackage(process.cwd(), output);

      await expect(createPackage(process.cwd(), output, { replaceDifferent: false })).resolves.toEqual(first);
    });

    it("refuses to replace an archive whose contents differ, and leaves it untouched", async () => {
      const directory = await temporaryDirectory();
      const output = path.join(directory, "extension.zip");
      await writeFile(output, "a previously released archive");

      await expect(createPackage(process.cwd(), output, { replaceDifferent: false }))
        .rejects.toThrow("already exists with different contents");
      expect(await readFile(output, "utf8")).toBe("a previously released archive");
    });

    it("replaces a differing archive by default", async () => {
      const directory = await temporaryDirectory();
      const output = path.join(directory, "extension.zip");
      await writeFile(output, "stale");

      const archive = await createPackage(process.cwd(), output);

      expect(await readFile(output)).toEqual(archive);
    });
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

  it("extracts the archive to the same bytes as the runtime files", async () => {
    const directory = await temporaryDirectory();
    const archive = await createPackage(process.cwd(), path.join(directory, "extension.zip"));
    const output = path.join(directory, "extracted");

    const written = await extractZip(archive, output);

    expect(written).toEqual(RUNTIME_FILES);
    for (const file of RUNTIME_FILES) {
      expect(await readFile(path.join(output, file))).toEqual(await readFile(file));
    }
  });

  it("refuses to extract a corrupted, compressed, or path-escaping entry", async () => {
    const directory = await temporaryDirectory();
    const archive = await createPackage(process.cwd(), path.join(directory, "extension.zip"));
    const firstEntryData = 30 + Buffer.byteLength(RUNTIME_FILES[0]);

    const corrupted = Buffer.from(archive);
    corrupted[firstEntryData] ^= 0xff;
    await expect(extractZip(corrupted, path.join(directory, "a"))).rejects.toThrow("checksum");

    const compressed = Buffer.from(archive);
    const centralOffset = compressed.readUInt32LE(compressed.length - 22 + 16);
    compressed.writeUInt16LE(8, centralOffset + 10);
    await expect(extractZip(compressed, path.join(directory, "b"))).rejects.toThrow("stored");

    const escaping = Buffer.from(archive);
    const nameOffset = centralOffset + 46;
    escaping.write("../", nameOffset, "utf8");
    await expect(extractZip(escaping, path.join(directory, "c"))).rejects.toThrow("outside");
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

  // Permissions are part of the documented security posture (SECURITY.md,
  // PRIVACY.md). Changing them must be a deliberate edit here as well.
  it("requests only the documented permissions and hosts", async () => {
    const manifest = JSON.parse(await readFile(path.join(process.cwd(), "manifest.json"), "utf8"));

    expect(manifest.permissions).toEqual(["storage", "scripting"]);
    expect(manifest.host_permissions).toEqual(["https://app.dreaming.com/*"]);
    expect(manifest.content_scripts.flatMap((script) => script.matches)).toEqual([
      "https://app.dreaming.com/spanish/*",
      "https://app.dreaming.com/french/*",
      "https://www.youtube.com/embed/*",
    ]);
  });

  it("rejects manifest references outside the runtime allowlist", async () => {
    const directory = await fixtureDirectory();
    await updateJson(directory, "manifest.json", (value) => { value.options_ui.page = "unexpected.html"; });
    await expect(validatePackageInputs(directory)).rejects.toThrow("outside the runtime allowlist");

    const background = await fixtureDirectory();
    await updateJson(background, "manifest.json", (value) => { value.background.service_worker = "src/unexpected.js"; });
    await expect(validatePackageInputs(background)).rejects.toThrow("outside the runtime allowlist");
  });

  it("rejects missing files and invalid icon dimensions", async () => {
    const missing = await fixtureDirectory();
    await rm(path.join(missing, "src/difficulty-core.js"));
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
