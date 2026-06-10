import Link from "next/link";
import type { CreatorPlan } from "@prisma/client";

import styles from "@/app/dashboard.module.css";
import { getCurrentSession } from "@/auth";
import { ApiForm } from "@/components/api-form";
import {
  formatOrderAmount,
  manualOrderPeriodLabel,
  manualOrderQuotaImpactLabel,
  orderStatusLabel,
  orderTypeLabel,
  paymentStatusTone,
} from "@/lib/billing-history";
import { checkoutModeLabel, manualOrderCheckoutHint } from "@/lib/checkout-modes";
import { fanCodeDisplayStatus } from "@/lib/fan-code-status";
import { modelAssistanceStatusText, resolveModelAssistanceRequests } from "@/lib/model-assistance-requests";
import { hasPermission, isAdminRole } from "@/lib/permissions";
import { getPlatformRuntimeSettings, listPlatformSettings, type PlatformSettingView } from "@/lib/platform-settings";
import { prisma } from "@/lib/prisma";
import { listRecentSafetyEvents } from "@/lib/safety-events";
import { summarizeUsageAnalytics, usageWindowStart } from "@/lib/usage-analytics";
import { voiceCloneNextStep, voiceCloneStatusLabel, voiceCloneStatusTone } from "@/lib/voice-clone-status";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session?.user || session.user.status !== "active" || !isAdminRole(session.user.role)) {
    return (
      <main className={styles.authShell}>
        <div className={styles.authCard}>
          <p className={styles.kicker}>CONTROL ROOM</p>
          <h1>管理后台</h1>
          <p>请使用有效的超级管理员、运营管理员或客服管理员账号登录。</p>
          <div className={styles.authActions}>
            <Link href="/sign-in">去登录</Link>
            <Link href="/">回首页</Link>
          </div>
        </div>
      </main>
    );
  }

  const usageDays = 7;
  const [
    adminUsers,
    creators,
    orders,
    auditLogs,
    projects,
    cloneRequests,
    fanAccessCodes,
    modelSetupRequests,
    adminModelFulfillments,
    platformSettings,
    runtimeSettings,
    usageRecords,
    safetyEvents,
  ] = await Promise.all([
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
    prisma.modelAsset.findMany({
      where: {
        uploadedBy: "admin",
        validationStatus: "valid",
      },
      select: {
        id: true,
        projectId: true,
        version: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    hasPermission(session.user.role, "provider_secrets.manage") ? listPlatformSettings() : Promise.resolve([]),
    getPlatformRuntimeSettings(),
    prisma.chatUsage.findMany({
      where: {
        createdAt: { gte: usageWindowStart(usageDays) },
      },
      include: {
        project: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    listRecentSafetyEvents(20),
  ]);
  const creatorOptions = creators.map((creator) => ({
    id: creator.id,
    label: `${creator.creatorProfile?.displayName ?? creator.email} · ${creator.email}`,
  }));
  const activeCreators = creators.filter((creator) => creator.status === "active").length;
  const publishedProjects = projects.filter((project) => project.status === "published").length;
  const pendingOrders = orders.filter((order) => order.paymentStatus !== "confirmed").length;
  const pendingCloneRequests = cloneRequests.filter((request) => request.status === "submitted" || request.status === "reviewing").length;
  const checkoutProviderMode = runtimeSettings.checkoutMode !== "manual-only";
  const modelAssistanceRequests = resolveModelAssistanceRequests(modelSetupRequests, adminModelFulfillments);
  const usage = summarizeUsageAnalytics(
    usageRecords.map((record) => ({
      projectId: record.projectId,
      projectName: record.project.name,
      messageCount: record.messageCount,
      tokenEstimate: record.tokenEstimate,
      createdAt: record.createdAt,
    })),
    { days: usageDays },
  );

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>CONTROL ROOM</p>
          <h1>管理后台</h1>
          <p>
            {session.user.email} · {session.user.role}
          </p>
        </div>
        <nav className={styles.nav}>
          <Link href="/creator">创作者工作台</Link>
          <Link href="/">首页</Link>
          <Link href="/api/auth/signout">退出登录</Link>
        </nav>
      </header>

      <section className={styles.grid}>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>创作者</span>
          <strong>{creators.length}</strong>
          <p className={styles.muted}>最近一页中 {activeCreators} 个活跃账号。</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>管理员</span>
          <strong>{adminUsers.length}</strong>
          <p className={styles.muted}>超级 / 运营 / 客服管理员。</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>手动订单</span>
          <strong>{orders.length}</strong>
          <p className={styles.muted}>{pendingOrders} 笔待确认。</p>
        </div>
        <div className={`${styles.panel} ${styles.metric}`}>
          <span>粉丝码</span>
          <strong>{fanAccessCodes.length}</strong>
          <p className={styles.muted}>{publishedProjects} 个项目上演中。</p>
        </div>
      </section>

      <section className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>OPERATIONS</p>
          <h2>手动商务、项目交付与支持队列</h2>
        </div>
        <span className={pendingCloneRequests ? `${styles.statusPill} ${styles.statusWarn}` : `${styles.statusPill} ${styles.statusGood}`}>
          {pendingCloneRequests} 个声音克隆请求待处理
        </span>
      </section>

      <section className={styles.twoColumn}>
        <div className={styles.forms}>
          <section className={styles.panel}>
            <h2>用量分析</h2>
            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span>消息数</span>
                <strong>{usage.totalMessages}</strong>
              </div>
              <div className={styles.metaItem}>
                <span>Token 估算</span>
                <strong>{usage.totalTokens}</strong>
              </div>
              <div className={styles.metaItem}>
                <span>活跃项目</span>
                <strong>{usage.activeProjects}</strong>
              </div>
              <div className={styles.metaItem}>
                <span>平均 Token</span>
                <strong>{usage.averageTokensPerMessage}</strong>
              </div>
            </div>
            <h3>近 {usageDays} 天</h3>
            <UsageTrend daily={usage.daily} />
            <h3>项目排行</h3>
            <ul className={styles.list}>
              {usage.topProjects.map((project) => (
                <li className={styles.row} key={project.projectId}>
                  <strong>{project.projectName}</strong>
                  <span>
                    {project.messages} 条消息 · {project.tokens} token 估算
                  </span>
                </li>
              ))}
              {!usage.topProjects.length ? <li className={styles.row}>该时间段内没有观众聊天记录。</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>安全队列</h2>
            <p className={styles.muted}>最近被内容审查或提示词安全规则拦截的粉丝消息。</p>
            <ul className={styles.list}>
              {safetyEvents.map((event) => (
                <li className={styles.row} key={event.id}>
                  <strong>{event.projectName}</strong>
                  <span className={event.severity === "high" ? `${styles.statusPill} ${styles.statusBad}` : `${styles.statusPill} ${styles.statusWarn}`}>
                    {event.severity} · {event.code}
                  </span>
                  <span>
                    {event.creatorEmail}
                    {event.projectSlug ? ` · /c/${event.projectSlug}` : ""} · {event.createdAt.toISOString()}
                  </span>
                  <span>{event.messagePreview || "无消息预览。"}</span>
                </li>
              ))}
              {!safetyEvents.length ? <li className={styles.row}>还没有被拦截的消息。</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>平台能力状态</h2>
            <ul className={styles.checklist}>
              <CapabilityRow title="邮箱魔法链接登录" detail="创作者与管理员均可使用。" done />
              <CapabilityRow title="手动收款与配额台账" detail="管理员创建并确认订单,配额变更可审计。" done />
              <CapabilityRow title="Live2D 模型交付" detail="创作者/管理员上传、校验、回滚与受保护分发均已启用。" done />
              <CapabilityRow title="粉丝码进场与聊天代理" detail="访问码校验、设备绑定,AI 成功回复后扣减配额。" done />
              <CapabilityRow title="微信登录" detail="OAuth 入口、回调、沙箱登录与管理员 OpenID 绑定已接通。" done />
              <CapabilityRow title="支付回调" detail="带签名的支付 webhook 可确认订单并写入配额台账。" done />
              <CapabilityRow title="TTS 运行模式" detail="预置语音播放跟随平台 TTS 模式;禁用时聊天不播语音。" done />
              <CapabilityRow title="资源分发模式" detail="语音播放地址跟随 app-proxy 或签名跳转模式。" done />
              <CapabilityRow title="声音克隆履约" detail="请求入口默认关闭;管理员仍可审阅历史请求。" done />
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>管理员账号</h2>
            <ul className={styles.list}>
              {adminUsers.map((adminUser) => (
                <li className={styles.row} key={adminUser.id}>
                  <strong>{adminUser.email}</strong>
                  <span>
                    {adminUser.role} · {adminUser.status}
                  </span>
                  <span className={styles.muted}>
                    微信 {adminUser.wechatOpenId ? `已绑定:${adminUser.wechatOpenId}` : "未绑定"}
                  </span>
                  {hasPermission(session.user.role, "admin.users.manage") ? (
                    <WechatBindingForm userId={adminUser.id} openId={adminUser.wechatOpenId} />
                  ) : null}
                </li>
              ))}
              {!adminUsers.length ? <li className={styles.row}>没有管理员账号。</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>创作者</h2>
            <ul className={styles.list}>
              {creators.map((creator) => (
                <li className={styles.row} key={creator.id}>
                  <strong>{creator.creatorProfile?.displayName ?? creator.email}</strong>
                  <span className={creator.status === "active" ? `${styles.statusPill} ${styles.statusGood}` : `${styles.statusPill} ${styles.statusBad}`}>
                    {creator.status}
                  </span>
                  <span>{creator.email}</span>
                  <span className={styles.muted}>
                    微信 {creator.wechatOpenId ? `已绑定:${creator.wechatOpenId}` : "未绑定"}
                  </span>
                  {creatorPlanDetails(creator.creatorPlan, creator._count.projects).map((detail) => (
                    <span key={detail}>{detail}</span>
                  ))}
                  {hasPermission(session.user.role, "creators.manage") ? (
                    <>
                      <details className={styles.collapse}>
                        <summary>账号状态</summary>
                        <ApiForm action={`/api/admin/creators/${creator.id}/status`} submitLabel="更新状态">
                          <label>
                            状态
                            <select name="status" defaultValue={creator.status}>
                              <option value="active">正常(active)</option>
                              <option value="suspended">停用(suspended)</option>
                            </select>
                          </label>
                        </ApiForm>
                      </details>
                      <WechatBindingForm userId={creator.id} openId={creator.wechatOpenId} />
                    </>
                  ) : null}
                </li>
              ))}
              {!creators.length ? <li className={styles.row}>还没有创作者。</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>订单</h2>
            <ul className={styles.list}>
              {orders.map((order) => (
                <li className={styles.row} key={order.id}>
                  <strong>{order.creator.email}</strong>
                  <span className={paymentStatusToneClass(order.paymentStatus)}>{orderStatusLabel(order.paymentStatus)}</span>
                  <span>
                    {formatOrderAmount(order)} · {order.planName ?? orderTypeLabel(order.orderType)}
                  </span>
                  <span>{manualOrderPeriodLabel(order)}</span>
                  <span>{manualOrderQuotaImpactLabel(order)}</span>
                  {order.paymentStatus === "pending" ? (
                    <div className={styles.splitActions}>
                      <details className={styles.collapse}>
                        <summary>确认收款</summary>
                        <ApiForm action={`/api/admin/orders/${order.id}/confirm`} submitLabel="确认订单">
                          <span className={styles.muted}>将写入套餐配额、台账流水与审计日志。</span>
                        </ApiForm>
                      </details>
                      <details className={styles.collapse}>
                        <summary>作废订单</summary>
                        <ApiForm action={`/api/admin/orders/${order.id}/void`} submitLabel="作废订单">
                          <span className={styles.muted}>用于确认不会收到该笔款项时。</span>
                        </ApiForm>
                      </details>
                    </div>
                  ) : null}
                  {order.paymentStatus === "confirmed" ? (
                    <details className={styles.collapse}>
                      <summary>标记退款</summary>
                      <ApiForm action={`/api/admin/orders/${order.id}/refund`} submitLabel="确认退款">
                        <span className={styles.muted}>回收该订单未使用的配额并写入审计日志。</span>
                      </ApiForm>
                    </details>
                  ) : null}
                </li>
              ))}
              {!orders.length ? <li className={styles.row}>还没有订单。</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>项目</h2>
            <ul className={styles.list}>
              {projects.map((project) => (
                <li className={styles.row} key={project.id}>
                  <strong>{project.name}</strong>
                  <span className={project.status === "published" ? `${styles.statusPill} ${styles.statusGood}` : project.status === "paused" ? `${styles.statusPill} ${styles.statusBad}` : `${styles.statusPill} ${styles.statusWarn}`}>
                    {project.status}
                  </span>
                  <span>
                    {project.creator.email} · /c/{project.slug} · 模型 {project.currentModelAsset?.validationStatus ?? "无"}
                  </span>
                  <details className={styles.collapse}>
                    <summary>调整状态</summary>
                    <ApiForm action={`/api/admin/projects/${project.id}/status`} submitLabel="设置状态">
                      <label>
                        状态
                        <select name="status" defaultValue={project.status}>
                          <option value="published">上演中(published)</option>
                          <option value="paused">暂停(paused)</option>
                          <option value="draft">草稿(draft)</option>
                        </select>
                      </label>
                    </ApiForm>
                  </details>
                  {hasPermission(session.user.role, "assets.assist") ? (
                    <>
                      <details className={styles.collapse}>
                        <summary>代传模型</summary>
                        <ApiForm action={`/api/admin/projects/${project.id}/model-assets`} submitLabel="上传协助模型">
                          <label>
                            Live2D zip
                            <input name="file" type="file" accept=".zip" required />
                          </label>
                        </ApiForm>
                      </details>
                      <details className={styles.collapse}>
                        <summary>代传语音</summary>
                        <ApiForm action={`/api/admin/projects/${project.id}/voice-assets`} submitLabel="上传协助语音">
                          <label>
                            语音名称
                            <input name="name" />
                          </label>
                          <label>
                            WAV/MP3 文件
                            <input name="file" type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" required />
                          </label>
                          <label>
                            标签
                            <input name="tags" />
                          </label>
                        </ApiForm>
                      </details>
                    </>
                  ) : null}
                </li>
              ))}
              {!projects.length ? <li className={styles.row}>还没有项目。</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>模型协助请求</h2>
            <ul className={styles.list}>
              {modelAssistanceRequests.map((request) => (
                <li className={styles.row} key={request.id}>
                  <strong>{request.projectName}</strong>
                  <span className={request.status === "fulfilled" ? `${styles.statusPill} ${styles.statusGood}` : `${styles.statusPill} ${styles.statusWarn}`}>
                    {request.status === "fulfilled" ? "已完成" : "待管理员配置"}
                  </span>
                  <span>
                    {request.creatorEmail} · 项目 {request.projectId || "n/a"}
                  </span>
                  <span>{modelAssistanceStatusText(request)}</span>
                  {request.fulfilledModelAssetId ? (
                    <span className={styles.muted}>模型资产 {request.fulfilledModelAssetId}</span>
                  ) : null}
                  {request.notes ? <span className={styles.muted}>{request.notes}</span> : null}
                </li>
              ))}
              {!modelAssistanceRequests.length ? <li className={styles.row}>还没有模型协助请求。</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>粉丝码诊断</h2>
            <ul className={styles.list}>
              {fanAccessCodes.map((code) => (
                <li className={styles.row} key={code.id}>
                  <strong>{fanCodeDisplayStatus(code)}</strong>
                  <span>
                    {code.project.creator.email} · {code.project.name} · /c/{code.project.slug}
                  </span>
                  <span>
                    {code.usedMessages}/{code.maxMessages} 条消息 · {code.bindMode}
                    {code.boundDeviceHash ? " · 已绑定设备" : " · 未绑定"} · {code.expiresAt.toISOString()} 到期
                  </span>
                  <span className={styles.muted}>
                    ID {code.id} · 批次 {code.batchId}
                  </span>
                  {code.boundDeviceHash && hasPermission(session.user.role, "fan_codes.manage") ? (
                    <details className={styles.collapse}>
                      <summary>重置设备绑定</summary>
                      <ApiForm action={`/api/admin/fan-codes/${code.id}/device-binding`} submitLabel="确认重置">
                        <span className={styles.muted}>清除已绑定的浏览器并使现有观众会话失效。</span>
                      </ApiForm>
                    </details>
                  ) : null}
                </li>
              ))}
              {!fanAccessCodes.length ? <li className={styles.row}>还没有粉丝码。</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>审计日志</h2>
            <ul className={styles.list}>
              {auditLogs.map((log) => (
                <li className={styles.row} key={log.id}>
                  <strong>{log.action}</strong>
                  <span>
                    {log.targetType} · {log.targetId ?? "n/a"} · {log.createdAt.toISOString()}
                  </span>
                </li>
              ))}
              {!auditLogs.length ? <li className={styles.row}>还没有审计日志。</li> : null}
            </ul>
          </section>

          <section className={styles.panel}>
            <h2>声音克隆请求</h2>
            <ul className={styles.list}>
              {cloneRequests.map((request) => (
                <li className={styles.row} key={request.id}>
                  <strong>{request.project.name}</strong>
                  <span className={statusToneClass(request.status)}>
                    {voiceCloneStatusLabel(request.status)} · {request.status}
                  </span>
                  <span>
                    {request.creator.email} · 提交 {request.createdAt.toISOString()} · 更新 {request.updatedAt.toISOString()}
                  </span>
                  <span>{voiceCloneNextStep(request.status)}</span>
                  {request.notes ? <span>{request.notes}</span> : null}
                  {hasPermission(session.user.role, "clone_requests.review") ? (
                    <details className={styles.collapse}>
                      <summary>更新进度</summary>
                      <ApiForm action={`/api/admin/clone-requests/${request.id}/status`} submitLabel="更新请求状态">
                        <label>
                          状态
                          <select name="status" defaultValue={request.status}>
                            <option value="submitted">已提交(submitted)</option>
                            <option value="reviewing">审核中(reviewing)</option>
                            <option value="approved">已通过(approved)</option>
                            <option value="rejected">已拒绝(rejected)</option>
                            <option value="fulfilled">已完成(fulfilled)</option>
                          </select>
                        </label>
                      </ApiForm>
                    </details>
                  ) : null}
                </li>
              ))}
              {!cloneRequests.length ? <li className={styles.row}>还没有声音克隆请求。</li> : null}
            </ul>
          </section>
        </div>

        <div className={styles.forms}>
          {hasPermission(session.user.role, "admin.users.manage") ? (
            <section className={styles.panel}>
              <h2>新建 / 更新管理员</h2>
              <ApiForm action="/api/admin/users" submitLabel="保存管理员">
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  角色
                  <select name="role" defaultValue="ops_admin">
                    <option value="super_admin">超级管理员(super_admin)</option>
                    <option value="ops_admin">运营管理员(ops_admin)</option>
                    <option value="support_admin">客服管理员(support_admin)</option>
                  </select>
                </label>
                <label>
                  状态
                  <select name="status" defaultValue="active">
                    <option value="active">正常(active)</option>
                    <option value="suspended">停用(suspended)</option>
                  </select>
                </label>
              </ApiForm>
            </section>
          ) : null}

          {hasPermission(session.user.role, "provider_secrets.manage") ? (
            <section className={styles.panel}>
              <h2>平台设置</h2>
              <p className={styles.muted}>配置服务商模式与运行策略,真正的密钥仍保存在部署环境变量中。</p>
              <div className={styles.tableLike}>
                {platformSettings.map((setting) => (
                  <PlatformSettingForm key={setting.key} setting={setting} />
                ))}
              </div>
            </section>
          ) : null}

          {hasPermission(session.user.role, "creators.manage") ? (
            <section className={styles.panel}>
              <h2>创建创作者</h2>
              <ApiForm action="/api/admin/creators" submitLabel="创建创作者">
                <label>
                  Email
                  <input name="email" type="email" required />
                </label>
                <label>
                  显示名称
                  <input name="displayName" required />
                </label>
                <label>
                  套餐名称
                  <input name="planName" />
                </label>
                <label>
                  到期时间
                  <input name="expiresAt" type="datetime-local" />
                </label>
                <label>
                  项目数上限
                  <input name="maxProjects" type="number" min="1" defaultValue="1" />
                </label>
                <label>
                  AI 消息上限
                  <input name="monthlyAiMessageLimit" type="number" min="1" defaultValue="1000" />
                </label>
                <label>
                  存储上限 MB
                  <input name="storageLimitMb" type="number" min="1" defaultValue="512" />
                </label>
                <label>
                  粉丝码配额
                  <input name="fanCodeQuota" type="number" min="1" defaultValue="20" />
                </label>
              </ApiForm>
            </section>
          ) : null}

          {hasPermission(session.user.role, "support.notes") ? (
            <section className={styles.panel}>
              <h2>添加支持备注</h2>
              <ApiForm action="/api/admin/support-notes" submitLabel="保存备注">
                <label>
                  目标类型
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
                  目标 ID
                  <input name="targetId" />
                </label>
                <label>
                  备注
                  <textarea name="note" required />
                </label>
              </ApiForm>
            </section>
          ) : null}

          {hasPermission(session.user.role, "quota.grant") ? (
            <section className={styles.panel}>
              <h2>赠送配额</h2>
              <ApiForm action="/api/admin/quota-grants" submitLabel="赠送配额">
                <label>
                  创作者
                  <select name="creatorId" required>
                    <option value="">选择创作者</option>
                    {creatorOptions.map((creator) => (
                      <option key={creator.id} value={creator.id}>
                        {creator.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  资源类型
                  <select name="resource" defaultValue="fan_codes">
                    <option value="projects">项目数(projects)</option>
                    <option value="fan_codes">粉丝码(fan_codes)</option>
                    <option value="ai_messages">AI 消息(ai_messages)</option>
                    <option value="storage_mb">存储(storage_mb)</option>
                  </select>
                </label>
                <label>
                  数量
                  <input name="amount" type="number" min="1" defaultValue="100" required />
                </label>
                <label>
                  原因
                  <textarea name="reason" />
                </label>
              </ApiForm>
            </section>
          ) : null}

          {hasPermission(session.user.role, "plans.manage") ? (
            <section className={styles.panel}>
              <h2>创建手动订单</h2>
              <span className={checkoutProviderMode ? `${styles.statusPill} ${styles.statusWarn}` : styles.statusPill}>
                {checkoutModeLabel(runtimeSettings.checkoutMode)}
              </span>
              <p className={styles.muted}>{manualOrderCheckoutHint(runtimeSettings.checkoutMode)}</p>
              <ApiForm action="/api/admin/orders" submitLabel="创建订单">
                <label>
                  创作者
                  <select name="creatorId" required>
                    <option value="">选择创作者</option>
                    {creatorOptions.map((creator) => (
                      <option key={creator.id} value={creator.id}>
                        {creator.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  金额
                  <input name="amount" defaultValue="399.00" required />
                </label>
                <label>
                  订单类型
                  <select name="orderType" defaultValue={checkoutProviderMode ? "quota_adjustment" : "plan"}>
                    <option value="plan" disabled={checkoutProviderMode}>
                      套餐(plan)
                    </option>
                    <option value="fan_code_pack" disabled={checkoutProviderMode}>
                      粉丝码包(fan_code_pack)
                    </option>
                    <option value="quota_adjustment">配额调整(quota_adjustment)</option>
                  </select>
                </label>
                <label>
                  支付方式
                  <select name="paymentMethod" defaultValue="wechat">
                    <option value="wechat">微信(wechat)</option>
                    <option value="alipay">支付宝(alipay)</option>
                    <option value="bank_transfer">银行转账(bank_transfer)</option>
                    <option value="other">其他(other)</option>
                  </select>
                </label>
                <label>
                  套餐名称
                  <input name="planName" defaultValue={checkoutProviderMode ? "" : "Pro"} disabled={checkoutProviderMode} />
                </label>
                <label>
                  周期开始
                  <input name="periodStart" type="datetime-local" />
                </label>
                <label>
                  周期结束
                  <input name="periodEnd" type="datetime-local" />
                </label>
                <label>
                  项目配额增量
                  <input name="projectQuotaDelta" type="number" defaultValue="1" />
                </label>
                <label>
                  AI 消息配额增量
                  <input name="aiMessageQuotaDelta" type="number" defaultValue="5000" />
                </label>
                <label>
                  存储配额增量 MB
                  <input name="storageQuotaDeltaMb" type="number" defaultValue="1024" />
                </label>
                <label>
                  粉丝码配额增量
                  <input name="fanCodeQuotaDelta" type="number" defaultValue="100" />
                </label>
                <label>
                  备注
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

function CapabilityRow({ title, detail, done = false }: { title: string; detail: string; done?: boolean }) {
  return (
    <li className={styles.checkItem}>
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <span className={done ? `${styles.statusPill} ${styles.statusGood}` : `${styles.statusPill} ${styles.statusWarn}`}>{done ? "已就绪" : "规划中"}</span>
    </li>
  );
}

function paymentStatusToneClass(status: string) {
  const tone = paymentStatusTone(status);
  if (tone === "good") return `${styles.statusPill} ${styles.statusGood}`;
  if (tone === "bad") return `${styles.statusPill} ${styles.statusBad}`;
  if (tone === "warn") return `${styles.statusPill} ${styles.statusWarn}`;
  return styles.statusPill;
}

function PlatformSettingForm({ setting }: { setting: PlatformSettingView }) {
  return (
    <div className={styles.row}>
      <strong>{setting.label}</strong>
      <span>
        {setting.category} · {setting.source}
        {setting.updatedAt ? ` · 更新于 ${setting.updatedAt.toISOString().slice(0, 10)}` : ""}
      </span>
      <span>{setting.description}</span>
      <ApiForm action="/api/admin/platform-settings" submitLabel="保存设置">
        <input type="hidden" name="key" value={setting.key} />
        <label>
          值
          {setting.valueType === "enum" ? (
            <select name="value" defaultValue={String(setting.value)}>
              {setting.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : setting.valueType === "number" ? (
            <input name="value" type="number" min="1" max="10000" defaultValue={String(setting.value)} />
          ) : setting.valueType === "boolean" ? (
            <select name="value" defaultValue={String(setting.value)}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          ) : (
            <input name="value" defaultValue={String(setting.value)} />
          )}
        </label>
      </ApiForm>
    </div>
  );
}

function WechatBindingForm({ userId, openId }: { userId: string; openId: string | null }) {
  return (
    <details className={styles.collapse}>
      <summary>{openId ? "更新微信绑定" : "绑定微信"}</summary>
      <ApiForm action={`/api/admin/users/${userId}/wechat`} submitLabel={openId ? "更新绑定" : "绑定微信"}>
        <label>
          微信 OpenID
          <input name="openId" defaultValue={openId ?? ""} placeholder="来自微信 OAuth 的 OpenID" />
        </label>
        {openId ? <span className={styles.muted}>清空后提交即可解除该微信身份的绑定。</span> : null}
      </ApiForm>
    </details>
  );
}

function UsageTrend({ daily }: { daily: Array<{ date: string; messages: number; tokens: number }> }) {
  const maxMessages = Math.max(1, ...daily.map((day) => day.messages));
  return (
    <ol className={styles.trendList}>
      {daily.map((day) => (
        <li key={day.date}>
          <span>{day.date.slice(5)}</span>
          <div className={styles.progress} aria-label={`${day.date} 有 ${day.messages} 条消息`}>
            <span style={{ width: `${Math.round((day.messages / maxMessages) * 100)}%` }} />
          </div>
          <strong>{day.messages}</strong>
        </li>
      ))}
    </ol>
  );
}

function statusToneClass(status: string) {
  const tone = voiceCloneStatusTone(status);
  if (tone === "good") return `${styles.statusPill} ${styles.statusGood}`;
  if (tone === "bad") return `${styles.statusPill} ${styles.statusBad}`;
  if (tone === "warn") return `${styles.statusPill} ${styles.statusWarn}`;
  return styles.statusPill;
}

function creatorPlanDetails(plan: CreatorPlan | null, projectCount: number) {
  if (!plan) return ["未开通套餐"];

  return [
    `${plan.planName} · ${plan.status} · ${plan.expiresAt.toISOString().slice(0, 10)} 到期`,
    `项目 ${projectCount}/${plan.maxProjects} · AI 消息 ${plan.usedAiMessages}/${plan.monthlyAiMessageLimit}`,
    `粉丝码 ${plan.usedFanCodes}/${plan.fanCodeQuota} · 存储 ${plan.usedStorageMb}/${plan.storageLimitMb} MB`,
  ];
}
