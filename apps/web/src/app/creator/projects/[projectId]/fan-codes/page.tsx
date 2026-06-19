import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { FanCodeGeneratorModal } from "@/components/fan-code-generator-modal";
import { Pill, type Tone } from "@/components/ui";
import { fanCodeDisplayStatus } from "@/lib/fan-code-status";
import { prisma } from "@/lib/prisma";

import { CreatorAuthRequired, CreatorShell, creatorStyles as styles } from "../../../_components";

export const dynamic = "force-dynamic";

const CODE_COLS = "1.6fr 1.1fr 1.1fr 0.8fr 0.9fr auto";

const statusTone: Record<string, Tone> = {
  unused: "neutral",
  bound: "teal",
  "used up": "amber",
  expired: "danger",
  revoked: "danger",
};
const statusLabel: Record<string, string> = {
  unused: "fanCodesStatusUnused",
  bound: "fanCodesStatusBound",
  "used up": "fanCodesStatusUsedUp",
  expired: "fanCodesStatusExpired",
  revoked: "fanCodesStatusRevoked",
};

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default async function FanCodesPage({ params }: PageProps<"/creator/projects/[projectId]/fan-codes">) {
  const t = await getTranslations("fans");
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || session.user.role !== "creator") {
    return <CreatorAuthRequired title={t("fanCodesTitle")} />;
  }

  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, creatorId: session.user.id },
    include: { fanAccessCodes: { orderBy: { createdAt: "desc" }, take: 60 } },
  });
  if (!project) notFound();

  const codes = project.fanAccessCodes.map((code) => ({
    id: code.id,
    code: code.code,
    status: fanCodeDisplayStatus(code),
    bindMode: code.bindMode,
    boundDeviceHash: code.boundDeviceHash,
    expiresAt: code.expiresAt,
    usedMessages: code.usedMessages,
    maxMessages: code.maxMessages,
  }));
  const dispatched = codes.length;
  const bound = codes.filter((c) => c.status === "bound").length;
  const unused = codes.filter((c) => c.status === "unused").length;
  const revoked = codes.filter((c) => c.status === "revoked").length;

  return (
    <CreatorShell active="projects" user={session.user}>
      <div className={styles.pageHead}>
        <div>
          <h1>{t("fanCodesHeading", { name: project.name })}</h1>
          <p className={styles.pageHeadSub}>
            {t("fanCodesSubtitle", { dispatched, bound })}
          </p>
        </div>
        <Link href={`/creator/projects/${project.id}`} className={styles.panelMeta}>
          {t("fanCodesBack")}
        </Link>
      </div>

      <div className={styles.toolbar} style={{ marginBottom: 14, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div className={styles.toolbar} style={{ flexWrap: "wrap" }}>
          <Pill tone="pink">{t("fanCodesPillAll", { n: dispatched })}</Pill>
          <Pill tone="neutral">{t("fanCodesPillUnused", { n: unused })}</Pill>
          <Pill tone="teal">{t("fanCodesPillBound", { n: bound })}</Pill>
          <Pill tone="neutral">{t("fanCodesPillRevoked", { n: revoked })}</Pill>
        </div>
        <FanCodeGeneratorModal projectId={project.id} formCardClass={styles.formCard} />
      </div>

      <div className={styles.tableWrap}>
        <div className={`${styles.tableRow} ${styles.tableHead}`} style={{ gridTemplateColumns: CODE_COLS }}>
          <span>{t("fanCodesColCode")}</span>
          <span>{t("fanCodesColDevice")}</span>
          <span>{t("fanCodesColExpiry")}</span>
          <span>{t("fanCodesColUsage")}</span>
          <span>{t("fanCodesColStatus")}</span>
          <span />
        </div>
        {codes.map((code) => (
          <div key={code.id} className={styles.tableRow} style={{ gridTemplateColumns: CODE_COLS }}>
            <span className={styles.mono}>{code.code ?? `#${code.id.slice(0, 8)}`}</span>
            <span className={styles.pageHeadSub}>
              {code.bindMode === "none"
                ? t("fanCodesDeviceNone")
                : code.boundDeviceHash
                  ? t("fanCodesDeviceBound", { hash: code.boundDeviceHash.slice(0, 6) })
                  : t("fanCodesDeviceWaiting")}
            </span>
            <span className={styles.mono}>{formatDate(code.expiresAt)}</span>
            <span className={styles.mono}>
              {code.status === "unused" ? `0/${code.maxMessages}` : `${code.usedMessages}/${code.maxMessages}`}
            </span>
            <Pill tone={statusTone[code.status] ?? "neutral"} dot={code.status === "bound"}>
              {statusLabel[code.status] ? t(statusLabel[code.status]) : code.status}
            </Pill>
            <div className={styles.rowActions}>
              {code.status === "revoked" ? (
                <span className={styles.pageHeadSub}>—</span>
              ) : (
                <details>
                  <summary className={styles.danger}>{t("fanCodesRevoke")}</summary>
                  <div className={styles.formCard}>
                    <ApiForm action={`/api/creator/fan-codes/${code.id}`} method="DELETE" submitLabel={t("fanCodesRevokeConfirm")} submitVariant="danger">
                      <span className={styles.pageHeadSub}>{t("fanCodesRevokeHint")}</span>
                    </ApiForm>
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}
        {codes.length === 0 && <div className={styles.empty}>{t("fanCodesEmpty")}</div>}
      </div>
    </CreatorShell>
  );
}
