#!/usr/bin/env node
                                                                              
                                                                               
                                                                            
  
                                                                                  
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { z } from "zod";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Project, RevisionConflictError } from "../core/project";
import { pkgPath } from "../core/paths";
import { resolveWorkspaceRoot } from "../core/mcp-config";
import { applyPatch, type PatchOp } from "../core/patch";
import { validateDoc, type AnyDoc } from "../core/validate-doc";
import { renderResult } from "./render";
import { listNavigation, navigationInput } from "./navigation";
import { readView, readViewInput } from "./read-view";
import { vocabularyDocs } from "./vocabulary-docs";
import { BRAND } from "../brand";

const URI = BRAND.uriScheme;                                         

const EXAMPLE_SUFFIX = /\.(flow|sequence)\.json$/;
const flowSchemaUrl = pkgPath("schema", "flow.schema.json");
const sequenceSchemaUrl = pkgPath("schema", "sequence.schema.json");
const examplesDir = pkgPath("examples");

                                                                               
                                                                               
function resolveRoot(callWorkspace?: string) {
  return resolveWorkspaceRoot({
    callWorkspace,
    envWorkspace: process.env[BRAND.envWorkspace],
    argvWorkspace: process.argv[2],
    scope: process.env[BRAND.envScope],
    cwd: process.cwd(),
  });
}

                                                                       
function projectFor(callWorkspace?: string): { project?: Project; root?: string; error?: string } {
  const r = resolveRoot(callWorkspace);
  if (!r.root) return { error: r.error };
  return { project: new Project(r.root), root: r.root };
}

const errText = (text: string) => ({ content: [{ type: "text" as const, text }], isError: true as const });

                                                                                  

const idInput = { id: z.string().describe("Flow id (filename without .flow.json).") };

const modelShape = z
  .object({
    version: z.string(),
    id: z.string(),
    title: z.string(),
  })
  .passthrough()
  .describe(
    "A complete Flow OR Sequence document (discriminated by `kind`: omit/`flow` for a Flow, " +
      `\`sequence\` for a Sequence). See ${URI}://schema and ${URI}://sequence-schema for the ` +
      `JSON Schemas and ${URI}://guide for authoring rules. Validated server-side.`,
  );

const modelInput = { model: modelShape };

                                                                                  
const workspaceInput = {
  workspace: z
    .string()
    .optional()
    .describe(
      `Absolute path of the PROJECT directory to operate in — documents live under its \`${BRAND.storeDir}/\` ` +
        "folder. Omit ONLY when the server already knows the project (it was launched there, e.g. Claude " +
        "Code). In a global client (e.g. Claude Desktop) you MUST pass it; if omitted the server returns " +
        "an error. If you do not know where to save, ASK THE USER. Pass the SAME value on every call.",
    ),
};

                                                                                     
const revisionInput = {
  expectRevision: z
    .string()
    .optional()
    .describe(
      "The revision of the document you read (read_flow returns it). If the document changed since, nothing " +
        "is written and you get the current revision: read it again, redo your change, retry.",
    ),
};

                                                                                       
                                                                               
function writeFailure(e: unknown) {
  if (e instanceof RevisionConflictError) {
    return {
      content: [{ type: "text" as const, text: `Not written — ${e.message}. Read it again with read_flow, redo your change on that version, and retry${e.current ? ` with expectRevision "${e.current}"` : ""}.` }],
      structuredContent: { written: null, conflict: { id: e.id, expectedRevision: e.expected, currentRevision: e.current } },
      isError: true,
    };
  }
  return errText(`Not written — ${e instanceof Error ? e.message : String(e)}`);
}

                                                                                  

                                                                               
                                                                              
                                                                                  
const INSTRUCTIONS = `${BRAND.display}: visualize processes and interactions as JSON documents at two altitudes — Flow (high: a
directed graph of steps; \`*.flow.json\`) and Sequence (low/exact: an ordered, nested call tree;
\`kind:"sequence"\`, \`*.sequence.json\`). You author these.

Tools:
- get_docs {topic} — the authoring guide / JSON Schemas / examples as TEXT. CALL THIS FIRST if you have
  not authored a ${BRAND.display} document before: \`topic:"guide"\` for the rules, \`"flow-schema"\` /
  \`"sequence-schema"\` for the exact contracts, \`"examples"\` to list/fetch samples. (It exists because
  some clients — e.g. Claude Desktop — expose MCP resources only to the user, not to you.)
  \`topic:"vocabulary"\` lists node shapes, icons and edge styles by meaning; add \`query:"database"\` to search it.
- list_flows — paged catalog + \`workspaceRoot\` (the folder writes land in; check it if a write goes
  somewhere unexpected — a stale root means the server must be restarted with the right path).
  Exact queries: \`query:{kind:"shared",id:"..."}\` for every shared occurrence;
  \`query:{kind:"links",document:"...",direction:"incoming",relations:["subflow","sequence"]}\`
  for incoming drills (use \`"twin"\` for twins). Follow \`nextCursor\` with the SAME query until
  \`complete:true\`; a changed workspace invalidates the cursor, so restart the query.
- read_flow {id} — JSON envelope {document, revision}; only document is an editable model.
  Optional \`format:"compact"|"dot"\` returns a read-only view; \`around:"local-node-id",depth:0..5\`
  selects a Flow neighborhood with boundary references, without opening drills. All formats share
  this selection. \`detail:"structure"\` omits descriptions; use full detail to distinguish labels.
  Focused JSON is also read-only. Patch by local ids, never write a view or envelope as a model.
- validate_flow {model} — dry-run validation (structure + referential integrity + split heuristic).
- write_flow {model} — validate + write a WHOLE document (rejects on errors; else writes and reports
  warnings — worth a look — and hints — no action needed).
- patch_flow {id, ops[]} — SMALL edits by object id (set-field / upsert·remove node|edge|call); applies
  the delta, validates the whole result, then writes. Prefer this over resending the whole doc.
  Pass the read's revision as \`expectRevision\` on patch/write; a conflict writes nothing: reread.
- manage_flow {action, id, ...} — lifecycle: delete | rename | set-category. Never move/delete files by
  hand (it bypasses validation).

Key rules: identity is the \`id\`, not the label (set \`shared:true\` on a Flow node/edge for cross-flow
identity; actor ids stay local to each document). Never edit a diagram only to silence a warning or hint. You pass a
document by \`id\` (never a file path) — docs are stored under \`<workspace>/${BRAND.storeDir}/\` automatically.
Where to save: pass \`workspace\` (absolute project dir) on the tools. If you omit it, the server uses the
project it was launched in (project-scoped clients, e.g. Claude Code) or returns an error (global clients,
e.g. Claude Desktop) — then pass the path of the project under discussion, or ask the user. Reuse the same
\`workspace\` across the conversation. Author the Flow first; add a Sequence (linked from a node/edge via
\`sequence\`) only where the exact call-trace helps.

Fuller guidance: call get_docs {topic:"guide"|"flow-schema"|"sequence-schema"|"vocabulary"|"examples"}
(works in every client), or read the matching MCP resources (${URI}://guide, ${URI}://schema,
${URI}://sequence-schema, ${URI}://vocabulary, ${URI}://examples/{name}) if your client surfaces resources to you.`;

const server = new McpServer({ name: BRAND.mcpName, version: "0.1.0" }, { instructions: INSTRUCTIONS });

server.registerTool(
  "get_docs",
  {
    title: "Get authoring docs",
    description:
      "Fetch the authoring guide, the JSON Schemas, or bundled examples as TEXT — the same material " +
      "as the MCP resources, but callable as a tool (some clients, e.g. Claude Desktop, expose " +
      "resources to the user only, not to the model). `topic`: 'guide' (authoring rules) | 'flow-schema' " +
      "| 'sequence-schema' (exact contracts) | 'vocabulary' (node shapes, icons, edge styles by meaning; " +
      "`query` searches it) | 'examples'. For 'examples', omit `name` to list them, or " +
      "pass a `name` to fetch one. Call this before authoring if you are unsure of the format.",
    inputSchema: {
      topic: z.enum(["guide", "flow-schema", "sequence-schema", "vocabulary", "examples"]).describe("Which document to fetch."),
      name: z.string().optional().describe("Example name (topic=examples); omit to list available examples."),
      query: z.string().optional().describe("Words to search (topic=vocabulary), e.g. 'database' or 'async queue'; omit for the whole vocabulary."),
    },
  },
  async (args) => {
    const { topic, name, query } = args;
    const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
    try {
      if (topic === "guide") return text(GUIDE);
      if (topic === "vocabulary") return text(vocabularyDocs(query));
      if (topic === "flow-schema") return text(readFileSync(flowSchemaUrl, "utf8"));
      if (topic === "sequence-schema") return text(readFileSync(sequenceSchemaUrl, "utf8"));
                             
      if (!name) {
        const names = [...new Set(readdirSync(examplesDir).filter((f) => EXAMPLE_SUFFIX.test(f)).map((f) => f.replace(EXAMPLE_SUFFIX, "")))];
        return text(names.length ? `Available examples (pass one as \`name\`):\n${names.map((n) => `- ${n}`).join("\n")}` : "(no bundled examples)");
      }
      let body: string;
      try {
        body = readFileSync(pkgPath("examples", `${name}.flow.json`), "utf8");
      } catch {
        body = readFileSync(pkgPath("examples", `${name}.sequence.json`), "utf8");
      }
      return text(body);
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Couldn't fetch ${topic}${name ? `/${name}` : ""}: ${String(e)}` }], isError: true };
    }
  },
);

server.registerTool(
  "list_flows",
  {
    title: "List documents",
    description:
      "Paged document catalog (id + title + kind + category) and exact workspace relationship queries. " +
      "query:{kind:'shared',id} finds all shared occurrences; query:{kind:'links',document,direction:'incoming'|'outgoing'|'both',relations:['subflow','sequence','twin']} " +
      "finds drills/twins without reading every document. Default 50 results. Follow nextCursor until complete=true; " +
      "reuse the same query and workspace. Includes workspaceRoot. Invalid/unreadable documents return an error, never a falsely complete answer.",
    inputSchema: { ...workspaceInput, ...navigationInput },
  },
  async (args) => {
    const { project, root, error } = projectFor(args.workspace);
    if (!project || !root) return errText(error ?? "No workspace set.");
    try { return await listNavigation(root, args); }
    catch (e) { return errText(`Cannot return a complete workspace listing/query: ${String(e)}`); }
  },
);

server.registerTool(
  "read_flow",
  { title: "Read document", description: "Read by document id. Default JSON: {document,revision}; only document is editable. format:'compact' or 'dot' gives a read-only view. around:'local-node-id', depth:0..5 selects a Flow neighborhood in any format, with incident edges and labeled boundary references; drills are not opened. detail:'structure' omits explanatory fields, full retains them. Focused JSON is a view envelope, never a document to write. Patch using local ids and expectRevision from this read.", inputSchema: { ...idInput, ...workspaceInput, ...readViewInput } },
  async (args) => {
    const { id } = args;
    const { project, error } = projectFor(args.workspace);
    if (!project) return errText(error ?? "No workspace set.");
    try {
      const { doc, revision } = await project.readWithRevision(id);
      return readView(doc, args.format, args.detail, { around: args.around, depth: args.depth }, revision);
    } catch (e) {
      return errText(`Cannot read document "${id}": ${String(e)}`);
    }
  },
);

server.registerTool(
  "validate_flow",
  {
    title: "Validate flow",
    description:
      "Validate a Flow or Sequence document WITHOUT writing it. Dispatches by kind: flows get " +
      "structure (JSON Schema) + semantics (referential integrity, id uniqueness, shared-id " +
      "consistency, split heuristic, dangling drill targets); sequences get structure + call-id " +
      "uniqueness + actor/phase integrity. Returns errors + advisory warnings.",
    inputSchema: { ...modelInput, ...workspaceInput },
  },
  async (args) => {
    const model = args.model as unknown as AnyDoc;
                                                                                    
                                                                                     
    const { project } = projectFor(args.workspace);
    const result = project ? await project.validate(model) : validateDoc(model, []);
    const note = project ? "" : "\n(validated standalone — no workspace set, cross-flow checks skipped)";
    return { content: [{ type: "text", text: renderResult(result) + note }], structuredContent: result as unknown as Record<string, unknown> };
  },
);

server.registerTool(
  "write_flow",
  {
    title: "Write flow",
    description:
      "Validate and write a document to <id>.flow.json or <id>.sequence.json (by its `kind`). " +
      "Rejects on hard errors (does NOT write); writes and returns advisory warnings otherwise. " +
      "Pass the whole document each time. With `expectRevision` (the revision you read), nothing is " +
      "written if the document changed since.",
    inputSchema: { ...modelInput, ...revisionInput, ...workspaceInput },
  },
  async (args) => {
    const model = args.model as unknown as AnyDoc;
    const { project, root, error } = projectFor(args.workspace);
    if (!project || !root) return errText(error ?? "No workspace set.");
    if (!existsSync(root)) return errText(`Workspace directory not found: ${root}. Pass an existing project directory as \`workspace\`.`);
    const result = await project.validate(model);
    if (!result.ok) {
      return {
        content: [{ type: "text", text: `Not written — fix the errors:\n${renderResult(result)}` }],
        structuredContent: { written: null, ...result } as unknown as Record<string, unknown>,
        isError: true,
      };
    }
    try {
      const dest = await project.write(model, { expectRevision: args.expectRevision });
      return {
        content: [{ type: "text", text: `Wrote "${model.id}" (revision ${dest.revision}).\n${renderResult(result)}` }],
        structuredContent: { written: dest.file, revision: dest.revision, ...result } as unknown as Record<string, unknown>,
      };
    } catch (e) {
      return writeFailure(e);
    }
  },
);

server.registerTool(
  "manage_flow",
  {
    title: "Manage document (lifecycle)",
    description:
      "Document lifecycle/metadata — separate from content authoring. `action`: 'delete' (remove the " +
      "file + manifest entry), 'rename' (change the display title; needs `title`), 'set-category' " +
      "(logical, nested 'a/b'; needs `category`). For content use write_flow / patch_flow.",
    inputSchema: {
      action: z.enum(["delete", "rename", "set-category"]).describe("delete | rename | set-category"),
      id: z.string().describe("Document id."),
      title: z.string().optional().describe("New title (action=rename)."),
      category: z.string().optional().describe("Logical category, nested 'a/b' (action=set-category; '' = ungroup)."),
      ...workspaceInput,
    },
  },
  async (args) => {
    const { action, id, title, category } = args;
    const { project, root, error } = projectFor(args.workspace);
    if (!project || !root) return errText(error ?? "No workspace set.");
    if (!existsSync(root)) return errText(`Workspace directory not found: ${root}. Pass an existing project directory as \`workspace\`.`);
    const fail = (msg: string) => ({ content: [{ type: "text" as const, text: msg }], isError: true });
    try {
      if (action === "delete") {
        await project.remove(id);
        return { content: [{ type: "text" as const, text: `Deleted "${id}".` }] };
      }
      if (action === "rename") {
        if (title == null) return fail("rename needs `title`.");
        await project.rename(id, title);
        return { content: [{ type: "text" as const, text: `Renamed "${id}" → "${title}".` }] };
      }
      if (category == null) return fail("set-category needs `category`.");
      await project.setCategory(id, category);
      return { content: [{ type: "text" as const, text: `Set category of "${id}" → "${category || "(ungrouped)"}".` }] };
    } catch (e) {
      return fail(String(e));
    }
  },
);

server.registerTool(
  "patch_flow",
  {
    title: "Patch document (partial edit)",
    description:
      "Apply small edits to an existing document by object id — cheap (send only the delta), but the " +
      "WHOLE result is validated + written (rejects on errors, exactly like write_flow). `ops[]` items: " +
      "set-field {target:'doc'|'node'|'edge'|'call', id?, field, value} · upsert-node {node} · " +
      "remove-node {id} · upsert-edge {edge} · remove-edge {id} · upsert-call {call, parent?} · " +
      "remove-call {id}. An edge without an id is addressed by `edge: {from, to, type?, label?}` instead " +
      "of `id` (remove-edge, set-field target 'edge'). An op whose target does not exist fails the whole " +
      "patch. Example — insert X between A and B: upsert-node {X}, remove-edge {edge:{from:A,to:B}}, " +
      "upsert-edge A→X, upsert-edge X→B. Use this instead of resending the whole document for minor changes.",
    inputSchema: {
      id: z.string().describe("Document id to edit."),
      ops: z.array(z.object({ op: z.string() }).passthrough()).describe("Ordered edit operations (see description)."),
      ...revisionInput,
      ...workspaceInput,
    },
  },
  async (args) => {
    const id = args.id;
    const ops = args.ops as unknown as PatchOp[];
    const { project, root, error } = projectFor(args.workspace);
    if (!project || !root) return errText(error ?? "No workspace set.");
    if (!existsSync(root)) return errText(`Workspace directory not found: ${root}. Pass an existing project directory as \`workspace\`.`);
    let doc: AnyDoc;
    let revision: string;
    try {
      ({ doc, revision } = await project.readWithRevision(id));
    } catch {
      return { content: [{ type: "text" as const, text: `No document "${id}" in the workspace.` }], isError: true };
    }
                                                                            
    if (args.expectRevision !== undefined && args.expectRevision !== revision) {
      return writeFailure(new RevisionConflictError(id, args.expectRevision, revision));
    }
    let patched: AnyDoc;
    try {
      patched = applyPatch(doc, ops);
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Patch not applied: ${String(e)}` }], isError: true };
    }
    const result = await project.validate(patched);
    if (!result.ok) {
      return {
        content: [{ type: "text", text: `Not written — fix the errors:\n${renderResult(result)}` }],
        structuredContent: { written: null, ...result } as unknown as Record<string, unknown>,
        isError: true,
      };
    }
    try {
                                                                              
      const dest = await project.write(patched, { expectRevision: revision });
      return {
        content: [{ type: "text", text: `Patched "${patched.id}" (revision ${dest.revision}).\n${renderResult(result)}` }],
        structuredContent: { written: dest.file, revision: dest.revision, ...result } as unknown as Record<string, unknown>,
      };
    } catch (e) {
      return writeFailure(e);
    }
  },
);

                                                                                  

server.registerResource(
  "schema",
  `${URI}://schema`,
  { title: "Flow JSON Schema", description: "JSON Schema (draft 2020-12) for a Flow document.", mimeType: "application/schema+json" },
  async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/schema+json", text: readFileSync(flowSchemaUrl, "utf8") }] }),
);

server.registerResource(
  "sequence-schema",
  `${URI}://sequence-schema`,
  { title: "Sequence JSON Schema", description: "JSON Schema (draft 2020-12) for a Sequence document.", mimeType: "application/schema+json" },
  async (uri) => ({ contents: [{ uri: uri.href, mimeType: "application/schema+json", text: readFileSync(sequenceSchemaUrl, "utf8") }] }),
);

server.registerResource(
  "guide",
  `${URI}://guide`,
  { title: "Authoring guide", description: `How to author a ${BRAND.display} Flow document.`, mimeType: "text/markdown" },
  async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: GUIDE }] }),
);

server.registerResource(
  "vocabulary",
  `${URI}://vocabulary`,
  { title: "Visual vocabulary", description: "Node shapes, icons and edge styles, by meaning.", mimeType: "text/markdown" },
  async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: vocabularyDocs() }] }),
);

server.registerResource(
  "examples",
  new ResourceTemplate(`${URI}://examples/{name}`, {
    list: async () => ({
      resources: readdirSync(examplesDir)
        .filter((f) => EXAMPLE_SUFFIX.test(f))
        .map((f) => {
          const name = f.replace(EXAMPLE_SUFFIX, "");
          return { uri: `${URI}://examples/${name}`, name, mimeType: "application/json" };
        }),
    }),
  }),
  { title: "Examples", description: "Bundled example flows and sequences." },
  async (uri, variables) => {
    const name = String(variables.name);
    const tryRead = (suffix: string) => readFileSync(pkgPath("examples", `${name}${suffix}`), "utf8");
    let text: string;
    try {
      text = tryRead(".flow.json");
    } catch {
      text = tryRead(".sequence.json");
    }
    return { contents: [{ uri: uri.href, mimeType: "application/json", text }] };
  },
);

const GUIDE = `# ${BRAND.display} — authoring a Flow document

A Flow document is one JSON file (\`<id>.flow.json\`) describing one behaviour at a
high altitude: a directed graph of steps, color-coded by which actor performs each.

## Shape
\`{ version:"1", id, title, layout?:"TB"|"LR", actors[], nodes[], edges[] }\`

- **actors**: every participant — human AND system. \`{ id, label, kind:human|system|service|infra, color? }\`.
- **nodes**: \`{ id, type, label, description, owner?, shared?, subflow?, inputs?, outputs?, source?, refs?, shape?, icon? }\`.
  - **type → default shape**: terminal (start/end) · step (action) · decision (branch) ·
    subflow (drills into another flow; set \`subflow\` to that flow's id) · io (data).
  - **shape / icon** (opt): what the node IS (database, queue, document, person…) and a visual cue
    beside the label. type keeps its meaning. Choose by meaning: get_docs {topic:"vocabulary"}.
  - **owner** (strongly recommended): the actor id that performs this step → its color. With more than
    one actor, set an owner on EVERY non-terminal node — otherwise the diagram has no color coding and
    the whole point of actors is lost (validate_flow warns: \`nodes-without-owner\`). Terminals (Start/
    Done) may stay neutral.
  - **description** (required): a LIST OF POINTS (\`string[]\`) — one thesis per item, NOT one
    blob. Rendered as bullets. Depth is your call, guided by the user.
  - **inputs/outputs** (opt): \`{name, type?}[]\`. **source** (opt): \`{file?, symbol?, line?}\` for
    code. **refs** (opt): \`{label, url}[]\` for external docs/links (non-code systems).
- **edges**: \`{ from, to, type, label?, style? }\` — type: flow · branch (label = condition) · return.
  \`style\` (opt) changes only the look (dashed, dotted, thick, end markers); see the vocabulary.
  An edge is a **first-class object like a node**: it may also carry optional \`id\`, \`description\`
  (string[]), \`inputs\`/\`outputs\`, \`source\`, \`refs\`, \`shared\`, and \`subflow\` (drill into a flow
  describing the whole transition). Edge \`id\` shares the node id-namespace (unique across nodes+edges).

## Identity (read this — it is where authoring breaks)
Identity is the **id**, not the label. Two nodes may share a label if their ids differ.
- ids are **per-flow local by default** — the same id in two flows does NOT collide.
- Set \`shared:true\` on a Flow **node or edge** to make its id **workspace-global**: the same shared id
  in other flows is the SAME object (enables cross-flow tracing). Use it deliberately. Actors cannot be
  shared — an actor id is local to its document.
- **An operation is not an occurrence.** One step may run several times in a scenario (two branches that
  both log an error; a check before and after a change): each run is its own node with its own id —
  never merge them. \`shared\` links the same object across *flows*; inside one flow, repeats stay separate.
- Avoid: false merge (two different things, one shared id) and false split (one thing, two ids in two
  flows). What validation reports:
  - \`shared-conflict\` (error) — one shared id with a different type or owner, or a node vs an edge.
  - \`shared-divergence\` (warning) — one shared id whose label or source differs between flows: check
    that it really is one object.
  - \`shared-one-sided\` (warning) — you shared an id that another flow still uses as a local id: the link
    is not made until that object is \`shared:true\` too (a \`patch_flow\` on the other document).
  - \`similar-node\` (hint) — nodes of the same type in two flows look alike: the label, the participant
    and the neighbouring steps. Read both: if they are the same step, give them one id and
    \`shared:true\`; if they are different things or separate occurrences, leave them — no action needed.
  - \`possible-split\` (warning) — when nodes carry a \`source\`: nodes in two flows point to the same
    definition (file + symbol) with the same type and owner. Give them one shared id only if they are the
    same operation in the same role; a symbol naming a whole class, a different role or a separate
    occurrence keeps its own id.
  Validation compares structure, not meaning: it cannot prove two objects are the same or different.
  That judgement is yours.
- **Never edit a diagram only to silence a warning or hint** (renaming labels or ids, adding or removing
  \`shared\`). Change it when the diagram is wrong; otherwise leave it as it is.

## Convention
A readable flow has a **Start** terminal (entry; a \`terminal\` node with no incoming edges)
and a **Done** terminal (exit; no outgoing edges). validate_flow advises (warning) if either
is missing — it never blocks, but prefer including them.

## Sequence documents (the low / exact level)
A **Sequence** is the other altitude: an ordered, nested record of real execution, rendered as a
sequence diagram. Set \`kind:"sequence"\` and use \`*.sequence.json\`. Shape:
\`{ version:"1", kind:"sequence", id, title, actors[], phases?[], calls[] }\`.
- **actors** = lifelines (same shape as a flow's). **phases** (opt): \`{id,label}\` section separators.
- **calls**: a TREE — \`{ id, to, method, from?, phase?, description?, params?, returns?, returnType?,
  request?, response?, source?, refs?, async?, children?[] }\`. Only \`to\`+\`method\` required.
  Pre-order traversal = chronological order; nesting (\`children\`) = call-stack/activation depth.
- A Flow step links down to a Sequence via the node/edge \`sequence\` field (like \`subflow\`).
- Schema: ${URI}://sequence-schema. The same read/write/validate/list tools handle both kinds.

## Twin — the WHOLE scenario at both altitudes
When the SAME whole behaviour exists as both a Flow and a Sequence, link them as TWINS (not by
drilling): set the top-level \`twin\` field on each document to the other's id (\`flow.twin\` = the
sequence id, and \`sequence.twin\` = the flow id). The UI then shows a Flow/Sequence toggle to switch
altitude on the same scenario, and the sidebar marks the pair.
- **Twin = whole ↔ whole** (two views of one scenario). **Drill** (\`subflow\`/\`sequence\` on a node/
  edge) = **part-of** (one step → its sub-trace). Don't use a mid-flow drill to mean "the whole flow,
  lower" — that's what a twin is for.
- Set it on BOTH (each pointing to the other); one-sided is tolerated. validate flags
  \`dangling-twin\` (target missing), \`conflicting-twin\` (the other points elsewhere), \`self-twin\`
  (error), and advises (\`same-kind-twin\`) if the pair isn't a Flow + a Sequence.

## Where documents are saved
Documents live under \`<workspace>/${BRAND.storeDir}/\`, where **workspace** is the project directory you are
documenting. Pass it as the \`workspace\` argument on the tools:
- **Project-scoped clients** (e.g. Claude Code, launched inside the repo): you may omit \`workspace\` — the
  server uses the directory it was started in.
- **Global clients** (e.g. Claude Desktop, one server for everything): you MUST pass \`workspace\`; omitting
  it returns an error (the server cannot guess). Pass the absolute path of the project under discussion;
  if you don't know it, ASK THE USER. Reuse the same value on every call.
The document content never contains machine paths — only the write destination is a runtime argument.

## Workflow & tools
- Read \`read_flow {id}\` for \`{document, revision}\`; only \`document\` is a writable model.
  For a known Flow node use \`around:nodeId,depth:0..5\` (default 1): incoming/outgoing neighborhoods,
  all incident edges and labeled boundary references. Drills remain references. JSON/compact/DOT
  share the selection. Focus and compact/DOT are read-only; never submit them as a whole model.
  Use full detail when descriptions distinguish equal labels. Structure explicitly omits fields.
- Pass the read's \`revision\` (in \`viewMetadata\` for views) as \`expectRevision\` on patch/write.
  A conflict writes nothing; reread and reconsider the change. Views use local ids for patching;
  DOT's document/node names are qualified addresses, not new ids. Edge indices are not patch ids.
- Whole document → \`write_flow\` (validates first; rejects on errors, else writes + warnings).
  \`validate_flow\` = dry run. See ${URI}://schema for the contract.
- **Before adding steps that may already exist elsewhere** (a step another process also has, a step
  renamed since), run the draft through \`validate_flow\` and read its \`similar-node\` hints: each shows
  the existing step — label, participant, neighbours, description. If it is the same step, reuse its
  id (and \`shared:true\` on both); if not, add yours. Then write. After a \`patch_flow\` the same hints
  arrive with the result; the write is reversible, so a duplicate you spot there is one more patch away.
- **Small change → \`patch_flow\`** (edit by object id: set-field / upsert·remove node/edge/call; an edge
  without an id by \`edge: {from, to}\` — inserting a step between A and B also removes the old A→B). It
  applies your delta, validates the WHOLE result, then writes — far cheaper than resending the doc and
  it does NOT skip validation. Prefer it for minor edits.
- **Lifecycle → \`manage_flow\`** (action: delete | rename | set-category). Don't move/delete files by
  hand — that bypasses validation (drill targets silently break).
- **Check \`workspaceRoot\`** (from \`list_flows\`) if a write lands somewhere unexpected — it is the
  folder this server operates on; if stale, restart the server with the right path.
- New documents are stored under \`${BRAND.storeDir}/\` automatically — you pass only an \`id\`, never a path.

## When to drill down vs inline (editorial)
- **Description bullet** — *explanation* of a step (what/why), not a separate action.
- **Another node in the SAME flow** — steps at the *same altitude* (one narrative).
- **Drill into a sub-flow** (\`type:subflow\`) — a step that is itself a *multi-step sub-process* worth
  its own diagram, or reused across flows.
- **Flow vs Sequence** — Flow = "how the process works" (high); Sequence = "exact calls / order /
  params" (debug/precision). Author Flow first; add a Sequence (linked via \`sequence\`) only where the
  exact call-trace earns its keep.
- **subflow vs sequence asymmetry** — \`subflow\` is gated to \`type:subflow\` (the node IS a sub-flow
  box); \`sequence\` may sit on ANY node/edge (orthogonal drill to that step's exact execution).
  validate flags a **dangling subflow/sequence** target (warning) if the linked doc isn't present yet.
- **A drill target is the SAME slice at a finer altitude — not the whole story retold.** A node/edge
  \`sequence\` (or \`subflow\`) should cover only *that* step/transition's calls and begin at its
  boundary. Hanging a Sequence that re-traces the WHOLE Flow off one mid-flow edge makes the two read
  as "two views of the same thing" instead of a drill-down of that part.
- **Want the entire Flow as a Sequence too?** That's a TWIN — set the top-level \`twin\` field on each
  (Flow ↔ Sequence), NOT a \`sequence\` drill on the start. See the "Twin" section above.
- **Explain drill-down to the human** when you use it ("I split this into linked levels — click *Open*
  on a step to go deeper"); many users meet drill-down here for the first time.

## Categories — organizing the sidebar
\`category\` (set via \`manage_flow set-category\`) is an **independent organizing axis** for the sidebar —
group documents by topic/subsystem however reads best. It is orthogonal to drill-down and twins (those
are content links; a category is just a sidebar folder).
- **Default to cohesion: linked documents share a category.** A doc's natural category is the one its
  **drill-parent** has (the flow that drills into it via \`subflow\`/\`sequence\`) and the one its **twin**
  has (same scenario, other altitude). When you organize a project, set the whole **linked family**
  (drill ancestors/descendants + twins) to the same category by default — don't scatter a parent and its
  sub-trace, or a Flow and its Sequence twin, across different groups without a reason. The serve UI
  mirrors this: setting a category on a linked doc offers **"Save for all linked" (recommended)**.
- **Split a family across categories only deliberately**, when an editorial grouping genuinely cuts
  across the link graph (e.g. a top orchestration flow in "Pipeline" while its supporting leaf
  sub-processes live in "Stages"). That is allowed — cohesion is the default, not a hard rule.
`;

async function main() {
  await server.connect(new StdioServerTransport());
  const scope = process.env[BRAND.envScope] ?? "(unset)";
  console.error(`[${BRAND.key}] MCP server on stdio — scope=${scope}, cwd=${process.cwd()}`);
}

main().catch((err) => {
  console.error(`[${BRAND.key}] fatal:`, err);
  process.exit(1);
});
