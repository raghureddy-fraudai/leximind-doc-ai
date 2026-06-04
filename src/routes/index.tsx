import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { FileText, Search, Sparkles, Quote, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Atrium — Document Intelligence Assistant" },
      {
        name: "description",
        content:
          "Upload PDFs, contracts, and reports. Ask natural-language questions. Get citation-backed answers grounded only in your documents.",
      },
      { property: "og:title", content: "Atrium — Document Intelligence Assistant" },
      {
        property: "og:description",
        content:
          "Citation-backed answers from your own documents. Powered by retrieval-augmented generation.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="px-6 md:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-md bg-foreground text-background grid place-items-center">
            <FileText className="size-4" />
          </div>
          <span className="font-display text-2xl">Atrium</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link to="/auth">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-aurora pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6 md:px-10 pt-16 md:pt-28 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-card/60 backdrop-blur text-xs text-muted-foreground">
            <Sparkles className="size-3" /> Retrieval-augmented · grounded · cited
          </div>
          <h1 className="mt-6 font-display text-5xl md:text-7xl leading-[1.02] tracking-tight">
            Your documents,<br />answered.
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-muted-foreground text-lg">
            Atrium turns contracts, manuals, reports, and research into an instantly queryable
            knowledge base. Every answer comes back with the source and page it came from.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="gap-1">
                Start querying <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <section className="max-w-5xl mx-auto px-6 md:px-10 pb-24 grid md:grid-cols-3 gap-4">
        <Feature
          icon={<FileText className="size-5" />}
          title="Drop in PDFs, DOCX, MD, TXT"
          desc="Parsed, structured, and chunked with section awareness."
        />
        <Feature
          icon={<Search className="size-5" />}
          title="Semantic search with pgvector"
          desc="HNSW-indexed embeddings find the right passage every time."
        />
        <Feature
          icon={<Quote className="size-5" />}
          title="Always cited"
          desc="See the exact source chunk, document, and page behind every answer."
        />
      </section>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="p-6 rounded-xl border bg-card shadow-soft">
      <div className="size-9 rounded-md bg-secondary grid place-items-center">{icon}</div>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}
