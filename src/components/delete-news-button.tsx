"use client";

import { useState, useTransition } from "react";
import { deleteNews } from "@/app/dashboard/actions";

/**
 * 카드 오른쪽 위의 X 버튼. 누르면 이 사용자의 목록에서 기사를 지우고, 서버가 목록을 새로 그려 카드가 사라진다.
 * 지우는 동안에는 data-deleting을 달아 카드(article의 has-[[data-deleting]])를 흐리게 한다.
 * 실패하면 버튼 아래에 짧은 오류 문구를 보여 준다.
 */
export function DeleteNewsButton({
  articleId,
  title,
}: {
  articleId: string;
  title: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await deleteNews(articleId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        data-deleting={isPending || undefined}
        aria-label={`‘${title}’ 뉴스 삭제`}
        title="뉴스 삭제"
        // 마우스가 있는 기기에서는 카드에 호버·포커스가 있을 때만 보인다(카드 article의 group). 터치 기기에서는 항상 보인다.
        // 지우는 중(disabled)에도 계속 보이게 한다.
        className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 transition-opacity duration-150 motion-reduce:transition-none [@media(hover:hover)]:[.group:not(:hover):not(:focus-within)_&:enabled]:opacity-0 hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        {isPending ? (
          <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
            <path d="M5.3 5.3a1 1 0 0 1 1.4 0L10 8.6l3.3-3.3a1 1 0 1 1 1.4 1.4L11.4 10l3.3 3.3a1 1 0 0 1-1.4 1.4L10 11.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L8.6 10 5.3 6.7a1 1 0 0 1 0-1.4Z" />
          </svg>
        )}
      </button>
      {error && (
        <p
          role="alert"
          className="rounded bg-white px-2 py-1 text-right text-xs text-red-600 shadow-sm dark:bg-zinc-900 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}
