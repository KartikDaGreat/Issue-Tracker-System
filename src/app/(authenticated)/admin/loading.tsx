import { Card } from "@/components/ui/card";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-36 animate-pulse rounded-md bg-gray-200" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded-md bg-gray-100" />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-md bg-gray-200" />
      </div>

      <div className="flex gap-1 border-b">
        <div className="h-9 w-36 animate-pulse rounded-t-md bg-gray-100" />
        <div className="h-9 w-36 animate-pulse rounded-t-md bg-gray-100" />
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5 overflow-hidden">
        <div className="p-4 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-44 animate-pulse rounded bg-gray-100" />
              </div>
              <div className="hidden sm:block h-5 w-20 animate-pulse rounded-full bg-gray-100" />
              <div className="h-5 w-14 animate-pulse rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
