import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

// <SignUp>은 현재 경로를 읽으므로 Cache Components에서는 Suspense로 감싸야 한다.
export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Suspense>
        <SignUp />
      </Suspense>
    </main>
  );
}
