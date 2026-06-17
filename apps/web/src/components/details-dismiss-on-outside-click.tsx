"use client";

import { useEffect } from "react";

export function DetailsDismissOnOutsideClick() {
  useEffect(() => {
    function dismissOpenDetails(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
        if (!details.contains(target)) {
          details.open = false;
        }
      });
    }

    document.addEventListener("pointerdown", dismissOpenDetails, true);
    return () => document.removeEventListener("pointerdown", dismissOpenDetails, true);
  }, []);

  return null;
}
