import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

/** Minimal, chrome-free layout for printable / PDF report views. */
export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return <div className="min-h-screen bg-white p-6 text-black print:p-0">{children}</div>;
}
