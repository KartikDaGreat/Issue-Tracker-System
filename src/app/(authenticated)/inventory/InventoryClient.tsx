"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  isActive: boolean;
  updatedAt: string;
  category: { id: string; name: string };
  quantityAvailable: number;
}

interface Category {
  id: string;
  name: string;
  _count: { items: number };
}

interface LogEntry {
  id: string;
  action: string;
  quantity: number;
  details: string;
  date: string;
  createdAt: string;
  loggedBy: { id: string; name: string };
}

interface Props {
  items: InventoryItem[];
  categories: Category[];
  role: string;
}

export default function InventoryClient({ items, categories, role }: Props) {
  const router = useRouter();
  const isAdmin = role === "ADMIN";

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Add item dialog
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  // Log dialog
  const [logOpen, setLogOpen] = useState(false);
  const [logItemId, setLogItemId] = useState("");
  const [logAction, setLogAction] = useState("PURCHASED");
  const [logQuantity, setLogQuantity] = useState("");
  const [logDetails, setLogDetails] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split("T")[0]);
  const [submittingLog, setSubmittingLog] = useState(false);

  // History dialog
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [historyLogs, setHistoryLogs] = useState<LogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Category management dialog
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // Report dialog
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPdfUrl, setReportPdfUrl] = useState<string | null>(null);
  const [reportPdfBlob, setReportPdfBlob] = useState<Blob | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [uploadingToDrive, setUploadingToDrive] = useState(false);

  const filteredItems =
    categoryFilter === "all"
      ? items
      : items.filter((i) => i.category.id === categoryFilter);

  async function handleAddItem() {
    if (!newCode || !newName || !newCategory || !newUnit) return;
    setAddingItem(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode,
          name: newName,
          categoryId: newCategory,
          unit: newUnit,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to add item");
        return;
      }
      toast.success("Item added");
      setAddItemOpen(false);
      setNewCode("");
      setNewName("");
      setNewCategory("");
      setNewUnit("");
      router.refresh();
    } finally {
      setAddingItem(false);
    }
  }

  function openLogDialog(itemId: string) {
    setLogItemId(itemId);
    setLogAction("PURCHASED");
    setLogQuantity("");
    setLogDetails("");
    setLogDate(new Date().toISOString().split("T")[0]);
    setLogOpen(true);
  }

  async function handleSubmitLog() {
    if (!logQuantity || !logDetails || !logDate) return;
    setSubmittingLog(true);
    try {
      const res = await fetch(`/api/inventory/${logItemId}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: logAction,
          quantity: parseInt(logQuantity),
          details: logDetails,
          date: logDate,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to log entry");
        return;
      }
      toast.success("Log entry added");
      setLogOpen(false);
      router.refresh();
    } finally {
      setSubmittingLog(false);
    }
  }

  async function openHistory(item: InventoryItem) {
    setHistoryItem(item);
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/inventory/${item.id}/logs`);
      const data = await res.json();
      setHistoryLogs(data);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleDeactivate(itemId: string) {
    const res = await fetch(`/api/inventory/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    if (!res.ok) {
      toast.error("Failed to deactivate item");
      return;
    }
    toast.success("Item deactivated");
    router.refresh();
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      const res = await fetch("/api/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to add category");
        return;
      }
      toast.success("Category added");
      setNewCategoryName("");
      router.refresh();
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleDeleteCategory(catId: string) {
    const res = await fetch(`/api/inventory/categories/${catId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to delete category");
      return;
    }
    toast.success("Category deleted");
    router.refresh();
  }

  async function openReport() {
    setReportOpen(true);
    setLoadingReport(true);
    setReportPdfUrl(null);
    setReportPdfBlob(null);
    try {
      const res = await fetch("/api/inventory/report");
      if (!res.ok) {
        toast.error("Failed to generate report");
        setReportOpen(false);
        return;
      }
      const blob = await res.blob();
      setReportPdfBlob(blob);
      setReportPdfUrl(URL.createObjectURL(blob));
    } finally {
      setLoadingReport(false);
    }
  }

  function handleCloseReport(open: boolean) {
    if (!open && reportPdfUrl) {
      URL.revokeObjectURL(reportPdfUrl);
      setReportPdfUrl(null);
      setReportPdfBlob(null);
    }
    setReportOpen(open);

  }

  function handleLocalDownload() {
    if (!reportPdfUrl) return;
    const dateStr = new Date().toISOString().split("T")[0];
    const a = document.createElement("a");
    a.href = reportPdfUrl;
    a.download = `inventory-report-${dateStr}.pdf`;
    a.click();

    toast.success("Report downloaded");
  }

  async function handleDriveUpload() {
    setUploadingToDrive(true);

    try {
      const res = await fetch("/api/inventory/report/drive", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Failed to upload to Google Drive");
        return;
      }
      const data = await res.json();
      toast.success(`Uploaded to Google Drive: ${data.name}`, {
        action: data.link ? { label: "Open", onClick: () => window.open(data.link, "_blank") } : undefined,
      });
    } finally {
      setUploadingToDrive(false);
    }
  }

  const actionColor: Record<string, string> = {
    PURCHASED: "bg-green-100 text-green-800",
    USED: "bg-blue-100 text-blue-800",
    BROKEN: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage school inventory items and stock levels
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={openReport} className="gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
              Generate Report
            </Button>
          )}
          <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
            Categories
          </Button>
          <Button onClick={() => setAddItemOpen(true)} className="gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            Add Item
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <span className="text-sm font-medium text-gray-700">Category:</span>
          <Select
            value={categoryFilter}
            onValueChange={(v) => v && setCategoryFilter(v)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Categories">
                {categoryFilter === "all"
                  ? "All Categories"
                  : categories.find((c) => c.id === categoryFilter)?.name ?? "All Categories"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            </div>
            <p className="mt-4 text-sm font-medium text-gray-900">No items found</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first inventory item to get started.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow
                  key={item.id}
                  className={
                    item.quantityAvailable <= 0
                      ? "bg-red-50/50"
                      : item.quantityAvailable <= 5
                      ? "bg-amber-50/50"
                      : ""
                  }
                >
                  <TableCell className="font-mono text-xs font-medium">
                    {item.code}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => openHistory(item)}
                      className="text-left font-medium text-primary hover:underline"
                    >
                      {item.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {item.category.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        item.quantityAvailable <= 0
                          ? "font-bold text-red-600"
                          : item.quantityAvailable <= 5
                          ? "font-semibold text-amber-600"
                          : "font-medium"
                      }
                    >
                      {item.quantityAvailable}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.unit}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openLogDialog(item.id)}
                      >
                        Log
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeactivate(item.id)}
                        >
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Add Item Dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>Add a new item to track in inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Item Code</Label>
              <Input
                id="code"
                placeholder="e.g. LAB-MICRO-001"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g. Microscope"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newCategory} onValueChange={(v) => v && setNewCategory(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category">
                    {newCategory
                      ? categories.find((c) => c.id === newCategory)?.name ?? "Select category"
                      : "Select category"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                placeholder="e.g. pieces, boxes, sets"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddItem}
              disabled={addingItem || !newCode || !newName || !newCategory || !newUnit}
            >
              {addingItem ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Inventory Entry</DialogTitle>
            <DialogDescription>Record a purchase, usage, or breakage.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={logAction} onValueChange={(v) => v && setLogAction(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PURCHASED">Purchased</SelectItem>
                  <SelectItem value="USED">Used</SelectItem>
                  <SelectItem value="BROKEN">Broken</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                placeholder="Enter quantity"
                value={logQuantity}
                onChange={(e) => setLogQuantity(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="details">Details</Label>
              <Textarea
                id="details"
                placeholder="What was purchased, why it was used, how it broke..."
                value={logDetails}
                onChange={(e) => setLogDetails(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logDate">Date</Label>
              <Input
                id="logDate"
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSubmitLog}
              disabled={submittingLog || !logQuantity || !logDetails || !logDate}
            >
              {submittingLog ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {historyItem?.name}{" "}
              <span className="text-xs font-mono text-muted-foreground">
                ({historyItem?.code})
              </span>
            </DialogTitle>
            <DialogDescription>
              Stock: {historyItem?.quantityAvailable} {historyItem?.unit}
            </DialogDescription>
          </DialogHeader>
          {loadingHistory ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
              ))}
            </div>
          ) : historyLogs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No log entries yet.
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Logged By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        {new Date(log.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            actionColor[log.action] || ""
                          }`}
                        >
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {log.action === "PURCHASED" ? "+" : "-"}
                        {log.quantity}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {log.details}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.loggedBy.name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>Add{isAdmin ? " or delete" : ""} inventory categories.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="New category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
              />
              <Button
                onClick={handleAddCategory}
                disabled={addingCategory || !newCategoryName.trim()}
                size="sm"
              >
                Add
              </Button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-gray-50"
                >
                  <div>
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({c._count.items} items)
                    </span>
                  </div>
                  {isAdmin && c._count.items === 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                      onClick={() => handleDeleteCategory(c.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Inventory Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={handleCloseReport}>
        <DialogContent className="sm:max-w-4xl h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Inventory Report</DialogTitle>
                <DialogDescription>Usage and trend summary for all inventory items.</DialogDescription>
              </div>
              {reportPdfUrl && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleLocalDownload}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                    Save to device
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleDriveUpload}
                    disabled={uploadingToDrive}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
                    {uploadingToDrive ? "Uploading..." : "Save to Drive"}
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          {loadingReport ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Generating report...</p>
              </div>
            </div>
          ) : reportPdfUrl ? (
            <iframe
              src={reportPdfUrl}
              className="flex-1 w-full rounded-md border"
              title="Inventory Report PDF"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
