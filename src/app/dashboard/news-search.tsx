import Form from "next/form";
import Link from "next/link";
import type { SelectedCategory } from "./category-tabs";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

type Props = {
  /** 지금 적용된 검색어(?q=). 없으면 빈 문자열 */
  query: string;
  /** 지금 선택된 카테고리 탭. 검색해도 탭은 유지한다. */
  category: SelectedCategory;
};

/**
 * 뉴스 키워드 검색. '검색' 버튼이나 Enter로 제출하면 /dashboard?q=…로 이동한다(GET, 클라이언트 내비게이션).
 * 페이지 번호는 넣지 않으므로 검색하면 1페이지부터 보여 준다.
 * 주요(primary) 버튼은 '뉴스 가져오기' 하나뿐이라 '검색'은 테두리 버튼이다(ui.md 1절).
 */
export function NewsSearch({ query, category }: Props) {
  return (
    <Form action="/dashboard" role="search" className="flex w-full gap-2 sm:max-w-md">
      {category ? <input type="hidden" name="category" value={category} /> : null}
      <label htmlFor="news-search" className="sr-only">
        뉴스 검색어
      </label>
      <input
        // 주소의 검색어가 바뀌면(뒤로 가기, 검색 지우기) 입력칸도 그 값으로 다시 맞춘다.
        key={query}
        id="news-search"
        type="search"
        name="q"
        defaultValue={query}
        maxLength={100}
        placeholder="제목·요약에서 키워드 검색"
        className={`h-9 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 ${FOCUS_RING}`}
      />
      <button
        type="submit"
        className={`h-9 shrink-0 rounded-lg border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100 ${FOCUS_RING}`}
      >
        검색
      </button>
    </Form>
  );
}

/** 검색 중일 때 목록 위에 보여 주는 결과 줄: ‘엔비디아’ 검색 결과 12건 · 검색 지우기 */
export function SearchSummary({
  query,
  total,
  clearHref,
}: {
  query: string;
  total: number;
  clearHref: string;
}) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-zinc-500" aria-live="polite">
      <span>
        <span className="font-medium text-zinc-900 dark:text-zinc-100">‘{query}’</span> 검색 결과{" "}
        <span className="tabular-nums">{total}</span>건
      </span>
      <span aria-hidden>·</span>
      <Link
        href={clearHref}
        className={`rounded text-indigo-600 hover:underline dark:text-indigo-400 ${FOCUS_RING}`}
      >
        검색 지우기
      </Link>
    </p>
  );
}
