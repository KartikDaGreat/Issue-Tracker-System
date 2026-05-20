import { Card, CardContent } from "@/components/ui/card";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-40 animate-pulse rounded-md bg-gray-200" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded-md bg-gray-100" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-md bg-gray-200" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-0 shadow-sm ring-1 ring-black/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                  <div className="mt-2 h-7 w-10 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-100" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
          <div className="h-9 w-40 animate-pulse rounded-md bg-gray-100" />
          <div className="h-9 w-48 animate-pulse rounded-md bg-gray-100" />
          <div className="h-9 w-36 animate-pulse rounded-md bg-gray-100" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-4 w-12 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
              <div className="hidden md:block h-4 w-24 animate-pulse rounded bg-gray-100" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
