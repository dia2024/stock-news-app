import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AppHeader } from "@/components/app-header";
import { NewsCard } from "@/components/news-card";
import { Pagination } from "@/components/pagination";
import {
  ensureDefaultCategories,
  getCategoriesWithCounts,
  getUserNewsPage,
  type CategoryFilter,
} from "@/db/queries";
import { CategoryTabs, type SelectedCategory } from "./category-tabs";
import { FetchNewsToolbar } from "./fetch-news-toolbar";
import {
  getCachedNotionStatus,
  NotionNotice,
  NotionStatusIndicator,
} from "./notion-status";

export const metadata: Metadata = {
  title: "대시보드 | Stock 뉴스 수집기",
};

// 이 페이지의 Server Function(fetchNews, processNewsBatch, saveToNotion) 실행 시간 상한(초).
// processNewsBatch는 Claude 호출 5건을 병렬로 기다린다.
export const maxDuration = 60;

/** 한 페이지에 보여 줄 뉴스 카드 수(3열 × 3줄) */
const PAGE_SIZE = 9;

// 헤더와 레이아웃은 정적 셸로 먼저 보내고, 사용자별 뉴스 목록은 요청 때 스트리밍한다.
// searchParams는 요청 때만 알 수 있으므로 Suspense 안의 NewsGrid에서 기다린다.
export default function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <h1 className="sr-only">최신 뉴스</h1>
        <FetchNewsToolbar
          notionStatus={
            <Suspense fallback={null}>
              <NotionStatusIndicator />
            </Suspense>
          }
        />
        <Suspense fallback={null}>
          <NotionNotice result={notionResult(searchParams)} />
        </Suspense>
        <Suspense fallback={<NewsGridSkeleton />}>
          <NewsGrid searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function NewsGrid({
  searchParams,
}: Pick<PageProps<"/dashboard">, "searchParams">) {
  // proxy.ts의 검사와 별개로 데이터를 읽기 전에 사용자를 다시 확인한다.
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const params = await searchParams;
  const page = parsePage(params.page);

  // 첫 방문이면 기본 카테고리를 만든 뒤 탭을 그린다.
  await ensureDefaultCategories(userId);
  const counts = await getCategoriesWithCounts(userId);

  const selected = parseCategory(params.category, counts.categories);
  // 지워졌거나 남의 카테고리 ID는 전체 보기로 돌려보낸다.
  if (selected === undefined) redirect(pageHref(null, 1));

  const filter: CategoryFilter =
    selected === null
      ? { kind: "all" }
      : selected === "none"
        ? { kind: "none" }
        : { kind: "category", id: selected };
  const [{ news, total, now }, notionStatus] = await Promise.all([
    loadNews(userId, page, filter),
    getCachedNotionStatus(userId),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 없는 페이지(기사가 줄었거나 주소를 직접 고친 경우)는 마지막 페이지로 보낸다.
  if (page > totalPages) redirect(pageHref(selected, totalPages));

  return (
    <div className="flex flex-col gap-6">
      <CategoryTabs
        categories={counts.categories}
        total={counts.total}
        uncategorized={counts.uncategorized}
        selected={selected}
      />
      {news.length === 0 ? (
        <EmptyState hasAnyNews={counts.total > 0} />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {news.map((item) => (
              <NewsCard
                key={item.id}
                item={item}
                now={now}
                notionConnected={notionStatus === "connected"}
              />
            ))}
          </ul>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            hrefFor={(p) => pageHref(selected, p)}
          />
        </>
      )}
    </div>
  );
}

function EmptyState({ hasAnyNews }: { hasAnyNews: boolean }) {
  if (hasAnyNews) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          이 카테고리에 분류된 뉴스가 없습니다.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">
        아직 가져온 뉴스가 없습니다.
      </p>
      <p className="break-keep text-sm text-zinc-500">
        위의 ‘뉴스 가져오기’ 버튼을 눌러 최신 해외 증시 뉴스를 받아 보세요.
      </p>
    </div>
  );
}

/** OAuth 콜백이 붙여 보낸 ?notion= 결과 */
async function notionResult(searchParams: PageProps<"/dashboard">["searchParams"]) {
  const value = (await searchParams).notion;
  return Array.isArray(value) ? value[0] : value;
}

/** ?page=N을 1 이상의 정수로 읽는다. 없거나 잘못된 값이면 1페이지다. */
function parsePage(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

/**
 * ?category=를 읽는다. null = 전체, "none" = 미분류, 그 밖에는 이 사용자의 카테고리 ID.
 * 이 사용자의 카테고리가 아니면 undefined다.
 */
function parseCategory(
  value: string | string[] | undefined,
  userCategories: { id: string }[],
): SelectedCategory | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  if (raw === "none") return "none";
  return userCategories.some((c) => c.id === raw) ? raw : undefined;
}

/** 전체·1페이지는 파라미터 없이 /dashboard로 둔다. 탭을 바꾸면 1페이지부터 보여 준다. */
function pageHref(category: SelectedCategory, page: number) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

// 상대 시각('3시간 전')의 기준은 목록을 조회한 시각이다. 렌더 중에 Date.now()를 부르지 않도록 여기서 함께 잡는다.
async function loadNews(userId: string, page: number, filter: CategoryFilter) {
  const { items, total } = await getUserNewsPage(
    userId,
    page,
    PAGE_SIZE,
    filter,
  );
  return { news: items, total, now: Date.now() };
}

function NewsGridSkeleton() {
  return (
    <ul
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
      aria-label="뉴스를 불러오는 중"
    >
      {Array.from({ length: PAGE_SIZE }, (_, i) => (
        <li
          key={i}
          className="h-56 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
        />
      ))}
    </ul>
  );
}
