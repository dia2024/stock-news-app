import Link from "next/link";
import { AddCategoryButton } from "./add-category-button";

/** null = 전체, "none" = 미분류, 그 밖에는 카테고리 ID */
export type SelectedCategory = string | null;

const TAB =
  "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3.5 text-sm text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 aria-[current=page]:border-indigo-600 aria-[current=page]:bg-indigo-600 aria-[current=page]:text-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100 dark:aria-[current=page]:border-indigo-500 dark:aria-[current=page]:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

type Props = {
  categories: { id: string; name: string; articleCount: number }[];
  total: number;
  uncategorized: number;
  selected: SelectedCategory;
};

/** 카테고리 탭(ui.md 6절): 전체 → 사용자 카테고리(생성순) → 미분류 → [+ 카테고리] */
export function CategoryTabs({
  categories,
  total,
  uncategorized,
  selected,
}: Props) {
  return (
    <nav
      aria-label="카테고리"
      className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max items-center gap-2">
        <Tab href="/dashboard" label="전체" count={total} current={selected === null} />
        {categories.map((c) => (
          <Tab
            key={c.id}
            href={`/dashboard?category=${c.id}`}
            label={c.name}
            count={c.articleCount}
            current={selected === c.id}
          />
        ))}
        <Tab
          href="/dashboard?category=none"
          label="미분류"
          count={uncategorized}
          current={selected === "none"}
        />
        <li>
          <AddCategoryButton />
        </li>
      </ul>
    </nav>
  );
}

function Tab({
  href,
  label,
  count,
  current,
}: {
  href: string;
  label: string;
  count: number;
  current: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={current ? "page" : undefined}
        className={TAB}
      >
        {label}
        <span className="text-xs tabular-nums opacity-70">{count}</span>
      </Link>
    </li>
  );
}
