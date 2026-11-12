"use client";

import { useState, useTransition } from "react";
import { fetchNews, processNewsBatch } from "./actions";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

type Progress = { done: number; total: number };

/** 수집 툴바(ui.md 5절): '뉴스 가져오기' 버튼, 진행률, 결과 문구, 실패 알림 */
export function FetchNewsToolbar() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);

  function handleClick() {
    setStatus(null);
    setAlerts([]);
    setProgress(null);
    startTransition(async () => {
      const fetched = await fetchNews();
      if (!fetched.ok) {
        setAlerts([fetched.error]);
        return;
      }
      const nextAlerts: string[] = [];
      if (fetched.failedFeeds.length > 0) {
        nextAlerts.push(
          `${fetched.failedFeeds.join(", ")} 피드를 읽지 못했습니다. 나머지 뉴스는 정상적으로 가져왔습니다.`,
        );
      }

      // 남은 건이 0이 될 때까지 배치를 반복 호출한다(Vercel 실행 시간 제한 때문).
      // 실패한 기사는 skipIds로 넘겨 이번 실행에서는 다시 고르지 않는다.
      const total = fetched.remaining;
      const skipIds: string[] = [];
      let processed = 0;
      let remaining = total;
      let stopError: string | null = null;
      if (total > 0) setProgress({ done: 0, total });

      while (remaining > 0) {
        const batch = await processNewsBatch(skipIds);
        if (!batch.ok) {
          stopError = batch.error;
          break;
        }
        processed += batch.processed;
        skipIds.push(...batch.failedIds);
        remaining = batch.remaining;
        setProgress({ done: processed + skipIds.length, total });
        // 한 건도 처리하지 못한 배치는 API 키·한도 같은 공통 문제일 가능성이 커서 멈춘다.
        if (batch.processed === 0 && batch.failedIds.length > 0) {
          stopError = "뉴스를 번역·분류하지 못했습니다. 잠시 후 다시 시도해 주세요.";
          break;
        }
      }
      setProgress(null);

      if (stopError) {
        nextAlerts.push(
          `${stopError} 처리하지 못한 뉴스는 다시 누르면 이어서 처리합니다.`,
        );
      } else if (skipIds.length > 0) {
        nextAlerts.push(
          `뉴스 ${skipIds.length}건은 번역·분류하지 못했습니다. 다시 누르면 재시도합니다.`,
        );
      }

      if (fetched.linked > 0) {
        setStatus(`새 뉴스 ${fetched.linked}건을 가져왔습니다.`);
      } else if (processed > 0) {
        setStatus(`대기 중이던 뉴스 ${processed}건을 번역·분류했습니다.`);
      } else {
        setStatus("새로 가져온 뉴스가 없습니다.");
      }
      setAlerts(nextAlerts);
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
        {progress && <ProgressBar {...progress} />}
        <p aria-live="polite" className="text-sm text-zinc-600 dark:text-zinc-400">
          {status}
        </p>
      </div>

      {alerts.map((message, i) => (
        <div
          key={message}
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400"
        >
          <p className="break-keep">{message}</p>
          <button
            type="button"
            onClick={() => setAlerts((prev) => prev.filter((_, j) => j !== i))}
            aria-label="알림 닫기"
            className={`-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/40 ${FOCUS_RING}`}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
              <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/** 번역·분류 진행률(ui.md 5절). 진행 막대의 폭만 style을 쓴다. */
function ProgressBar({ done, total }: Progress) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex min-w-48 flex-1 items-center gap-3">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-label="뉴스 번역·분류 진행률"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <div
          className="h-full rounded-full bg-indigo-600 transition-all dark:bg-indigo-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-zinc-500">
        {done}/{total}
      </span>
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
