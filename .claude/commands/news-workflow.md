---
description: 뉴스 수집기 새 기능 개발 흐름 (main 확인 → 브랜치 생성 → 개발 → 커밋·main 병합 → 요약)
argument-hint: "[브랜치 이름]"
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git rev-parse:*), Bash(git log:*), Bash(git diff:*), Bash(git checkout:*), Bash(git switch:*)
---

# 뉴스 수집기 기능 개발 흐름

이 명령은 아래 5단계를 **순서대로** 진행한다. 각 단계에서 사용자 확인이 필요한 곳은 반드시 멈추고 답을 기다린다. 사용자에게 보이는 안내는 모두 한국어로 한다.

전달받은 인수: `$ARGUMENTS`

## 1단계: 현재 상태와 브랜치 확인

1. `git status`와 `git branch --show-current`로 현재 브랜치와 작업 트리 상태를 확인해 사용자에게 짧게 보여 준다.
2. 현재 브랜치가 `main`이 **아니면**:
   - "⚠️ 현재 브랜치는 `<브랜치>`입니다. 새 기능 브랜치는 main에서 시작해야 합니다."라고 경고한다.
   - main으로 이동할지 묻는다. 사용자가 동의하면 `git switch main`으로 이동한다. 거부하면 명령을 멈춘다.
   - 커밋하지 않은 변경이 있으면 이동 전에 알리고, 커밋·stash·중단 중 무엇을 할지 묻는다. 변경을 임의로 버리지 않는다.
3. main에 있다면 커밋하지 않은 변경이 있는지 확인하고, 있으면 알린 뒤 계속할지 묻는다.

## 2단계: 새 브랜치 만들기

- `$ARGUMENTS`가 비어 있지 **않으면** 그 값을 브랜치 이름으로 쓴다. 영어 소문자·숫자·하이픈 형식(`^[a-z0-9]+(-[a-z0-9]+)*$`)이 아니면 그 형식으로 바꾼 이름을 제안하고 확인받는다.
- `$ARGUMENTS`가 비어 **있으면** "어떤 기능을 개발하실 건가요?"라고 묻는다. 답을 받으면 영어 소문자-하이픈 형식의 브랜치 이름을 2~3개 제안한다(예: `notion-reconnect-banner`, `category-sort-order`). 사용자가 고르거나 직접 입력한 이름을 쓴다.
- 같은 이름의 브랜치가 이미 있는지 `git branch --list <이름>`으로 확인한다. 있으면 알리고 다른 이름을 받는다.
- `git switch -c <브랜치 이름>`으로 main에서 새 브랜치를 만든다.

## 3단계: 개발 시작 안내

브랜치를 만든 뒤 다음을 출력한다.

1. **"이제 개발을 시작하세요!"** (만든 브랜치 이름과 함께)
2. `CLAUDE.md`와 `AGENTS.md`를 다시 읽고, 이 프로젝트의 기술 스택과 컨벤션을 간결한 목록으로 정리해 알려 준다. 최소한 다음을 포함한다.
   - 스택: Next.js 16.4 / React 19.3(코드 작성 전 `node_modules/next/dist/docs/` 확인), Clerk 7, Drizzle + Neon HTTP, Anthropic SDK, 노션 MCP, Tailwind CSS 4(Turbopack 로더), zod 4
   - Next.js 주의점: 인증 검사는 `src/proxy.ts`, `params`·`searchParams`·`cookies()`·`headers()`는 비동기, `PageProps<"/경로">`, `cacheComponents` 켜짐(라우트에 `export const runtime` 금지)
   - Clerk 주의점: `<Show when="signed-in">`, 데이터 접근 코드마다 `auth()`로 `userId` 재확인, 경로를 읽는 Clerk 컴포넌트는 `<Suspense>`로 감싸기
   - DB 규칙: `db.transaction()` 대신 `db.batch()`, 스키마는 camelCase 필드만, 스키마 변경은 `npm run db:generate -- --name <이름>`으로 만든 마이그레이션으로만, 이미 적용된 `drizzle/*.sql`은 수정 금지, 모든 사용자 데이터는 `userId`로 제한
   - 문서: 기능 작업 전 `PRD.md` 해당 절, 화면 작업 전 `ui.md`
   - 검증: `npm run build`(기본 기준), `npm run lint`
3. 마지막에 "개발이 끝나면 **'완료'** 또는 **'done'**이라고 입력해 주세요."라고 안내하고 멈춘다.

이후 사용자가 개발을 요청하면 평소처럼 돕는다. 이 흐름은 사용자가 '완료' 또는 'done'을 입력할 때 4단계로 이어진다.

## 4단계: 커밋과 main 병합 ('완료' / 'done' 입력 시)

1. 현재 브랜치가 2단계에서 만든 기능 브랜치인지 확인한다.
2. `git status`와 `git diff --stat`(스테이징된 변경은 `git diff --cached --stat`)으로 **변경된 파일 목록**을 보여 준다. 변경이 없으면 알리고, 이미 커밋된 내용만 병합할지 묻는다.
3. `.env*`나 비밀값이 들어 있는 파일이 목록에 있으면 경고하고 커밋에서 뺀다.
4. 커밋 전에 `npm run build`(필요하면 `npm run lint`)를 돌릴지 묻고, 돌렸다면 결과를 그대로 알린다. 실패하면 커밋 전에 고칠지 묻는다.
5. 변경 내용(`git diff`)을 읽고 **커밋 메시지를 제안**한다. 이 저장소의 기존 형식(`git log --oneline -10`)을 따른다: 한국어, `영역: 무엇을 했는지` 한 줄 제목, 필요하면 본문. 메시지 끝에는 시스템이 안내한 공동 작성자(Co-Authored-By) 줄을 붙인다.
6. 사용자가 확인(또는 수정)하면:
   - 변경 파일을 이름으로 지정해 `git add` 하고 커밋한다(`git add -A`로 모르는 파일까지 넣지 않는다).
   - `git switch main` 후 `git merge --no-ff <기능 브랜치>`로 병합한다.
   - 충돌이 나면 멈추고 충돌 파일을 보여 준 뒤 어떻게 할지 묻는다. 임의로 해결하거나 `--abort`하지 않는다.
   - 원격 push와 기능 브랜치 삭제는 하지 않는다. 필요하면 5단계 끝에서 따로 묻는다.

## 5단계: 작업 요약

병합이 끝나면 다음을 정리해 보여 준다.

- 기능 브랜치 이름과 병합 커밋 해시(`git log --oneline -3`)
- 이번 작업으로 바뀐 파일과 각 파일의 변경 요지 (`git diff --stat main~1..main` 참고)
- 구현한 기능을 2~4줄로 요약
- 검증 결과(build·lint를 돌렸는지, 통과했는지)
- 남은 할 일이나 확인할 점(예: 마이그레이션 적용 `npm run db:migrate`, 실제 노션 계정 검증, `CLAUDE.md`의 '현재 상태' 갱신 필요 여부)
- 마지막으로 기능 브랜치 삭제(`git branch -d`)와 원격 push를 할지 묻는다.
