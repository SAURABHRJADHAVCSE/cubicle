"use client";

import {
  BookHeart,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  File,
  FileWarning,
  Folder,
  FolderOpen,
  Loader2,
  Pencil,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAgents } from "@/hooks/useAgents";
import { useWorkspaceFile } from "@/hooks/useWorkspaceFile";
import { getAuthToken } from "@/lib/authToken";
import { ApiError, api } from "@/lib/api";
import { getMediaKind } from "@/lib/mediaKind";
import { useUIStore } from "@/stores/uiStore";
import type { WorkspaceEntry, WorkspaceFileContent } from "@/types/agent";

const SOUL_FILENAME = "SOUL.md";

// vscode:// needs forward slashes and URI-escaping, not a raw Windows path.
function vscodeUri(hostPath: string): string {
  return `vscode://file/${encodeURI(hostPath.replace(/\\/g, "/"))}`;
}

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Full-size image/video preview for the file browser — routed through the
 * raw-bytes/blob-URL fetch (useWorkspaceFile) instead of files/content's
 * text-only, size-capped preview endpoint, which can't render binary
 * content at all and previously showed "File too large to preview" or "Not
 * a text file" for any generated image/video. */
function MediaFilePreview({ agentId, path }: { agentId: string; path: string }) {
  const { objectUrl, loading, error } = useWorkspaceFile(agentId, path);
  const kind = getMediaKind(path);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }
  if (error || !objectUrl) {
    return (
      <div className="mx-auto mt-6 flex max-w-[260px] items-center gap-1.5 text-center text-xs text-muted-foreground">
        <FileWarning className="size-3.5 shrink-0" />
        {error ?? "Couldn't load file"}
      </div>
    );
  }
  if (kind === "video") {
    return <video src={objectUrl} controls className="max-h-full max-w-full rounded-lg border border-border" />;
  }
  // eslint-disable-next-line @next/next/no-img-element -- object URL, next/image can't optimize it
  return <img src={objectUrl} alt={path} className="max-h-full max-w-full rounded-lg border border-border object-contain" />;
}

export function FilesPanel() {
  const activeFilesAgentId = useUIStore((state) => state.activeFilesAgentId);
  const selectFilesAgent = useUIStore((state) => state.selectFilesAgent);
  const { data: agents } = useAgents();
  const agent = agents?.find((item) => item.id === activeFilesAgentId);

  const [currentPath, setCurrentPath] = useState("");
  const [entries, setEntries] = useState<WorkspaceEntry[] | null>(null);
  const [hostPath, setHostPath] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<WorkspaceFileContent | null>(null);
  const [openMediaEntry, setOpenMediaEntry] = useState<WorkspaceEntry | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingSoul, setEditingSoul] = useState(false);
  const [draftContent, setDraftContent] = useState("");
  const [savingSoul, setSavingSoul] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // No reset-on-agent-change effect needed: page.tsx mounts this with
  // `key={activeFilesAgentId}`, so switching agents fully remounts the
  // component and these useState initial values are already correct.
  useEffect(() => {
    if (!activeFilesAgentId) return;
    let cancelled = false;
    // Kicking off a real async fetch (external system), not deriving state
    // from props — same pattern as DevicesCard.tsx's remote-url effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setListError(null);
    api.agents
      .listFiles(activeFilesAgentId, currentPath)
      .then((listing) => {
        if (cancelled) return;
        setEntries(listing.entries);
        setHostPath(listing.host_path);
      })
      .catch((err) => {
        if (cancelled) return;
        setEntries(null);
        setListError(err instanceof ApiError ? err.message : "Couldn't load this folder.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeFilesAgentId, currentPath]);

  if (!activeFilesAgentId) return null;

  function close() {
    selectFilesAgent(null);
  }

  async function copyHostPath() {
    if (!hostPath) return;
    try {
      await navigator.clipboard.writeText(hostPath);
      toast.success("Folder path copied");
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access");
    }
  }

  // A real local download, not routed through api.ts's request() — that
  // always parses JSON, and a zip tag can't carry the bearer token this
  // router requires, so fetch it directly and save the Blob (same
  // authed-fetch pattern as useWorkspaceFile.ts's image/video preview).
  async function downloadZip() {
    if (!activeFilesAgentId) return;
    setDownloadingZip(true);
    try {
      const token = getAuthToken();
      const response = await fetch(api.agents.zipUrl(activeFilesAgentId, currentPath), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const filenameMatch = response.headers
        .get("content-disposition")
        ?.match(/filename="([^"]+)"/);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filenameMatch?.[1] ?? `${agent?.name ?? "workspace"}.zip`;
      link.click();
      URL.revokeObjectURL(objectUrl);
      toast.success("Download started");
    } catch {
      toast.error("Couldn't download this folder as a zip");
    } finally {
      setDownloadingZip(false);
    }
  }

  function openEntry(entry: WorkspaceEntry) {
    if (entry.type === "dir") {
      setCurrentPath(entry.path);
      return;
    }
    if (!activeFilesAgentId) return;
    setFileError(null);
    setOpenFile(null);
    setOpenMediaEntry(null);
    setEditingSoul(false);
    // Media files skip files/content entirely — that endpoint is text-only
    // and size-capped, so it can't render an image/video at all. No fetch
    // needed here either: the listing already has name/size.
    if (getMediaKind(entry.path)) {
      setOpenMediaEntry(entry);
      return;
    }
    api.agents
      .readFile(activeFilesAgentId, entry.path)
      .then(setOpenFile)
      .catch((err) => setFileError(err instanceof ApiError ? err.message : "Couldn't open this file."));
  }

  function backToFolder() {
    setOpenFile(null);
    setOpenMediaEntry(null);
    setEditingSoul(false);
  }

  function startEditingSoul() {
    if (!openFile) return;
    setDraftContent(openFile.content ?? "");
    setEditingSoul(true);
  }

  function cancelEditingSoul() {
    setEditingSoul(false);
  }

  async function saveSoul() {
    if (!activeFilesAgentId) return;
    setSavingSoul(true);
    try {
      const result = await api.agents.writeSoul(activeFilesAgentId, draftContent);
      setOpenFile((f) =>
        f ? { ...f, content: result.content, size: new TextEncoder().encode(result.content).length } : f,
      );
      setEditingSoul(false);
      toast.success("SOUL.md saved");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save SOUL.md");
    } finally {
      setSavingSoul(false);
    }
  }

  const crumbs = currentPath ? currentPath.split("/") : [];

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background/95 shadow-2xl backdrop-blur-2xl md:absolute md:inset-0 md:border-l md:border-border text-foreground">
      <div className="flex items-center gap-3 border-b border-border bg-muted/90 px-4 py-3 backdrop-blur-xl">
        <Avatar className="size-8 ring-1 ring-slate-200 dark:ring-white/10 shadow-sm" style={{ backgroundColor: agent?.accent_color }}>
          <AvatarFallback className="text-2xs font-bold text-white" style={{ backgroundColor: agent?.accent_color }}>
            {agent?.name.slice(0, 2).toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-xs font-semibold text-foreground">
            {agent?.name ?? "Agent"}&apos;s workspace
          </p>
          <p className="truncate font-mono text-3xs text-muted-foreground">
            {hostPath ?? agent?.working_directory ?? "No workspace configured"}
          </p>
        </div>
        {hostPath && (
          <>
            <Button
              variant="ghost"
              size="icon-xs"
              className="rounded-full bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
              onClick={copyHostPath}
              aria-label="Copy folder path"
              title="Copy folder path"
            >
              <Copy className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="rounded-full bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
              render={<a href={vscodeUri(hostPath)} />}
              aria-label="Open this folder in VS Code"
              title="Open in VS Code"
            >
              <ExternalLink className="size-3.5" />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          className="rounded-full bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={downloadZip}
          disabled={downloadingZip}
          aria-label={currentPath ? "Download this folder as a zip" : "Download workspace as a zip"}
          title={currentPath ? "Download this folder as a zip" : "Download workspace as a zip"}
        >
          {downloadingZip ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="rounded-full bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={close}
          aria-label="Close file browser"
        >
          <X className="size-4" />
        </Button>
      </div>

      {openFile || openMediaEntry ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2">
            <button
              type="button"
              onClick={backToFolder}
              className="flex items-center gap-1 text-2xs font-bold text-primary hover:underline"
            >
              <ChevronRight className="size-3 rotate-180" /> Back to folder
            </button>
            <span className="ml-auto font-mono text-3xs text-muted-foreground">
              {formatSize(openFile?.size ?? openMediaEntry?.size ?? null)}
            </span>
            {openFile?.path === SOUL_FILENAME && openFile.readable && (
              editingSoul ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={cancelEditingSoul}
                    aria-label="Cancel editing"
                    disabled={savingSoul}
                  >
                    <X className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 rounded-full px-2.5 text-3xs font-bold"
                    onClick={saveSoul}
                    disabled={savingSoul}
                  >
                    {savingSoul ? "Saving…" : "Save"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={startEditingSoul}
                  aria-label="Edit SOUL.md"
                  title="Edit"
                >
                  <Pencil className="size-3.5" />
                </Button>
              )
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto soft-scrollbar p-4">
            {openMediaEntry ? (
              activeFilesAgentId && (
                <div className="flex h-full items-center justify-center">
                  <MediaFilePreview agentId={activeFilesAgentId} path={openMediaEntry.path} />
                </div>
              )
            ) : editingSoul ? (
              <Textarea
                autoFocus
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                className="h-full min-h-full resize-none font-mono text-2xs leading-relaxed"
              />
            ) : openFile?.readable ? (
              <pre className="paper-grain whitespace-pre-wrap break-words rounded-lg border border-border bg-card p-3 font-mono text-2xs leading-relaxed text-foreground">
                {openFile.content}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground">{openFile?.reason}</p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Breadcrumb — a printed folder-tab trail rather than a plain
              slash-separated path, consistent with the rest of the app's
              "office paperwork" language. */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-border/60 px-4 py-2 text-2xs font-bold whitespace-nowrap soft-scrollbar">
            <button
              type="button"
              onClick={() => setCurrentPath("")}
              className={currentPath ? "text-muted-foreground hover:text-primary" : "text-primary"}
            >
              Root
            </button>
            {crumbs.map((crumb, i) => {
              const pathToHere = crumbs.slice(0, i + 1).join("/");
              const isLast = i === crumbs.length - 1;
              return (
                <span key={pathToHere} className="flex items-center gap-1">
                  <ChevronRight className="size-3 text-muted-foreground" />
                  <button
                    type="button"
                    onClick={() => setCurrentPath(pathToHere)}
                    className={isLast ? "text-primary" : "text-muted-foreground hover:text-primary"}
                  >
                    {crumb}
                  </button>
                </span>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto soft-scrollbar p-3">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            )}

            {!loading && listError && (
              <div className="mx-auto mt-6 max-w-[260px] text-center text-xs text-muted-foreground">
                {listError}
              </div>
            )}

            {!loading && !listError && entries?.length === 0 && (
              <div className="mx-auto mt-10 max-w-[230px] text-center">
                <div className="mx-auto flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <FolderOpen className="size-4" />
                </div>
                <p className="mt-3 text-xs font-semibold text-foreground">Empty folder</p>
                <p className="mt-1 text-3xs text-muted-foreground">
                  Nothing here yet — this agent hasn&apos;t written any files.
                </p>
              </div>
            )}

            {!loading && !listError && entries && entries.length > 0 && (
              <div className="flex flex-col gap-1">
                {entries.map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => openEntry(entry)}
                    className="flex items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left text-xs hover:border-border hover:bg-card"
                  >
                    {entry.type === "dir" ? (
                      <Folder className="size-4 shrink-0 text-primary" />
                    ) : entry.path === SOUL_FILENAME ? (
                      // Distinguished from an ordinary workspace file — this
                      // one defines the agent's behavior, worth noticing at
                      // a glance rather than needing to already know it's here.
                      <BookHeart className="size-4 shrink-0 text-primary" />
                    ) : (
                      <File className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{entry.name}</span>
                    {entry.type === "file" && (
                      <span className="shrink-0 font-mono text-3xs text-muted-foreground">
                        {formatSize(entry.size)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {fileError && (
              <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-2xs text-destructive">
                {fileError}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
