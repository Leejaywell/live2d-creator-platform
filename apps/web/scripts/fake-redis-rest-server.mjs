import http from "node:http";

const port = Number(process.env.PORT || 4020);
const values = new Map();
const expirations = new Map();

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    json(response, 200, { ok: true });
    return;
  }

  if (request.method !== "POST") {
    json(response, 404, { error: "Not found" });
    return;
  }

  const body = await readJson(request);
  const isPipeline = request.url === "/pipeline";
  const commands = isPipeline ? body : [body];
  const results = commands.map(runCommand);
  json(response, 200, isPipeline ? results : results[0]);
});

server.listen(port, () => {
  console.log(`Fake Redis REST server listening on ${port}`);
});

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
  }
  return raw ? JSON.parse(raw) : [];
}

function runCommand(command) {
  const [name, key, ...args] = command;
  const op = String(name).toUpperCase();
  cleanup(key);

  if (op === "PING") return { result: "PONG" };
  if (op === "INCR") {
    const next = Number(values.get(key) ?? 0) + 1;
    values.set(key, next);
    return { result: next };
  }
  if (op === "EXPIRE") {
    const seconds = Number(args[0] ?? 0);
    const nx = String(args[1] ?? "").toUpperCase() === "NX";
    if (nx && expirations.has(key)) return { result: 0 };
    expirations.set(key, Date.now() + seconds * 1000);
    return { result: 1 };
  }
  if (op === "TTL") {
    const expiresAt = expirations.get(key);
    if (!expiresAt) return { result: -1 };
    return { result: Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) };
  }
  return { error: `Unsupported command ${op}` };
}

function cleanup(key) {
  const expiresAt = expirations.get(key);
  if (expiresAt && expiresAt <= Date.now()) {
    values.delete(key);
    expirations.delete(key);
  }
}

function json(response, status, data) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(data));
}
