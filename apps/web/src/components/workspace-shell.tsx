"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Live2DViewer } from "@/components/live2d-viewer";

import styles from "./workspace-shell.module.css";

export type WorkspaceStep = { label: string; anchor: string; done: boolean };

// The creator project workspace: a persistent Live2D stage (the "performer")
// stays on the left while a step rail jumps between the module sections that
// scroll on the right. Completion comes from publish readiness.
export function WorkspaceShell({
  steps,
  modelPreviewUrl,
  children,
}: {
  steps: WorkspaceStep[];
  modelPreviewUrl?: string | null;
  children: ReactNode;
}) {
  const [active, setActive] = useState(steps[0]?.anchor ?? "");

  useEffect(() => {
    const sections = steps
      .map((step) => document.getElementById(step.anchor))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: [0.1, 0.5] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [steps]);

  function jump(anchor: string) {
    document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className={styles.workspace}>
      <aside className={styles.aside}>
        <nav className={styles.rail} aria-label="配置步骤">
          {steps.map((step, index) => (
            <button
              key={step.anchor}
              type="button"
              onClick={() => jump(step.anchor)}
              className={`${styles.step} ${active === step.anchor ? styles.stepActive : ""} ${step.done ? styles.stepDone : ""}`}
              aria-current={active === step.anchor ? "step" : undefined}
            >
              <span className={styles.stepIndex}>{step.done ? "✓" : index + 1}</span>
              <span className={styles.stepLabel}>{step.label}</span>
            </button>
          ))}
        </nav>
        <div className={`glass ${styles.stage}`} data-testid="workspace-stage">
          {modelPreviewUrl ? (
            <Live2DViewer modelJsonUrl={modelPreviewUrl} activeTags={[]} activeEffects={[]} />
          ) : (
            <div className={styles.stagePlaceholder}>
              <span>演员候场中</span>
              <small>上传有效模型后在此实时预览</small>
            </div>
          )}
        </div>
      </aside>
      <div className={styles.modules}>{children}</div>
    </div>
  );
}
