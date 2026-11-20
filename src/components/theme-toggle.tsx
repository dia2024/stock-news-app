"use client";

import { useSyncExternalStore } from "react";

// 테마는 <html class="dark">로 표현하고 localStorage "theme"에 저장한다.
// 첫 적용은 layout.tsx의 themeScript가 하고, 이 버튼은 이후 전환만 맡는다.
const STORAGE_KEY = "theme";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

// 서버에서는 테마를 알 수 없으므로 라이트로 그리고, 하이드레이션 뒤 실제 값으로 바뀐다.
function getServerSnapshot() {
  return false;
}

function setTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // 저장소를 쓸 수 없어도(사생활 보호 모드 등) 현재 화면에는 적용한다.
  }
  listeners.forEach((listener) => listener());
}

export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const label = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";

  return (
    <button
      type="button"
      onClick={() => setTheme(!isDark)}
      aria-label={label}
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {isDark ? (
        // 해 아이콘: 누르면 라이트 모드
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      ) : (
        // 달 아이콘: 누르면 다크 모드
        <svg
          className="size-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
