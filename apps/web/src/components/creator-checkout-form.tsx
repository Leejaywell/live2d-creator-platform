"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";

import { adminOrderProducts, type CheckoutProduct, paymentMethodLabel } from "@/lib/checkout-products";

import styles from "./creator-checkout-form.module.css";

type Result = { orderId: string; label: string; amount: string; currency: string; checkoutUrl?: string };

export function CreatorCheckoutForm({ products = adminOrderProducts }: { products?: readonly CheckoutProduct[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const paymentMethods = useMemo(
    () => Array.from(new Set(products.flatMap((product) => product.paymentMethods))),
    [products],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setStatus("正在创建订单…");
    setResult(null);
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/creator/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: formData.get("sku"), paymentMethod: formData.get("paymentMethod") }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(data.error ?? "下单失败");
        return;
      }
      const checkout = data.checkout ?? {};
      setStatus(checkout.checkoutUrl ? "订单已创建，支付后仍需管理员确认。" : "订单已创建，等待管理员确认后生效。");
      setResult({
        orderId: checkout.order?.id ?? "",
        label: checkout.product?.label ?? "",
        amount: checkout.product?.amount ?? "",
        currency: checkout.product?.currency ?? "",
        checkoutUrl: checkout.checkoutUrl,
      });
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "下单失败");
    } finally {
      setPending(false);
    }
  }

  if (!products.length) {
    return <p className={styles.status}>暂未配置可购买的商品。</p>;
  }

  return (
    <form className={styles.form} onSubmit={onSubmit} aria-busy={pending}>
      <label className={styles.field}>
        支付方式
        <select name="paymentMethod" defaultValue={paymentMethods[0]} required>
          {paymentMethods.map((method) => (
            <option key={method} value={method}>
              {paymentMethodLabel(method)}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.options} role="radiogroup" aria-label="套餐">
        {products.map((product, index) => (
          <label className={styles.option} key={product.sku}>
            <input name="sku" type="radio" value={product.sku} defaultChecked={index === 0} />
            <span className={styles.optionBody}>
              <strong>{product.label}</strong>
              <small>
                ¥{product.amount} · {product.periodDays ?? 0} 天 · {product.projectQuotaDelta} 项目
              </small>
              <small>
                AI {product.aiMessageQuotaDelta} · 粉丝码 {product.fanCodeQuotaDelta}
              </small>
            </span>
          </label>
        ))}
      </div>
      <button className={styles.submit} type="submit" disabled={pending}>
        {pending ? "创建中…" : "提交订单"}
      </button>
      {status ? <p className={styles.status} aria-live="polite">{status}</p> : null}
      {result ? (
        <div className={styles.result}>
          <strong>{result.label}</strong>
          <span>
            订单 {result.orderId} · {result.amount} {result.currency}
          </span>
        </div>
      ) : null}
    </form>
  );
}
