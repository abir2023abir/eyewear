"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Post = { id?: string; slug: string; title: string; excerpt: string; body: string; published: boolean; createdAt?: string };

export default function BlogEditor({ posts }: { posts: Post[] }) {
  const [edit, setEdit] = useState<Post | null>(null);
  const [err, setErr] = useState("");
  const router = useRouter();
  const save = async () => {
    setErr("");
    const r = await fetch("/api/admin/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
    if (!r.ok) return setErr((await r.json()).error || "Failed");
    setEdit(null);
    router.refresh();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this post permanently?")) return;
    await fetch("/api/admin/posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
  };
  if (edit)
    return (
      <div className="card p-6 grid gap-3">
        <input className="input font-bold" placeholder="Title" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
        <input className="input" placeholder="url-slug (auto from title if empty)" value={edit.slug} onChange={(e) => setEdit({ ...edit, slug: e.target.value })} />
        <textarea className="textarea" rows={2} placeholder="Excerpt / meta description (≈150 characters)" value={edit.excerpt} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} />
        <textarea className="textarea font-mono text-sm" rows={18} placeholder="Body" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.published} onChange={(e) => setEdit({ ...edit, published: e.target.checked })} /> Published</label>
        {err && <p className="err">{err}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={save}>Save post</button>
          <button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
        </div>
      </div>
    );
  return (
    <div className="grid gap-4">
      <button className="btn btn-primary w-fit" onClick={() => setEdit({ slug: "", title: "", excerpt: "", body: "", published: true })}>+ New post</button>
      <div className="card">
        <table className="table">
          <thead><tr><th>Title</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {posts.map((p) => (
              <tr key={p.id}>
                <td><b>{p.title}</b><div className="text-xs muted">/blog/{p.slug}</div></td>
                <td className="text-sm">{p.createdAt?.slice(0, 10)}</td>
                <td>{p.published ? <span className="tag tag-ok">Live</span> : <span className="tag tag-light">Draft</span>}</td>
                <td className="text-right whitespace-nowrap">
                  <button className="text-[var(--blue)] font-bold text-sm mr-3" onClick={() => setEdit(p)}>Edit</button>
                  <button className="text-[var(--bad)] font-bold text-sm" onClick={() => del(p.id!)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
