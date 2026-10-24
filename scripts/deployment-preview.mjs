import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDeploymentBundle, jsonText } from "./prepare-deployment.mjs";
import { projectRoot } from "./compile-contract.mjs";

export async function createPreviewServer({ artifact, port = 4174 } = {}) {
  if (!artifact) ({ artifact } = await createDeploymentBundle());
  const directory = path.join(projectRoot, "scripts/deployment-preview");
  // URLs never become filesystem paths. Only these fixed public assets exist.
  const routes = new Map([
    ["/", { type: "text/html; charset=utf-8", body: await fs.readFile(path.join(directory, "index.html")) }],
    ["/app.js", { type: "text/javascript; charset=utf-8", body: await fs.readFile(path.join(directory, "app.js")) }],
    ["/guards.js", { type: "text/javascript; charset=utf-8", body: await fs.readFile(path.join(directory, "guards.mjs")) }],
    ["/style.css", { type: "text/css; charset=utf-8", body: await fs.readFile(path.join(directory, "style.css")) }],
    ["/artifact.json", { type: "application/json; charset=utf-8", body: Buffer.from(jsonText(artifact)) }],
    ["/ethers.js", { type: "text/javascript; charset=utf-8", body: await fs.readFile(path.join(projectRoot, "node_modules/ethers/dist/ethers.min.js")) }],
  ]);
  const server = http.createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    response.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    const actualPort = server.address()?.port;
    if (request.headers.host !== `127.0.0.1:${actualPort}`) {
      response.writeHead(403).end("Forbidden host");
      return;
    }
    if (request.method !== "GET") {
      response.setHeader("Allow", "GET");
      response.writeHead(405).end("Read-only HTTP server");
      return;
    }
    const route = routes.get(request.url);
    if (!route) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.setHeader("Content-Type", route.type);
    response.writeHead(200).end(route.body);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw new Error("Usage: npm run preview:deployment (no arguments)");
  await createPreviewServer();
  console.log("本地部署辅助页：http://127.0.0.1:4174");
  console.log("仅点击页面按钮才会请求 MetaMask；此服务不保存或读取私钥。");
}
