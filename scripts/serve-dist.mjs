import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const port = Number(process.env.PORT || process.argv.find(arg => arg.startsWith("--port="))?.split("=")[1] || 5294);
const host = process.env.HOST || "127.0.0.1";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".map": "application/json; charset=utf-8",
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separator = line.indexOf("=");
    if (separator === -1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function safeJoin(base, requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  const target = path.resolve(base, `.${decodedPath}`);
  return target.startsWith(base) ? target : null;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

async function handleApi(request, response) {
  const apiName = new URL(request.url, `http://${request.headers.host}`).pathname.replace(/^\/api\//, "");
  const apiPath = path.join(root, "api", `${apiName}.js`);

  if (!fs.existsSync(apiPath)) {
    sendJson(response, 404, { error: "API route not found." });
    return;
  }

  try {
    const module = await import(`${pathToFileURL(apiPath).href}?t=${Date.now()}`);
    if (typeof module.default !== "function") {
      sendJson(response, 500, { error: "API route has no default handler." });
      return;
    }
    await module.default(request, response);
  } catch (error) {
    sendJson(response, 500, { error: "API route failed.", detail: error?.message || String(error) });
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let requestPath = url.pathname;

  if (requestPath === "/simulator") requestPath = "/simulator/";
  if (requestPath === "/outside") requestPath = "/outside/";
  if (requestPath.endsWith("/")) requestPath += "index.html";

  const filePath = safeJoin(distDir, requestPath);
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(response);
}

loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, "simulator-cesium-restore", ".env.local"));

const server = http.createServer(async (request, response) => {
  if (request.url?.startsWith("/api/")) {
    await handleApi(request, response);
    return;
  }
  serveStatic(request, response);
});

server.listen(port, host, () => {
  console.log(`FlowLayer local server running at http://${host}:${port}/`);
});
