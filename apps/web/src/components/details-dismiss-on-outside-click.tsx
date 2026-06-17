"use client";

import { useEffect } from "react";

// Closes any open <details> menu when the user clicks outside of it or presses Escape.
export function DetailsDismissOnOutsideClick() {
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
        if (!details.contains(target)) details.open = false;
      });
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      document.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((details) => {
        details.open = false;
      });
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
