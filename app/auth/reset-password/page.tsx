import { ResetPasswordForm } from "@/components/account/reset-password-form";

export default function ResetPasswordPage() {
  return <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12"><section className="w-full rounded-[1.75rem] border border-almidy-border-subtle bg-white p-6 shadow-panel"><h1 className="text-3xl font-black text-slate-950">Set a new password</h1><p className="mt-2 text-sm text-slate-600">Use this page only after opening the secure link in Almidy’s reset email.</p><ResetPasswordForm /></section></main>;
}
