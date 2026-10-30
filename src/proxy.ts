import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// スタッフ用の画面（/operator）を開くたびに、ログインの期限を更新する。
// スタッフかどうかの本当の確認は、src/app/operator/page.tsx で行う
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const isLoginPage = request.nextUrl.pathname === "/operator/login";
  if (!data.user && !isLoginPage) {
    return NextResponse.redirect(new URL("/operator/login", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/operator", "/operator/:path*"],
};
