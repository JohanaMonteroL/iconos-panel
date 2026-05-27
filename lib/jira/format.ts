// Helpers de formato para JIRA:
//   - prefijos de título según `tipo`.
//   - conversión simple de markdown a Atlassian Document Format (ADF).
//
// El ADF que generamos cubre lo común que va a usar Johana: párrafos,
// negritas, itálicas, headings (## y ###), listas con viñetas, listas
// numeradas, bloques de cita, código inline y links. Más que suficiente
// para tickets internos.

export type TipoTicket = "estimacion" | "desarrollo" | "soporte" | "investigacion";
export type SubTipoTicket = "task" | "historia" | "bug";

export function prefijoTitulo(tipo: TipoTicket): string {
  switch (tipo) {
    case "estimacion":
      return "Estimación: ";
    case "soporte":
      return "Soporte: ";
    case "investigacion":
      return "Investigación: ";
    case "desarrollo":
    default:
      return "";
  }
}

export function aplicarPrefijo(tipo: TipoTicket, tituloCorto: string): string {
  const pref = prefijoTitulo(tipo);
  const limpio = tituloCorto.replace(
    /^\s*(Estimación|Soporte|Investigación)\s*:\s*/i,
    ""
  );
  return `${pref}${limpio.trim()}`;
}

export function mapearIssueTypeName(
  tipo: TipoTicket,
  subTipo: SubTipoTicket | null
): string {
  switch (tipo) {
    case "estimacion":
      return "Task";
    case "investigacion":
      return "Task";
    case "soporte":
      return subTipo === "bug" ? "Bug" : "Task";
    case "desarrollo":
      return subTipo === "historia" ? "Story" : "Task";
    default:
      return "Task";
  }
}

// ── Templates de descripción por tipo ───────────────────────────────────

// (Función templateDescripcion eliminada: ya no usamos templates rígidos. El
// usuario escribe libre y la IA mejora la redacción.)

// ── Markdown → ADF ──────────────────────────────────────────────────────

type AdfNode = Record<string, unknown>;

const empty = (): AdfNode => ({
  type: "doc",
  version: 1,
  content: [],
});

// Procesa una línea de texto inline (negritas, itálicas, código, links).
function inlineToAdf(text: string): AdfNode[] {
  const out: AdfNode[] = [];
  let i = 0;

  const pushText = (s: string, marks?: AdfNode[]) => {
    if (s.length === 0) return;
    const node: AdfNode = { type: "text", text: s };
    if (marks && marks.length > 0) node.marks = marks;
    out.push(node);
  };

  while (i < text.length) {
    // Link [texto](url)
    if (text[i] === "[") {
      const closeBracket = text.indexOf("]", i + 1);
      if (closeBracket > i && text[closeBracket + 1] === "(") {
        const closeParen = text.indexOf(")", closeBracket + 2);
        if (closeParen > closeBracket) {
          const label = text.slice(i + 1, closeBracket);
          const href = text.slice(closeBracket + 2, closeParen);
          out.push({
            type: "text",
            text: label,
            marks: [{ type: "link", attrs: { href } }],
          });
          i = closeParen + 1;
          continue;
        }
      }
    }

    // **bold**
    if (text[i] === "*" && text[i + 1] === "*") {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        pushText(text.slice(i + 2, end), [{ type: "strong" }]);
        i = end + 2;
        continue;
      }
    }

    // _italic_
    if (text[i] === "_") {
      const end = text.indexOf("_", i + 1);
      if (end > i + 1) {
        pushText(text.slice(i + 1, end), [{ type: "em" }]);
        i = end + 1;
        continue;
      }
    }

    // `code`
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i + 1) {
        pushText(text.slice(i + 1, end), [{ type: "code" }]);
        i = end + 1;
        continue;
      }
    }

    // Texto normal — acumular hasta el próximo token
    let j = i + 1;
    while (
      j < text.length &&
      text[j] !== "*" &&
      text[j] !== "_" &&
      text[j] !== "`" &&
      text[j] !== "["
    )
      j++;
    pushText(text.slice(i, j));
    i = j;
  }

  return out;
}

function makeParagraph(text: string): AdfNode {
  return {
    type: "paragraph",
    content: inlineToAdf(text),
  };
}

function makeHeading(level: 1 | 2 | 3, text: string): AdfNode {
  return {
    type: "heading",
    attrs: { level },
    content: inlineToAdf(text),
  };
}

function makeBulletList(items: string[]): AdfNode {
  return {
    type: "bulletList",
    content: items.map((it) => ({
      type: "listItem",
      content: [makeParagraph(it)],
    })),
  };
}

function makeOrderedList(items: string[]): AdfNode {
  return {
    type: "orderedList",
    content: items.map((it) => ({
      type: "listItem",
      content: [makeParagraph(it)],
    })),
  };
}

function makeBlockquote(text: string): AdfNode {
  return {
    type: "blockquote",
    content: [makeParagraph(text)],
  };
}

export function markdownToAdf(md: string): AdfNode {
  const doc = empty();
  const content: AdfNode[] = [];
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Línea en blanco → saltar.
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length as 1 | 2 | 3;
      content.push(makeHeading(level, h[2]));
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      // Agrupa líneas consecutivas con >.
      const buf: string[] = [line.slice(2)];
      i++;
      while (i < lines.length && lines[i].startsWith("> ")) {
        buf.push(lines[i].slice(2));
        i++;
      }
      content.push(makeBlockquote(buf.join(" ")));
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      content.push(makeBulletList(items));
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      content.push(makeOrderedList(items));
      continue;
    }

    // Párrafo — agrupa líneas consecutivas no-vacías sin marca especial.
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s|[-*]\s|>\s|\d+\.\s)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    content.push(makeParagraph(buf.join(" ")));
  }

  // ADF no acepta `content: []` en `doc`, requiere al menos un párrafo.
  if (content.length === 0) {
    content.push(makeParagraph(""));
  }

  doc.content = content;
  return doc;
}

// ── Prioridad: panel → JIRA ─────────────────────────────────────────────

export function mapearPrioridadAJira(p: string): string {
  switch (p.toLowerCase()) {
    case "highest":
      return "Highest";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    case "lowest":
      return "Lowest";
    default:
      return "Medium";
  }
}
