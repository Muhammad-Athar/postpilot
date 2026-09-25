import { Suspense } from "react";
import { getSession } from "@/lib/auth/session";
import { PageTitle } from "@/components/ui/Heading";
import { SettingsTabs } from "./SettingsTabs";
import { WorkspaceTab } from "./WorkspaceTab";
import { ProfileTab } from "./ProfileTab";
import { PasswordTab } from "./PasswordTab";
import { BrandTab } from "./BrandTab";

export default async function SettingsPage() {
  const { workspace, brand, user } = await getSession();
  const meta = (user.user_metadata ?? {}) as { display_name?: string; avatar_url?: string };
  return (
    <div>
      <PageTitle sub="Workspace mode and cadence, your profile and password, and the brand name.">Settings</PageTitle>
      <Suspense>
        <SettingsTabs panels={{
          workspace: <WorkspaceTab workspace={workspace} />,
          profile: <ProfileTab displayName={meta.display_name ?? ""} email={user.email ?? ""} avatarUrl={meta.avatar_url ?? null} />,
          password: <PasswordTab />,
          brand: <BrandTab brandId={brand.id} name={brand.name} />,
        }} />
      </Suspense>
    </div>
  );
}
