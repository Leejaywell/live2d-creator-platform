import type { Metadata } from "next";
import { Schibsted_Grotesk, Spline_Sans_Mono, Syne } from "next/font/google";
import { DetailsDismissOnOutsideClick } from "@/components/details-dismiss-on-outside-click";
import "./globals.css";

const displayFont = Syne({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const bodyFont = Schibsted_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

const monoFont = Spline_Sans_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Live2D Creator Platform · 开演",
    template: "%s · Live2D Creator Platform",
  },
  description: "主播自己的 Live2D AI 伙伴舞台:上传模型、配置触发标签、发放粉丝码,让观众走进专属角色页。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body>
        <DetailsDismissOnOutsideClick />
        {children}
      </body>
    </html>
  );
}
