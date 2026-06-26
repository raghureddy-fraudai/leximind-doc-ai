import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  listDocuments,
  createDocument,
  embedChunks,
  finalizeDocument,
  failDocument,
  deleteDocument,
} from "@/lib/library.functions";

import { chunkPages } from "@/lib/chunk";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/library")({
  component: LibraryPage,
});

const ACCEPT = ".pdf,.docx,.txt,.md,.markdown";

function LibraryPage() {
  const router = useRouter();
  const list = useServerFn(listDocuments);
  const create = useServerFn(createDocument);
  const embed = useServerFn(embedChunks);
  const finalize = useServerFn(finalizeDocument);
  const fail = useServerFn(failDocument);
  const del = useServerFn(deleteDocument);
  const q = useQuery({ queryKey: ["documents"], queryFn: () => list() });
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        setBusy(`Parsing ${file.name}…`);
        const pages = await parseFile(file);
        if (pages.length === 0) throw new Error("No text extracted");
        const chunks = chunkPages(pages);

        setBusy(`Uploading ${file.name}…`);
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
        const { data: userRes } = await supabase.auth.getUser();
        if (!userRes.user) throw new Error("Not signed in");
        const path = `${userRes.user.id}/${Date.now()}-${file.name}`;
        const up = await supabase.storage.from("documents").upload(path, file);
        if (up.error) throw up.error;

        const doc = await create({
          data: {
            name: file.name,
            file_type: ext,
            size_bytes: file.size,
            page_count: pages.length,
          },
        });

        setBusy(`Embedding ${chunks.length} chunks…`);
        for (let i = 0; i < chunks.length; i += 20) {
          const batch = chunks.slice(i, i + 20);
          try {
            await embed({ data: { document_id: doc.id, chunks: batch } });
          } catch (e) {
            await fail({
              data: { document_id: doc.id, error: e instanceof Error ? e.message : String(e) },
            });
            throw e;
          }
        }
        await finalize({ data: { document_id: doc.id, chunk_count: chunks.length } });
        toast.success(`Indexed ${file.name}`);
        q.refetch();
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setBusy(null);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl">Library</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Upload documents to make them queryable.
          </p>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button onClick={() => fileInput.current?.click()} disabled={!!busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" /> {busy}
              </>
            ) : (
              <>
                <Upload className="size-4 mr-2" /> Upload
              </>
            )}
          </Button>
        </div>
      </div>

      <div
        className="border-2 border-dashed rounded-xl p-10 text-center bg-card/40 mb-6"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        <Upload className="size-6 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm">
          Drop PDF, DOCX, TXT, or Markdown files here, or click <span className="font-medium">Upload</span>.
        </p>
      </div>

      <div className="space-y-2">
        {q.isLoading && (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}
        {q.data?.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-12">
            No documents yet. Upload something to get started.
          </div>
        )}
        {q.data?.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center gap-3 p-4 border rounded-lg bg-card shadow-soft"
          >
            <div className="size-10 rounded-md bg-secondary grid place-items-center">
              <FileText className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{doc.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {doc.page_count} pages · {doc.chunk_count} chunks · {(doc.size_bytes / 1024).toFixed(0)} KB
              </div>
            </div>
            <StatusBadge status={doc.status} />
            <Button
              variant="ghost"
              size="icon"
              onClick={async () => {
                if (!confirm(`Delete ${doc.name}?`)) return;
                await del({ data: { id: doc.id } });
                router.invalidate();
                q.refetch();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
        <CheckCircle2 className="size-3.5" /> Ready
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="size-3.5" /> Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" /> Processing
    </span>
  );
}
