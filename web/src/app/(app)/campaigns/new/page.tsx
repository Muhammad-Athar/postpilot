import { getSession } from "@/lib/auth/session";
import { NewCampaignForm } from "@/components/campaigns/NewCampaignForm";
import type { CampaignSettings } from "@/lib/campaigns/settings";

export default async function NewCampaignPage() {
  const { workspace } = await getSession();
  return <NewCampaignForm workspaceId={workspace.id} defaults={workspace.default_settings as Partial<CampaignSettings>} />;
}
