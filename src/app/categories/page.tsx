import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@clerk/nextjs/server";
import { AppHeader } from "@/components/app-header";
import { ensureDefaultCategories, getCategoriesWithCounts } from "@/db/queries";
import { AddCategoryForm } from "./add-category-form";
import { CategoryRow } from "./category-row";

export const metadata: Metadata = {
  title: "카테고리 관리 | Stock 뉴스 수집기",
};

// ui.md 8절. 헤더와 제목은 정적 셸로 먼저 보내고, 사용자별 목록은 요청 때 스트리밍한다.
export default function CategoriesPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">카테고리 관리</h1>
          <p className="break-keep text-sm text-zinc-500">
            카테고리를 삭제하면 그 카테고리의 뉴스는 미분류로 바뀝니다. 새
            카테고리는 다음에 가져오는 뉴스부터 분류에 쓰입니다.
          </p>
        </div>
        <AddCategoryForm />
        <Suspense fallback={<ListSkeleton />}>
          <CategoryList />
        </Suspense>
      </main>
    </div>
  );
}

async function CategoryList() {
  // proxy.ts의 검사와 별개로 데이터를 읽기 전에 사용자를 다시 확인한다.
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  await ensureDefaultCategories(userId);
  const { categories } = await getCategoriesWithCounts(userId);

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">
          카테고리가 없습니다.
        </p>
        <p className="break-keep text-sm text-zinc-500">
          위에서 카테고리를 추가하면 가져온 뉴스가 자동으로 분류됩니다.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {categories.map((c) => (
        <CategoryRow
          key={c.id}
          id={c.id}
          name={c.name}
          articleCount={c.articleCount}
        />
      ))}
    </ul>
  );
}

function ListSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="카테고리를 불러오는 중"
      className="h-64 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
    />
  );
}
