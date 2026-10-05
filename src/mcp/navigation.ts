import { z } from "zod";
import { ProjectNavigation, digest, type NavigationQuery } from "../core/navigation";

export const navigationInput = {
  query: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("shared"), id: z.string().min(1), objectKind: z.enum(["node", "edge"]).optional() }).strict(),
    z.object({ kind: z.literal("links"), document: z.string().min(1), direction: z.enum(["incoming", "outgoing", "both"]).optional(),
      relations: z.array(z.enum(["subflow", "sequence", "twin"])).min(1).optional() }).strict(),
  ]).optional().describe("Exact relationship lookup. shared finds all shared node/edge occurrences; links finds incoming/outgoing drills and twins for a document. Omit for a paged document catalog."),
  limit: z.number().int().min(1).max(100).optional().describe("Page size, default 50; maximum 100. Follow nextCursor until complete=true."),
  cursor: z.string().max(2048).optional().describe("Opaque nextCursor from the previous page of the SAME query. Changes to the workspace invalidate the cursor: restart without it."),
};

const navigation = new ProjectNavigation();
                                                                                  
const MAX_PAGE_BYTES = 24_000;
export interface ListRequest { query?: NavigationQuery; limit?: number; cursor?: string }

export async function listNavigation(root: string, request: ListRequest, loader = navigation) {
  const index = await loader.load(root);
  const query = request.query;
  const queryHash = digest(JSON.stringify([root, query ?? null]));
  let offset = 0;
  if (request.cursor) {
    let cursor: { snapshot?: string; query?: string; offset?: number };
    try {
      cursor = JSON.parse(Buffer.from(request.cursor, "base64url").toString("utf8"));
      if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) throw new Error("Invalid cursor shape");
    }
    catch { throw new Error("Invalid navigation cursor; restart without cursor"); }
    if (cursor.snapshot !== index.snapshot) throw new Error("Workspace changed since the previous page; restart without cursor");
    if (cursor.query !== queryHash || !Number.isSafeInteger(cursor.offset) || cursor.offset! < 0) throw new Error("Cursor belongs to another query or is invalid; restart without cursor");
    offset = cursor.offset!;
  }
  const all = query ? index.query(query) : index.catalog;
  if (offset > all.length) throw new Error("Cursor offset is outside the result; restart without cursor");
  const limit = request.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("limit must be between 1 and 100");
  const rows: typeof all[number][] = [];
  let bytes = 0;
  for (const row of all.slice(offset, offset + limit)) {
    const size = Buffer.byteLength(JSON.stringify(row), "utf8");
    if (bytes + size > MAX_PAGE_BYTES) break;
    rows.push(row); bytes += size;
  }
  if (!rows.length && offset < all.length) throw new Error("A single navigation result exceeds the page byte budget; shorten its label/title before listing it");
  const response = () => {
    const end = offset + rows.length;
    const complete = end === all.length;
    const nextCursor = complete ? undefined : Buffer.from(JSON.stringify({ snapshot: index.snapshot, query: queryHash, offset: end })).toString("base64url");
    const data = { workspaceRoot: root, snapshot: index.snapshot, total: all.length, offset, complete,
      ...(nextCursor ? { nextCursor } : {}), ...(query ? { query, results: [...rows] } : { flows: [...rows] }) };
                                                                              
    const text = query ? JSON.stringify(data) :
      `workspace: ${root}\nsnapshot: ${index.snapshot}\npage: ${end}/${all.length}; complete=${complete}${nextCursor ? `; nextCursor=${nextCursor}` : ""}\n` +
        rows.map(row => { const f = row as typeof index.catalog[number]; return `- ${JSON.stringify(f.id)} [${f.kind}] — ${JSON.stringify(f.title)} (${JSON.stringify(f.category)})`; }).join("\n");
    return { content: [{ type: "text" as const, text }], structuredContent: data };
  };
  let result = response();
                                                                                   
  while (Buffer.byteLength(JSON.stringify(result), "utf8") > 48_000) {
    if (rows.length <= 1) throw new Error("A navigation result exceeds the response byte budget");
    rows.pop(); result = response();
  }
  return result;
}
