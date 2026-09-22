/** Tiny, safe markdown renderer: "## heading", "- list", paragraphs, **bold**. No raw HTML is ever injected. */
export default function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="prose-x">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (b.startsWith("## ")) {
          const [h, ...rest] = lines;
          return (
            <div key={i}>
              <h2>{h.slice(3)}</h2>
              {rest.length > 0 && <Para lines={rest} />}
            </div>
          );
        }
        if (lines.every((l) => l.startsWith("- "))) return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
        return <Para key={i} lines={lines} />;
      })}
    </div>
  );
}

function Para({ lines }: { lines: string[] }) {
  if (lines.every((l) => l.startsWith("- "))) return <ul>{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>;
  return <p>{inline(lines.join(" "))}</p>;
}

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part));
}
