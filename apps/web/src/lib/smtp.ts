import net from "node:net";
import tls from "node:tls";

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type SmtpResponse = {
  code: number;
  lines: string[];
};

export async function verifySmtpConnection() {
  const client = await SmtpClient.connect();
  try {
    await client.authenticate();
  } finally {
    await client.quit();
  }
}

export async function sendMail(input: MailInput) {
  const client = await SmtpClient.connect();
  try {
    await client.authenticate();
    await client.send(input);
  } finally {
    await client.quit();
  }
}

class SmtpClient {
  private capabilities = new Set<string>();
  private buffer = "";
  private pending?: {
    resolve: (response: SmtpResponse) => void;
    reject: (error: Error) => void;
    lines: string[];
  };

  private constructor(private socket: net.Socket | tls.TLSSocket) {
    socket.on("data", (chunk) => this.onData(chunk.toString("utf8")));
    socket.on("error", (error) => {
      this.pending?.reject(error);
      this.pending = undefined;
    });
  }

  static async connect() {
    const port = Number(process.env.EMAIL_SERVER_PORT || 587);
    const host = requiredEnv("EMAIL_SERVER_HOST");
    const secure = process.env.EMAIL_SERVER_SECURE === "true" || port === 465;
    const socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    const client = new SmtpClient(socket);

    await onceConnect(socket);
    await client.expect([220]);
    await client.ehlo();

    if (!secure && client.capabilities.has("STARTTLS") && process.env.EMAIL_SERVER_STARTTLS !== "false") {
      await client.command("STARTTLS", [220]);
      client.socket = tls.connect({ socket, servername: host });
      client.socket.on("data", (chunk) => client.onData(chunk.toString("utf8")));
      client.socket.on("error", (error) => {
        client.pending?.reject(error);
        client.pending = undefined;
      });
      await onceSecureConnect(client.socket as tls.TLSSocket);
      await client.ehlo();
    }

    if (process.env.NODE_ENV === "production" && !secure && process.env.EMAIL_SERVER_STARTTLS === "false") {
      throw new Error("EMAIL_SERVER_STARTTLS must not be disabled in production");
    }

    return client;
  }

  async authenticate() {
    const user = process.env.EMAIL_SERVER_USER;
    const pass = process.env.EMAIL_SERVER_PASSWORD;
    if (!user || !pass) return;

    if (this.capabilities.has("AUTH")) {
      const payload = Buffer.from(`\0${user}\0${pass}`, "utf8").toString("base64");
      await this.command(`AUTH PLAIN ${payload}`, [235]);
    } else if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP server must advertise AUTH in production when credentials are configured");
    }
  }

  async send(input: MailInput) {
    const from = parseEmailAddress(requiredEnv("EMAIL_FROM"));
    const to = parseEmailAddress(input.to);
    await this.command(`MAIL FROM:<${from}>`, [250]);
    await this.command(`RCPT TO:<${to}>`, [250, 251]);
    await this.command("DATA", [354]);
    await this.writeData(formatMessage({ ...input, from }));
  }

  async quit() {
    if (this.socket.destroyed) return;
    await this.command("QUIT", [221]).catch(() => undefined);
    this.socket.end();
  }

  private async ehlo() {
    const response = await this.command(`EHLO ${smtpDomain()}`, [250]);
    this.capabilities = new Set(
      response.lines
        .slice(1)
        .map((line) => line.replace(/^250[- ]/, "").split(/\s+/)[0]?.toUpperCase())
        .filter(Boolean),
    );
  }

  private command(value: string, expected: number[]) {
    this.socket.write(`${value}\r\n`);
    return this.expect(expected);
  }

  private writeData(value: string) {
    const normalized = value.replaceAll(/\r?\n/g, "\r\n");
    const dotStuffed = normalized
      .split("\r\n")
      .map((line) => (line.startsWith(".") ? `.${line}` : line))
      .join("\r\n");
    this.socket.write(`${dotStuffed}\r\n.\r\n`);
    return this.expect([250]);
  }

  private expect(expected: number[]) {
    return new Promise<SmtpResponse>((resolve, reject) => {
      this.pending = {
        resolve: (response) => {
          if (!expected.includes(response.code)) {
            reject(new Error(`SMTP command failed with ${response.code}: ${response.lines.join(" ")}`));
            return;
          }
          resolve(response);
        },
        reject,
        lines: [],
      };
    });
  }

  private onData(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split(/\r?\n/);
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line) continue;
      const pending = this.pending;
      if (!pending) continue;
      pending.lines.push(line);
      if (/^\d{3} /.test(line)) {
        this.pending = undefined;
        pending.resolve({
          code: Number(line.slice(0, 3)),
          lines: pending.lines,
        });
      }
    }
  }
}

function formatMessage(input: MailInput & { from: string }) {
  const boundary = `live2d-${Date.now().toString(36)}`;
  const headers = [
    `From: ${safeHeader(process.env.EMAIL_FROM || input.from)}`,
    `To: ${safeHeader(input.to)}`,
    `Subject: ${safeHeader(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  return [
    ...headers,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html ?? `<pre>${escapeHtml(input.text)}</pre>`,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

function parseEmailAddress(value: string) {
  const match = value.match(/<([^<>]+)>/);
  const email = (match?.[1] ?? value).trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) {
    throw new Error("Invalid email address");
  }
  return email;
}

function safeHeader(value: string) {
  if (/[\r\n]/.test(value)) {
    throw new Error("Email headers must not contain newlines");
  }
  return value;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function smtpDomain() {
  return process.env.EMAIL_HELO_NAME || "live2d-creator-platform.local";
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function onceConnect(socket: net.Socket | tls.TLSSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });
}

function onceSecureConnect(socket: tls.TLSSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });
}
