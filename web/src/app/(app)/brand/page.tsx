import { getSession } from "@/lib/auth/session";
import { brandKitSchema } from "@/lib/brand/schema";
import { PageTitle } from "@/components/ui/Heading";
import { BrandKitForm } from "./BrandKitForm";

export default async function BrandPage({ searchParams }: { searchParams: Promise<{ onboarding?: string }> }) {
  const { brand } = await getSession();
  const { onboarding } = await searchParams;
  const kit = brandKitSchema.parse(brand.kit ?? {});
  return (
    <div>
      <PageTitle sub="Everything here rides along with every prompt, so the output sounds like you and not like a model.">Brand kit</PageTitle>
      <BrandKitForm brandName={brand.name} kit={kit} bannedWords={brand.banned_words} voiceProfile={brand.voice_profile} onboarding={onboarding === "1"} />
    </div>
  );
}
