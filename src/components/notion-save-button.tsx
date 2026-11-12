"use client";

import { useState, useTransition } from "react";
import { saveToNotion } from "@/app/dashboard/actions";

/**
 * 카드의 'news 저장' 버튼(ui.md 7절). 저장에 성공하면 서버가 목록을 새로 그려
 * 카드가 '저장됨'으로 바뀐다. 실패하면 버튼 아래에 짧은 오류 문구를 보여 준다.
 */
export function NotionSaveButton({
  articleId,
  connected,
}: {
  articleId: string;
  connected: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await saveToNotion(articleId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={!connected || isPending}
        title={connected ? undefined : "먼저 노션을 연결하세요"}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        {isPending && (
          <svg viewBox="0 0 24 24" fill="none" className="size-3.5 animate-spin" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        )}
        {isPending ? "저장 중…" : "news 저장"}
      </button>
      {error && (
        <p role="alert" className="text-right text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
