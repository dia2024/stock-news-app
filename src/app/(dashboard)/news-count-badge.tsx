import { auth } from "@clerk/nextjs/server";
import { countUserNews } from "@/db/queries";

/**
 * 수집 툴바의 뉴스 총 개수 배지: '총 20개의 뉴스'
 * 이 사용자 목록에 있는 기사 수(지운 기사 제외)이며, 카테고리 탭·검색어와 상관없이 전체 개수다.
 * 수집·삭제 Server Function이 refresh()를 부르므로 그때마다 다시 그려진다.
 */
export async function NewsCountBadge() {
  // proxy.ts의 검사와 별개로 데이터를 읽기 전에 사용자를 다시 확인한다.
  const { userId } = await auth();
  if (!userId) return null;
  const total = await countUserNews(userId);

  return (
    <span className="inline-flex h-6 items-center whitespace-nowrap rounded-full bg-zinc-100 px-2.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      총&nbsp;
      <span className="tabular-nums">{total.toLocaleString("ko-KR")}</span>
      개의 뉴스
    </span>
  );
}

/** 개수를 읽는 동안 같은 자리를 차지하는 회색 블록 */
export function NewsCountBadgeSkeleton() {
  return (
    <span
      className="inline-block h-6 w-24 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800"
      aria-hidden
    />
  );
}
