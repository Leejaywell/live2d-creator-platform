import { networkInterfaces } from "node:os";

// Build a base URL a phone on the same Wi-Fi can open — the machine's LAN IPv4,
// never 127.0.0.1/localhost (those only resolve on this computer). Set
// PUBLIC_LAN_HOST to override (e.g. a tunnel host) when auto-detection is wrong.
export function getLanBaseUrl(port = Number(process.env.PORT) || 3000): string {
  if (process.env.PUBLIC_LAN_HOST) {
    const host = process.env.PUBLIC_LAN_HOST.replace(/\/+$/, "");
    return /^https?:\/\//.test(host) ? host : `http://${host}`;
  }

  const candidates: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const iface of list ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        candidates.push(iface.address);
      }
    }
  }
  // Prefer private LAN ranges (the address a phone on the same router can reach).
  const isPrivate = (ip: string) =>
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
  const ip = candidates.find(isPrivate) ?? candidates[0] ?? "localhost";
  return `http://${ip}:${port}`;
}
