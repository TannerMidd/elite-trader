export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

export interface DownloadArtifact {
  blob: Blob;
  filename: string | null;
  contentType: string | null;
  serverVersion: string | null;
}

export interface OkResponse {
  ok: true;
}
