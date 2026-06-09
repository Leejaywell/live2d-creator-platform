import http from "node:http";
import net from "node:net";

const smtpPort = Number(process.env.SMTP_PORT || 1025);
const apiPort = Number(process.env.API_PORT || 8025);
const messages = [];

net
  .createServer((socket) => {
    let dataMode = false;
    let data = "";
    let mailFrom = "";
    const recipients = [];

    write(socket, "220 fake-mailpit ESMTP ready");
    socket.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      if (dataMode) {
        data += text;
        if (data.includes("\r\n.\r\n")) {
          const [message] = data.split("\r\n.\r\n");
          messages.unshift({
            ID: String(messages.length + 1),
            From: mailFrom,
            To: recipients.join(", "),
            Text: message,
            HTML: message,
          });
          data = "";
          dataMode = false;
          write(socket, "250 queued");
        }
        return;
      }

      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-fake-mailpit\r\n250 AUTH PLAIN LOGIN\r\n");
        } else if (upper.startsWith("AUTH")) {
          write(socket, "235 authenticated");
        } else if (upper.startsWith("MAIL FROM:")) {
          mailFrom = line.slice("MAIL FROM:".length).trim();
          write(socket, "250 ok");
        } else if (upper.startsWith("RCPT TO:")) {
          recipients.push(line.slice("RCPT TO:".length).trim());
          write(socket, "250 ok");
        } else if (upper === "DATA") {
          dataMode = true;
          write(socket, "354 end with dot");
        } else if (upper === "QUIT") {
          write(socket, "221 bye");
          socket.end();
        } else {
          write(socket, "250 ok");
        }
      }
    });
  })
  .listen(smtpPort, () => {
    console.log(`Fake SMTP server listening on ${smtpPort}`);
  });

http
  .createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      json(response, 200, { ok: true });
      return;
    }

    if (request.method === "GET" && request.url?.startsWith("/api/v1/messages")) {
      json(response, 200, { messages: messages.map(({ ID, From, To }) => ({ ID, From, To })) });
      return;
    }

    const match = request.url?.match(/^\/api\/v1\/message\/([^/]+)$/);
    if (request.method === "GET" && match) {
      const message = messages.find((item) => item.ID === decodeURIComponent(match[1]));
      if (!message) {
        json(response, 404, { error: "Not found" });
        return;
      }
      json(response, 200, message);
      return;
    }

    json(response, 404, { error: "Not found" });
  })
  .listen(apiPort, () => {
    console.log(`Fake Mailpit-compatible API listening on ${apiPort}`);
  });

function write(socket, line) {
  socket.write(`${line}\r\n`);
}

function json(response, status, data) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(data));
}
