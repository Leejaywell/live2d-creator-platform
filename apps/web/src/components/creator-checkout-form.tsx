"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "@/app/dashboard.module.css";
import { checkoutProducts, type CheckoutProduct } from "@/lib/checkout-products";

type CheckoutResult = {
  orderId: string;
  label: string;
  amount: string;
  currency: string;
  checkoutUrl?: string;
};

type CreatorCheckoutFormProps = {
  products?: readonly CheckoutProduct[];
};

export function CreatorCheckoutForm({ products = checkoutProducts }: CreatorCheckoutFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const defaultSku = products[0]?.sku ?? "";
  const paymentMethods = useMemo(() => Array.from(new Set(products.flatMap((product) => product.paymentMethods))), [products]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setStatus("正在创建订单…");
    setResult(null);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const response = await fetch("/api/creator/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus(data.error ?? "下单请求失败");
        return;
      }

      const checkout = parseCheckoutResponse(data);
      setStatus(checkout.checkoutUrl ? "订单已创建,随时可以继续支付。" : "订单已创建,支付链接尚未配置。");
      setResult({
        orderId: checkout.order.id,
        label: checkout.product.label,
        amount: checkout.product.amount,
        currency: checkout.product.currency,
        checkoutUrl: checkout.checkoutUrl,
      });
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "下单请求失败");
    } finally {
      setPending(false);
    }
  }

  if (!products.length) {
    return <p className={styles.muted}>暂未配置可购买的商品。</p>;
  }

  return (
    <form onSubmit={submit} aria-busy={pending}>
      <label>
        商品
        <select name="sku" defaultValue={defaultSku} required>
          {products.map((product) => (
            <option key={product.sku} value={product.sku}>
              {product.label} · {product.amount} {product.currency}
            </option>
          ))}
        </select>
      </label>
      <label>
        支付方式
        <select name="paymentMethod" defaultValue={paymentMethods[0] ?? "wechat"} required>
          {paymentMethods.map((method) => (
            <option key={method} value={method}>
              {paymentMethodLabel(method)}
            </option>
          ))}
        </select>
      </label>
      <ul className={styles.productList}>
        {products.map((product) => (
          <li key={product.sku}>
            <strong>{product.label}</strong>
            <span>{product.description}</span>
          </li>
        ))}
      </ul>
      <button type="submit" disabled={pending}>
        {pending ? "创建中…" : "创建购买订单"}
      </button>
      {status ? <p aria-live="polite">{status}</p> : null}
      {result ? (
        <div className={styles.checkoutResult}>
          <strong>{result.label}</strong>
          <span>
            订单 {result.orderId} · {result.amount} {result.currency}
          </span>
          {result.checkoutUrl ? (
            <a className={styles.buttonLink} href={result.checkoutUrl}>
              继续支付
            </a>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function parseCheckoutResponse(data: unknown) {
  if (!data || typeof data !== "object" || !("checkout" in data)) {
    throw new Error("Checkout response was incomplete");
  }
  const checkout = (data as { checkout: unknown }).checkout;
  if (!checkout || typeof checkout !== "object") {
    throw new Error("Checkout response was incomplete");
  }
  const value = checkout as {
    order?: { id?: unknown };
    product?: { label?: unknown; amount?: unknown; currency?: unknown };
    checkoutUrl?: unknown;
  };
  if (
    typeof value.order?.id !== "string" ||
    typeof value.product?.label !== "string" ||
    typeof value.product.amount !== "string" ||
    typeof value.product.currency !== "string"
  ) {
    throw new Error("Checkout response was incomplete");
  }
  return {
    order: { id: value.order.id },
    product: {
      label: value.product.label,
      amount: value.product.amount,
      currency: value.product.currency,
    },
    checkoutUrl: typeof value.checkoutUrl === "string" ? value.checkoutUrl : undefined,
  };
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "wechat":
      return "微信支付";
    case "alipay":
      return "支付宝";
    case "bank_transfer":
      return "银行转账";
    default:
      return "其他";
  }
}
