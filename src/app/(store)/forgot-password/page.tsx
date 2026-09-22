import { Suspense } from "react";
import type { Metadata } from "next";
import { ForgotForm } from "../reset-password/ResetForms";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false } };

export default function ForgotPassword() {
  return (
    <Suspense>
      <ForgotForm />
    </Suspense>
  );
}
