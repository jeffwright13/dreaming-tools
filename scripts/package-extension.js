import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RUNTIME_FILES = Object.freeze([
  "manifest.json",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
  "src/content.css",
  "src/content.js",
  "src/core.js",
  "src/options.css",
  "src/options.html",
  "src/options.js",
]);

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});
const FIXED_DOS_DATE = 0x0021;
const UTF8_FLAG = 0x0800;

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function localHeader(name, data, checksum) {
  const nameBytes = Buffer.from(name);
  const header = Buffer.alloc(30 + nameBytes.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(UTF8_FLAG, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(FIXED_DOS_DATE, 12);
  header.writeUInt32LE(checksum, 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(nameBytes.length, 26);
  header.writeUInt16LE(0, 28);
  nameBytes.copy(header, 30);
  return header;
}

function centralHeader(name, data, checksum, offset) {
  const nameBytes = Buffer.from(name);
  const header = Buffer.alloc(46 + nameBytes.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(0x0314, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(UTF8_FLAG, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(FIXED_DOS_DATE, 14);
  header.writeUInt32LE(checksum, 16);
  header.writeUInt32LE(data.length, 20);
  header.writeUInt32LE(data.length, 24);
  header.writeUInt16LE(nameBytes.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0x81a40000, 38);
  header.writeUInt32LE(offset, 42);
  nameBytes.copy(header, 46);
  return header;
}

function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [name, data] of entries) {
    const checksum = crc32(data);
    const header = localHeader(name, data, checksum);
    localParts.push(header, data);
    centralParts.push(centralHeader(name, data, checksum, offset));
    offset += header.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

export function listZipEntries(archive) {
  const endOffset = archive.length - 22;
  if (endOffset < 0 || archive.readUInt32LE(endOffset) !== 0x06054b50) {
    throw new Error("Archive has no valid end-of-central-directory record");
  }

  const count = archive.readUInt16LE(endOffset + 10);
  let offset = archive.readUInt32LE(endOffset + 16);
  const names = [];
  for (let index = 0; index < count; index += 1) {
    if (archive.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Archive has an invalid central-directory entry");
    }
    const nameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    names.push(archive.toString("utf8", offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

export async function validatePackageInputs(rootDirectory) {
  const [manifest, packageJson] = await Promise.all([
    readFile(path.join(rootDirectory, "manifest.json"), "utf8").then(JSON.parse),
    readFile(path.join(rootDirectory, "package.json"), "utf8").then(JSON.parse),
  ]);
  if (manifest.version !== packageJson.version) {
    throw new Error(`Version mismatch: manifest ${manifest.version}, package ${packageJson.version}`);
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    throw new Error(`Unsupported extension version: ${manifest.version}`);
  }

  const referencedFiles = new Set([
    ...Object.values(manifest.icons ?? {}),
    ...manifest.content_scripts.flatMap((script) => [...(script.js ?? []), ...(script.css ?? [])]),
    manifest.options_ui?.page,
  ].filter(Boolean));
  for (const file of referencedFiles) {
    if (!RUNTIME_FILES.includes(file)) {
      throw new Error(`Manifest references a file outside the runtime allowlist: ${file}`);
    }
  }
  for (const file of RUNTIME_FILES) {
    const details = await stat(path.join(rootDirectory, file));
    if (!details.isFile()) {
      throw new Error(`Required runtime path is not a file: ${file}`);
    }
  }
  for (const [declaredSize, file] of Object.entries(manifest.icons ?? {})) {
    const image = await readFile(path.join(rootDirectory, file));
    const validSignature = image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const size = Number(declaredSize);
    if (!validSignature || image.readUInt32BE(16) !== size || image.readUInt32BE(20) !== size) {
      throw new Error(`Icon dimensions do not match manifest declaration: ${file}`);
    }
  }
  return { files: [...RUNTIME_FILES], version: manifest.version };
}

export async function createPackage(rootDirectory, outputPath) {
  const { files } = await validatePackageInputs(rootDirectory);
  const entries = await Promise.all(files.map(async (file) => [
    file,
    await readFile(path.join(rootDirectory, file)),
  ]));
  const archive = createZip(entries);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, archive);
  return archive;
}

export async function verifyPackage(rootDirectory, archivePath) {
  await validatePackageInputs(rootDirectory);
  const entries = listZipEntries(await readFile(archivePath));
  if (entries.length !== RUNTIME_FILES.length || entries.some((entry, index) => entry !== RUNTIME_FILES[index])) {
    throw new Error(`Archive contents differ from runtime allowlist:\n${entries.join("\n")}`);
  }
  return entries;
}

async function run() {
  const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const { version } = await validatePackageInputs(rootDirectory);
  const archivePath = path.join(rootDirectory, "dist", `dreaming-difficulty-${version}.zip`);
  if (process.argv[2] === "--verify") {
    await verifyPackage(rootDirectory, process.argv[3] ? path.resolve(process.argv[3]) : archivePath);
    console.log(`Verified ${path.relative(rootDirectory, archivePath)}`);
    return;
  }
  await createPackage(rootDirectory, archivePath);
  await verifyPackage(rootDirectory, archivePath);
  console.log(`Created ${path.relative(rootDirectory, archivePath)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
