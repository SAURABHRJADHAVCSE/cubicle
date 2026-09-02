const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm"]);

export type MediaKind = "image" | "video" | null;

/** Classifies a workspace file path by extension — the only two kinds
 * media generation ever produces (see backend media/base.py's
 * GeneratedMedia.kind). Used to route a file to the raw-bytes/blob-URL
 * viewer (useWorkspaceFile) instead of the text-only preview endpoint,
 * which can't render binary content at all. */
export function getMediaKind(path: string): MediaKind {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return null;
}
