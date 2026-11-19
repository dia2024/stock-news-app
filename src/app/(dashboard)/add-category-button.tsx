"use client";

import { useState, useTransition } from "react";
import { addCategoryAction } from "@/app/categories/actions";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

/**
 * 탭 끝의 '+ 카테고리' 버튼(ui.md 6절).
 * 누르면 같은 자리가 입력칸으로 바뀐다. Enter로 추가, Esc나 빈 값으로 포커스를 잃으면 취소한다.
 */
export function AddCategoryButton() {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function close() {
    setEditing(false);
    setName("");
    setError(null);
  }

  function submit() {
    startTransition(async () => {
      const result = await addCategoryAction(name);
      if (result.ok) close();
      else setError(result.error);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-zinc-300 px-3.5 text-sm text-zinc-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-indigo-400 dark:hover:text-indigo-400 ${FOCUS_RING}`}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
          <path d="M10 4a1 1 0 0 1 1 1v4h4a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-4H5a1 1 0 1 1 0-2h4V5a1 1 0 0 1 1-1Z" />
        </svg>
        카테고리
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        autoFocus
        value={name}
        disabled={isPending}
        maxLength={20}
        aria-label="새 카테고리 이름"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "add-category-error" : undefined}
        placeholder="새 카테고리"
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          } else if (e.key === "Escape") {
            close();
          }
        }}
        onBlur={() => {
          if (!name.trim() && !isPending) close();
        }}
        className="h-8 w-40 rounded-full border border-zinc-300 bg-white px-3.5 text-sm text-zinc-900 outline-none focus:border-indigo-600 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-indigo-500"
      />
      {error && (
        <p
          id="add-category-error"
          className="max-w-64 text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}
