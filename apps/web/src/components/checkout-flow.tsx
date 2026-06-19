"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui";
import { type CheckoutProduct, paymentMethodLabel } from "@/lib/checkout-products";

import styles from "./checkout-flow.module.css";

const methodIcon: Record<string, string> = { wechat: "💳", alipay: "🏦", other: "🧾" };

export function CheckoutFlow({ products }: { products: readonly CheckoutProduct[] }) {
  const t = useTranslations("fans");
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
    return <p className={styles.stepLabel}>{t("checkoutNoProducts")}</p>;
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
        setError(data.error ?? t("checkoutFailed"));
        return;
      }
      setStatus("waiting");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : t("checkoutFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div>
        <p className={styles.stepLabel}>{t("checkoutStep1")}</p>
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
                {active ? <span className={styles.planBadge}>{t("checkoutSelected")}</span> : null}
                <div className={styles.planName}>{product.label}</div>
                <div className={styles.planPrice}>
                  ¥{product.amount}
                  {product.periodDays ? <span>{t("checkoutPerDays", { days: product.periodDays })}</span> : null}
                </div>
                <div className={styles.planDesc}>
                  {t("checkoutPlanDesc", { projects: product.projectQuotaDelta, ai: product.aiMessageQuotaDelta })}
                </div>
              </button>
            );
          })}
        </div>

        <p className={styles.stepLabel}>{t("checkoutStep2")}</p>
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
        <h2>{t("checkoutSummary")}</h2>
        <div className={styles.summaryRow}>
          <span>{selected.label}</span>
          <span>¥{selected.amount}</span>
        </div>
        <div className={styles.summaryRow}>
          <span>{t("checkoutQuota")}</span>
          <span>{t("checkoutQuotaSummary", { ai: selected.aiMessageQuotaDelta, code: selected.fanCodeQuotaDelta })}</span>
        </div>
        <div className={styles.summaryTotal}>
          <span>{t("checkoutPayable")}</span>
          <span className={styles.amount}>
            ¥{selected.amount} {selected.currency}
          </span>
        </div>
        <Button className={styles.payBtn} block size="lg" type="button" onClick={confirm} disabled={pending}>
          {pending ? t("checkoutCreating") : t("checkoutConfirm")}
        </Button>
        {status === "waiting" ? (
          <div className={`${styles.payHint} ${styles.done}`}>
            <span />
            {t("checkoutWaiting")}
          </div>
        ) : status === "error" ? (
          <div className={styles.payHint}>{error}</div>
        ) : (
          <div className={styles.payHint}>
            <span />
            {t("checkoutManualHint")}
          </div>
        )}
      </aside>
    </div>
  );
}
