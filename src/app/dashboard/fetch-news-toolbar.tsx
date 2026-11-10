"use client";

import { useState, useTransition } from "react";
import { fetchNews } from "./actions";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

type Alert = { message: string };

/** 수집 툴바(ui.md 5절): '뉴스 가져오기' 버튼, 결과 문구, 실패 알림 */
export function FetchNewsToolbar() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [alert, setAlert] = useState<Alert | null>(null);

  function handleClick() {
    setStatus(null);
    setAlert(null);
    startTransition(async () => {
      const result = await fetchNews();
      if (!result.ok) {
        setAlert({ message: result.error });
        return;
      }
      setStatus(
        result.linked > 0
          ? `새 뉴스 ${result.linked}건을 가져왔습니다.`
          : "새로 가져온 뉴스가 없습니다.",
      );
      if (result.failedFeeds.length > 0) {
        setAlert({
          message: `${result.failedFeeds.join(", ")} 피드를 읽지 못했습니다. 나머지 뉴스는 정상적으로 가져왔습니다.`,
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleClick}
          disabled={isPending}
          className={`inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400 ${FOCUS_RING}`}
        >
          {isPending && <Spinner />}
          {isPending ? "가져오는 중…" : "뉴스 가져오기"}
        </button>
        <p aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
          {status}
        </p>
      </div>

      {alert && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400"
        >
          <p className="break-keep">{alert.message}</p>
          <button
            type="button"
            onClick={() => setAlert(null)}
            aria-label="알림 닫기"
            className={`-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/40 ${FOCUS_RING}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
              <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
