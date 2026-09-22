import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-x py-24 text-center">
      <div className="eyebrow">404</div>
      <h1 className="h-section mt-2">We couldn’t find that page.</h1>
      <p className="lead mt-3">It may have moved, or the frame may no longer be available.</p>
      <div className="flex justify-center gap-3 mt-8">
        <Link href="/shop" className="btn btn-primary">Browse frames</Link>
        <Link href="/" className="btn btn-outline">Home</Link>
      </div>
    </div>
  );
}
