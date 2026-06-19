"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { FanCodeGenerator } from "@/components/fan-code-generator";
import { Button } from "@/components/ui";

import styles from "./fan-code-generator-modal.module.css";

// "+ 生成批次" button above the list that opens the generation form in a modal.
export function FanCodeGeneratorModal({
  projectId,
  formCardClass,
  endpoint,
}: {
  projectId: string;
  formCardClass?: string;
  endpoint?: string;
}) {
  const t = useTranslations("fans");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        {t("modalOpen")}
      </Button>
      {open ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.head}>
              <h2 className={styles.title}>{t("modalTitle")}</h2>
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label={t("modalClose")}>
                ✕
              </button>
            </div>
            <div className={formCardClass}>
              <FanCodeGenerator projectId={projectId} endpoint={endpoint} onDone={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
