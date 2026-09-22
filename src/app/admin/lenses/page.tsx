import { db } from "@/lib/db";
import LensEditor from "./LensEditor";

export default async function Lenses() {
  const lenses = await db.lensOption.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="grid gap-5 max-w-4xl">
      <div>
        <h1 className="h-section !text-3xl">Lens pricing</h1>
        <p className="muted text-sm">What customers can add to a frame on the product page and in “Build your order”.</p>
      </div>
      <LensEditor lenses={lenses} />
    </div>
  );
}
