import Link from "next/link";

import styles from "@/app/dashboard.module.css";
import { ApiForm } from "@/components/api-form";
import { FanCodeGenerator } from "@/components/fan-code-generator";
import { TriggerTagTester } from "@/components/trigger-tag-tester";
import { fanCodeDisplayStatus } from "@/lib/fan-code-status";

export type EditableProject = {
  id: string;
  name: string;
  slug: string;
  intro: string | null;
  avatarUrl: string | null;
  systemPrompt: string;
  welcomeMessage: string;
  theme: string;
  status: string;
  currentModelAssetId: string | null;
  modelAssets: {
    id: string;
    version: number;
    validationStatus: string;
    validationErrors: unknown;
    createdAt: Date;
  }[];
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
    voiceAssets: { id: string }[];
  }[];
  voiceAssets: {
    id: string;
    name: string;
    audioUrl: string;
    durationMs: number | null;
    tags: string[];
    status: string;
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
};

export function ProjectManagementForms({ project }: { project: EditableProject }) {
  const projectId = project.id;

  return (
    <div className={styles.forms}>
      <section className={styles.panel}>
        <h2>Project Settings</h2>
        <ApiForm action={`/api/creator/projects/${projectId}`} method="PATCH" submitLabel="Save project">
          <label>
            Name
            <input name="name" defaultValue={project.name} required />
          </label>
          <label>
            Slug
            <input name="slug" pattern="[a-z0-9-]+" defaultValue={project.slug} required />
          </label>
          <label>
            Intro
            <textarea name="intro" defaultValue={project.intro ?? ""} />
          </label>
          <label>
            Avatar URL
            <input name="avatarUrl" type="url" defaultValue={project.avatarUrl ?? ""} />
          </label>
          <label>
            System prompt
            <textarea name="systemPrompt" defaultValue={project.systemPrompt} required />
          </label>
          <label>
            Welcome message
            <input name="welcomeMessage" defaultValue={project.welcomeMessage} required />
          </label>
          <label>
            Theme
            <input name="theme" defaultValue={project.theme} required />
          </label>
        </ApiForm>
      </section>

      <section className={styles.panel}>
        <h2>Publish / Pause</h2>
        <ApiForm action={`/api/creator/projects/${projectId}/publish`} submitLabel="Update status">
          <label>
            Status
            <select name="status" defaultValue={project.status}>
              <option value="published">published</option>
              <option value="paused">paused</option>
              <option value="draft">draft</option>
            </select>
          </label>
        </ApiForm>
        <div className={styles.nav}>
          <Link href={`/c/${project.slug}`}>Audience page</Link>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Upload Live2D Model</h2>
        <ApiForm action={`/api/creator/projects/${projectId}/model-assets`} submitLabel="Upload and validate model">
          <label>
            Cubism model zip
            <input name="file" type="file" accept=".zip" required />
          </label>
        </ApiForm>
        <ApiForm action={`/api/creator/projects/${projectId}/model-assets/assistance-requests`} submitLabel="Request admin setup">
          <label>
            Notes
            <textarea name="notes" />
          </label>
        </ApiForm>
        <ul className={styles.list}>
          {project.modelAssets.map((asset) => (
            <li className={styles.row} key={asset.id}>
              <strong>Version {asset.version}</strong>
              <span>
                {asset.validationStatus}
                {asset.id === project.currentModelAssetId ? " · current" : ""}
              </span>
              {formatValidationErrors(asset.validationErrors) ? <span className={styles.muted}>{formatValidationErrors(asset.validationErrors)}</span> : null}
              {asset.validationStatus === "valid" && asset.id !== project.currentModelAssetId ? (
                <ApiForm action={`/api/creator/projects/${projectId}/model-assets/rollback`} submitLabel="Rollback to this model">
                  <input type="hidden" name="modelAssetId" value={asset.id} />
                </ApiForm>
              ) : null}
            </li>
          ))}
          {!project.modelAssets.length ? <li className={styles.row}>No model versions yet.</li> : null}
        </ul>
      </section>

      <section className={styles.panel}>
        <h2>Add Trigger Tag</h2>
        <ApiForm action={`/api/creator/projects/${projectId}/tags`} submitLabel="Create tag">
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Keywords
            <input name="keywords" placeholder="压力,难过,陪" required />
          </label>
          <label>
            Description
            <input name="description" />
          </label>
          <label>
            Prompt fragment
            <textarea name="promptFragment" />
          </label>
          <label>
            Live2D expression
            <input name="live2dExpression" />
          </label>
          <label>
            Live2D params JSON
            <textarea name="live2dParams" placeholder='{"ParamSmile":1}' />
          </label>
          <label>
            Priority
            <input name="priority" type="number" defaultValue="0" />
          </label>
          <label>
            Voice asset IDs
            <input name="voiceAssetIds" placeholder="voice id, voice id" />
          </label>
        </ApiForm>
      </section>

      <section className={styles.panel}>
        <h2>Edit Trigger Tags</h2>
        <TriggerTagTester projectId={projectId} />
        <ul className={styles.list}>
          {project.triggerTags.map((tag) => (
            <li className={styles.row} key={tag.id}>
              <strong>{tag.name}</strong>
              <span>{tag.keywords.join(", ") || "no keywords"}</span>
              <ApiForm action={`/api/creator/projects/${projectId}/tags/${tag.id}`} method="PATCH" submitLabel="Save tag">
                <label>
                  Name
                  <input name="name" defaultValue={tag.name} required />
                </label>
                <label>
                  Description
                  <input name="description" defaultValue={tag.description ?? ""} />
                </label>
                <label>
                  Keywords
                  <input name="keywords" defaultValue={tag.keywords.join(",")} />
                </label>
                <label>
                  Prompt fragment
                  <textarea name="promptFragment" defaultValue={tag.promptFragment ?? ""} />
                </label>
                <label>
                  Live2D expression
                  <input name="live2dExpression" defaultValue={tag.live2dExpression ?? ""} />
                </label>
                <label>
                  Live2D params JSON
                  <textarea name="live2dParams" defaultValue={tag.live2dParams ? JSON.stringify(tag.live2dParams) : ""} />
                </label>
                <label>
                  Priority
                  <input name="priority" type="number" defaultValue={tag.priority} />
                </label>
                <label>
                  Enabled
                  <select name="enabled" defaultValue={String(tag.enabled)}>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
                <label>
                  Voice asset IDs
                  <input name="voiceAssetIds" defaultValue={tag.voiceAssets.map((voice) => voice.id).join(",")} />
                </label>
              </ApiForm>
              <ApiForm action={`/api/creator/projects/${projectId}/tags/${tag.id}`} method="DELETE" submitLabel="Delete tag">
                <span className={styles.muted}>Deletes this trigger and disconnects voice bindings.</span>
              </ApiForm>
            </li>
          ))}
          {!project.triggerTags.length ? <li className={styles.row}>No trigger tags yet.</li> : null}
        </ul>
      </section>

      <section className={styles.panel}>
        <h2>Upload Voice Asset</h2>
        <ApiForm action={`/api/creator/projects/${projectId}/voice-assets`} submitLabel="Create voice asset">
          <label>
            Name
            <input name="name" required />
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
      </section>

      <section className={styles.panel}>
        <h2>Edit Voice Assets</h2>
        <ul className={styles.list}>
          {project.voiceAssets.map((voice) => (
            <li className={styles.row} key={voice.id}>
              <strong>{voice.name}</strong>
              <span>
                {voice.status} · {voice.tags.join(", ") || "no tags"}
              </span>
              <audio controls src={`/api/assets/proxy?key=${encodeURIComponent(voice.audioUrl)}`} />
              <ApiForm action={`/api/creator/projects/${projectId}/voice-assets/${voice.id}`} method="PATCH" submitLabel="Save voice">
                <label>
                  Name
                  <input name="name" defaultValue={voice.name} required />
                </label>
                <label>
                  Duration ms
                  <input name="durationMs" type="number" defaultValue={voice.durationMs ?? ""} />
                </label>
                <label>
                  Tags
                  <input name="tags" defaultValue={voice.tags.join(",")} />
                </label>
                <label>
                  Status
                  <select name="status" defaultValue={voice.status}>
                    <option value="active">active</option>
                    <option value="disabled">disabled</option>
                  </select>
                </label>
              </ApiForm>
              <ApiForm action={`/api/creator/projects/${projectId}/voice-assets/${voice.id}`} method="PATCH" submitLabel="Replace audio">
                <label>
                  WAV/MP3 file
                  <input name="file" type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" required />
                </label>
                <label>
                  Name
                  <input name="name" defaultValue={voice.name} />
                </label>
                <label>
                  Tags
                  <input name="tags" defaultValue={voice.tags.join(",")} />
                </label>
              </ApiForm>
              <ApiForm action={`/api/creator/projects/${projectId}/voice-assets/${voice.id}`} method="DELETE" submitLabel="Disable voice">
                <span className={styles.muted}>Keeps audit history and disables this voice for future matching.</span>
              </ApiForm>
            </li>
          ))}
          {!project.voiceAssets.length ? <li className={styles.row}>No voice assets yet.</li> : null}
        </ul>
      </section>

      <section className={styles.panel}>
        <h2>Generate Fan Codes</h2>
        <FanCodeGenerator projectId={projectId} />
        <h3>Recent Fan Codes</h3>
        <ul className={styles.list}>
          {project.fanAccessCodes.map((code) => (
            <li className={styles.row} key={code.id}>
              <strong>{fanCodeDisplayStatus(code)}</strong>
              <span>
                {code.usedMessages}/{code.maxMessages} messages · {code.bindMode}
                {code.boundDeviceHash ? " · bound" : ""} · expires {code.expiresAt.toISOString()}
              </span>
              <span className={styles.muted}>Batch {code.batchId}</span>
              {code.status !== "revoked" ? (
                <div className={styles.nav}>
                  <ApiForm action={`/api/creator/fan-codes/${code.id}`} method="DELETE" submitLabel="Revoke code">
                    <span className={styles.muted}>Disable only this access code.</span>
                  </ApiForm>
                  <ApiForm action={`/api/creator/fan-codes/batches/${code.batchId}`} method="DELETE" submitLabel="Revoke batch">
                    <span className={styles.muted}>Disable every access code from this batch.</span>
                  </ApiForm>
                </div>
              ) : null}
            </li>
          ))}
          {!project.fanAccessCodes.length ? <li className={styles.row}>No fan codes yet.</li> : null}
        </ul>
      </section>

      <section className={styles.panel}>
        <h2>Voice Clone Request</h2>
        <ApiForm action={`/api/creator/projects/${projectId}/clone-requests`} submitLabel="Submit request">
          <label>
            <input type="checkbox" name="authorizationConfirmed" value="true" required /> I confirm I have authorization to request voice cloning for this project.
          </label>
          <label>
            Notes
            <textarea name="notes" />
          </label>
        </ApiForm>
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
