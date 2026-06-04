export type RawPage = { page: number; text: string };

export type Chunk = {
  content: string;
  page_number: number | null;
  section: string | null;
  chunk_index: number;
};

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

function splitRecursive(text: string, size: number, overlap: number): string[] {
  const separators = ["\n\n", "\n", ". ", " ", ""];
  function rec(input: string, seps: string[]): string[] {
    if (input.length <= size) return [input];
    const [sep, ...rest] = seps;
    if (sep === "" || sep === undefined) {
      const out: string[] = [];
      for (let i = 0; i < input.length; i += size - overlap) {
        out.push(input.slice(i, i + size));
      }
      return out;
    }
    const parts = input.split(sep);
    const out: string[] = [];
    let buf = "";
    for (const p of parts) {
      const candidate = buf ? buf + sep + p : p;
      if (candidate.length > size) {
        if (buf) out.push(buf);
        if (p.length > size) {
          out.push(...rec(p, rest));
          buf = "";
        } else {
          buf = p;
        }
      } else {
        buf = candidate;
      }
    }
    if (buf) out.push(buf);
    // overlap
    const merged: string[] = [];
    for (let i = 0; i < out.length; i++) {
      if (i === 0) merged.push(out[i]);
      else {
        const prev = out[i - 1];
        const overlapText = prev.slice(Math.max(0, prev.length - overlap));
        merged.push(overlapText + out[i]);
      }
    }
    return merged;
  }
  return rec(text, separators).filter((c) => c.trim().length > 0);
}

function detectSection(text: string): string | null {
  const firstLine = text.split("\n").find((l) => l.trim().length > 0) ?? "";
  if (firstLine.length < 120 && /^[A-Z0-9][\w\s\-:.,]{2,}$/.test(firstLine.trim())) {
    return firstLine.trim();
  }
  return null;
}

export function chunkPages(pages: RawPage[]): Chunk[] {
  const chunks: Chunk[] = [];
  let idx = 0;
  for (const page of pages) {
    const pieces = splitRecursive(page.text, CHUNK_SIZE, CHUNK_OVERLAP);
    for (const piece of pieces) {
      chunks.push({
        content: piece,
        page_number: page.page,
        section: detectSection(piece),
        chunk_index: idx++,
      });
    }
  }
  return chunks;
}
