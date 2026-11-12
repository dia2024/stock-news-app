import { cache } from "react";
import { auth } from "@clerk/nextjs/server";
import { getNotionStatus } from "@/db/notion-queries";
import { DismissibleAlert } from "./dismissible-alert";

/** 한 요청 안에서 툴바·알림·카드가 같은 조회를 나눠 쓴다. */
export const getCachedNotionStatus = cache(getNotionStatus);

const SECONDARY_BUTTON =
  "inline-flex h-8 items-center rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

/** 툴바 오른쪽 끝의 노션 연결 상태(ui.md 5절) */
export async function NotionStatusIndicator() {
  const { userId } = await auth();
  if (!userId) return null;
  const status = await getCachedNotionStatus(userId);

  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
        노션 연결됨
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`size-2 rounded-full ${status === "expired" ? "bg-amber-500" : "bg-zinc-400"}`}
        aria-hidden
      />
      {/* OAuth 리디렉션이라 Link가 아니라 a를 쓴다. */}
      <a href="/api/notion/connect" className={SECONDARY_BUTTON}>
        {status === "expired" ? "노션 다시 연결" : "노션 연결하기"}
      </a>
    </span>
  );
}

/**
 * 툴바 아래 알림: OAuth 콜백 결과(?notion=connected|denied|error)와 연결 만료 경고.
 */
export async function NotionNotice({
  result,
}: {
  result: Promise<string | undefined>;
}) {
  const { userId } = await auth();
  if (!userId) return null;
  const [status, notion] = await Promise.all([
    getCachedNotionStatus(userId),
    result,
  ]);

  if (notion === "connected" && status === "connected") {
    return (
      <DismissibleAlert tone="success">
        노션이 연결되었습니다. 카드의 ‘news 저장’ 버튼으로 뉴스를 저장할 수 있습니다.
      </DismissibleAlert>
    );
  }
  if (notion === "denied") {
    return <DismissibleAlert tone="warning">노션 연결을 취소했습니다.</DismissibleAlert>;
  }
  if (notion === "error") {
    return (
      <DismissibleAlert tone="error">
        노션을 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.
      </DismissibleAlert>
    );
  }
  if (status === "expired") {
    return (
      <DismissibleAlert tone="warning">
        노션 연결이 만료되었습니다. ‘노션 다시 연결’을 눌러 다시 연결해 주세요.
      </DismissibleAlert>
    );
  }
  return null;
}
