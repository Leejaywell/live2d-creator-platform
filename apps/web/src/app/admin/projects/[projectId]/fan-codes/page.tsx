import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { FanCodeGeneratorModal } from "@/components/fan-code-generator-modal";
import { Pill, type Tone } from "@/components/ui";
import { fanCodeDisplayStatus } from "@/lib/fan-code-status";
import { isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

import { AdminAuthRequired, AdminShell, dash } from "../../../_components";

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

export default async function AdminFanCodesPage({ params }: PageProps<"/admin/projects/[projectId]/fan-codes">) {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return <AdminAuthRequired />;
  }

  const t = await getTranslations("admin");
  const tf = await getTranslations("fans");

  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      creator: { include: { creatorProfile: true } },
      fanAccessCodes: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!project) notFound();

  const creatorName = project.creator.creatorProfile?.displayName ?? project.creator.username ?? "—";
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
    <AdminShell active="projects" user={session.user}>
      <div className={dash.pageHead}>
        <div>
          <h1>{t("acFanCodesHeading", { name: project.name })}</h1>
          <p className={dash.pageHeadSub}>{t("acFanCodesSubtitle", { creator: creatorName, dispatched })}</p>
        </div>
        <Link href="/admin/projects" className={dash.panelMeta}>
          {t("acFanCodesBack")}
        </Link>
      </div>

      <div className={dash.toolbar} style={{ marginBottom: 14, flexWrap: "wrap", justifyContent: "space-between" }}>
        <div className={dash.toolbar} style={{ flexWrap: "wrap" }}>
          <Pill tone="pink">{tf("fanCodesPillAll", { n: dispatched })}</Pill>
          <Pill tone="neutral">{tf("fanCodesPillUnused", { n: unused })}</Pill>
          <Pill tone="teal">{tf("fanCodesPillBound", { n: bound })}</Pill>
          <Pill tone="neutral">{tf("fanCodesPillRevoked", { n: revoked })}</Pill>
        </div>
        <FanCodeGeneratorModal
          projectId={project.id}
          formCardClass={dash.formCard}
          endpoint={`/api/admin/projects/${project.id}/fan-codes`}
        />
      </div>

      <div className={dash.tableWrap}>
        <div className={`${dash.tableRow} ${dash.tableHead}`} style={{ gridTemplateColumns: CODE_COLS }}>
          <span>{tf("fanCodesColCode")}</span>
          <span>{tf("fanCodesColDevice")}</span>
          <span>{tf("fanCodesColExpiry")}</span>
          <span>{tf("fanCodesColUsage")}</span>
          <span>{tf("fanCodesColStatus")}</span>
          <span />
        </div>
        {codes.map((code) => (
          <div key={code.id} className={dash.tableRow} style={{ gridTemplateColumns: CODE_COLS }}>
            <span className={dash.mono}>{code.code ?? `#${code.id.slice(0, 8)}`}</span>
            <span className={dash.pageHeadSub}>
              {code.bindMode === "none"
                ? tf("fanCodesDeviceNone")
                : code.boundDeviceHash
                  ? tf("fanCodesDeviceBound", { hash: code.boundDeviceHash.slice(0, 6) })
                  : tf("fanCodesDeviceWaiting")}
            </span>
            <span className={dash.mono}>{formatDate(code.expiresAt)}</span>
            <span className={dash.mono}>
              {code.status === "unused" ? `0/${code.maxMessages}` : `${code.usedMessages}/${code.maxMessages}`}
            </span>
            <Pill tone={statusTone[code.status] ?? "neutral"} dot={code.status === "bound"}>
              {statusLabel[code.status] ? tf(statusLabel[code.status]) : code.status}
            </Pill>
            <div className={dash.rowActions}>
              {code.status === "revoked" ? (
                <span className={dash.pageHeadSub}>—</span>
              ) : (
                <details>
                  <summary className={dash.danger}>{tf("fanCodesRevoke")}</summary>
                  <div className={dash.formCard}>
                    <ApiForm
                      action={`/api/admin/fan-codes/${code.id}`}
                      method="DELETE"
                      submitLabel={tf("fanCodesRevokeConfirm")}
                      submitVariant="danger"
                    >
                      <span className={dash.pageHeadSub}>{tf("fanCodesRevokeHint")}</span>
                    </ApiForm>
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}
        {codes.length === 0 && <div className={dash.empty}>{tf("fanCodesEmpty")}</div>}
      </div>
    </AdminShell>
  );
}
