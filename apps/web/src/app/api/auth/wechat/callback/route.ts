import { NextRequest, NextResponse } from "next/server";

import { signInWithWechatOpenId } from "@/auth";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { rateLimit } from "@/lib/rate-limit";
import { exchangeWeChatCodeForOpenId } from "@/lib/wechat-auth";

const stateCookieName = "live2d_wechat_oauth_state";

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, { key: "auth-wechat-callback", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const settings = await getPlatformRuntimeSettings();
    const response = NextResponse.redirect(new URL("/", request.url));
    let openId = "";

    if (settings.wechatLogin === "sandbox") {
      openId = request.nextUrl.searchParams.get("openId") || "";
    } else if (settings.wechatLogin === "enabled") {
      assertValidState(request);
      openId = await exchangeWeChatCodeForOpenId({
        code: request.nextUrl.searchParams.get("code") || "",
        appId: process.env.WECHAT_APP_ID,
        appSecret: process.env.WECHAT_APP_SECRET,
      });
    } else {
      throw new Error("WeChat login is not available");
    }

    const redirectPath = await signInWithWechatOpenId(openId, response);
    response.headers.set("Location", new URL(redirectPath, request.url).toString());
    response.cookies.set(stateCookieName, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/sign-in?wechat=failed", request.url));
  }
}

function assertValidState(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state") || "";
  const expectedState = request.cookies.get(stateCookieName)?.value || "";
  if (!state || !expectedState || state !== expectedState) {
    throw new Error("Invalid WeChat OAuth state");
  }
}
