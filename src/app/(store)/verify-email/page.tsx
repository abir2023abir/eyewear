import { Suspense } from "react";
import type { Metadata } from "next";
import { VerifyEmail } from "../reset-password/ResetForms";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
