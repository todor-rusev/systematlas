                                                                                   
                                                                              
                                                                            
                                                                      
                                                                

export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "strong"; children: Inline[] }
  | { kind: "link"; href: string; children: Inline[] }
  | { kind: "break" };

export type Block =
  | { kind: "paragraph"; children: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "code"; language: string; text: string };

                                                                                     
export function safeHref(url: string): string | null {
  return /^(?:https?:\/\/|mailto:)/i.test(url.trim()) ? url.trim() : null;
}

const URL_RE = /https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/y;

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let text = "";
  const flush = () => {
    if (text) out.push({ kind: "text", text });
    text = "";
  };
  for (let i = 0; i < source.length; ) {
    const rest = source.slice(i);
    if (source[i] === "\n") {
      flush();
      out.push({ kind: "break" });
      i++;
      continue;
    }
    if (source[i] === "`") {
      const end = source.indexOf("`", i + 1);
      if (end > i + 1) {
        flush();
        out.push({ kind: "code", text: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (rest.startsWith("**")) {
      const end = source.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push({ kind: "strong", children: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if (source[i] === "[") {
      const link = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(rest);
      const href = link && safeHref(link[2]);
      if (link && href) {
        flush();
        out.push({ kind: "link", href, children: parseInline(link[1]) });
        i += link[0].length;
        continue;
      }
    }
    if ((source[i] === "h" || source[i] === "H") && (i === 0 || /[\s(]/.test(source[i - 1]))) {
      URL_RE.lastIndex = i;
      const url = URL_RE.exec(source);
      if (url) {
        flush();
        out.push({ kind: "link", href: url[0], children: [{ kind: "text", text: url[0] }] });
        i += url[0].length;
        continue;
      }
    }
    text += source[i++];
  }
  flush();
  return out;
}

const LIST_ITEM = /^\s{0,3}(?:([-*])|(\d+)[.)])\s+(.*)$/;

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const endParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", children: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };
  const endList = () => {
    if (list) blocks.push({ kind: "list", ordered: list.ordered, items: list.items.map(parseInline) });
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s{0,3}```\s*([\w+#.-]*)\s*$/.exec(line);
    if (fence) {
      endParagraph();
      endList();
      const body: string[] = [];
      for (i++; i < lines.length && !/^\s{0,3}```\s*$/.test(lines[i]); i++) body.push(lines[i]);
      blocks.push({ kind: "code", language: fence[1], text: body.join("\n") });
      continue;
    }
    if (!line.trim()) {
      endParagraph();
      endList();
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      endParagraph();
      const ordered = item[2] !== undefined;
      if (list && list.ordered !== ordered) endList();
      if (!list) list = { ordered, items: [] };
      list.items.push(item[3]);
      continue;
    }
                                                                                        
    if (list && /^\s+\S/.test(line)) {
      list.items[list.items.length - 1] += `\n${line.trim()}`;
      continue;
    }
    endList();
    paragraph.push(line);
  }
  endParagraph();
  endList();
  return blocks;
}

                                                                                      
export function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => (n.kind === "text" || n.kind === "code" ? n.text : n.kind === "break" ? "\n" : inlineText(n.children)))
    .join("");
}

export const plainText = (source: string): string => inlineText(parseInline(source));

                                                                                  
export function inlineRuns(source: string): { text: string; code: boolean }[] {
  const runs: { text: string; code: boolean }[] = [];
  const walk = (nodes: Inline[]) => {
    for (const n of nodes) {
      if (n.kind === "text") runs.push({ text: n.text, code: false });
      else if (n.kind === "code") runs.push({ text: n.text, code: true });
      else if (n.kind === "break") runs.push({ text: "\n", code: false });
      else walk(n.children);
    }
  };
  walk(parseInline(source));
  return runs;
}

                                                                                          
export const hasMarkup = (source: string): boolean =>
  parseInline(source).some((n) => n.kind !== "text" && n.kind !== "break");
