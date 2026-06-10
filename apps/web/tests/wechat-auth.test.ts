import assert from "node:assert/strict";
import test from "node:test";

import {
  assertWechatModeAllowsStart,
  buildWeChatAuthorizeUrl,
  exchangeWeChatCodeForOpenId,
  normalizeWechatOpenId,
  wechatLoginHint,
  wechatLoginLabel,
} from "../src/lib/wechat-auth";

test("wechat login labels and hints describe platform modes", () => {
  assert.equal(wechatLoginLabel("sandbox"), "Sandbox");
  assert.match(wechatLoginHint("reserved"), /reserved/);
  assert.doesNotThrow(() => assertWechatModeAllowsStart("sandbox"));
  assert.doesNotThrow(() => assertWechatModeAllowsStart("enabled"));
  assert.throws(() => assertWechatModeAllowsStart("disabled"), /not available/);
  assert.throws(() => assertWechatModeAllowsStart("reserved"), /not available/);
});

test("normalizeWechatOpenId trims and rejects unsupported values", () => {
  assert.equal(normalizeWechatOpenId(" openid_123-ABC "), "openid_123-ABC");
  assert.throws(() => normalizeWechatOpenId(""), /required/);
  assert.throws(() => normalizeWechatOpenId("bad openid"), /unsupported/);
  assert.throws(() => normalizeWechatOpenId("abc"), /unsupported/);
});

test("buildWeChatAuthorizeUrl creates a QR connect URL", () => {
  const url = buildWeChatAuthorizeUrl(
    {
      appId: "wx-app",
      redirectUri: "https://app.example.com/api/auth/wechat/callback",
    },
    "state-123",
  );

  assert.equal(url.startsWith("https://open.weixin.qq.com/connect/qrconnect?"), true);
  assert.equal(url.endsWith("#wechat_redirect"), true);
  const parsed = new URL(url.replace("#wechat_redirect", ""));
  assert.equal(parsed.searchParams.get("appid"), "wx-app");
  assert.equal(parsed.searchParams.get("scope"), "snsapi_login");
  assert.equal(parsed.searchParams.get("state"), "state-123");
});

test("exchangeWeChatCodeForOpenId returns openid from provider payload", async () => {
  const openId = await exchangeWeChatCodeForOpenId({
    code: "auth-code",
    appId: "wx-app",
    appSecret: "secret",
    fetchImpl: async (url) => {
      const parsed = new URL(String(url));
      assert.equal(parsed.searchParams.get("grant_type"), "authorization_code");
      return Response.json({ openid: "openid-1", access_token: "token" });
    },
  });

  assert.equal(openId, "openid-1");
});

test("exchangeWeChatCodeForOpenId rejects provider errors and missing credentials", async () => {
  await assert.rejects(
    () =>
      exchangeWeChatCodeForOpenId({
        code: "auth-code",
        appId: "wx-app",
        appSecret: "secret",
        fetchImpl: async () => Response.json({ errcode: 40029, errmsg: "invalid code" }),
      }),
    /40029/,
  );
  await assert.rejects(() => exchangeWeChatCodeForOpenId({ code: "auth-code" }), /WECHAT_APP_ID/);
});
