                                                                                 
                                                                                    
import { END_MARKERS, ICONS, LINE_STYLES, SHAPES } from "../core/visual-vocabulary";

interface Entry { section: "shape" | "icon" | "line" | "marker"; name: string; meaning: string }

const ENTRIES: Entry[] = [
  ...Object.entries(SHAPES).map(([name, meaning]) => ({ section: "shape" as const, name, meaning })),
  ...Object.entries(ICONS).map(([name, icon]) => ({ section: "icon" as const, name, meaning: icon.description })),
  ...LINE_STYLES.map((name) => ({ section: "line" as const, name, meaning: "edge style.line" })),
  ...END_MARKERS.map((name) => ({ section: "marker" as const, name, meaning: "edge style.start / style.end" })),
];

const RULES = `# Visual vocabulary — how a Flow diagram looks

Meaning first, appearance second. Every field below is optional; omit it when the default says enough.

- **node.type** keeps the control-flow meaning and its default form: terminal → capsule, step → rounded
  rectangle, decision → diamond, subflow → owner-colored rounded card + frame + Open, io → parallelogram.
- **node.shape** says what the node IS (a database, a queue, a document, a person, a timer). Pick the
  shape whose meaning below matches; use the same shape for the same kind of thing in every document.
  It never changes type: a decision stays a decision, a subflow still drills down.
- **node.icon** adds a recognisable cue in its own slot beside the label; the label is never replaced.
  Prefer \`{kind:"builtin",name}\`. \`{kind:"emoji",text}\` (≤32 chars) for a cue the set lacks.
  \`{kind:"svg",viewBox:[x,y,w,h],paths:[{d,fill?,stroke?,strokeWidth?}]}\` only when neither fits:
  ≤32 paths, path data is SVG commands and numbers only, colors are \`currentColor\`, \`none\` or hex.
  An icon that repeats the shape or the label adds nothing; leave it out.
- **Pictures** use \`shape:"image"\` with \`node.icon\` containing custom SVG paths or emoji.
  \`shape:"icon"\` uses a smaller picture slot. PNG/JPEG files, image URLs and raw SVG markup
  are not supported; custom vector artwork is embedded in the document and exported offline.
- **edge.style** \`{line?, width?:"normal"|"thick", start?, end?}\` changes how a transition looks;
  edge.type still says flow / branch / return. Use it for a difference the reader must see, the same way
  throughout the document, and state what it means in the edge label or description.

Example: \`{ "id":"orders-db", "type":"step", "shape":"cyl", "icon":{"kind":"builtin","name":"database"},
"label":"Orders DB", ... }\` · \`{ "from":"api", "to":"worker", "type":"flow", "label":"async",
"style":{"line":"dashed"} }\`

Search: get_docs {topic:"vocabulary", query:"queue"} returns only matching names.`;

const SECTION_TITLES: Record<Entry["section"], string> = {
  shape: "Shapes (node.shape) — name: meaning",
  icon: "Built-in icons (node.icon {kind:\"builtin\",name}) — name: meaning",
  line: "Line styles (edge.style.line)",
  marker: "End markers (edge.style.start / end)",
};

function render(entries: Entry[]): string {
  return (Object.keys(SECTION_TITLES) as Entry["section"][])
    .map((section) => {
      const rows = entries.filter((e) => e.section === section);
      if (!rows.length) return "";
      const body = section === "line" || section === "marker"
        ? rows.map((e) => e.name).join(" · ")
        : rows.map((e) => `- ${e.name}: ${e.meaning}`).join("\n");
      return `## ${SECTION_TITLES[section]}\n${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

                                                                                                      
export function vocabularyDocs(query?: string): string {
  const words = (query ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  if (!words.length) return `${RULES}\n\n${render(ENTRIES)}`;
  const scored = ENTRIES
    .map((entry) => {
      const name = entry.name.toLowerCase(), meaning = entry.meaning.toLowerCase();
      const score = words.reduce((n, w) => n + (name === w ? 3 : name.includes(w) ? 2 : meaning.includes(w) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored.length) {
    const names = (section: Entry["section"]) => ENTRIES.filter((e) => e.section === section).map((e) => e.name).join(", ");
    return `No vocabulary entry matches ${JSON.stringify(query)}. All names:\n` +
      `shapes: ${names("shape")}\nicons: ${names("icon")}\nlines: ${names("line")}\nmarkers: ${names("marker")}\n` +
      `Call get_docs {topic:"vocabulary"} without query for meanings and usage rules.`;
  }
  return `Matches for ${JSON.stringify(query)} (usage rules: get_docs {topic:"vocabulary"} without query):\n\n` +
    render(scored.map((s) => s.entry));
}
