import http from "node:http";

const port = Number(process.env.PORT || 4010);

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
    return;
  }

    let bodyStr = "";
    for await (const chunk of request) {
      bodyStr += chunk;
    }
    let bodyObj = {};
    try {
      bodyObj = JSON.parse(bodyStr);
    } catch {
      // Ignored
    }

    if (bodyObj.stream) {
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "connection": "keep-alive",
      });
      response.write(
        `data: ${JSON.stringify({
          choices: [
            {
              delta: {
                content: JSON.stringify({ reply: "OK", tags: [] }),
              },
            },
          ],
        })}\n\n`,
      );
      response.write("data: [DONE]\n\n");
      response.end();
      return;
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

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "Not found" }));
});

server.listen(port, () => {
  console.log(`Fake OpenAI-compatible server listening on ${port}`);
});
