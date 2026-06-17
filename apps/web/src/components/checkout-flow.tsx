"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { type CheckoutProduct, paymentMethodLabel } from "@/lib/checkout-products";

import styles from "./checkout-flow.module.css";

const methodIcon: Record<string, string> = { wechat: "💳", alipay: "🏦", other: "🧾" };

export function CheckoutFlow({ products }: { products: readonly CheckoutProduct[] }) {
  const router = useRouter();
  const [sku, setSku] = useState(products[0]?.sku ?? "");
  const selected = useMemo(() => products.find((p) => p.sku === sku) ?? products[0], [products, sku]);
  const paymentMethods = useMemo(
    () => (selected ? selected.paymentMethods : []),
    [selected],
  );
  const [method, setMethod] = useState(paymentMethods[0] ?? "wechat");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "waiting" | "error">("idle");
  const [error, setError] = useState("");

  if (!selected) {
    return <p className={styles.stepLabel}>暂未配置可购买的套餐。</p>;
  }

  async function confirm() {
    if (pending || !selected) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/creator/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: selected.sku, paymentMethod: method }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus("error");
        setError(data.error ?? "下单失败");
        return;
      }
      setStatus("waiting");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "下单失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div>
        <p className={styles.stepLabel}>① 选择套餐</p>
        <div className={styles.planGrid}>
          {products.map((product) => {
            const active = product.sku === sku;
            return (
              <button
                key={product.sku}
                type="button"
                className={`${styles.planCard} ${active ? styles.planCardActive : ""}`}
                onClick={() => setSku(product.sku)}
                aria-pressed={active}
              >
                {active ? <span className={styles.planBadge}>已选</span> : null}
                <div className={styles.planName}>{product.label}</div>
                <div className={styles.planPrice}>
                  ¥{product.amount}
                  {product.periodDays ? <span>/{product.periodDays}天</span> : null}
                </div>
                <div className={styles.planDesc}>
                  {product.projectQuotaDelta} 项目 · {product.aiMessageQuotaDelta} 对话
                </div>
              </button>
            );
          })}
        </div>

        <p className={styles.stepLabel}>② 支付方式</p>
        <div className={styles.payRow}>
          {paymentMethods.map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.payOption} ${m === method ? styles.payOptionActive : ""}`}
              onClick={() => setMethod(m)}
              aria-pressed={m === method}
            >
              {methodIcon[m] ?? "💴"} {paymentMethodLabel(m)}
            </button>
          ))}
        </div>
      </div>

      <aside className={styles.summary}>
        <h2>订单摘要</h2>
        <div className={styles.summaryRow}>
          <span>{selected.label}</span>
          <span>¥{selected.amount}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>配额</span>
          <span>AI {selected.aiMessageQuotaDelta} · 码 {selected.fanCodeQuotaDelta}</span>
        </div>
        <div className={styles.summaryTotal}>
          <span>应付</span>
          <span className={styles.amount}>
            ¥{selected.amount} {selected.currency}
          </span>
        </div>
        <button className={styles.payBtn} type="button" onClick={confirm} disabled={pending}>
          {pending ? "创建中…" : "确认支付"}
        </button>
        {status === "waiting" ? (
          <div className={`${styles.payHint} ${styles.done}`}>
            <span />
            订单已创建，等待管理员确认后生效
          </div>
        ) : status === "error" ? (
          <div className={styles.payHint}>{error}</div>
        ) : (
          <div className={styles.payHint}>
            <span />
            手动收款 · 下单后由管理员确认
          </div>
        )}
      </aside>
    </div>
  );
}
