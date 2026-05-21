// Renderer minimalista para texto en formato Slack mrkdwn.
// Soporta:
//   *bold*
//   _italic_
//   <url|texto>  (hipervínculo)
//   <url>        (link plano)
//   > blockquote (al inicio de línea)
//   • bullets    (al inicio de línea, se rinden con padding)

import React from "react";

function renderInline(text: string): React.ReactNode[] {
  // Orden: links primero (porque pueden contener cualquier char), luego bold/italic
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < text.length) {
    // Link <url|text>, <url>, o mención especial <!here> / <!channel>
    if (text[i] === "<") {
      const end = text.indexOf(">", i + 1);
      if (end > i) {
        const inside = text.slice(i + 1, end);

        // Menciones especiales de Slack: <!here>, <!channel>, <!everyone>
        if (inside === "!here" || inside === "!channel" || inside === "!everyone") {
          const label =
            inside === "!here" ? "@here" : inside === "!channel" ? "@channel" : "@everyone";
          out.push(
            <span
              key={`m${key++}`}
              style={{
                background: "#fde68a",
                color: "#92400e",
                padding: "0 4px",
                borderRadius: 3,
                fontWeight: 600,
              }}
            >
              {label}
            </span>
          );
          i = end + 1;
          continue;
        }

        const pipe = inside.indexOf("|");
        const url = pipe >= 0 ? inside.slice(0, pipe) : inside;
        const label = pipe >= 0 ? inside.slice(pipe + 1) : inside;
        if (/^https?:\/\//.test(url)) {
          out.push(
            <a
              key={`a${key++}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#1264a3", textDecoration: "underline" }}
            >
              {label}
            </a>
          );
          i = end + 1;
          continue;
        }
      }
    }

    // *bold*  — único delimitador estilo Slack
    if (text[i] === "*") {
      const end = text.indexOf("*", i + 1);
      if (end > i + 1 && !/\s/.test(text[i + 1]) && !/\s/.test(text[end - 1])) {
        out.push(
          <strong key={`b${key++}`} className="font-semibold">
            {text.slice(i + 1, end)}
          </strong>
        );
        i = end + 1;
        continue;
      }
    }

    // _italic_
    if (text[i] === "_") {
      const end = text.indexOf("_", i + 1);
      if (end > i + 1 && !/\s/.test(text[i + 1]) && !/\s/.test(text[end - 1])) {
        out.push(
          <em key={`i${key++}`} className="italic">
            {text.slice(i + 1, end)}
          </em>
        );
        i = end + 1;
        continue;
      }
    }

    // Texto normal — acumular hasta el próximo token
    let j = i + 1;
    while (j < text.length && text[j] !== "<" && text[j] !== "*" && text[j] !== "_") j++;
    out.push(text.slice(i, j));
    i = j;
  }
  return out;
}

export default function SlackText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        if (line === "") return <div key={idx} style={{ height: "0.4em" }} />;

        // Blockquote: línea que empieza con >
        if (line.startsWith("> ")) {
          return (
            <div
              key={idx}
              style={{
                borderLeft: "3px solid var(--border-default)",
                paddingLeft: 12,
                color: "var(--text-secondary)",
                fontStyle: "italic",
              }}
            >
              {renderInline(line.slice(2))}
            </div>
          );
        }

        // Bullets: • al inicio
        if (line.startsWith("• ")) {
          return (
            <div
              key={idx}
              style={{
                paddingLeft: 12,
                display: "flex",
                gap: 8,
              }}
            >
              <span style={{ color: "var(--text-tertiary)" }}>•</span>
              <div>{renderInline(line.slice(2))}</div>
            </div>
          );
        }

        return <div key={idx}>{renderInline(line)}</div>;
      })}
    </div>
  );
}
