import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import fs from "node:fs/promises";
import path from "node:path";
import { lookup } from "mime-types";

export type StorageBackend = "r2" | "local";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required when using Cloudflare R2 storage`);
  return value;
}

export function storageBackend(): StorageBackend {
  return process.env.R2_BUCKET_NAME?.trim() &&
    process.env.R2_ACCOUNT_ID?.trim() &&
    process.env.R2_ACCESS_KEY_ID?.trim() &&
    process.env.R2_SECRET_ACCESS_KEY?.trim()
    ? "r2"
    : "local";
}

export function localCourseStorageRoot(): string {
  const configured = process.env.COURSE_STORAGE_DIR || "./storage/courses";
  return path.resolve(configured);
}

function r2Prefix(): string {
  return (process.env.R2_PREFIX || "courses").replace(/^\/+|\/+$/g, "");
}

function r2Key(courseId: string, relativePath = ""): string {
  const prefix = r2Prefix();
  const normalized = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  return normalized ? `${prefix}/${courseId}/${normalized}` : `${prefix}/${courseId}`;
}

let cachedClient: S3Client | null = null;

function r2Client(): S3Client {
  if (cachedClient) return cachedClient;
  const accountId = requiredEnv("R2_ACCOUNT_ID");
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY")
    }
  });
  return cachedClient;
}

function r2Bucket(): string {
  return requiredEnv("R2_BUCKET_NAME");
}

async function putLocal(courseId: string, relativePath: string, body: Buffer): Promise<void> {
  const absolute = path.resolve(localCourseStorageRoot(), courseId, relativePath);
  const root = path.resolve(localCourseStorageRoot(), courseId);
  if (!absolute.startsWith(root + path.sep) && absolute !== root) {
    throw new Error("Invalid course file path");
  }
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, body);
}

async function getLocal(courseId: string, relativePath: string): Promise<Buffer | null> {
  const absolute = path.resolve(localCourseStorageRoot(), courseId, relativePath);
  const root = path.resolve(localCourseStorageRoot(), courseId);
  if (!absolute.startsWith(root + path.sep)) return null;
  try {
    return await fs.readFile(absolute);
  } catch {
    return null;
  }
}

async function deleteLocal(courseId: string): Promise<void> {
  await fs.rm(path.join(localCourseStorageRoot(), courseId), { recursive: true, force: true });
}

async function putR2(courseId: string, relativePath: string, body: Buffer): Promise<void> {
  const contentType = lookup(relativePath) || "application/octet-stream";
  await r2Client().send(
    new PutObjectCommand({
      Bucket: r2Bucket(),
      Key: r2Key(courseId, relativePath),
      Body: body,
      ContentType: typeof contentType === "string" ? contentType : "application/octet-stream"
    })
  );
}

async function getR2(courseId: string, relativePath: string): Promise<Buffer | null> {
  try {
    const result = await r2Client().send(
      new GetObjectCommand({
        Bucket: r2Bucket(),
        Key: r2Key(courseId, relativePath)
      })
    );
    if (!result.Body) return null;
    const bytes = await result.Body.transformToByteArray();
    return Buffer.from(bytes);
  } catch (error: unknown) {
    const name = typeof error === "object" && error && "name" in error ? String((error as { name: string }).name) : "";
    const status = typeof error === "object" && error && "$metadata" in error
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
      : undefined;
    if (name === "NoSuchKey" || status === 404) return null;
    throw error;
  }
}

async function listAllR2Keys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  do {
    const page = await r2Client().send(
      new ListObjectsV2Command({
        Bucket: r2Bucket(),
        Prefix: prefix.endsWith("/") ? prefix : `${prefix}/`,
        ContinuationToken: continuationToken
      })
    );
    for (const item of page.Contents || []) {
      if (item.Key) keys.push(item.Key);
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

async function deleteR2(courseId: string): Promise<void> {
  const prefix = r2Key(courseId);
  const keys = await listAllR2Keys(prefix);
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    if (!chunk.length) continue;
    await r2Client().send(
      new DeleteObjectsCommand({
        Bucket: r2Bucket(),
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: true
        }
      })
    );
  }
}

/** Replace all files for a course (local disk or R2). */
export async function replaceCourseFiles(
  courseId: string,
  files: Array<{ relativePath: string; body: Buffer }>
): Promise<void> {
  await deleteCourseFiles(courseId);
  const backend = storageBackend();
  const put = backend === "r2" ? putR2 : putLocal;
  const concurrency = backend === "r2" ? 8 : 16;
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    await Promise.all(batch.map((file) => put(courseId, file.relativePath, file.body)));
  }
}

export async function readCourseFile(courseId: string, relativePath: string): Promise<Buffer | null> {
  return storageBackend() === "r2" ? getR2(courseId, relativePath) : getLocal(courseId, relativePath);
}

export async function deleteCourseFiles(courseId: string): Promise<void> {
  if (storageBackend() === "r2") await deleteR2(courseId);
  else await deleteLocal(courseId);
}

export async function storageHealth(): Promise<{
  backend: StorageBackend;
  ok: boolean;
  detail: string;
}> {
  const backend = storageBackend();
  if (backend === "local") {
    try {
      const root = localCourseStorageRoot();
      await fs.mkdir(root, { recursive: true });
      await fs.access(root);
      return { backend, ok: true, detail: root };
    } catch (error) {
      return {
        backend,
        ok: false,
        detail: error instanceof Error ? error.message : "Local storage unavailable"
      };
    }
  }

  try {
    await r2Client().send(
      new ListObjectsV2Command({
        Bucket: r2Bucket(),
        Prefix: `${r2Prefix()}/`,
        MaxKeys: 1
      })
    );
    return { backend, ok: true, detail: `r2://${r2Bucket()}/${r2Prefix()}` };
  } catch (error) {
    return {
      backend,
      ok: false,
      detail: error instanceof Error ? error.message : "R2 unavailable"
    };
  }
}
