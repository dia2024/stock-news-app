import type { NewsItem } from "@/db/queries";
import { DeleteNewsButton } from "./delete-news-button";
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

/** 카드 틀. 스켈레톤과 실제 카드가 같은 여백·모서리·테두리를 쓰도록 한곳에 둔다. */
const CARD_FRAME =
  "flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

/** 로딩 중에 NewsCard 자리를 채우는 뼈대. 카드와 같은 틀과 줄 배치를 회색 막대로 그린다. */
export function NewsCardSkeleton() {
  const barColor = "bg-zinc-200 dark:bg-zinc-800";
  const bar = `rounded ${barColor}`;
  return (
    <li aria-hidden>
      <div className={`${CARD_FRAME} min-h-56 animate-pulse`}>
        {/* 메타 줄: 출처 · 시각 */}
        <div className="flex items-center gap-3">
          <div className={`h-3 w-16 ${bar}`} />
          <div className={`h-3 w-10 ${bar}`} />
        </div>
        {/* 제목 2줄 */}
        <div className="mt-3 flex flex-col gap-2">
          <div className={`h-4 w-full ${bar}`} />
          <div className={`h-4 w-3/4 ${bar}`} />
        </div>
        {/* 요약 3줄 */}
        <div className="mt-3 flex flex-col gap-2">
          <div className={`h-3 w-full ${bar}`} />
          <div className={`h-3 w-full ${bar}`} />
          <div className={`h-3 w-2/3 ${bar}`} />
        </div>
        {/* 하단 줄: 카테고리 배지 · news 저장 */}
        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <div className={`h-6 w-14 rounded-full ${barColor}`} />
          <div className={`h-8 w-20 rounded-lg ${barColor}`} />
        </div>
      </div>
    </li>
  );
}

/**
 * 뉴스 카드(ui.md 7절). 위에서 아래로 메타 줄(출처·시각) → 제목(원문 링크) → 요약 → 하단 줄(카테고리·저장)이다.
 * 제목이 곧 원문 링크다. 카드에 마우스를 올리면 테두리가 짙어지고 제목 끝의 ↗가 살짝 움직이며,
 * 마우스가 있는 기기에서는 삭제(X) 버튼이 이때 나타난다.
 */
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
  const title = item.titleKo ?? item.originalTitle;
  const translated = item.titleKo !== null;

  return (
    <li>
      {/* group: 호버·포커스를 자식(X 버튼, ↗)에 전달. 지우는 중(data-deleting)에는 카드를 흐리게 한다. */}
      <article
        className={`${CARD_FRAME} group relative transition-[border-color,opacity] duration-150 hover:border-zinc-300 focus-within:border-zinc-300 has-[[data-deleting]]:opacity-50 motion-reduce:transition-none dark:hover:border-zinc-700 dark:focus-within:border-zinc-700`}
      >
        <DeleteNewsButton articleId={item.id} title={title} />

        {/* 메타 줄. pr-8: X 버튼과 겹치지 않게 비워 둔다. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pr-8 text-xs">
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">{item.source}</span>
          <time
            dateTime={date.toISOString()}
            title={fullFormat.format(date)}
            className="tabular-nums text-zinc-500 dark:text-zinc-400"
          >
            {formatPublished(date, now)}
          </time>
          {!translated && (
            <span className="rounded-full border border-zinc-200 px-1.5 text-[11px] leading-4 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              번역 전
            </span>
          )}
        </div>

        {/* 번역 전(titleKo·summaryKo가 null)에는 임시로 원문 제목과 원문 설명을 보여 준다. */}
        <h2
          lang={translated ? undefined : "en"}
          className="mt-3 text-pretty break-keep text-[17px] font-semibold leading-[1.45] tracking-[-0.01em] text-zinc-900 dark:text-zinc-50"
        >
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-sm decoration-indigo-300 decoration-1 underline-offset-4 hover:text-indigo-700 hover:underline dark:decoration-indigo-500/60 dark:hover:text-indigo-300 ${FOCUS_RING}`}
          >
            {title}
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-1 inline-block size-3.5 -translate-y-px align-baseline text-zinc-400 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-current motion-reduce:transition-none dark:text-zinc-500"
              aria-hidden
            >
              <path d="M5 11 11 5M6 5h5v5" />
            </svg>
            <span className="sr-only"> (원문, 새 탭에서 열림)</span>
          </a>
        </h2>

        {summary && (
          <p
            lang={item.summaryKo ? undefined : "en"}
            className="mt-2 line-clamp-4 break-keep text-sm leading-[1.7] text-zinc-600 dark:text-zinc-400"
          >
            {summary}
          </p>
        )}

        {/* 하단 줄은 mt-auto로 바닥에 붙이고, pt-5 여백 안쪽에 구분선을 둔다(요약이 짧아도 선이 본문에 붙지 않게). */}
        <div className="mt-auto pt-5">
          {/* items-start: 저장 실패 문구가 버튼 아래에 붙어도 배지가 버튼 첫 줄에 맞는다. 배지는 my-1로 버튼(h-8) 높이에 맞춘다. */}
          <div className="flex items-start justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            {item.categoryName ? (
              <span className="my-1 inline-flex h-6 items-center rounded-full bg-zinc-100 px-2.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {item.categoryName}
              </span>
            ) : (
              <span className="my-1 inline-flex h-6 items-center rounded-full border border-dashed border-zinc-300 px-2.5 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                미분류
              </span>
            )}
            {item.notionPageId ? (
              <span className="inline-flex h-8 items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
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
        </div>
      </article>
    </li>
  );
}
