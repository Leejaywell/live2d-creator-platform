import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/auth";
import { CheckoutFlow } from "@/components/checkout-flow";
import { adminOrderProducts } from "@/lib/checkout-products";

import { CreatorAuthRequired, CreatorShell, creatorStyles as styles } from "../_components";

export const dynamic = "force-dynamic";

export default async function CreatorCheckoutPage() {
  const t = await getTranslations("fans");
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title={t("checkoutPageTitle")} />;
  }

  return (
    <CreatorShell active="billing" user={session.user}>
      <div className={styles.pageHead}>
        <div>
          <h1>{t("checkoutPageTitle")}</h1>
          <p className={styles.pageHeadSub}>{t("checkoutPageSubtitle")}</p>
        </div>
      </div>
      <CheckoutFlow products={adminOrderProducts} />
    </CreatorShell>
  );
}
