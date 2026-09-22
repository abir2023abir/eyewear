import { db } from "@/lib/db";
import BlogEditor from "./BlogEditor";

export default async function AdminBlog() {
  const posts = await db.post.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="grid gap-5 max-w-5xl">
      <div>
        <h1 className="h-section !text-3xl">Blog</h1>
        <p className="muted text-sm">Write with simple formatting: blank line = new paragraph, “## ” = heading, “- ” = bullet, **bold**.</p>
      </div>
      <BlogEditor posts={posts.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() }))} />
    </div>
  );
}
