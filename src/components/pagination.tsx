import Link from "next/link";

/** 현재 페이지 앞뒤로 보여 줄 번호 수 */
const SIBLINGS = 2;

const ITEM =
  "inline-flex h-8 min-w-8 items-center justify-center whitespace-nowrap rounded-lg px-2.5 text-sm tabular-nums";
const LINK = `${ITEM} border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 aria-[current=page]:border-indigo-600 aria-[current=page]:bg-indigo-600 aria-[current=page]:text-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100 dark:aria-[current=page]:border-indigo-500 dark:aria-[current=page]:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600`;
const DISABLED = `${ITEM} border border-zinc-200 text-zinc-400 opacity-50 dark:border-zinc-800 dark:text-zinc-600`;

type Props = {
  currentPage: number;
  totalPages: number;
  /** 페이지 번호로 링크 주소를 만든다. */
  hrefFor: (page: number) => string;
};

/**
 * 뉴스 목록 아래의 페이지 이동. 한 페이지뿐이면 그리지 않는다.
 * 예: 현재 50 / 전체 100 → [처음][이전] 1 … 48 49 [50] 51 52 … 100 [다음][끝]
 */
export function Pagination({ currentPage, totalPages, hrefFor }: Props) {
  if (totalPages <= 1) return null;

  const isFirst = currentPage <= 1;
  const isLast = currentPage >= totalPages;

  return (
    <nav aria-label="페이지" className="flex justify-center">
      <ul className="flex flex-wrap items-center justify-center gap-1.5">
        <NavItem label="처음" href={hrefFor(1)} disabled={isFirst} />
        <NavItem label="이전" href={hrefFor(currentPage - 1)} disabled={isFirst} />
        {pageItems(currentPage, totalPages).map((page, i) =>
          page === null ? (
            <li key={`gap-${i}`} aria-hidden className={`${ITEM} text-zinc-400`}>
              …
            </li>
          ) : (
            <li key={page}>
              <Link
                href={hrefFor(page)}
                aria-current={page === currentPage ? "page" : undefined}
                aria-label={`${page}페이지`}
                className={LINK}
              >
                {page}
              </Link>
            </li>
          ),
        )}
        <NavItem label="다음" href={hrefFor(currentPage + 1)} disabled={isLast} />
        <NavItem label="끝" href={hrefFor(totalPages)} disabled={isLast} />
      </ul>
    </nav>
  );
}

function NavItem({
  label,
  href,
  disabled,
}: {
  label: string;
  href: string;
  disabled: boolean;
}) {
  return (
    <li>
      {disabled ? (
        <span aria-disabled="true" className={DISABLED}>
          {label}
        </span>
      ) : (
        <Link href={href} className={LINK}>
          {label}
        </Link>
      )}
    </li>
  );
}

/**
 * 보여 줄 번호 목록. null은 …(건너뜀) 자리다.
 * - 첫 페이지와 마지막 페이지는 항상 넣는다.
 * - 현재 페이지 앞뒤로 SIBLINGS개씩 넣는다.
 * - 첫·마지막 페이지와 주변 번호 사이가 이어지지 않으면 …를 넣고, 이어지면 넣지 않는다.
 * - 빠진 번호가 하나뿐이면 … 대신 그 번호를 보여 준다(1 … 3 대신 1 2 3).
 */
function pageItems(current: number, total: number): (number | null)[] {
  let start = Math.max(2, current - SIBLINGS);
  let end = Math.min(total - 1, current + SIBLINGS);
  if (start === 3) start = 2;
  if (end === total - 2) end = total - 1;

  const items: (number | null)[] = [1];
  if (start > 2) items.push(null);
  for (let page = start; page <= end; page++) items.push(page);
  if (end < total - 1) items.push(null);
  if (total > 1) items.push(total);
  return items;
}
