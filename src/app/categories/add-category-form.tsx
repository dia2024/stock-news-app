"use client";

import { useState, useTransition } from "react";
import { addCategoryAction } from "./actions";

const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

/** 카테고리 관리 화면 맨 위의 추가 폼(입력칸 + '추가' 버튼) */
export function AddCategoryForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await addCategoryAction(name);
          if (result.ok) setName("");
          else setError(result.error);
        });
      }}
      className="flex flex-col gap-1"
    >
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          maxLength={20}
          placeholder="새 카테고리 이름"
          aria-label="새 카테고리 이름"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "add-form-error" : undefined}
          className="h-9 min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={isPending}
          className={`inline-flex items-center rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400 ${FOCUS_RING}`}
        >
          추가
        </button>
      </div>
      {error && (
        <p id="add-form-error" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
