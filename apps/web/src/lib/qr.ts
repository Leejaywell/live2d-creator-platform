import QRCode from "qrcode";

/** Render a URL to a PNG data-URL QR code (server-side). */
export function qrPngDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 240,
    color: { dark: "#0b0913ff", light: "#ffffffff" },
  });
}
