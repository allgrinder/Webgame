import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';

/** Spielstand-Daten als gzip (fflate): typisch ~10× kleiner als JSON. */
export function pack(obj: unknown): Uint8Array {
  return gzipSync(strToU8(JSON.stringify(obj)), { level: 6 });
}

export function unpack<T>(bytes: Uint8Array): T {
  return JSON.parse(strFromU8(gunzipSync(bytes))) as T;
}

/** gzip-Kennung (1f 8b) erkennen, sonst JSON-Text. */
export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}
