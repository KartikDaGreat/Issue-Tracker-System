import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        {/* min-w-0 is what stops a wide table from stretching the page: a
            flex item defaults to min-width:auto and will not shrink below its
            content, so the overflow escaped to the document instead of
            staying inside the table's own scroll container. */}
        <main className="min-w-0 flex-1 p-4 pb-20 md:p-8 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">
            {children}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
