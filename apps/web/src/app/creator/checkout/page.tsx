import { getCurrentSession } from "@/auth";
import { CheckoutFlow } from "@/components/checkout-flow";
import { adminOrderProducts } from "@/lib/checkout-products";

import { CreatorAuthRequired, CreatorShell, creatorStyles as styles } from "../_components";

export const dynamic = "force-dynamic";

export default async function CreatorCheckoutPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title="结账" />;
  }

  return (
    <CreatorShell active="billing" user={session.user}>
      <div className={styles.pageHead}>
        <div>
          <h1>结账</h1>
          <p className={styles.pageHeadSub}>选择套餐并下单 · 手动收款，由管理员确认后生效</p>
        </div>
      </div>
      <CheckoutFlow products={adminOrderProducts} />
    </CreatorShell>
  );
}
