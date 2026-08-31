import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import ReportsClient from "./ReportsClient";

export const metadata = {
  title: "Reports · KVMHSS Ticket Tracker",
};

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "PRINCIPAL") redirect("/dashboard");

  return <ReportsClient />;
}
