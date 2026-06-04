import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider, embedTexts } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type ChatBody = {
  thread_id: string;
  message: string;
  document_ids?: string[];
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub;

        const body = (await request.json()) as ChatBody;
        if (!body.message?.trim() || !body.thread_id) {
          return new Response("Bad request", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Load short history (last 8 messages) for context
        const { data: history } = await supabase
          .from("messages")
          .select("role, content")
          .eq("thread_id", body.thread_id)
          .order("created_at", { ascending: true })
          .limit(8);

        // Embed query, retrieve chunks
        const [queryEmbedding] = await embedTexts(key, [body.message]);
        const { data: matches, error: matchErr } = await supabase.rpc("match_chunks", {
          query_embedding: queryEmbedding as unknown as string,
          match_user_id: userId,
          match_count: 6,
          filter_document_ids: body.document_ids?.length ? body.document_ids : undefined,
        });
        if (matchErr) {
          return new Response(`Retrieval failed: ${matchErr.message}`, { status: 500 });
        }
        const chunks = matches ?? [];

        const contextText = chunks
          .map(
            (c, i) =>
              `[${i + 1}] (${c.document_name}${c.page_number ? `, p.${c.page_number}` : ""}${c.section ? `, ${c.section}` : ""})\n${c.content}`,
          )
          .join("\n\n---\n\n");

        const system =
          "You are a document intelligence assistant. Answer ONLY using the provided document context. Never fabricate information. If the answer is unavailable in the retrieved context, explicitly say 'I could not find this information in the uploaded documents.' Cite sources inline like [1], [2] referring to the numbered context items.";

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const historyMsgs = (history ?? []).map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        try {
          const { text } = await generateText({
            model,
            system,
            messages: [
              ...historyMsgs,
              {
                role: "user",
                content: `Context:\n\n${contextText || "(no context retrieved)"}\n\nQuestion: ${body.message}`,
              },
            ],
          });

          const citations = chunks.map((c, i) => ({
            index: i + 1,
            document_id: c.document_id,
            document_name: c.document_name,
            page_number: c.page_number,
            section: c.section,
            content: c.content,
            similarity: c.similarity,
          }));

          // Persist
          await supabase.from("messages").insert([
            { thread_id: body.thread_id, user_id: userId, role: "user", content: body.message },
            {
              thread_id: body.thread_id,
              user_id: userId,
              role: "assistant",
              content: text,
              citations,
            },
          ]);
          await supabase
            .from("threads")
            .update({
              updated_at: new Date().toISOString(),
              title: historyMsgs.length === 0 ? body.message.slice(0, 60) : undefined,
            })
            .eq("id", body.thread_id);

          return Response.json({ text, citations });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("429")) {
            return new Response("Rate limit exceeded. Please try again shortly.", { status: 429 });
          }
          if (msg.includes("402")) {
            return new Response("AI credits exhausted. Please add credits.", { status: 402 });
          }
          return new Response(`AI error: ${msg}`, { status: 500 });
        }
      },
    },
  },
});
