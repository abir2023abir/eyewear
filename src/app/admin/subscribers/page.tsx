import { db } from "@/lib/db";
import SubscriberTools, { RemoveSubscriber } from "./SubscriberTools";

export default async function Subscribers() {
  const subs = await db.subscriber.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="grid gap-5 max-w-3xl">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="h-section !text-3xl">Newsletter</h1>
          <p className="muted text-sm">{subs.length} subscribers · download the CSV to import into Mailchimp, Klaviyo, Brevo…</p>
        </div>
        <a href="/api/admin/subscribers" className="btn btn-primary">Download CSV</a>
      </div>
      <SubscriberTools />
      <div className="card">
        <table className="table">
          <thead><tr><th>Email</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.id}>
                <td>{s.email}</td>
                <td className="text-sm">{s.createdAt.toLocaleDateString()}</td>
                <td className="text-right"><RemoveSubscriber id={s.id} email={s.email} /></td>
              </tr>
            ))}
            {subs.length === 0 && <tr><td colSpan={3} className="muted">No subscribers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
