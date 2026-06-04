import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getStats, listDocuments } from "@/lib/library.functions";
import { FileText, Database, MessageSquare, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: Analytics,
});

function Analytics() {
  const stats = useServerFn(getStats);
  const docs = useServerFn(listDocuments);
  const s = useQuery({ queryKey: ["stats"], queryFn: () => stats() });
  const d = useQuery({ queryKey: ["documents"], queryFn: () => docs() });
  const ready = d.data?.filter((x) => x.status === "ready").length ?? 0;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <h1 className="font-display text-4xl">Analytics</h1>
      <p className="text-muted-foreground text-sm mt-1">Overview of your knowledge base.</p>
      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<FileText className="size-4" />} label="Documents" value={s.data?.documents ?? 0} />
        <Stat icon={<CheckCircle2 className="size-4" />} label="Ready" value={ready} />
        <Stat icon={<Database className="size-4" />} label="Chunks indexed" value={s.data?.chunks ?? 0} />
        <Stat icon={<MessageSquare className="size-4" />} label="Queries asked" value={s.data?.queries ?? 0} />
      </div>
      <div className="mt-10 p-6 rounded-xl border bg-card shadow-soft">
        <h2 className="font-medium">Recent documents</h2>
        <div className="mt-3 space-y-2">
          {(d.data ?? []).slice(0, 8).map((doc) => (
            <div key={doc.id} className="flex items-center justify-between text-sm py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="size-3.5 text-muted-foreground" />
                <span className="truncate">{doc.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {doc.chunk_count} chunks
              </span>
            </div>
          ))}
          {d.data?.length === 0 && (
            <div className="text-sm text-muted-foreground">No documents yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="p-5 rounded-xl border bg-card shadow-soft">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-4xl">{value.toLocaleString()}</div>
    </div>
  );
}
