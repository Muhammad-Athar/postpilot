import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Cookie-bound client for server components and route handlers (RLS applies). */
export async function createServerSupabase() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (all) => {
        try {
          all.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          /* called from a server component: cookies are read-only there */
        }
      },
    },
  });
}
