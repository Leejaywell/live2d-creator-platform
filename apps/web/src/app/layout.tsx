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

// Fonts use system stacks (see --font-* in globals.css). Google Fonts is
// intentionally NOT loaded — it is blocked in mainland China and would otherwise
// stall rendering behind an unreachable stylesheet.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <DetailsDismissOnOutsideClick />
        {children}
      </body>
    </html>
  );
}
