import type { NewsItem } from "@/db/queries";
import { NotionSaveButton } from "./notion-save-button";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

const absoluteFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const fullFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "full",
  timeStyle: "short",
});

// ui.md 7절: 24시간 이내는 상대 시각, 그보다 오래되면 'MM월 DD일 HH:mm'(한국 시간)
function formatPublished(date: Date, now: number) {
  const minutes = Math.floor((now - date.getTime()) / 60_000);
  if (minutes >= 0 && minutes < 24 * 60) {
    if (minutes < 1) return "방금 전";
    if (minutes < 60) return `${minutes}분 전`;
    return `${Math.floor(minutes / 60)}시간 전`;
  }
  return absoluteFormat.format(date);
}

export function NewsCard({
  item,
  now,
  notionConnected,
}: {
  item: NewsItem;
  now: number;
  notionConnected: boolean;
}) {
  const date = item.publishedAt ?? item.createdAt;
  const summary = item.summaryKo ?? item.originalDescription;

  return (
    <li>
      <article className="flex h-full flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
          {item.categoryName ? (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {item.categoryName}
            </span>
          ) : (
            <span className="rounded-full border border-dashed border-zinc-300 px-2 py-0.5 font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              미분류
            </span>
          )}
          <span>{item.source}</span>
          <span aria-hidden>·</span>
          <time
            dateTime={date.toISOString()}
            title={fullFormat.format(date)}
            className="tabular-nums"
          >
            {formatPublished(date, now)}
          </time>
        </div>

        {/* 번역 전(titleKo·summaryKo가 null)에는 임시로 원문 제목과 원문 설명을 보여 준다. */}
        <h2
          lang={item.titleKo ? undefined : "en"}
          className="break-keep text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100"
        >
          {item.titleKo ?? item.originalTitle}
        </h2>

        {summary && (
          <p
            lang={item.summaryKo ? undefined : "en"}
            className="line-clamp-4 break-keep text-sm leading-relaxed text-zinc-600 dark:text-zinc-400"
          >
            {summary}
          </p>
        )}

        <div className="mt-auto flex items-start justify-between border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded text-sm text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 ${FOCUS_RING}`}
          >
            원문 보기 <span aria-hidden>↗</span>
          </a>
          {item.notionPageId ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z"
                  clipRule="evenodd"
                />
              </svg>
              저장됨
            </span>
          ) : (
            <NotionSaveButton articleId={item.id} connected={notionConnected} />
          )}
        </div>
      </article>
    </li>
  );
}
