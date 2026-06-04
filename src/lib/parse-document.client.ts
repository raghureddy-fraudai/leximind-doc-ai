import type { RawPage } from "./chunk";

export async function parseFile(file: File): Promise<RawPage[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return parsePdf(file);
  if (name.endsWith(".docx")) return parseDocx(file);
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) {
    const text = await file.text();
    return [{ page: 1, text }];
  }
  throw new Error(`Unsupported file type: ${file.name}`);
}

async function parsePdf(file: File): Promise<RawPage[]> {
  const pdfjs = await import("pdfjs-dist");
  // Use bundled worker via Vite ?url import
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const pages: RawPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (text) pages.push({ page: i, text });
  }
  return pages;
}

async function parseDocx(file: File): Promise<RawPage[]> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
  return [{ page: 1, text: value }];
}
