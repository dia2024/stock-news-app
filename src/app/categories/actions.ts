"use server";

import { auth } from "@clerk/nextjs/server";
import { refresh } from "next/cache";
import { z } from "zod";
import {
  createCategory,
  deleteCategory,
  renameCategory,
  type CategoryMutationResult,
} from "@/db/queries";

export type CategoryActionResult = { ok: true } | { ok: false; error: string };

// '미분류'는 Claude 분류에서 '맞는 카테고리 없음'을 뜻하는 예약어이고, '전체'는 탭 이름이라 쓸 수 없다.
const RESERVED_NAMES = ["미분류", "전체"];

const nameSchema = z
  .string()
  .trim()
  .min(1, "카테고리 이름을 입력해 주세요.")
  .max(20, "카테고리 이름은 20자 이내로 입력해 주세요.")
  .refine((name) => !RESERVED_NAMES.includes(name), {
    message: "‘미분류’와 ‘전체’는 카테고리 이름으로 쓸 수 없습니다.",
  });

const idSchema = z.uuid();

function nameError(name: unknown) {
  const parsed = nameSchema.safeParse(name);
  return parsed.success
    ? { name: parsed.data, error: null }
    : { name: null, error: parsed.error.issues[0].message };
}

function toResult(result: CategoryMutationResult): CategoryActionResult {
  if (result.ok) {
    refresh();
    return { ok: true };
  }
  return {
    ok: false,
    error:
      result.reason === "duplicate"
        ? "이미 있는 카테고리 이름입니다."
        : "카테고리를 찾을 수 없습니다. 새로고침해 주세요.",
  };
}

const FAILED = {
  ok: false,
  error: "카테고리를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
} as const;

export async function addCategoryAction(
  rawName: string,
): Promise<CategoryActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요합니다." };

  const { name, error } = nameError(rawName);
  if (!name) return { ok: false, error: error! };

  try {
    return toResult(await createCategory(userId, name));
  } catch (err) {
    console.error("[addCategory] 실패", err);
    return FAILED;
  }
}

export async function renameCategoryAction(
  id: string,
  rawName: string,
): Promise<CategoryActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요합니다." };
  if (!idSchema.safeParse(id).success) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const { name, error } = nameError(rawName);
  if (!name) return { ok: false, error: error! };

  try {
    return toResult(await renameCategory(userId, id, name));
  } catch (err) {
    console.error("[renameCategory] 실패", err);
    return FAILED;
  }
}

export async function deleteCategoryAction(
  id: string,
): Promise<CategoryActionResult> {
  const { userId } = await auth();
  if (!userId) return { ok: false, error: "로그인이 필요합니다." };
  if (!idSchema.safeParse(id).success) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  try {
    return toResult(await deleteCategory(userId, id));
  } catch (err) {
    console.error("[deleteCategory] 실패", err);
    return {
      ok: false,
      error: "카테고리를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}
