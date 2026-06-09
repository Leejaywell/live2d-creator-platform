import http from "node:http";

const port = Number(process.env.PORT || 4010);

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    for await (const chunk of request) {
      void chunk;
      // Drain request body.
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      JSON.stringify({
        id: "chatcmpl-readiness",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({ reply: "OK", tags: [] }),
            },
            finish_reason: "stop",
          },
        ],
      }),
    );
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, () => {
  console.log(`Fake OpenAI-compatible server listening on ${port}`);
});
