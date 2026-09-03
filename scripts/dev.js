import { readFile } from "node:fs/promises";
import http from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

http
  .createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") pathname = "/demo/index.html";
      if (pathname.endsWith("/")) pathname += "index.html";
      const safe = normalize(pathname).replace(/^(\.\.(\/|\\|$))+/, "");
      const path = join(root, safe);
      const body = await readFile(path);
      response.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Calendar prototype: http://127.0.0.1:${port}/demo/`);
  });
