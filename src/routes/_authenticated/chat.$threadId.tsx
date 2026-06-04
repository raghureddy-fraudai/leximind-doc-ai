import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  listThreads,
  createThread,
  deleteThread,
  getThreadMessages,
} from "@/lib/threads.functions";
import { listDocuments } from "@/lib/library.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, Send, FileText, Quote } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

type Citation = {
  index: number;
  document_id: string;
  document_name: string;
  page_number: number | null;
  section: string | null;
  content: string;
  similarity: number;
};

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[] | null;
  created_at?: string;
};

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const list = useServerFn(listThreads);
  const create = useServerFn(createThread);
  const del = useServerFn(deleteThread);
  const getMsgs = useServerFn(getThreadMessages);
  const listDocs = useServerFn(listDocuments);

  const threadsQ = useQuery({ queryKey: ["threads"], queryFn: () => list() });
  const docsQ = useQuery({ queryKey: ["documents"], queryFn: () => listDocs() });
  const msgsQ = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => getMsgs({ data: { thread_id: threadId } }),
  });

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [activeCitation, setActiveCitation] = useState<Citation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (msgsQ.data) setMessages(msgsQ.data as Msg[]);
  }, [msgsQ.data, threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    const userMsg: Msg = { id: `tmp-${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ thread_id: threadId, message: text }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { text: string; citations: Citation[] };
      setMessages((m) => [
        ...m,
        { id: `tmp-a-${Date.now()}`, role: "assistant", content: json.text, citations: json.citations },
      ]);
      qc.invalidateQueries({ queryKey: ["threads"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-screen flex">
      {/* Threads list */}
      <div className="w-64 border-r flex flex-col bg-card/30">
        <div className="p-3 border-b">
          <Button
            className="w-full"
            variant="outline"
            onClick={async () => {
              const t = await create();
              qc.invalidateQueries({ queryKey: ["threads"] });
              navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
            }}
          >
            <Plus className="size-4 mr-2" /> New chat
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {threadsQ.data?.map((t) => (
            <div key={t.id} className="group flex items-center gap-1">
              <Link
                to="/chat/$threadId"
                params={{ threadId: t.id }}
                className="flex-1 min-w-0 text-left px-3 py-2 rounded-md text-sm hover:bg-sidebar-accent truncate"
                activeProps={{ className: "bg-sidebar-accent font-medium" }}
              >
                <div className="truncate">{t.title}</div>
                <div className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                </div>
              </Link>
              <button
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm("Delete conversation?")) return;
                  await del({ data: { id: t.id } });
                  qc.invalidateQueries({ queryKey: ["threads"] });
                  if (t.id === threadId) {
                    navigate({ to: "/chat" });
                  } else {
                    router.invalidate();
                  }
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat surface */}
      <div className="flex-1 flex flex-col min-w-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
            {messages.length === 0 && !msgsQ.isLoading && (
              <div className="text-center py-20">
                <h2 className="font-display text-3xl">Ask your documents</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {docsQ.data?.length
                    ? `Retrieving across ${docsQ.data.filter((d) => d.status === "ready").length} indexed document(s).`
                    : "Upload documents in the Library to start querying."}
                </p>
              </div>
            )}
            {messages.map((m) => (
              <MessageView key={m.id} msg={m} onCitation={setActiveCitation} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="size-4 animate-spin" /> Searching documents and composing answer…
              </div>
            )}
          </div>
        </div>
        <div className="border-t bg-background">
          <div className="max-w-3xl mx-auto p-4 flex gap-2 items-end">
            <Textarea
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask a question about your documents…"
              rows={2}
              className="resize-none"
            />
            <Button onClick={send} disabled={sending || !input.trim()} size="icon" className="h-[60px] w-[60px]">
              <Send className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Citation panel */}
      {activeCitation && (
        <div className="w-96 border-l overflow-y-auto bg-card/30">
          <div className="p-4 border-b flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Quote className="size-3" /> Citation [{activeCitation.index}]
              </div>
              <div className="font-medium truncate mt-1 flex items-center gap-1.5">
                <FileText className="size-3.5 shrink-0" />
                {activeCitation.document_name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {activeCitation.page_number ? `Page ${activeCitation.page_number}` : "—"}
                {activeCitation.section ? ` · ${activeCitation.section}` : ""}
                {` · ${(activeCitation.similarity * 100).toFixed(0)}% match`}
              </div>
            </div>
            <button
              className="text-muted-foreground hover:text-foreground text-xs"
              onClick={() => setActiveCitation(null)}
            >
              Close
            </button>
          </div>
          <div className="p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {activeCitation.content}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageView({ msg, onCitation }: { msg: Msg; onCitation: (c: Citation) => void }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 rounded-2xl bg-primary text-primary-foreground">
          {msg.content}
        </div>
      </div>
    );
  }
  const citations = msg.citations ?? [];
  // Render text with [n] tokens as clickable buttons
  const parts = msg.content.split(/(\[\d+\])/g);
  return (
    <div className="space-y-3">
      <div className="text-foreground leading-relaxed whitespace-pre-wrap">
        {parts.map((p, i) => {
          const match = p.match(/^\[(\d+)\]$/);
          if (match) {
            const idx = Number(match[1]);
            const c = citations.find((x) => x.index === idx);
            if (c) {
              return (
                <button
                  key={i}
                  className="inline-flex items-center justify-center align-baseline mx-0.5 px-1.5 py-0.5 rounded text-xs bg-accent/30 hover:bg-accent/60 text-accent-foreground"
                  onClick={() => onCitation(c)}
                  title={c.document_name}
                >
                  {idx}
                </button>
              );
            }
          }
          return <span key={i}>{p}</span>;
        })}
      </div>
      {citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {citations.map((c) => (
            <button
              key={c.index}
              onClick={() => onCitation(c)}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card text-xs hover:bg-secondary transition-colors max-w-xs"
            >
              <span className="text-muted-foreground">[{c.index}]</span>
              <FileText className="size-3 shrink-0" />
              <span className="truncate">{c.document_name}</span>
              {c.page_number && <span className="text-muted-foreground">p.{c.page_number}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
