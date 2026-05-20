import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function TicketDetailLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 h-8 w-24 animate-pulse rounded-md bg-gray-100" />
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-8 w-72 animate-pulse rounded-md bg-gray-200" />
          <div className="h-6 w-20 animate-pulse rounded-full bg-gray-100" />
          <div className="h-6 w-16 animate-pulse rounded-full bg-gray-100" />
        </div>
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-gray-100" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm ring-1 ring-black/5">
            <CardHeader className="pb-3">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-black/5">
            <CardHeader className="pb-3">
              <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-20 w-full animate-pulse rounded-lg bg-gray-50" />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-0 shadow-sm ring-1 ring-black/5">
            <CardHeader className="pb-3">
              <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
                  <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm ring-1 ring-black/5">
            <CardHeader className="pb-3">
              <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-9 w-full animate-pulse rounded-md bg-gray-100" />
              <div className="h-9 w-full animate-pulse rounded-md bg-gray-100" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
