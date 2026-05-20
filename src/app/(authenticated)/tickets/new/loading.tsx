import { Card, CardContent } from "@/components/ui/card";

export default function NewTicketLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <div className="mb-2 h-8 w-16 animate-pulse rounded-md bg-gray-100" />
        <div className="h-8 w-52 animate-pulse rounded-md bg-gray-200" />
        <div className="mt-2 h-4 w-72 animate-pulse rounded bg-gray-100" />
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5">
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <div className="h-4 w-10 animate-pulse rounded bg-gray-200" />
            <div className="h-10 w-full animate-pulse rounded-md bg-gray-100" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-24 w-full animate-pulse rounded-md bg-gray-100" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
              <div className="h-10 w-full animate-pulse rounded-md bg-gray-100" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-14 animate-pulse rounded bg-gray-200" />
              <div className="h-10 w-full animate-pulse rounded-md bg-gray-100" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
