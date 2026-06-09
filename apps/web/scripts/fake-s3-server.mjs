import http from "node:http";

const port = Number(process.env.PORT || 9000);
const objects = new Map();

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    json(response, 200, { ok: true });
    return;
  }

  const key = objectKey(request.url || "");
  if (!key) {
    json(response, 400, { error: "Missing object key" });
    return;
  }

  if (request.method === "PUT") {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(Buffer.from(chunk));
    }
    objects.set(key, {
      body: Buffer.concat(chunks),
      contentType: request.headers["content-type"] || "application/octet-stream",
      cacheControl: request.headers["cache-control"],
    });
    response.writeHead(200, { "content-type": "application/xml" });
    response.end("");
    return;
  }

  if (request.method === "GET") {
    const object = objects.get(key);
    if (!object) {
      response.writeHead(404, { "content-type": "application/xml" });
      response.end("<Error><Code>NoSuchKey</Code></Error>");
      return;
    }
    response.writeHead(200, {
      "content-type": object.contentType,
      "cache-control": object.cacheControl || "no-store",
      "content-length": object.body.length,
    });
    response.end(object.body);
    return;
  }

  if (request.method === "DELETE") {
    objects.delete(key);
    response.writeHead(204);
    response.end();
    return;
  }

  json(response, 405, { error: "Method not allowed" });
});

server.listen(port, () => {
  console.log(`Fake S3-compatible server listening on ${port}`);
});

function objectKey(url) {
  const parsed = new URL(url, `http://localhost:${port}`);
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return "";
  return decodeURIComponent(parts.slice(1).join("/"));
}

function json(response, status, data) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(data));
}
