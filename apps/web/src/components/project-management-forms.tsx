import Link from "next/link";

import styles from "@/app/dashboard.module.css";
import { createTagAction, setProjectStatusAction, updateProjectAction } from "@/app/creator/projects/[projectId]/actions";
import { ActionSubmit } from "@/components/action-submit";
import { ApiForm } from "@/components/api-form";
import { FanCodeGenerator } from "@/components/fan-code-generator";
import { Live2DViewer } from "@/components/live2d-viewer";
import { ShareLinkCopyButton } from "@/components/share-link-copy-button";
import { TriggerTagTester } from "@/components/trigger-tag-tester";
import { fanCodeDisplayStatus } from "@/lib/fan-code-status";
import { type ModelAssistanceRequestView, modelAssistanceStatusText } from "@/lib/model-assistance-requests";

export type EditableProject = {
  id: string;
  name: string;
  slug: string;
  intro: string | null;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  systemPrompt: string;
  welcomeMessage: string;
  theme: string;
  status: string;
  currentModelAssetId: string | null;
  currentModelAsset: {
    id: string;
    version: number;
    validationStatus: string;
    validationErrors: unknown;
  } | null;
  triggerTags: {
    id: string;
    name: string;
    description: string | null;
    keywords: string[];
    promptFragment: string | null;
    live2dExpression: string | null;
    live2dParams: unknown;
    priority: number;
    enabled: boolean;
  }[];
  fanAccessCodes: {
    id: string;
    batchId: string;
    expiresAt: Date;
    maxMessages: number;
    usedMessages: number;
    bindMode: string;
    boundDeviceHash: string | null;
    status: string;
    createdAt: Date;
  }[];
  modelAssistanceRequests: ModelAssistanceRequestView[];
};

export function ProjectManagementForms({ project }: { project: EditableProject }) {
  const projectId = project.id;

  return (
    <div className={styles.forms}>
      <section className={styles.twoColumn} id="ws-basics">
        <section className={styles.panel}>
          <h2>项目设置</h2>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span>名称</span>
              <strong>{project.name}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>Slug</span>
              <strong>{project.slug}</strong>
            </div>
            <div className={styles.metaItem}>
              <span>主题色</span>
              <strong>{project.theme}</strong>
            </div>
          </div>
          <details className={styles.collapse}>
            <summary>编辑项目设置</summary>
            <form action={updateProjectAction.bind(null, projectId)}>
              <label>
                名称
                <input name="name" defaultValue={project.name} required />
              </label>
              <label>
                Slug
                <input name="slug" pattern="[a-z0-9-]+" defaultValue={project.slug} required />
              </label>
              <label>
                简介
                <textarea name="intro" defaultValue={project.intro ?? ""} />
              </label>
              <label>
                头像 URL
                <input name="avatarUrl" type="url" defaultValue={project.avatarUrl ?? ""} />
              </label>
              <label>
                舞台背景图 URL
                <input name="backgroundUrl" type="url" defaultValue={project.backgroundUrl ?? ""} placeholder="https://…(留空使用默认舞台光效)" />
              </label>
              <label>
                系统提示词
                <textarea name="systemPrompt" defaultValue={project.systemPrompt} required />
              </label>
              <label>
                欢迎语
                <input name="welcomeMessage" defaultValue={project.welcomeMessage} required />
              </label>
              <label>
                主题色
                <input name="theme" type="color" defaultValue={project.theme || "#ff6c9e"} required aria-label="项目主题色" />
              </label>
              <ActionSubmit>保存设置</ActionSubmit>
            </form>
          </details>
        </section>

        <div className={styles.forms}>
          <section className={styles.panel}>
            <h2>发布 / 暂停</h2>
            <span className={project.status === "published" ? `${styles.statusPill} ${styles.statusGood}` : project.status === "paused" ? `${styles.statusPill} ${styles.statusBad}` : `${styles.statusPill} ${styles.statusWarn}`}>
              {project.status}
            </span>
            <details className={styles.collapse}>
              <summary>更新状态</summary>
              <form action={setProjectStatusAction.bind(null, projectId)}>
                <label>
                  状态
                  <select name="status" defaultValue={project.status}>
                    <option value="published">上演中(published)</option>
                    <option value="paused">已暂停(paused)</option>
                    <option value="draft">草稿(draft)</option>
                  </select>
                </label>
                <ActionSubmit>更新状态</ActionSubmit>
              </form>
            </details>
            <div className={styles.nav}>
              <Link href={`/c/${project.slug}`}>观众页</Link>
              <ShareLinkCopyButton path={`/c/${project.slug}`} label="复制分享链接" />
            </div>
          </section>

        </div>
      </section>

      <section className={styles.panel} id="ws-model">
        <h2>Live2D 模型</h2>
        {project.currentModelAsset?.validationStatus === "valid" ? (
          <div className={styles.modelPreview}>
            <Live2DViewer
              modelJsonUrl={`/api/creator/projects/${projectId}/model-assets/${project.currentModelAsset.id}/preview`}
              activeTags={[]}
              activeEffects={[]}
            />
            <span className={styles.muted}>正在预览当前模型,资源受保护加载。</span>
          </div>
        ) : null}
        <details className={styles.collapse}>
          <summary>上传模型</summary>
          <ApiForm action={`/api/creator/projects/${projectId}/model-assets`} submitLabel="上传并校验模型">
            <label>
              Cubism 模型 zip
              <input name="file" type="file" accept=".zip" required />
            </label>
          </ApiForm>
        </details>
        <details className={styles.collapse}>
          <summary>请求管理员协助配置</summary>
          <ApiForm action={`/api/creator/projects/${projectId}/model-assets/assistance-requests`} submitLabel="提交协助请求">
            <label>
              备注
              <textarea name="notes" />
            </label>
          </ApiForm>
        </details>
        <h3>协助请求记录</h3>
        <ul className={styles.list}>
          {project.modelAssistanceRequests.map((request) => (
            <li className={styles.row} key={request.id}>
              <strong>{request.projectName}</strong>
              <span className={request.status === "fulfilled" ? `${styles.statusPill} ${styles.statusGood}` : `${styles.statusPill} ${styles.statusWarn}`}>
                {request.status === "fulfilled" ? "已完成" : "等待管理员处理"}
              </span>
              <span>{modelAssistanceStatusText(request)}</span>
              {request.fulfilledModelAssetId ? <span className={styles.muted}>模型已可预览和发布。</span> : null}
              {request.notes ? <span className={styles.muted}>{request.notes}</span> : null}
            </li>
          ))}
          {!project.modelAssistanceRequests.length ? <li className={styles.row}>还没有协助请求。</li> : null}
        </ul>
        <h3>当前模型记录</h3>
        <ul className={styles.list}>
          {project.currentModelAsset ? (
            <li className={styles.row} key={project.currentModelAsset.id}>
              <strong>当前模型</strong>
              <span>
                {project.currentModelAsset.validationStatus}
                {project.currentModelAsset.id === project.currentModelAssetId ? " · 当前使用" : ""}
              </span>
              {formatValidationErrors(project.currentModelAsset.validationErrors) ? <span className={styles.muted}>{formatValidationErrors(project.currentModelAsset.validationErrors)}</span> : null}
              <details className={styles.collapse}>
                <summary>删除模型记录</summary>
                <ApiForm action={`/api/creator/projects/${projectId}/model-assets/${project.currentModelAsset.id}`} method="DELETE" submitLabel="确认删除模型记录">
                  <span className={styles.muted}>删除当前模型记录。删除后项目将没有可用模型。</span>
                </ApiForm>
              </details>
            </li>
          ) : (
            <li className={styles.row}>还没有模型。</li>
          )}
        </ul>
      </section>

      <section className={styles.twoColumn} id="ws-tags">
        <section className={styles.panel}>
          <h2>触发标签</h2>
          <details className={styles.collapse}>
            <summary>新建触发标签</summary>
            <form action={createTagAction.bind(null, projectId)}>
              <label>
                名称
                <input name="name" required />
              </label>
              <label>
                关键词
                <input name="keywords" placeholder="压力,难过,陪" required />
              </label>
              <label>
                语义描述
                <input name="description" />
              </label>
              <label>
                提示词片段
                <textarea name="promptFragment" />
              </label>
              <label>
                Live2D 表情
                <input name="live2dExpression" />
              </label>
              <label>
                Live2D 参数 JSON
                <textarea name="live2dParams" placeholder='{"ParamSmile":1}' />
              </label>
              <label>
                优先级
                <input name="priority" type="number" defaultValue="0" />
              </label>
              <ActionSubmit>创建标签</ActionSubmit>
            </form>
          </details>
          <ul className={styles.list}>
            {project.triggerTags.map((tag) => (
              <li className={styles.row} key={tag.id}>
                <strong>{tag.name}</strong>
                <span className={tag.enabled ? `${styles.statusPill} ${styles.statusGood}` : styles.statusPill}>
                  {tag.enabled ? "启用" : "停用"} · 优先级 {tag.priority}
                </span>
                <span>{tag.keywords.join("、") || "无关键词"}</span>
                <details className={styles.collapse}>
                  <summary>编辑标签</summary>
                  <ApiForm action={`/api/creator/projects/${projectId}/tags/${tag.id}`} method="PATCH" submitLabel="保存标签">
                    <label>
                      名称
                      <input name="name" defaultValue={tag.name} required />
                    </label>
                    <label>
                      语义描述
                      <input name="description" defaultValue={tag.description ?? ""} />
                    </label>
                    <label>
                      关键词
                      <input name="keywords" defaultValue={tag.keywords.join(",")} />
                    </label>
                    <label>
                      提示词片段
                      <textarea name="promptFragment" defaultValue={tag.promptFragment ?? ""} />
                    </label>
                    <label>
                      Live2D 表情
                      <input name="live2dExpression" defaultValue={tag.live2dExpression ?? ""} />
                    </label>
                    <label>
                      Live2D 参数 JSON
                      <textarea name="live2dParams" defaultValue={tag.live2dParams ? JSON.stringify(tag.live2dParams) : ""} />
                    </label>
                    <label>
                      优先级
                      <input name="priority" type="number" defaultValue={tag.priority} />
                    </label>
                    <label>
                      启用状态
                      <select name="enabled" defaultValue={String(tag.enabled)}>
                        <option value="true">启用</option>
                        <option value="false">停用</option>
                      </select>
                    </label>
                  </ApiForm>
                </details>
                <details className={styles.collapse}>
                  <summary>删除标签</summary>
                  <ApiForm action={`/api/creator/projects/${projectId}/tags/${tag.id}`} method="DELETE" submitLabel="确认删除">
                    <span className={styles.muted}>删除该触发标签。</span>
                  </ApiForm>
                </details>
              </li>
            ))}
            {!project.triggerTags.length ? <li className={styles.row}>还没有触发标签。</li> : null}
          </ul>
        </section>

        <section className={styles.panel}>
          <h2>标签试运行</h2>
          <p className={styles.muted}>输入一条示例消息,查看会命中的标签与表情参数,不消耗配额。</p>
          <TriggerTagTester projectId={projectId} />
        </section>
      </section>

      <section className={styles.panel} id="ws-codes">
          <h2>粉丝访问码</h2>
          <details className={styles.collapse}>
            <summary>生成访问码</summary>
            <FanCodeGenerator projectId={projectId} />
          </details>
          <h3>最近的粉丝码</h3>
          <ul className={styles.list}>
            {project.fanAccessCodes.map((code) => (
              <li className={styles.row} key={code.id}>
                <strong>{fanCodeDisplayStatus(code)}</strong>
                <span>
                  {code.usedMessages}/{code.maxMessages} 条消息 · {code.bindMode}
                  {code.boundDeviceHash ? " · 已绑定设备" : ""} · {code.expiresAt.toISOString()} 到期
                </span>
                <span className={styles.muted}>批次 {code.batchId}</span>
                {code.status !== "revoked" ? (
                  <div className={styles.splitActions}>
                    <details className={styles.collapse}>
                      <summary>撤销此码</summary>
                      <ApiForm action={`/api/creator/fan-codes/${code.id}`} method="DELETE" submitLabel="确认撤销">
                        <span className={styles.muted}>仅停用这一个访问码。</span>
                      </ApiForm>
                    </details>
                    {code.boundDeviceHash ? (
                      <details className={styles.collapse}>
                        <summary>重置设备绑定</summary>
                        <ApiForm action={`/api/creator/fan-codes/${code.id}`} submitLabel="确认重置">
                          <span className={styles.muted}>清除已绑定的浏览器,下次成功进场时重新绑定。</span>
                        </ApiForm>
                      </details>
                    ) : null}
                    <details className={styles.collapse}>
                      <summary>撤销整个批次</summary>
                      <ApiForm action={`/api/creator/fan-codes/batches/${code.batchId}`} method="DELETE" submitLabel="确认撤销批次">
                        <span className={styles.muted}>停用该批次生成的所有访问码。</span>
                      </ApiForm>
                    </details>
                  </div>
                ) : null}
              </li>
            ))}
            {!project.fanAccessCodes.length ? <li className={styles.row}>还没有粉丝码。</li> : null}
          </ul>
      </section>
    </div>
  );
}

function formatValidationErrors(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join("; ");
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}
