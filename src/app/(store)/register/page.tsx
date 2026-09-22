import { Suspense } from "react";
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";

export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default function Register() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
