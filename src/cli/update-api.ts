import type { IncomingMessage, ServerResponse } from "node:http";
import type { UpdateService } from "../core/updates";

export interface UpdateApiContext {
  service: Promise<UpdateService>;
  token: string;
  hosts: string[];
}

                                                                                
                                                                           
export async function handleUpdateApi(req: IncomingMessage, res: ServerResponse,
  context: UpdateApiContext): Promise<void> {
  const json = (code: number, body: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
  };
  const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress ?? "");
  if (!local || !context.hosts.includes(req.headers.host ?? ""))
    return json(403, { error: "Updates are only available from the local SystemAtlas browser." });
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const status = async () => ({ ...await (await context.service).refreshStatus(), token: context.token });
  try {
    if (method === "GET" && url.pathname === "/api/update") return json(200, await status());
    if (method !== "POST" || !["/api/update/install", "/api/update/skip"].includes(url.pathname))
      return json(405, { error: "Method not allowed" });
    if (req.headers.origin !== url.origin || req.headers["content-type"]?.split(";")[0] !== "application/json")
      return json(403, { error: "Update actions must come from the SystemAtlas dialog." });
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 2048) return json(413, { error: "Request too large" });
    }
    const { version, token } = JSON.parse(body) as { version?: unknown; token?: unknown };
    if (token !== context.token) return json(403, { error: "Reload SystemAtlas before trying again." });
    if (typeof version !== "string") return json(400, { error: "Missing update version" });
    const service = await context.service;
    if (url.pathname.endsWith("/skip")) await service.skip(version);
    else await service.update(version);
    return json(200, await status());
  } catch (e) {
    return json(400, { error: e instanceof Error ? e.message : String(e) });
  }
}
