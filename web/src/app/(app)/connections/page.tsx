import { getSession } from "@/lib/auth/session";
import { PLATFORMS, PLATFORM_RULES } from "@/lib/platforms/rules";
import { PageTitle, Eyebrow } from "@/components/ui/Heading";
import { PlatformCard, type Connection } from "@/components/connections/PlatformCard";

export default async function ConnectionsPage() {
  const { brand, admin } = await getSession();
  const { data } = await admin.from("connected_accounts").select("platform, external_id, status").eq("brand_id", brand.id);
  const byPlatform = new Map((data ?? []).map((c) => [c.platform, c as Connection]));
  const native = PLATFORMS.filter((p) => PLATFORM_RULES[p].adapter === "native");
  const late = PLATFORMS.filter((p) => PLATFORM_RULES[p].adapter === "late");
  return (
    <div className="space-y-8">
      <PageTitle sub="Connect the accounts Postpilot should publish to and measure. Bluesky and Mastodon connect directly. X, TikTok, YouTube, LinkedIn, Threads and Pinterest connect through your Zernio workspace. Instagram and Facebook arrive after Meta app review.">Connections</PageTitle>
      <section>
        <Eyebrow>Native</Eyebrow>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{native.map((p) => <PlatformCard key={p} platform={p} connection={byPlatform.get(p)} />)}</div>
      </section>
      <section>
        <Eyebrow>Via Zernio</Eyebrow>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{late.map((p) => <PlatformCard key={p} platform={p} connection={byPlatform.get(p)} />)}</div>
      </section>
    </div>
  );
}
