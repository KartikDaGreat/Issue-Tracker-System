import { Card, CardContent } from "@/components/ui/card";

export default function InventoryLoading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="h-8 w-40 animate-pulse rounded-md bg-gray-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-28 animate-pulse rounded-md bg-gray-100" />
          <div className="h-10 w-28 animate-pulse rounded-md bg-gray-100" />
        </div>
      </div>
      <Card className="border-0 shadow-sm ring-1 ring-black/5">
        <CardContent className="p-0">
          <div className="space-y-0 divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
                <div className="ml-auto h-4 w-16 animate-pulse rounded bg-gray-100" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
