import React from "react";
import { cx } from "./ui";

/** Marca visual: semilla + brote (no texto “G”). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      className={cx("h-full w-full", className)}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M16 6c-4 4-5.5 9-4 13.5 1.2 3.6 4 6.5 4 6.5s2.8-2.9 4-6.5C21.5 15 20 10 16 6Z"
        fill="currentColor"
        fillOpacity={0.95}
      />
      <path
        d="M16 14v8M12 17c1.2 2.2 3 3.5 4 4M20 17c-1.2 2.2-3 3.5-4 4"
        stroke="currentColor"
        strokeWidth={1.35}
        strokeLinecap="round"
        strokeOpacity={0.45}
      />
    </svg>
  );
}

export function BrandLogoBlock({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  return (
    <div
      className={cx(
        box,
        "grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-sm ring-1 ring-brand-700/20"
      )}
    >
      <div className={size === "sm" ? "h-5 w-5" : "h-6 w-6"}>
        <BrandMark />
      </div>
    </div>
  );
}
