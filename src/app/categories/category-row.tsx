"use client";

import { useState, useTransition } from "react";
import { deleteCategoryAction, renameCategoryAction } from "./actions";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const TEXT_BUTTON = `rounded px-2 py-1 text-sm font-medium disabled:opacity-50 ${FOCUS_RING}`;

type Props = { id: string; name: string; articleCount: number };

/** 카테고리 한 행: 이름과 기사 수, '수정'·'삭제' 버튼. '수정'을 누르면 이름이 입력칸으로 바뀐다. */
export function CategoryRow({ id, name, articleCount }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const errorId = `category-error-${id}`;

  function cancel() {
    setEditing(false);
    setDraft(name);
    setError(null);
  }

  function save() {
    if (draft.trim() === name) {
      cancel();
      return;
    }
    startTransition(async () => {
      const result = await renameCategoryAction(id, draft);
      if (result.ok) setEditing(false);
      else setError(result.error);
    });
  }

  function remove() {
    const ok = window.confirm(
      `“${name}” 카테고리를 삭제할까요? 이 카테고리의 뉴스 ${articleCount}건은 미분류가 됩니다.`,
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteCategoryAction(id);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={20}
            disabled={isPending}
            aria-label={`“${name}” 새 이름`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              else if (e.key === "Escape") cancel();
            }}
            className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-indigo-500"
          />
        ) : (
          <p className="flex min-w-0 items-baseline gap-2">
            <span className="truncate font-medium">{name}</span>
            <span className="shrink-0 text-xs tabular-nums text-zinc-500">
              {articleCount}건
            </span>
          </p>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {editing ? (
            <>
              <button
                type="button"
                onClick={save}
                disabled={isPending}
                className={`${TEXT_BUTTON} text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/40`}
              >
                저장
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={isPending}
                className={`${TEXT_BUTTON} text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800`}
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={isPending}
                className={`${TEXT_BUTTON} text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800`}
              >
                수정
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={isPending}
                className={`${TEXT_BUTTON} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40`}
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>
      {error && (
        <p id={errorId} className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </li>
  );
}
