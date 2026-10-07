                                                                             
                                                                            
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { parseBlocks, parseInline, type Inline } from "../core/markdown";
import { highlightCode, syntaxRole } from "./code-highlight";
import { tokens } from "../tokens";

const codeSpan: CSSProperties = {
  fontFamily: tokens.font.mono,
  fontSize: "0.9em",
  fontWeight: 500,
  padding: "0 4px",
  borderRadius: 4,
  background: "rgba(42,39,34,.08)",
  overflowWrap: "anywhere",
};

                                                                                           
const keepClickOnLink = (e: MouseEvent) => e.stopPropagation();

function renderInline(nodes: Inline[], key = ""): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}${i}`;
    switch (n.kind) {
      case "text":
        return n.text;
      case "break":
        return <br key={k} />;
      case "code":
        return (
          <code key={k} style={codeSpan}>
            {n.text}
          </code>
        );
      case "strong":
        return <strong key={k}>{renderInline(n.children, `${k}.`)}</strong>;
      case "link":
        return (
          <a
            key={k}
            className="nodrag"
            href={n.href}
            target="_blank"
            rel="noreferrer noopener"
            onClick={keepClickOnLink}
            onDoubleClick={keepClickOnLink}
            style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}
          >
            {renderInline(n.children, `${k}.`)}
          </a>
        );
    }
  });
}

                                                             
export function InlineMarkdown({ text }: { text: string }) {
  return <>{renderInline(parseInline(text))}</>;
}

                                                
export function MarkdownBlocks({ text, style }: { text: string; style?: CSSProperties }) {
  return (
    <div className="ft-markdown" style={style}>
      {parseBlocks(text).map((block, i) => {
        if (block.kind === "paragraph") return <p key={i} style={{ margin: "0 0 8px" }}>{renderInline(block.children)}</p>;
        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={i} style={{ margin: "0 0 8px", paddingLeft: 18 }}>
              {block.items.map((item, j) => (
                <li key={j} style={{ marginBottom: 4 }}>
                  {renderInline(item, `${j}.`)}
                </li>
              ))}
            </List>
          );
        }
        return (
          <figure key={i} style={{ margin: "0 0 10px" }}>
            {block.language ? (
              <figcaption style={{ fontSize: 10.5, color: tokens.color.faint, fontFamily: tokens.font.mono, marginBottom: 3 }}>
                {block.language}
              </figcaption>
            ) : null}
            <pre
              style={{
                margin: 0,
                padding: "8px 10px",
                background: tokens.color.field,
                border: `1px solid ${tokens.color.border}`,
                borderRadius: 7,
                fontFamily: tokens.font.mono,
                fontSize: 11.5,
                lineHeight: 1.45,
                overflowX: "auto",
                whiteSpace: "pre",
              }}
            >
              <code>
                {highlightCode(block.text, block.language).map((run, j) => {
                  const role = syntaxRole(run.classes);
                  return role ? (
                    <span key={j} style={{ color: tokens.syntax[role], fontStyle: role === "comment" ? "italic" : undefined }}>
                      {run.text}
                    </span>
                  ) : (
                    run.text
                  );
                })}
              </code>
            </pre>
          </figure>
        );
      })}
    </div>
  );
}
