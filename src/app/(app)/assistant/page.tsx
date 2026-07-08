import { PageHeader } from "@/components/page-header";
import { AssistantChat } from "@/components/assistant-chat";
import { isAiEnabled } from "@/lib/ai/config";
import { getAvailablePeriods, getLatestPeriod } from "@/lib/analytics";
import { getI18n } from "@/i18n/server";

export const dynamic = "force-dynamic";

/**
 * «مساعد الإدارة الذكي» — Arabic-first management Q&A over the already
 * calculated budget figures. The page only passes a boolean aiEnabled flag to
 * the client; the NVIDIA key never leaves the server.
 */
export default async function AssistantPage() {
  const { dict } = await getI18n();
  const t = dict.assistant;

  const periods = await getAvailablePeriods();
  const latest = await getLatestPeriod();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.title} description={t.description} />
      <AssistantChat
        aiEnabled={isAiEnabled()}
        availablePeriods={periods}
        defaultMonth={latest?.month ?? new Date().getMonth() + 1}
        defaultYear={latest?.year ?? new Date().getFullYear()}
      />
    </div>
  );
}
