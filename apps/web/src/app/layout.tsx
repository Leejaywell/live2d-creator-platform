import type { Metadata } from "next";

import { DetailsDismissOnOutsideClick } from "@/components/details-dismiss-on-outside-click";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Backstage · Live2D 创作者平台",
    template: "%s · Backstage",
  },
  description:
    "给你的角色一座随时开演的舞台:上传 Live2D 模型、配置语音与触发标签、发放粉丝访问码,让观众凭码进场与 AI 驱动的角色实时对话。",
};

// CJK display/body fonts are loaded via the Google Fonts stylesheet rather than
// next/font to avoid build-time font fetching (offline builds) and the weight of
// inlining variable CJK subsets. Family names map to the CSS vars in globals.css.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@500;600;700;900&family=Noto+Sans+SC:wght@300;400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <DetailsDismissOnOutsideClick />
        {children}
      </body>
    </html>
  );
}
