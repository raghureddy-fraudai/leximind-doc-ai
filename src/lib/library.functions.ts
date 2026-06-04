import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { embedTexts } from "./ai-gateway.server";
import type { Chunk } from "./chunk";

export const listDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        name: z.string().min(1).max(255),
        file_type: z.string().min(1).max(50),
        size_bytes: z.number().int().nonnegative(),
        page_count: z.number().int().nonnegative(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const { data: doc, error } = await context.supabase
      .from("documents")
      .insert({
        user_id: context.userId,
        name: data.name,
        file_type: data.file_type,
        size_bytes: data.size_bytes,
        page_count: data.page_count,
        status: "processing",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return doc;
  });

const ChunkSchema = z.object({
  content: z.string().min(1).max(4000),
  page_number: z.number().int().nullable(),
  section: z.string().nullable(),
  chunk_index: z.number().int().nonnegative(),
});

export const embedChunks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        document_id: z.string().uuid(),
        chunks: z.array(ChunkSchema).min(1).max(40),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const embeddings = await embedTexts(
      key,
      data.chunks.map((c: Chunk) => c.content),
    );
    const rows = data.chunks.map((c, i) => ({
      document_id: data.document_id,
      user_id: context.userId,
      content: c.content,
      page_number: c.page_number,
      section: c.section,
      chunk_index: c.chunk_index,
      embedding: embeddings[i] as unknown as string,
    }));
    const { error } = await context.supabase.from("chunks").insert(rows);
    if (error) throw new Error(error.message);
    return { inserted: rows.length };
  });

export const finalizeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ document_id: z.string().uuid(), chunk_count: z.number().int().nonnegative() }).parse(i),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("documents")
      .update({ status: "ready", chunk_count: data.chunk_count })
      .eq("id", data.document_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const failDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ document_id: z.string().uuid(), error: z.string().max(500) }).parse(i),
  )
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("documents")
      .update({ status: "error", error: data.error })
      .eq("id", data.document_id);
    return { ok: true };
  });

export const deleteDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ count: docCount }, { count: chunkCount }, { count: msgCount }] = await Promise.all([
      context.supabase.from("documents").select("*", { count: "exact", head: true }),
      context.supabase.from("chunks").select("*", { count: "exact", head: true }),
      context.supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("role", "user"),
    ]);
    return {
      documents: docCount ?? 0,
      chunks: chunkCount ?? 0,
      queries: msgCount ?? 0,
    };
  });
