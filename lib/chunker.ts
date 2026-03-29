export interface ContractChunk {
  text: string;
  index: number;
  sectionNumber: string | null;
  sectionTitle: string | null;
  pageEstimate: number;
}

export function chunkContract(fullText: string): ContractChunk[] {
  const chunks: ContractChunk[] = [];

  // Pattern to detect section headers in contracts
  // Matches: "Section 1.2", "ARTICLE III", "4.3.1", "Clause 7(b)",
  // "TERM AND TERMINATION", numbered items like "1.", "2.", etc.
  const sectionPattern =
    /(?:^|\n)(?:\s*)((?:Section|SECTION|Article|ARTICLE|Clause|CLAUSE)\s+[\d\w.()]+[.:;\s-]*.*?$|(?:^\d+\.[\d.]*\s+[A-Z].*?$)|(?:^[A-Z][A-Z\s]{4,}$))/gm;

  const matches: { index: number; header: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = sectionPattern.exec(fullText)) !== null) {
    const header = match[1]?.trim();
    if (header) {
      matches.push({ index: match.index, header });
    }
  }

  if (matches.length === 0) {
    // No sections detected — fall back to paragraph-based chunking
    return chunkByParagraphsToContractChunks(fullText);
  }

  // Split text at each section boundary
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : fullText.length;
    const sectionText = fullText.slice(start, end).trim();

    if (sectionText.length < 20) continue; // skip empty sections

    // Parse section number and title from header
    const { number, title } = parseSectionHeader(matches[i].header);

    // If a section is very long (>2000 chars), sub-chunk by paragraphs
    if (sectionText.length > 2000) {
      const subChunks = chunkByParagraphs(sectionText, 1500);
      subChunks.forEach((sub, j) => {
        chunks.push({
          text: sub,
          index: chunks.length,
          sectionNumber: number ? `${number} (part ${j + 1})` : null,
          sectionTitle: title,
          pageEstimate: Math.floor(start / 3000) + 1, // rough page estimate
        });
      });
    } else {
      chunks.push({
        text: sectionText,
        index: chunks.length,
        sectionNumber: number,
        sectionTitle: title,
        pageEstimate: Math.floor(start / 3000) + 1,
      });
    }
  }

  // Also capture any preamble text before the first section
  if (matches.length > 0 && matches[0].index > 100) {
    const preamble = fullText.slice(0, matches[0].index).trim();
    if (preamble.length > 50) {
      chunks.unshift({
        text: preamble,
        index: 0,
        sectionNumber: "Preamble",
        sectionTitle: "Contract Header / Parties",
        pageEstimate: 1,
      });
      // Re-index
      chunks.forEach((c, idx) => {
        c.index = idx;
      });
    }
  }

  return chunks;
}

function parseSectionHeader(header: string): {
  number: string | null;
  title: string | null;
} {
  // Try to extract "Section 4.3 - Payment Terms" → { number: "4.3", title: "Payment Terms" }
  const numbered = header.match(
    /^(?:Section|Article|Clause)\s+([\d\w.()]+)[.:;\s-]*(.*)/i,
  );
  if (numbered) {
    return { number: numbered[1], title: numbered[2]?.trim() || null };
  }

  // Try "4.3.1 Payment Terms" → { number: "4.3.1", title: "Payment Terms" }
  const numPrefix = header.match(/^(\d+\.[\d.]*)\s+(.*)/);
  if (numPrefix) {
    return { number: numPrefix[1], title: numPrefix[2] };
  }

  // ALL CAPS HEADER → { number: null, title: "Term And Termination" }
  if (header === header.toUpperCase() && header.length > 4) {
    const titleCase = header
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { number: null, title: titleCase };
  }

  return { number: null, title: header };
}

function chunkByParagraphs(text: string, maxLen: number = 1500): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const out: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > maxLen && current.length > 100) {
      out.push(current.trim());
      current = para;
    } else {
      current += "\n\n" + para;
    }
  }
  if (current.trim().length > 50) {
    out.push(current.trim());
  }

  return out;
}

/** When no section headers match, emit one `ContractChunk` per paragraph group (same as paragraph chunker). */
function chunkByParagraphsToContractChunks(
  fullText: string,
  maxLen: number = 1500,
): ContractChunk[] {
  const parts = chunkByParagraphs(fullText.trim(), maxLen);
  return parts.map((text, index) => ({
    text,
    index,
    sectionNumber: null,
    sectionTitle: null,
    pageEstimate: Math.floor(index / 2) + 1,
  }));
}
