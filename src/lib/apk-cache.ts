/**
 * Fetches an APK once and reuses the exact same bytes for every later
 * share / beam / save action in the session.
 */
const memory = new Map<string, File>();
const inflight = new Map<string, Promise<File>>();

const CACHE_NAME = "apk-cache-v1";

async function fromCacheStorage(key: string, filename: string): Promise<File | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(key);
    if (!hit) return null;
    const blob = await hit.blob();
    return new File([blob], filename, { type: "application/vnd.android.package-archive" });
  } catch {
    return null;
  }
}

async function putCacheStorage(key: string, file: File) {
  try {
    if (typeof caches === "undefined") return;
    const cache = await caches.open(CACHE_NAME);
    await cache.put(key, new Response(file));
  } catch {
    /* quota / private mode — memory cache still applies */
  }
}

export function getCachedApk(cacheKey: string): File | null {
  return memory.get(cacheKey) ?? null;
}

export async function loadApk(
  cacheKey: string,
  filename: string,
  resolveUrl: () => Promise<string>,
  onProgress?: (loaded: number, total: number) => void,
): Promise<File> {
  const cached = memory.get(cacheKey);
  if (cached) return cached;

  const running = inflight.get(cacheKey);
  if (running) return running;

  const task = (async () => {
    const stored = await fromCacheStorage(cacheKey, filename);
    if (stored) {
      memory.set(cacheKey, stored);
      return stored;
    }

    const url = await resolveUrl();
    const res = await fetch(url);
    if (!res.ok) throw new Error("download failed");

    const total = Number(res.headers.get("content-length") ?? 0);
    let blob: Blob;

    if (res.body && onProgress) {
      const reader = res.body.getReader();
      const chunks: BlobPart[] = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as unknown as BlobPart);
        loaded += value!.byteLength;
        onProgress(loaded, total);
      }
      blob = new Blob(chunks);
    } else {
      blob = await res.blob();
    }

    const file = new File([blob], filename, {
      type: "application/vnd.android.package-archive",
    });
    memory.set(cacheKey, file);
    void putCacheStorage(cacheKey, file);
    return file;
  })().finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, task);
  return task;
}

export function saveFile(file: File, filename: string) {
  const blobUrl = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}
