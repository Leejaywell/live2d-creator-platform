import crypto from "node:crypto";

import type { WechatLoginMode } from "@/lib/platform-settings";

export type WeChatOAuthConfig = {
  appId?: string;
  appSecret?: string;
  redirectUri: string;
};

export function wechatLoginLabel(mode: WechatLoginMode) {
  switch (mode) {
    case "reserved":
      return "Reserved";
    case "sandbox":
      return "Sandbox";
    case "enabled":
      return "Enabled";
    case "disabled":
      return "Disabled";
  }
}

export function wechatLoginHint(mode: WechatLoginMode) {
  switch (mode) {
    case "sandbox":
      return "Sandbox login accepts a bound WeChat OpenID for local verification.";
    case "enabled":
      return "WeChat OAuth is enabled for accounts that already have a linked OpenID.";
    case "disabled":
      return "WeChat login is disabled by platform settings.";
    case "reserved":
      return "WeChat login is reserved until credentials and account linking are configured.";
  }
}

export function normalizeWechatOpenId(openId: string) {
  const normalized = openId.trim();
  if (!normalized) {
    throw new Error("WeChat OpenID is required");
  }
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(normalized)) {
    throw new Error("WeChat OpenID contains unsupported characters");
  }
  return normalized;
}

export function createWechatOAuthState() {
  return crypto.randomBytes(24).toString("base64url");
}

export function buildWeChatAuthorizeUrl(config: WeChatOAuthConfig, state: string) {
  if (!config.appId) {
    throw new Error("WECHAT_APP_ID is required for enabled WeChat login");
  }

  const url = new URL("https://open.weixin.qq.com/connect/qrconnect");
  url.searchParams.set("appid", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "snsapi_login");
  url.searchParams.set("state", state);
  return `${url.toString()}#wechat_redirect`;
}

export function assertWechatModeAllowsStart(mode: WechatLoginMode) {
  if (mode === "disabled" || mode === "reserved") {
    throw new Error("WeChat login is not available");
  }
}

export async function exchangeWeChatCodeForOpenId(input: {
  code: string;
  appId?: string;
  appSecret?: string;
  fetchImpl?: typeof fetch;
}) {
  if (!input.appId || !input.appSecret) {
    throw new Error("WECHAT_APP_ID and WECHAT_APP_SECRET are required for WeChat callback");
  }
  if (!input.code.trim()) {
    throw new Error("WeChat authorization code is required");
  }

  const url = new URL("https://api.weixin.qq.com/sns/oauth2/access_token");
  url.searchParams.set("appid", input.appId);
  url.searchParams.set("secret", input.appSecret);
  url.searchParams.set("code", input.code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await (input.fetchImpl ?? fetch)(url);
  if (!response.ok) {
    throw new Error("WeChat token exchange failed");
  }

  const payload = await response.json();
  if (isWeChatError(payload)) {
    throw new Error(`WeChat token exchange failed: ${payload.errcode}`);
  }
  if (!isOpenIdPayload(payload)) {
    throw new Error("WeChat token exchange did not return an OpenID");
  }

  return payload.openid;
}

function isWeChatError(value: unknown): value is { errcode: number } {
  return Boolean(value && typeof value === "object" && "errcode" in value);
}

function isOpenIdPayload(value: unknown): value is { openid: string } {
  return Boolean(value && typeof value === "object" && typeof (value as { openid?: unknown }).openid === "string");
}
