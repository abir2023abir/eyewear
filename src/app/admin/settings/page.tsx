import { getSession } from "@/lib/auth";
import { forAdmin, getSettings } from "@/lib/settings";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const [data, s] = await Promise.all([getSettings().then(forAdmin), getSession()]);
  return (
    <div className="grid gap-5 max-w-5xl">
      <div>
        <h1 className="h-section !text-3xl">Store settings</h1>
        <p className="muted text-sm">Everything here updates the live website immediately — no code changes needed.</p>
      </div>
      <SettingsClient initial={data.settings} secretState={data.secretState} myEmail={s?.email || ""} />
    </div>
  );
}
