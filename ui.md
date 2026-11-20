# UI 가이드: Stock 뉴스 수집기

이 문서는 화면을 만들 때 따르는 스타일 규칙이다. 기능 요구사항은 `PRD.md` 2절과 7절에 있고, 이 문서는 그 화면을 **어떻게 보이게 할지**만 정한다.

스타일은 Tailwind CSS 4 유틸리티 클래스로만 작성한다. 별도 CSS 파일이나 인라인 `style`은 쓰지 않는다. 공통 값은 `src/app/globals.css`의 `@theme`에 토큰으로 둔다.

## 1. 원칙

- **읽기가 먼저다.** 화면의 주인공은 한국어 제목과 요약이다. 장식, 그림자, 색은 최소로 쓰고, 여백과 글자 크기로 위계를 만든다.
- **색은 의미가 있을 때만 쓴다.** 기본은 흑백(zinc) 계열이다. 강조색(indigo)은 주요 동작과 선택 상태에만, 초록·빨강·노랑은 성공·오류·경고에만 쓴다.
- **한 화면에 주요 버튼은 하나다.** 대시보드에서는 '뉴스 가져오기'만 채워진(primary) 버튼이다. 나머지는 테두리 버튼이나 텍스트 버튼이다.
- **라이트·다크 모드를 모두 지원한다.** 처음에는 시스템 설정을 따르고, 헤더 오른쪽 위의 토글 버튼(`ThemeToggle`)으로 바꾸면 그 선택을 `localStorage`의 `theme`에 저장해 계속 쓴다. `dark:` 변형은 `<html class="dark">`로 켜진다(`globals.css`의 `@custom-variant dark`). 색 클래스를 쓸 때는 `dark:` 짝을 함께 쓴다.

## 2. 디자인 토큰

### 색

| 용도 | 라이트 | 다크 |
|---|---|---|
| 페이지 배경 | `bg-zinc-50` | `dark:bg-zinc-950` |
| 카드·헤더 배경 | `bg-white` | `dark:bg-zinc-900` |
| 테두리 | `border-zinc-200` | `dark:border-zinc-800` |
| 본문 글자 | `text-zinc-900` | `dark:text-zinc-100` |
| 보조 글자(요약) | `text-zinc-600` | `dark:text-zinc-400` |
| 메타 글자(출처·시각) | `text-zinc-500` | `dark:text-zinc-400` (zinc-900 위 zinc-500은 대비 4.5:1 미만) |
| 강조(주요 버튼, 선택 탭) | `bg-indigo-600`, `text-indigo-600` | `dark:bg-indigo-500`, `dark:text-indigo-400` |
| 성공(저장됨, 연결됨) | `text-emerald-600` | `dark:text-emerald-400` |
| 오류(수집 실패, 연결 만료) | `text-red-600`, `bg-red-50` | `dark:text-red-400`, `dark:bg-red-950/40` |
| 경고(재연결 안내) | `text-amber-700`, `bg-amber-50` | `dark:text-amber-300`, `dark:bg-amber-950/40` |

`globals.css`의 `--background`, `--foreground`는 위 페이지 배경·본문 글자 값(`zinc-50`/`zinc-950`, `zinc-900`/`zinc-100`)과 맞춘다.

### 글꼴

- 한글 가독성을 위해 본문 글꼴은 `Noto Sans KR`(`next/font/google`)을 쓰고, 영문·숫자는 기존 Geist를 앞에 둔다. `--font-sans`를 `var(--font-geist-sans), var(--font-noto-sans-kr), sans-serif` 순서로 정의한다.
- 현재 `globals.css`의 `body { font-family: Arial ... }`는 `--font-sans`를 덮어쓰므로 지운다.
- 한국어는 `break-keep`을 기본으로 써서 단어 중간에서 줄이 바뀌지 않게 한다.

| 용도 | 클래스 |
|---|---|
| 앱 이름(헤더) | `text-lg font-semibold tracking-tight` |
| 페이지 제목 | `text-xl font-semibold` |
| 카드 제목 | `text-[17px] font-semibold leading-[1.45] tracking-[-0.01em]` |
| 카드 요약·본문 | `text-sm leading-[1.7]` |
| 메타 정보·배지 | `text-xs` |
| 숫자(진행률, 시각) | `tabular-nums` 추가 |

### 간격·모양

- 기본 간격 단위는 4px(Tailwind `1`)이다. 요소 사이 간격은 `gap-2`(8px), `gap-4`(16px), `gap-6`(24px) 세 가지를 주로 쓴다.
- 모서리: 카드·패널 `rounded-xl`, 버튼·입력 `rounded-lg`, 탭·배지 `rounded-full`.
- 그림자: 카드에 `shadow-sm`만 쓴다. 호버 때도 그림자를 키우지 않고 테두리 색만 바꾼다.
- 본문 최대 폭: `max-w-6xl mx-auto px-4 sm:px-6`.

## 3. 대시보드 레이아웃 (`/`)

```
┌──────────────────────────────────────────────────────────┐
│ Stock 뉴스 수집기                   카테고리 관리  (사용자) │  ← 헤더
├──────────────────────────────────────────────────────────┤
│ [뉴스 가져오기]  ▓▓▓▓▓░░░ 12/20 처리 중   ● 노션 연결됨   │  ← 수집 툴바
│                                                          │
│ (전체) 시장 동향  기업 실적  경제 지표  연준·금리  기술주 │
│ 미분류  [+ 카테고리]                                     │  ← 카테고리 탭
│                                                          │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│ │ 뉴스 카드  │ │ 뉴스 카드  │ │ 뉴스 카드  │             │  ← 카드 그리드
│ └────────────┘ └────────────┘ └────────────┘             │
└──────────────────────────────────────────────────────────┘
```

위에서 아래로 헤더 → 수집 툴바 → 카테고리 탭 → 카드 그리드 순서다. 툴바와 탭 사이, 탭과 그리드 사이는 `gap-6`으로 띄운다.

```tsx
<div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
  <Header />
  <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
    <CollectToolbar />
    <CategoryTabs />
    <NewsGrid />
  </main>
</div>
```

## 4. 헤더

- 왼쪽에 앱 이름 'Stock 뉴스 수집기', 오른쪽에 '카테고리 관리' 링크, Clerk `<UserButton />`, 다크/라이트 전환 버튼(`ThemeToggle`, `src/components/theme-toggle.tsx`)을 이 순서로 둔다. 전환 버튼은 아이콘만 있는 버튼이라 `aria-label`로 '다크 모드로 전환'/'라이트 모드로 전환'을 단다.
- 스크롤해도 보이도록 상단에 고정한다.

```tsx
<header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
  <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
    <Link href="/" className="text-lg font-semibold tracking-tight">Stock 뉴스 수집기</Link>
    <nav className="flex items-center gap-4 text-sm">
      <Link href="/categories" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">카테고리 관리</Link>
      <UserButton />
      <ThemeToggle />
    </nav>
  </div>
</header>
```

`layout.tsx`의 `metadata.title`도 'Stock 뉴스 수집기'로 맞춘다.

### 푸터

대시보드와 `/categories`의 맨 아래에 `AppFooter`(`src/components/app-footer.tsx`)를 둔다. 로그인·회원가입 화면에는 두지 않는다.

- 내용은 한 줄: 'Copyright 2026 Stock 뉴스 수집기. Powered by Claude'. 링크나 아이콘은 넣지 않는다.
- 페이지 바깥 틀(`flex min-h-full flex-col`) 안에서 `mt-auto`로 화면 바닥에 붙인다. 뉴스가 적어도 화면 중간에 뜨지 않는다.
- 위쪽 테두리 한 줄로만 본문과 나누고 배경은 페이지 배경을 그대로 쓴다. 글자는 메타 글자 색(`text-xs text-zinc-500 dark:text-zinc-400`)이다.
- 문구는 화면 가운데에 둔다(`text-center`). 본문 폭과 관계없이 모든 화면에서 같은 모양이다.

```tsx
<footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800">
  <p className="px-4 py-6 text-center text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
    Copyright 2026 Stock 뉴스 수집기. Powered by Claude
  </p>
</footer>
```

## 5. 수집 툴바

'뉴스 가져오기' 버튼, 진행률, 노션 연결 상태를 한 줄에 둔다. 좁은 화면에서는 줄바꿈된다(`flex-wrap`).

### 뉴스 가져오기 버튼 (primary)

```tsx
<button className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400">
  뉴스 가져오기
</button>
```

- 수집 중에는 `disabled`로 두고 문구를 '가져오는 중…'으로 바꾼다. 앞에 작은 스피너(`size-4 animate-spin`)를 붙인다.

### 진행률

수집이 진행 중일 때만 보인다. 배치 응답의 처리 건수와 남은 건수로 계산한다.

```tsx
<div className="flex min-w-48 flex-1 items-center gap-3">
  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
       role="progressbar" aria-valuenow={done} aria-valuemax={total}>
    <div className="h-full rounded-full bg-indigo-600 transition-all dark:bg-indigo-500" style={{ width: `${pct}%` }} />
  </div>
  <span className="text-xs tabular-nums text-zinc-500">{done}/{total}</span>
</div>
```

진행 막대의 폭만 예외로 `style`을 쓴다.

- 끝나면 막대를 감추고 결과를 한 줄로 알린다. 예: '새 뉴스 8건을 가져왔습니다.'(`text-sm text-zinc-600`)
- 실패한 피드가 있으면 툴바 아래에 오류 알림을 둔다(9절 참고). 예: 'WSJ 피드를 읽지 못했습니다. 나머지 뉴스는 정상적으로 가져왔습니다.'

### 노션 연결 상태

툴바 오른쪽 끝(`ml-auto`)에 점과 글자로 표시한다.

| 상태 | 표시 |
|---|---|
| 연결됨 | `size-2 rounded-full bg-emerald-500` 점 + '노션 연결됨'(`text-xs text-zinc-600`) |
| 연결 안 됨 | 회색 점(`bg-zinc-400`) + '노션 연결하기' 테두리 버튼 |
| 만료됨 | 노란 점(`bg-amber-500`) + '노션 다시 연결' 테두리 버튼, 툴바 아래에 경고 알림 |

테두리 버튼(secondary):

```tsx
<a href="/api/notion/connect" className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">
  노션 연결하기
</a>
```

## 6. 카테고리 탭

뉴스 카드 목록 바로 위에 둔다. 순서는 **전체 → 사용자 카테고리(생성순) → 미분류 → [+ 카테고리]** 이다. 추가 버튼은 항상 맨 끝에 있다.

- 탭은 `?category=<id>` 검색 파라미터를 바꾸는 `<Link>`다. 전체는 파라미터 없음, 미분류는 `?category=none`.
- 현재 탭에 `aria-current="page"`를 넣고, 그 값으로 선택 스타일을 준다.
- 각 탭 옆에 기사 수를 작게 표시해도 된다(`text-xs tabular-nums opacity-70`).
- 좁은 화면에서는 줄바꿈하지 않고 가로로 스크롤한다.

```tsx
<nav aria-label="카테고리" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
  <ul className="flex w-max items-center gap-2">
    <li>
      <Link
        href="/"
        aria-current={selected === null ? "page" : undefined}
        className="inline-flex h-8 items-center whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3.5 text-sm text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 aria-[current=page]:border-indigo-600 aria-[current=page]:bg-indigo-600 aria-[current=page]:text-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:aria-[current=page]:border-indigo-500 dark:aria-[current=page]:bg-indigo-500"
      >
        전체
      </Link>
    </li>
    {/* 각 카테고리, 미분류도 같은 스타일 */}
    <li>
      <AddCategoryButton />
    </li>
  </ul>
</nav>
```

### 카테고리 추가 버튼

다른 탭과 구분되도록 점선 테두리와 `+` 아이콘을 쓴다.

```tsx
<button className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-zinc-300 px-3.5 text-sm text-zinc-500 hover:border-indigo-400 hover:text-indigo-600 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-indigo-400 dark:hover:text-indigo-400">
  <PlusIcon className="size-4" aria-hidden /> 카테고리
</button>
```

- 누르면 버튼 자리가 같은 높이의 입력칸으로 바뀐다(`h-8 w-40 rounded-full border px-3.5 text-sm`). 자동으로 포커스한다.
- Enter로 추가, Esc나 빈 값으로 포커스를 잃으면 취소한다. 추가에 성공하면 새 탭이 '미분류' 앞에 생긴다.
- 이름이 비었거나 이미 있는 이름이면 입력칸 아래에 `text-xs text-red-600`으로 이유를 보여 준다.
- 이름 수정과 삭제는 대시보드에서 하지 않고 `/categories`에서 한다.

## 7. 뉴스 카드

### 그리드

```tsx
<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

최신 발행 시각 순서로 정렬한다.

### 카드 구조

위에서 아래로 **메타 줄(출처·시각) → 제목(원문 링크) → 요약 → 하단 줄(카테고리·저장)** 이다. 먼저 "어디서, 언제" 나온 뉴스인지 읽히게 하고, 탭과 겹치는 정보인 카테고리는 아래로 내린다. 하단 줄은 `mt-auto`로 카드 바닥에 붙여, 요약 길이가 달라도 버튼 위치가 맞게 한다. 실제 구현은 `src/components/news-card.tsx`다.

간격은 `gap` 대신 요소별 여백으로 묶음을 만든다: 메타 줄 → 제목 `mt-3`, 제목 → 요약 `mt-2`(제목과 요약을 한 덩어리로 묶는다), 요약 → 하단 줄 최소 `pt-5`, 구분선 아래 `pt-4`.

```tsx
<li>
  <article className="group relative flex h-full flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-[border-color,opacity] duration-150 hover:border-zinc-300 focus-within:border-zinc-300 motion-reduce:transition-none dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:focus-within:border-zinc-700">
    <DeleteNewsButton />  {/* 오른쪽 위 X */}

    {/* 메타 줄: 출처는 진하게, 시각은 옅게. 가운뎃점 대신 간격으로 나눈다. */}
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pr-8 text-xs">
      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{source}</span>
      <time className="tabular-nums text-zinc-500 dark:text-zinc-400">{formatted}</time>
    </div>

    {/* 제목 = 원문 링크. 끝에 작은 ↗ 아이콘 */}
    <h2 className="mt-3 text-pretty break-keep text-[17px] font-semibold leading-[1.45] tracking-[-0.01em] text-zinc-900 dark:text-zinc-50">
      <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-700 hover:underline decoration-indigo-300 underline-offset-4 dark:hover:text-indigo-300">
        {titleKo} <ArrowUpRight /> <span className="sr-only">(원문, 새 탭에서 열림)</span>
      </a>
    </h2>

    {/* 요약: 한글은 줄 간격을 넉넉히(1.7) */}
    <p className="mt-2 line-clamp-4 break-keep text-sm leading-[1.7] text-zinc-600 dark:text-zinc-400">{summaryKo}</p>

    {/* 하단 줄 */}
    <div className="mt-auto pt-5">
      <div className="flex items-start justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <CategoryBadge />
        <NotionSaveButton />
      </div>
    </div>
  </article>
</li>
```

### 카드 세부 규칙

- **카테고리 배지:** 하단 줄 왼쪽에 둔다(`h-6 px-2.5 rounded-full`). 모든 카테고리가 같은 회색 배지를 쓰고, 카테고리마다 색을 다르게 하지 않는다. 미분류는 테두리만 있는 배지(`border border-dashed border-zinc-300 bg-transparent`)로 구분한다.
- **출처:** 'Bloomberg', 'WSJ', 'Investing.com'처럼 글자로만 표시한다. 로고는 쓰지 않는다.
- **발행 시각:** 24시간 이내는 상대 시각('3시간 전'), 그보다 오래되면 'MM월 DD일 HH:mm'(한국 시간)으로 표시한다. `<time>`의 `title` 속성에 전체 날짜를 넣는다.
- **번역 전:** `titleKo`가 null이면 원문 제목·설명을 보여 주고, 메타 줄에 작은 테두리 배지 '번역 전'을 붙인다.
- **제목:** 줄 수를 자르지 않는다. 요약만 `line-clamp-4`로 자른다.
- **원문 링크:** 제목 자체가 링크이며 항상 새 탭으로 연다. 별도의 '원문 보기' 링크는 두지 않는다.
- **호버·포커스:** 카드에 마우스를 올리거나 안쪽에 키보드 포커스가 있으면 테두리가 한 단계 짙어지고, 제목 끝 ↗가 오른쪽 위로 2px 움직인다. 제목 위에서는 indigo 글자와 밑줄이 생긴다. 그림자는 키우지 않고 카드를 움직이지 않는다. 모든 전환은 150ms이며 `motion-reduce:transition-none`을 붙인다.
- **삭제(X) 버튼:** 마우스가 있는 기기(`@media (hover: hover)`)에서는 카드에 호버·포커스가 있을 때만 보인다. 터치 기기에서는 항상 보인다.

### news 저장 버튼

| 상태 | 모양 |
|---|---|
| 기본 | 작은 테두리 버튼 'news 저장'(`rounded-lg border px-3 py-1.5 text-xs font-medium`, 5절 secondary 스타일) |
| 저장 중 | `disabled`, 문구 '저장 중…', 스피너 |
| 저장됨 | 버튼이 아니라 글자: 체크 아이콘 + '저장됨'(`text-xs font-medium text-emerald-600 dark:text-emerald-400`) |
| 노션 미연결·만료 | `disabled`, `title`로 '먼저 노션을 연결하세요' 안내 |
| 실패 | 기본 상태로 돌아가고 버튼 아래에 `text-xs text-red-600`으로 짧은 오류 문구 |

## 8. 카테고리 관리 화면 (`/categories`)

- 헤더 아래에 페이지 제목 '카테고리 관리'와 한 줄 설명('카테고리를 삭제하면 그 카테고리의 뉴스는 미분류로 바뀝니다.')을 둔다.
- 본문 폭은 대시보드보다 좁게 `max-w-2xl`로 한다.
- 맨 위에 추가 폼(입력칸 + primary '추가' 버튼)을 둔다.
- 목록은 하나의 카드 안에 행으로 나열한다(`divide-y divide-zinc-200 rounded-xl border bg-white`). 각 행은 `flex items-center justify-between px-4 py-3`이다.
- 행 오른쪽에 '수정'과 '삭제' 텍스트 버튼을 둔다. '삭제'는 `text-red-600`이고, 누르면 확인 대화상자('“기술주” 카테고리를 삭제할까요? 이 카테고리의 뉴스 N건은 미분류가 됩니다.')를 띄운다.
- '수정'을 누르면 그 행의 이름이 입력칸으로 바뀌고 '저장'·'취소' 버튼이 나온다.

## 9. 상태 화면

| 상황 | 표시 |
|---|---|
| 기사가 하나도 없음 | 그리드 자리에 가운데 정렬 안내: '아직 가져온 뉴스가 없습니다.' + '뉴스 가져오기' 버튼을 누르라는 보조 문구 |
| 선택한 카테고리에 기사 없음 | '이 카테고리에 분류된 뉴스가 없습니다.' |
| 첫 로딩 | 한 페이지 카드 수(9개)만큼 `NewsCardSkeleton`: 카드와 같은 틀(`rounded-xl border bg-white p-5 min-h-56 animate-pulse`) 안에 메타 줄·제목 2줄·요약 3줄·하단 줄을 회색 막대(`bg-zinc-200 dark:bg-zinc-800`)로 그린다. 목록에 `aria-busy="true"`와 `aria-label="뉴스를 불러오는 중"`을 단다. |
| 오류·경고 알림 | 툴바 아래 한 줄 박스(`rounded-lg px-4 py-3 text-sm`, 2절의 오류·경고 색). 닫기 버튼을 둔다. |

빈 상태 박스:

```tsx
<div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center dark:border-zinc-700">
  <p className="font-medium text-zinc-900 dark:text-zinc-100">아직 가져온 뉴스가 없습니다.</p>
  <p className="text-sm text-zinc-500">위의 ‘뉴스 가져오기’ 버튼을 눌러 최신 해외 증시 뉴스를 받아 보세요.</p>
</div>
```

## 10. 접근성

- 모든 버튼과 링크에 키보드 포커스 표시를 둔다: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600`.
- 아이콘만 있는 버튼에는 `aria-label`을 넣는다. 장식용 아이콘은 `aria-hidden`.
- 진행률은 `role="progressbar"`와 `aria-valuenow`/`aria-valuemax`를 쓰고, 수집 결과 문구는 `aria-live="polite"` 영역에 넣는다.
- 글자와 배경의 명도 대비는 4.5:1 이상을 지킨다. `zinc-400`보다 옅은 색은 본문 글자에 쓰지 않는다.
- 터치 대상은 최소 32px 높이(`h-8`)로 한다.

## 11. 문구 규칙

- 버튼 문구는 동사로 끝낸다: '뉴스 가져오기', '노션 연결하기', '추가'.
- 안내 문구는 '~합니다/~습니다' 체로 짧게 쓴다.
- 'Notion' 대신 '노션'으로 쓴다. 단, 카드 버튼은 PRD대로 'news 저장'으로 표시한다.
- 숫자와 단위 사이는 띄우지 않는다: '8건', '3시간 전'.
