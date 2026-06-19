import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

import { DetailsDismissOnOutsideClick } from "@/components/details-dismiss-on-outside-click";
import { GlobalPetProvider } from "@/components/global-pet-context";
import { DesktopPet } from "@/components/desktop-pet";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Backstage · Live2D 创作者平台",
    template: "%s · Backstage",
  },
  description:
    "给你的角色一座随时开演的舞台:上传 Live2D 模型、配置语音与触发标签、发放粉丝访问码,让观众凭码进场与 AI 驱动的角色实时对话。",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <GlobalPetProvider>
            <DetailsDismissOnOutsideClick />
            {children}
            <DesktopPet />
          </GlobalPetProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
