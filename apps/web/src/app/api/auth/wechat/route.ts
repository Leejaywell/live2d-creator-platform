import { NextRequest, NextResponse } from "next/server";

import { signInWithWechatOpenId } from "@/auth";
import { getPlatformRuntimeSettings } from "@/lib/platform-settings";
import { rateLimit } from "@/lib/rate-limit";
import {
  assertWechatModeAllowsStart,
  buildWeChatAuthorizeUrl,
  createWechatOAuthState,
} from "@/lib/wechat-auth";

const stateCookieName = "live2d_wechat_oauth_state";

export async function GET(request: NextRequest) {
  const limited = await rateLimit(request, { key: "auth-wechat-start", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const settings = await getPlatformRuntimeSettings();
    assertWechatModeAllowsStart(settings.wechatLogin);

    if (settings.wechatLogin === "sandbox") {
      return NextResponse.redirect(new URL("/sign-in?wechat=sandbox", request.url));
    }

    const state = createWechatOAuthState();
    const redirectUri = new URL("/api/auth/wechat/callback", process.env.AUTH_URL || request.nextUrl.origin).toString();
    const response = NextResponse.redirect(
      buildWeChatAuthorizeUrl(
        {
          appId: process.env.WECHAT_APP_ID,
          appSecret: process.env.WECHAT_APP_SECRET,
          redirectUri,
        },
        state,
      ),
    );
    response.cookies.set(stateCookieName, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/sign-in?wechat=unavailable", request.url));
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { key: "auth-wechat-sandbox", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const settings = await getPlatformRuntimeSettings();
    if (settings.wechatLogin !== "sandbox") {
      throw new Error("Sandbox WeChat login is not enabled");
    }

    const form = await request.formData();
    const openId = String(form.get("openId") || "");
    const response = NextResponse.redirect(new URL("/", request.url));
    const redirectPath = await signInWithWechatOpenId(openId, response);
    response.headers.set("Location", new URL(redirectPath, request.url).toString());
    return response;
  } catch {
    return NextResponse.redirect(new URL("/sign-in?wechat=failed", request.url));
  }
}
