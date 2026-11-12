"use client";

import { useState } from "react";

const TONES = {
  success:
    "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  error: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
};

const HOVER = {
  success: "hover:bg-emerald-100 dark:hover:bg-emerald-900/40",
  warning: "hover:bg-amber-100 dark:hover:bg-amber-900/40",
  error: "hover:bg-red-100 dark:hover:bg-red-900/40",
};

/** 툴바 아래 한 줄 알림(ui.md 9절). 닫기 버튼을 둔다. */
export function DismissibleAlert({
  tone,
  children,
}: {
  tone: keyof typeof TONES;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div
      role={tone === "success" ? "status" : "alert"}
      className={`flex items-start justify-between gap-3 rounded-lg px-4 py-3 text-sm ${TONES[tone]}`}
    >
      <p className="break-keep">{children}</p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="알림 닫기"
        className={`-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${HOVER[tone]}`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
          <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
        </svg>
      </button>
    </div>
  );
}
