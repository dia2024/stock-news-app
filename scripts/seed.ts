/**
 * 개발용 예제 데이터를 넣는다. 사용법: npm run db:seed -- <Clerk userId>
 *
 * 여러 번 실행해도 중복이 생기지 않는다(각 테이블의 unique 제약에 onConflictDoNothing).
 * 예제 기사 URL은 모두 https://example.com/sample/ 로 시작하므로 실제 수집 기사와 겹치지 않고,
 * 이 접두어로 한 번에 지울 수 있다.
 *
 * src/db/index.ts는 server-only라서 Next.js 밖에서 import할 수 없으므로 여기서 클라이언트를 따로 만든다.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, inArray } from "drizzle-orm";
import {
  articles,
  categories,
  userArticles,
  type NewArticle,
} from "../src/db/schema";

config({ path: ".env.local", quiet: true });

const userId = process.argv[2];
if (!userId?.startsWith("user_")) {
  console.error("사용법: npm run db:seed -- <Clerk userId(user_...)>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL이 .env.local에 없습니다.");
}

const db = drizzle({
  client: neon(process.env.DATABASE_URL),
  casing: "snake_case",
});

const DEFAULT_CATEGORIES = [
  "시장 동향",
  "기업 실적",
  "경제 지표",
  "연준·금리",
  "기술주",
];

const BASE = "https://example.com/sample";

// category: 카테고리 이름, null이면 미분류. notionPageId: 값이 있으면 '저장됨'.
type Sample = {
  article: NewArticle;
  category: string | null;
  notionPageId: string | null;
};

const SAMPLES: Sample[] = [
  {
    article: {
      url: `${BASE}/bloomberg/stocks-close-record-high`,
      source: "Bloomberg",
      publishedAt: new Date("2026-11-05T21:15:00Z"),
      originalTitle:
        "US Stocks Close at Record as Rate-Cut Bets Lift Small Caps",
      originalDescription:
        "The S&P 500 notched a fresh all-time high on Wednesday, led by a rally in small-cap shares as traders boosted wagers that the Federal Reserve will lower borrowing costs again in December.",
      titleKo: "미 증시 사상 최고치 마감… 금리 인하 기대에 소형주 강세",
      summaryKo:
        "S&P 500 지수가 수요일 사상 최고치로 마감했습니다. 연준이 12월에 금리를 추가로 내릴 것이라는 기대가 커지면서 소형주가 상승을 이끌었습니다.",
    },
    category: "시장 동향",
    notionPageId: null,
  },
  {
    article: {
      url: `${BASE}/reuters/us-cpi-october`,
      source: "Reuters",
      publishedAt: new Date("2026-11-05T13:30:00Z"),
      originalTitle:
        "US consumer prices rise 0.2% in October, core inflation cools",
      originalDescription:
        "U.S. consumer prices increased moderately in October, and underlying inflation slowed to its weakest annual pace in more than four years, the Labor Department said.",
      titleKo: "미국 10월 소비자물가 0.2% 상승… 근원 인플레이션 둔화",
      summaryKo:
        "미국의 10월 소비자물가가 소폭 올랐습니다. 노동부에 따르면 근원 인플레이션의 연간 상승률은 4년여 만에 가장 낮았습니다.",
    },
    category: "경제 지표",
    notionPageId: null,
  },
  {
    article: {
      url: `${BASE}/bloomberg/northwind-earnings-beat`,
      source: "Bloomberg",
      publishedAt: new Date("2026-11-04T20:05:00Z"),
      originalTitle:
        "Northwind Semiconductor Jumps After Data-Center Sales Top Estimates",
      originalDescription:
        "Northwind Semiconductor shares rose 9% in late trading after the chipmaker reported third-quarter revenue of $14.2 billion, beating analyst estimates on strong demand for AI accelerators.",
      titleKo: "노스윈드 반도체, 데이터센터 매출 예상 상회에 주가 급등",
      summaryKo:
        "노스윈드 반도체의 3분기 매출이 142억 달러로 시장 예상치를 넘었습니다. AI 가속기 수요가 강했던 덕분입니다. 이 소식에 주가는 시간외 거래에서 9% 올랐습니다.",
    },
    category: "기술주",
    notionPageId: "sample-notion-page-0001",
  },
  {
    article: {
      url: `${BASE}/reuters/fed-official-patience`,
      source: "Reuters",
      publishedAt: new Date("2026-11-04T18:40:00Z"),
      originalTitle: "Fed's policymaker signals patience on further rate cuts",
      originalDescription:
        "A Federal Reserve official said on Tuesday the central bank can afford to be patient before lowering rates further, citing a still-resilient labor market.",
      titleKo: '연준 위원 "추가 금리 인하는 서두르지 않아도 돼"',
      summaryKo:
        "한 연준 위원이 화요일 노동시장이 아직 견조하다며 추가 금리 인하를 서두를 필요가 없다고 말했습니다.",
    },
    category: "연준·금리",
    notionPageId: null,
  },
  {
    article: {
      url: `${BASE}/reuters/oil-opec-output`,
      source: "Reuters",
      publishedAt: new Date("2026-11-03T09:10:00Z"),
      originalTitle: "Oil slips as OPEC+ weighs output increase",
      originalDescription: null,
      titleKo: "OPEC+ 증산 검토에 유가 하락",
      summaryKo:
        "OPEC+가 산유량을 늘리는 방안을 검토한다는 소식에 국제 유가가 내렸습니다.",
    },
    category: null,
    notionPageId: null,
  },
];

async function main() {
  // 1. 카테고리와 기사 넣기. 이미 있으면 건너뛴다.
  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((name) => ({ userId, name })))
    .onConflictDoNothing();
  await db
    .insert(articles)
    .values(SAMPLES.map((s) => s.article))
    .onConflictDoNothing({ target: articles.url });

  // 2. 생성된 ID 조회
  const [userCategories, sampleArticles] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(
        and(
          eq(categories.userId, userId),
          inArray(categories.name, DEFAULT_CATEGORIES),
        ),
      ),
    db
      .select({ id: articles.id, url: articles.url })
      .from(articles)
      .where(
        inArray(
          articles.url,
          SAMPLES.map((s) => s.article.url),
        ),
      ),
  ]);
  const categoryId = new Map(userCategories.map((c) => [c.name, c.id]));
  const articleId = new Map(sampleArticles.map((a) => [a.url, a.id]));

  // 3. 사용자별 분류 연결
  await db
    .insert(userArticles)
    .values(
      SAMPLES.map((s) => ({
        userId,
        articleId: articleId.get(s.article.url)!,
        categoryId: s.category ? categoryId.get(s.category)! : null,
        notionPageId: s.notionPageId,
      })),
    )
    .onConflictDoNothing();

  console.log(
    `완료: 카테고리 ${userCategories.length}개, 기사 ${sampleArticles.length}건을 ${userId}에 연결했습니다.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
