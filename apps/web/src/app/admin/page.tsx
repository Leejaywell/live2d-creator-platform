import Link from "next/link";
import type { CreatorPlan } from "@prisma/client";

import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import { fanCodeDisplayStatus } from "@/lib/fan-code-status";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return (
      <main className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h1>Admin Dashboard</h1>
            <p>Sign in with an active Super Admin, Ops Admin, or Support Admin account.</p>
          </div>
          <nav className={styles.nav}>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/">Home</Link>
          </nav>
        </header>
      </main>
    );
  }

  const [adminUsers, creators, orders, auditLogs, projects, cloneRequests, fanAccessCodes, modelSetupRequests] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["super_admin", "ops_admin", "support_admin"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.user.findMany({
      where: { role: "creator" },
      include: { creatorProfile: true, creatorPlan: true, _count: { select: { projects: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.manualOrder.findMany({
      include: { creator: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.project.findMany({ include: { creator: true, currentModelAsset: true }, orderBy: { updatedAt: "desc" }, take: 20 }),
    prisma.voiceCloneRequest.findMany({ include: { project: true, creator: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.fanAccessCode.findMany({
      include: { project: { include: { creator: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.auditLog.findMany({
      where: { action: "model_setup_assistance.requested" },
      include: { actor: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <h1>Admin Dashboard</h1>
          <p>
            {session.user.email} · {session.user.role}
          </p>
        </div>
        <nav className={styles.nav}>
          <Link href="/creator">Creator</Link>
          <Link href="/">Home</Link>
          <Link href="/api/auth/signout">Sign out</Link>
        </nav>
      </header>

      <section className={styles.grid}>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Creators</span>
          <strong>{creators.length}</strong>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Admins</span>
          <strong>{adminUsers.length}</strong>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Manual orders</span>
          <strong>{orders.length}</strong>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>Fan codes</span>
          <strong>{fanAccessCodes.length}</strong>
        </div>
      </section>

      <section className={styles.twoColumn}>
        <div className={styles.forms}>
          <section className={styles.panel}>
            <h2>Admin Users</h2>
            <ul className={styles.list}>
              {adminUsers.map((adminUser) => (
                <li className={styles.row} key={adminUser.id}>
                  <strong>{adminUser.email}</strong>
                  <span>
                    {adminUser.role} · {adminUser.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Creators</h2>
            <ul className={styles.list}>
              {creators.map((creator) => (
                <li className={styles.row} key={creator.id}>
                  <strong>{creator.creatorProfile?.displayName ?? creator.email}</strong>
                  <span>
                    {creator.email} · {creator.status}
                  </span>
                  {creatorPlanDetails(creator.creatorPlan, creator._count.projects).map((detail) => (
                    <span key={detail}>{detail}</span>
                  ))}
                  {hasPermission(session.user.role, "creators.manage") ? (
                    <ApiForm action={`/api/admin/creators/${creator.id}/status`} submitLabel="Update creator status">
                      <label>
                        Status
                        <select name="status" defaultValue={creator.status}>
                          <option value="active">active</option>
                          <option value="suspended">suspended</option>
                        </select>
                      </label>
                    </ApiForm>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Orders</h2>
            <ul className={styles.list}>
              {orders.map((order) => (
                <li className={styles.row} key={order.id}>
                  <strong>
                    {order.creator.email} · {order.paymentStatus}
                  </strong>
                  <span>
                    {order.amount.toString()} {order.currency} · {order.planName ?? order.orderType}
                  </span>
                  {order.paymentStatus !== "confirmed" ? (
                    <ApiForm action={`/api/admin/orders/${order.id}/confirm`} submitLabel="Confirm order">
                      <span className={styles.muted}>This writes plan quota, ledger entries, and audit logs.</span>
                    </ApiForm>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Projects</h2>
            <ul className={styles.list}>
              {projects.map((project) => (
                <li className={styles.row} key={project.id}>
                  <strong>{project.name}</strong>
                  <span>
                    {project.creator.email} · /c/{project.slug} · {project.status} · model {project.currentModelAsset?.validationStatus ?? "none"}
                  </span>
                  <ApiForm action={`/api/admin/projects/${project.id}/status`} submitLabel="Set status">
                    <label>
                      Status
                      <select name="status" defaultValue={project.status}>
                        <option value="published">published</option>
                        <option value="paused">paused</option>
                        <option value="draft">draft</option>
                      </select>
                    </label>
                  </ApiForm>
                  {hasPermission(session.user.role, "assets.assist") ? (
                    <>
                      <ApiForm action={`/api/admin/projects/${project.id}/model-assets`} submitLabel="Upload assisted model">
                        <label>
                          Live2D zip
                          <input name="file" type="file" accept=".zip" required />
                        </label>
                      </ApiForm>
                      <ApiForm action={`/api/admin/projects/${project.id}/voice-assets`} submitLabel="Upload assisted voice">
                        <label>
                          Voice name
                          <input name="name" />
                        </label>
                        <label>
                          WAV/MP3 file
                          <input name="file" type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" required />
                        </label>
                        <label>
                          Tags
                          <input name="tags" />
                        </label>
                      </ApiForm>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Model Setup Assistance Requests</h2>
            <ul className={styles.list}>
              {modelSetupRequests.map((request) => (
                <li className={styles.row} key={request.id}>
                  <strong>{request.actor?.email ?? "Unknown creator"}</strong>
                  <span>
                    Project {request.targetId ?? "n/a"} · {request.createdAt.toISOString()}
                  </span>
                  {auditJsonText(request.after, "projectName") ? <span>{auditJsonText(request.after, "projectName")}</span> : null}
                  {auditJsonText(request.after, "notes") ? <span className={styles.muted}>{auditJsonText(request.after, "notes")}</span> : null}
                </li>
              ))}
              {!modelSetupRequests.length ? <li className={styles.row}>No model setup requests yet.</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Fan Code Diagnostics</h2>
            <ul className={styles.list}>
              {fanAccessCodes.map((code) => (
                <li className={styles.row} key={code.id}>
                  <strong>{fanCodeDisplayStatus(code)}</strong>
                  <span>
                    {code.project.creator.email} · {code.project.name} · /c/{code.project.slug}
                  </span>
                  <span>
                    {code.usedMessages}/{code.maxMessages} messages · {code.bindMode}
                    {code.boundDeviceHash ? " · device bound" : " · not bound"} · expires {code.expiresAt.toISOString()}
                  </span>
                  <span className={styles.muted}>
                    ID {code.id} · Batch {code.batchId}
                  </span>
                </li>
              ))}
              {!fanAccessCodes.length ? <li className={styles.row}>No fan codes yet.</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Audit Log</h2>
            <ul className={styles.list}>
              {auditLogs.map((log) => (
                <li className={styles.row} key={log.id}>
                  <strong>{log.action}</strong>
                  <span>
                    {log.targetType} · {log.targetId ?? "n/a"} · {log.createdAt.toISOString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>Voice Clone Requests</h2>
            <ul className={styles.list}>
              {cloneRequests.map((request) => (
                <li className={styles.row} key={request.id}>
                  <strong>
                    {request.project.name} · {request.status}
                  </strong>
                  <span>
                    {request.creator.email} · {request.createdAt.toISOString()}
                  </span>
                  {request.notes ? <span>{request.notes}</span> : null}
                  {hasPermission(session.user.role, "clone_requests.review") ? (
                    <ApiForm action={`/api/admin/clone-requests/${request.id}/status`} submitLabel="Update clone request">
                      <label>
                        Status
                        <select name="status" defaultValue={request.status}>
                          <option value="submitted">submitted</option>
                          <option value="reviewing">reviewing</option>
                          <option value="approved">approved</option>
                          <option value="rejected">rejected</option>
                          <option value="fulfilled">fulfilled</option>
                        </select>
                      </label>
                    </ApiForm>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className={styles.forms}>
          {hasPermission(session.user.role, "admin.users.manage") ? (
            <section className={styles.panel}>
              <h2>Upsert Admin User</h2>
              <ApiForm action="/api/admin/users" submitLabel="Save admin user">
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Role
                  <select name="role" defaultValue="ops_admin">
                    <option value="super_admin">super_admin</option>
                    <option value="ops_admin">ops_admin</option>
                    <option value="support_admin">support_admin</option>
                  </select>
                </label>
                <label>
                  Status
                  <select name="status" defaultValue="active">
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                  </select>
                </label>
              </ApiForm>
            </section>
          ) : null}

          {hasPermission(session.user.role, "creators.manage") ? (
            <section className={styles.panel}>
              <h2>Create Creator</h2>
              <ApiForm action="/api/admin/creators" submitLabel="Create creator">
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  Display name
                  <input name="displayName" required />
                </label>
                <label>
                  Plan name
                  <input name="planName" />
                </label>
                <label>
                  Expires at
                  <input name="expiresAt" placeholder="YYYY-MM-DDTHH:mm:ss.sssZ" />
                </label>
                <label>
                  Project limit
                  <input name="maxProjects" type="number" min="1" defaultValue="1" />
                </label>
                <label>
                  AI message limit
                  <input name="monthlyAiMessageLimit" type="number" min="1" defaultValue="1000" />
                </label>
                <label>
                  Storage limit MB
                  <input name="storageLimitMb" type="number" min="1" defaultValue="512" />
                </label>
                <label>
                  Fan-code quota
                  <input name="fanCodeQuota" type="number" min="1" defaultValue="20" />
                </label>
              </ApiForm>
            </section>
          ) : null}

          {hasPermission(session.user.role, "support.notes") ? (
            <section className={styles.panel}>
              <h2>Add Support Note</h2>
              <ApiForm action="/api/admin/support-notes" submitLabel="Save support note">
                <label>
                  Target type
                  <select name="targetType" defaultValue="General">
                    <option value="General">General</option>
                    <option value="User">User</option>
                    <option value="Project">Project</option>
                    <option value="FanAccessCode">FanAccessCode</option>
                    <option value="ManualOrder">ManualOrder</option>
                    <option value="VoiceCloneRequest">VoiceCloneRequest</option>
                  </select>
                </label>
                <label>
                  Target ID
                  <input name="targetId" />
                </label>
                <label>
                  Note
                  <textarea name="note" required />
                </label>
              </ApiForm>
            </section>
          ) : null}

          {hasPermission(session.user.role, "quota.grant") ? (
            <section className={styles.panel}>
              <h2>Grant Quota</h2>
              <ApiForm action="/api/admin/quota-grants" submitLabel="Grant quota">
                <label>
                  Creator ID
                  <input name="creatorId" required />
                </label>
                <label>
                  Resource
                  <select name="resource" defaultValue="fan_codes">
                    <option value="projects">projects</option>
                    <option value="fan_codes">fan_codes</option>
                    <option value="ai_messages">ai_messages</option>
                    <option value="storage_mb">storage_mb</option>
                  </select>
                </label>
                <label>
                  Amount
                  <input name="amount" type="number" min="1" defaultValue="100" required />
                </label>
                <label>
                  Reason
                  <textarea name="reason" />
                </label>
              </ApiForm>
            </section>
          ) : null}

          {hasPermission(session.user.role, "plans.manage") ? (
            <section className={styles.panel}>
              <h2>Create Manual Order</h2>
              <ApiForm action="/api/admin/orders" submitLabel="Create order">
                <label>
                  Creator ID
                  <input name="creatorId" required />
                </label>
                <label>
                  Amount
                  <input name="amount" defaultValue="399.00" required />
                </label>
                <label>
                  Order type
                  <select name="orderType" defaultValue="plan">
                    <option value="plan">plan</option>
                    <option value="fan_code_pack">fan_code_pack</option>
                    <option value="quota_adjustment">quota_adjustment</option>
                  </select>
                </label>
                <label>
                  Payment method
                  <select name="paymentMethod" defaultValue="wechat">
                    <option value="wechat">wechat</option>
                    <option value="alipay">alipay</option>
                    <option value="bank_transfer">bank_transfer</option>
                    <option value="other">other</option>
                  </select>
                </label>
                <label>
                  Plan name
                  <input name="planName" defaultValue="Pro" />
                </label>
                <label>
                  Period end
                  <input name="periodEnd" placeholder="YYYY-MM-DDTHH:mm:ss.sssZ" />
                </label>
                <label>
                  Project quota delta
                  <input name="projectQuotaDelta" type="number" defaultValue="1" />
                </label>
                <label>
                  AI message quota delta
                  <input name="aiMessageQuotaDelta" type="number" defaultValue="5000" />
                </label>
                <label>
                  Storage quota delta MB
                  <input name="storageQuotaDeltaMb" type="number" defaultValue="1024" />
                </label>
                <label>
                  Fan-code quota delta
                  <input name="fanCodeQuotaDelta" type="number" defaultValue="100" />
                </label>
                <label>
                  Notes
                  <textarea name="notes" />
                </label>
              </ApiForm>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function auditJsonText(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const item = (value as Record<string, unknown>)[key];
  return typeof item === "string" ? item : "";
}

function creatorPlanDetails(plan: CreatorPlan | null, projectCount: number) {
  if (!plan) return ["no plan"];

  return [
    `${plan.planName} · ${plan.status} · expires ${plan.expiresAt.toISOString().slice(0, 10)}`,
    `Projects ${projectCount}/${plan.maxProjects} · AI messages ${plan.usedAiMessages}/${plan.monthlyAiMessageLimit}`,
    `Fan codes ${plan.usedFanCodes}/${plan.fanCodeQuota} · Storage ${plan.usedStorageMb}/${plan.storageLimitMb} MB`,
  ];
}
