import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { deleteCourseFiles, localCourseStorageRoot, replaceCourseFiles } from "@/lib/course-storage";

/** @deprecated Prefer localCourseStorageRoot / storageBackend from course-storage */
export function courseStorageRoot(): string {
  return localCourseStorageRoot();
}

export async function ensureCourseStorageRoot(): Promise<string> {
  const root = localCourseStorageRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

export async function extractScormPackage(buffer: Buffer, courseId: string): Promise<{ launchPath: string }> {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), `otto-scorm-${courseId}-`));
  try {
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();
    if (!entries.length) throw new Error("The uploaded ZIP package is empty");

    const files: Array<{ relativePath: string; body: Buffer }> = [];

    for (const entry of entries) {
      const normalized = entry.entryName.replaceAll("\\", "/").replace(/^\/+/, "");
      if (!normalized || normalized.split("/").includes("..")) {
        throw new Error("The SCORM package contains an unsafe file path");
      }
      const absolute = path.resolve(tempRoot, normalized);
      if (!absolute.startsWith(path.resolve(tempRoot) + path.sep) && absolute !== path.resolve(tempRoot)) {
        throw new Error("The SCORM package contains an unsafe file path");
      }
      if (entry.isDirectory) {
        await fs.mkdir(absolute, { recursive: true });
        continue;
      }
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      const body = entry.getData();
      await fs.writeFile(absolute, body);
      files.push({ relativePath: normalized, body });
    }

    const manifestPath = await findManifest(tempRoot);
    if (!manifestPath) throw new Error("imsmanifest.xml was not found in this ZIP package");
    const launchHref = await readLaunchHref(manifestPath);
    const manifestDirectory = path.dirname(manifestPath);
    const launchAbsolute = path.resolve(manifestDirectory, launchHref);
    const storageAbsolute = path.resolve(tempRoot);
    if (!launchAbsolute.startsWith(storageAbsolute + path.sep)) {
      throw new Error("The SCORM launch file points outside the uploaded package");
    }
    await fs.access(launchAbsolute);
    await injectScormProgressBridgeIntoPackage(tempRoot);

    // Re-read files after HTML patching so R2/local get the patched content.
    const patchedFiles: Array<{ relativePath: string; body: Buffer }> = [];
    for (const file of files) {
      const absolute = path.join(tempRoot, file.relativePath);
      patchedFiles.push({
        relativePath: file.relativePath,
        body: await fs.readFile(absolute)
      });
    }

    await replaceCourseFiles(courseId, patchedFiles);
    return { launchPath: path.relative(tempRoot, launchAbsolute).replaceAll(path.sep, "/") };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

export async function removeScormPackage(courseId: string): Promise<void> {
  await deleteCourseFiles(courseId);
}

const LOCAL_SCORM_INTERFACE = "/mindsmith-scorm-interface.js";
const SCORM_PROGRESS_BRIDGE_TAG = '<script src="/otto-scorm-progress-bridge.js"></script>';

export function patchScormLaunchHtml(html: string): string {
  if (!html.includes("mindsmith.ai/scorm-interface.js") && !html.includes("mindsmith-scorm-interface.js")) {
    return html;
  }

  let patched = html.replace(/https:\/\/app\.mindsmith\.ai\/scorm-interface\.js/g, LOCAL_SCORM_INTERFACE);

  if (!patched.includes("otto-scorm-progress-bridge.js")) {
    const localScript = patched.match(/<script[^>]*mindsmith-scorm-interface\.js[^>]*><\/script>/i);
    const remoteScript = patched.match(/<script[^>]*mindsmith\.ai\/scorm-interface\.js[^>]*><\/script>/i);
    const target = localScript?.[0] || remoteScript?.[0];
    if (target) {
      patched = patched.replace(target, `${SCORM_PROGRESS_BRIDGE_TAG}\n    ${target}`);
    } else if (patched.includes("</body>")) {
      patched = patched.replace("</body>", `    ${SCORM_PROGRESS_BRIDGE_TAG}\n  </body>`);
    }
  }

  return patched;
}

/** @deprecated Use patchScormLaunchHtml */
export function injectScormProgressBridge(html: string): string {
  return patchScormLaunchHtml(html);
}

async function injectScormProgressBridgeIntoPackage(root: string): Promise<void> {
  const htmlFiles = await collectHtmlFiles(root);
  await Promise.all(
    htmlFiles.map(async (filePath) => {
      const html = await fs.readFile(filePath, "utf8");
      const patched = patchScormLaunchHtml(html);
      if (patched !== html) await fs.writeFile(filePath, patched);
    })
  );
}

async function collectHtmlFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const queue = [root];
  while (queue.length) {
    const directory = queue.shift()!;
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) queue.push(absolute);
      else if (item.isFile() && item.name.toLowerCase().endsWith(".html")) files.push(absolute);
    }
  }
  return files;
}

async function findManifest(root: string): Promise<string | null> {
  const queue = [root];
  while (queue.length) {
    const directory = queue.shift()!;
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isFile() && item.name.toLowerCase() === "imsmanifest.xml") return absolute;
      if (item.isDirectory()) queue.push(absolute);
    }
  }
  return null;
}

async function readLaunchHref(manifestPath: string): Promise<string> {
  const xml = await fs.readFile(manifestPath, "utf8");
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", removeNSPrefix: true });
  const parsed = parser.parse(xml);
  const manifest = parsed.manifest;
  if (!manifest) throw new Error("The SCORM manifest is invalid");

  const organizations = asArray(manifest.organizations?.organization);
  const defaultOrgId = manifest.organizations?.default;
  const organization = organizations.find((item) => item.identifier === defaultOrgId) || organizations[0];
  const firstItem = findFirstLaunchItem(organization?.item);
  const resourceRef = firstItem?.identifierref;
  const resources = asArray(manifest.resources?.resource);
  const resource = resources.find((item) => item.identifier === resourceRef) || resources.find((item) => item.href);
  const href = resource?.href;
  if (!href || typeof href !== "string") throw new Error("No launch resource was found in imsmanifest.xml");
  return decodeURIComponent(href.split("?")[0].split("#")[0]);
}

function findFirstLaunchItem(input: unknown): Record<string, any> | null {
  for (const item of asArray(input)) {
    if (item && typeof item === "object") {
      const value = item as Record<string, any>;
      if (value.identifierref) return value;
      const nested = findFirstLaunchItem(value.item);
      if (nested) return nested;
    }
  }
  return null;
}

function asArray(value: unknown): any[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}
