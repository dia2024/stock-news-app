import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { koKR } from "@clerk/localizations";
import { Geist, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import { InlineScript } from "@/components/inline-script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 한글 본문 글꼴(ui.md 2절). 영문·숫자는 Geist가 먼저 그리고, 한글은 이 글꼴로 넘어온다.
// 한글 글자 파일은 크므로 미리 불러오지 않고(preload: false) unicode-range로 필요한 조각만 받는다.
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  preload: false,
});

// 첫 화면을 그리기 전에 저장된 테마(없으면 시스템 설정)를 <html>에 적용해 깜빡임을 막는다.
// 키 이름과 값은 src/components/theme-toggle.tsx와 같아야 한다.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");var d=t?t==="dark":matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export const metadata: Metadata = {
  title: "AI 뉴스 수집기",
  description: "해외 주식 뉴스를 한국어로 요약해 보여 주는 수집기",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider localization={koKR}>
      <html
        lang="ko"
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansKr.variable} h-full antialiased`}
        // themeScript가 서버 HTML과 다른 class(dark)를 붙이므로 이 요소의 불일치 경고만 끈다.
        suppressHydrationWarning
      >
        <head>
          <InlineScript html={themeScript} />
        </head>
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
