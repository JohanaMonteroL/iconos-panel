// Renderer mínimo de markdown — suficiente para outputs de Claude:
//   **bold**, *italic*, `code`, listas numeradas, bullets, párrafos.
//
// Parser línea-por-línea con autómata para que las listas numeradas
// no se reinicien entre items aunque haya líneas en blanco entre ellos.

import React from "react";

function renderInline(text: string): React.ReactNode[] {
  const tokenRe = /(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(_[^_\n]+_)|(`[^`\n]+`)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;

  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) {
      parts.push(
        <strong key={`b${key++}`} className="font-semibold">
          {t.slice(2, -2)}
        </strong>
      );
    } else if (t.startsWith("`")) {
      parts.push(
        <code
          key={`c${key++}`}
          className="text-mono"
          style={{
            background: "var(--bg-overlay)",
            padding: "1px 6px",
            borderRadius: 4,
          }}
        >
          {t.slice(1, -1)}
        </code>
      );
    } else if (t.startsWith("*") || t.startsWith("_")) {
      parts.push(
        <em key={`i${key++}`} className="italic">
          {t.slice(1, -1)}
        </em>
      );
    }
    last = tokenRe.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function renderLines(block: string): React.ReactNode {
  const lines = block.split("\n");
  return lines.map((line, i) => (
    <React.Fragment key={i}>
      {renderInline(line)}
      {i < lines.length - 1 && <br />}
    </React.Fragment>
  ));
}

const NUM_RE = /^\d+[.)]\s+/;
const BUL_RE = /^[-*•]\s+/;

export default function Markdown({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  if (!text) return null;

  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  // Helper: ¿la siguiente línea no vacía es continuación de la misma lista?
  const peekContinuesList = (idx: number, regex: RegExp): boolean => {
    let j = idx;
    while (j < lines.length && lines[j].trim() === "") j++;
    return j < lines.length && regex.test(lines[j].trim());
  };

  // Helper: consume un bloque de lista (numerada o bullets)
  const consumeList = (regex: RegExp, ordered: boolean) => {
    const items: string[] = [];
    let current = "";
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();
      if (regex.test(trimmed)) {
        if (current) items.push(current);
        current = trimmed.replace(regex, "");
        i++;
      } else if (trimmed === "") {
        // Línea vacía — sigue siendo lista solo si el próximo item válido también es lista
        if (peekContinuesList(i + 1, regex)) {
          i++;
        } else {
          break;
        }
      } else {
        // Continuación del item actual (texto envuelto)
        current += " " + trimmed;
        i++;
      }
    }
    if (current) items.push(current);

    const ListTag = ordered ? "ol" : "ul";
    const listClass = ordered ? "list-decimal" : "list-disc";
    nodes.push(
      <ListTag
        key={key++}
        className={`${listClass} pl-6 space-y-2 marker:text-text-secondary`}
      >
        {items.map((it, j) => (
          <li key={j} className="pl-1">
            {renderLines(it)}
          </li>
        ))}
      </ListTag>
    );
  };

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    if (NUM_RE.test(trimmed)) {
      consumeList(NUM_RE, true);
      continue;
    }

    if (BUL_RE.test(trimmed)) {
      consumeList(BUL_RE, false);
      continue;
    }

    // Párrafo — consumir líneas hasta blanco o inicio de lista
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i];
      const t = l.trim();
      if (t === "" || NUM_RE.test(t) || BUL_RE.test(t)) break;
      paraLines.push(l);
      i++;
    }
    nodes.push(<p key={key++}>{renderLines(paraLines.join("\n"))}</p>);
  }

  return <div className={`space-y-3 ${className}`}>{nodes}</div>;
}
