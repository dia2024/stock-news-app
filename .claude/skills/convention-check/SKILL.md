---
name: convention-check
description: 커밋 전 변경된 코드를 검토한다. 코딩 컨벤션 준수 여부와 코드 품질을 점검한다.
disable-model-invocation: true
allowed-tools: Bash(git *)
---

# 컨벤션 검사

## 참조 파일

- 검토 기준: [conventions.md](conventions.md)

## 스킬 내용

1. 현재 브랜치에서 변경된 코드를 가져온다.
   - `git diff main...HEAD` — 이 브랜치에서 main 이후 커밋한 변경
   - `git diff HEAD` — 아직 커밋하지 않은 변경(스테이징 포함)
   - `git ls-files --others --exclude-standard` — 새로 만든 파일(내용은 파일을 직접 읽는다)
   - 소스 코드(`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`)만 검토한다. `drizzle/*.sql`, `package-lock.json`, `.md` 파일은 건너뛴다.
2. [conventions.md](conventions.md)의 규칙을 기준으로 변경된 코드의 각 항목을 '통과' 또는 '개선 필요'로 표시한다.
3. '개선 필요' 항목이 있으면 위치(`파일:줄`)와 함께 어떻게 수정해야 하는지 코드 예시(수정 전 → 수정 후)를 보여 준다.
4. 모든 항목이 '통과'라면 `커밋 준비가 완료되었습니다!`를 출력한다.

## 출력 형식

```
## 컨벤션 검사 결과 (검토 파일 N개)

| 항목 | 결과 |
|---|---|
| 네이밍: 변수·함수 카멜 케이스 | 통과 |
| 코드 품질: console.log 제거 | 개선 필요 |
| ... | ... |

### 개선 필요

**코드 품질: console.log 제거** — `src/app/foo.ts:12`

수정 전:
    console.log("result", data);
수정 후:
    (삭제)
```

## 주의

- 이번 변경에 포함된 코드만 검토한다. 변경과 상관없는 기존 코드는 대상이 아니다.
- 검토만 한다. 코드를 직접 고치거나 커밋하지 않는다.
- 맥락을 보고 판단한다. `scripts/`의 CLI 출력용 `console.log`, 이미 `UPPER_SNAKE_CASE` 상수로 분리된 값, 프레임워크가 정한 이름(`GET`, `POST`, `proxy` 등)은 위반으로 보지 않는다.
