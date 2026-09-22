import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetForm } from "./ResetForms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPassword() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
