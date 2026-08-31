"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { apiFetch, apiJson, errorMessage } from "@/lib/fetcher";
import { INVENTORY_ACTION_LABELS, formatDate, labelFor } from "@/lib/format";
import { INVENTORY_ACTIONS, LIMITS } from "@/lib/validation";

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  isActive: boolean;
  updatedAt: string;
  category: { id: string; name: string };
  quantityAvailable: number;
  totalPurchased?: number;
  totalUsed?: number;
  totalBroken?: number;
  stockStatus?: string;
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
  voidedAt: string | null;
  voidReason: string | null;
  loggedBy: { id: string; name: string };
  voidedBy: { id: string; name: string } | null;
}

interface Props {
  items: InventoryItem[];
  categories: Category[];
  role: string;
  canDownloadReport: boolean;
}

const LOW_STOCK_THRESHOLD = 5;

const actionColor: Record<string, string> = {
  PURCHASED:
    "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  USED: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  BROKEN: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default function InventoryClient({
  items,
  categories,
  role,
  canDownloadReport,
}: Props) {
  const router = useRouter();
  const isAdmin = role === "ADMIN";
  const today = new Date().toISOString().split("T")[0];

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");

  const [addItemOpen, setAddItemOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    code: "",
    name: "",
    categoryId: "",
    unit: "",
  });
  const [addingItem, setAddingItem] = useState(false);

  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: "",
    code: "",
    unit: "",
    categoryId: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const [logOpen, setLogOpen] = useState(false);
  const [logItem, setLogItem] = useState<InventoryItem | null>(null);
  const [logAction, setLogAction] = useState<string>("PURCHASED");
  const [logQuantity, setLogQuantity] = useState("");
  const [logDetails, setLogDetails] = useState("");
  const [logDate, setLogDate] = useState(today);
  const [submittingLog, setSubmittingLog] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [historyLogs, setHistoryLogs] = useState<LogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showVoided, setShowVoided] = useState(false);

  const [voidTarget, setVoidTarget] = useState<LogEntry | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] =
    useState<Category | null>(null);

  const [deactivateTarget, setDeactivateTarget] = useState<InventoryItem | null>(
    null
  );

  const [reportOpen, setReportOpen] = useState(false);
  const [reportPdfUrl, setReportPdfUrl] = useState<string | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [uploadingToDrive, setUploadingToDrive] = useState(false);

  // Release the object URL if the component unmounts with the preview open.
  useEffect(() => {
    return () => {
      if (reportPdfUrl) URL.revokeObjectURL(reportPdfUrl);
    };
  }, [reportPdfUrl]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category.id !== categoryFilter) {
        return false;
      }
      if (stockFilter === "out" && item.quantityAvailable > 0) return false;
      if (
        stockFilter === "low" &&
        !(
          item.quantityAvailable > 0 &&
          item.quantityAvailable <= LOW_STOCK_THRESHOLD
        )
      ) {
        return false;
      }
      if (
        query &&
        !item.name.toLowerCase().includes(query) &&
        !item.code.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [items, categoryFilter, stockFilter, search]);

  const outOfStock = items.filter((i) => i.quantityAvailable <= 0).length;
  const lowStock = items.filter(
    (i) => i.quantityAvailable > 0 && i.quantityAvailable <= LOW_STOCK_THRESHOLD
  ).length;

  async function handleAddItem() {
    if (addingItem) return;
    const { code, name, categoryId, unit } = newItem;
    if (!code.trim() || !name.trim() || !categoryId || !unit.trim()) {
      toast.error("Fill in every field to add an item.");
      return;
    }

    setAddingItem(true);
    try {
      await apiJson("/api/inventory", "POST", {
        code: code.trim(),
        name: name.trim(),
        categoryId,
        unit: unit.trim(),
      });
      toast.success("Item added");
      setAddItemOpen(false);
      setNewItem({ code: "", name: "", categoryId: "", unit: "" });
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAddingItem(false);
    }
  }

  function openEdit(item: InventoryItem) {
    setEditItem(item);
    setEditDraft({
      name: item.name,
      code: item.code,
      unit: item.unit,
      categoryId: item.category.id,
    });
  }

  async function handleSaveEdit() {
    if (!editItem || savingEdit) return;

    const body: Record<string, unknown> = {};
    if (editDraft.name.trim() !== editItem.name) body.name = editDraft.name.trim();
    if (editDraft.code.trim() !== editItem.code) body.code = editDraft.code.trim();
    if (editDraft.unit.trim() !== editItem.unit) body.unit = editDraft.unit.trim();
    if (editDraft.categoryId !== editItem.category.id) {
      body.categoryId = editDraft.categoryId;
    }

    if (Object.keys(body).length === 0) {
      setEditItem(null);
      return;
    }

    setSavingEdit(true);
    try {
      await apiJson(`/api/inventory/${editItem.id}`, "PATCH", body);
      toast.success("Item updated");
      setEditItem(null);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  }

  function openLogDialog(item: InventoryItem) {
    setLogItem(item);
    setLogAction("PURCHASED");
    setLogQuantity("");
    setLogDetails("");
    setLogDate(today);
    setLogOpen(true);
  }

  async function handleSubmitLog() {
    if (!logItem || submittingLog) return;

    const quantity = Number(logQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Enter a whole quantity greater than zero.");
      return;
    }
    if (!logDetails.trim()) {
      toast.error("Add a short note describing this entry.");
      return;
    }
    // The server enforces this too; checking here avoids a pointless round-trip.
    if (logAction !== "PURCHASED" && quantity > logItem.quantityAvailable) {
      toast.error(
        `Only ${logItem.quantityAvailable} ${logItem.unit} in stock.`
      );
      return;
    }

    setSubmittingLog(true);
    try {
      await apiJson(`/api/inventory/${logItem.id}/logs`, "POST", {
        action: logAction,
        quantity,
        details: logDetails.trim(),
        date: logDate,
      });
      toast.success("Stock entry recorded");
      setLogOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmittingLog(false);
    }
  }

  async function loadHistory(item: InventoryItem, includeVoided = showVoided) {
    setHistoryItem(item);
    setHistoryOpen(true);
    setLoadingHistory(true);
    try {
      const data = await apiFetch<{ logs: LogEntry[] }>(
        `/api/inventory/${item.id}/logs?limit=100&includeVoided=${includeVoided}`
      );
      setHistoryLogs(data.logs);
    } catch (err) {
      toast.error(errorMessage(err));
      setHistoryLogs([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleVoid() {
    if (!voidTarget || !historyItem) return;
    if (!voidReason.trim()) {
      toast.error("Give a reason for voiding this entry.");
      return;
    }

    try {
      await apiJson(
        `/api/inventory/${historyItem.id}/logs/${voidTarget.id}`,
        "POST",
        { reason: voidReason.trim() }
      );
      toast.success("Entry voided and stock corrected");
      setVoidTarget(null);
      setVoidReason("");
      await loadHistory(historyItem);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function handleAddCategory() {
    if (addingCategory || !newCategoryName.trim()) return;
    setAddingCategory(true);
    try {
      await apiJson("/api/inventory/categories", "POST", {
        name: newCategoryName.trim(),
      });
      toast.success("Category added");
      setNewCategoryName("");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleDeleteCategory() {
    if (!deleteCategoryTarget) return;
    try {
      await apiJson(
        `/api/inventory/categories/${deleteCategoryTarget.id}`,
        "DELETE"
      );
      toast.success("Category deleted");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteCategoryTarget(null);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    try {
      await apiJson(`/api/inventory/${deactivateTarget.id}`, "PATCH", {
        isActive: false,
      });
      toast.success("Item deactivated");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeactivateTarget(null);
    }
  }

  async function openReport() {
    setReportOpen(true);
    setLoadingReport(true);
    if (reportPdfUrl) URL.revokeObjectURL(reportPdfUrl);
    setReportPdfUrl(null);
    try {
      const blob = await apiFetch<Blob>("/api/inventory/report");
      setReportPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      toast.error(errorMessage(err));
      setReportOpen(false);
    } finally {
      setLoadingReport(false);
    }
  }

  function closeReport(open: boolean) {
    if (!open && reportPdfUrl) {
      URL.revokeObjectURL(reportPdfUrl);
      setReportPdfUrl(null);
    }
    setReportOpen(open);
  }

  function downloadReport() {
    if (!reportPdfUrl) return;
    const link = document.createElement("a");
    link.href = reportPdfUrl;
    link.download = `inventory-report-${today}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("Report downloaded");
  }

  async function uploadToDrive() {
    if (uploadingToDrive) return;
    setUploadingToDrive(true);
    try {
      // The server regenerates the PDF from the database; no body is sent.
      // This endpoint previously read the PDF from the request body while the
      // browser sent none, so it failed every time.
      const data = await apiJson<{ name: string; link?: string }>(
        "/api/inventory/report/drive",
        "POST"
      );
      toast.success(`Uploaded to Google Drive: ${data.name}`, {
        action: data.link
          ? {
              label: "Open",
              onClick: () => window.open(data.link, "_blank", "noopener"),
            }
          : undefined,
      });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploadingToDrive(false);
    }
  }

  const hasFilters =
    categoryFilter !== "all" || stockFilter !== "all" || search.trim() !== "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage school inventory items and stock levels
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canDownloadReport && (
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

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <p className="label-caps">
            Items
          </p>
          <p className="mt-1 text-2xl font-bold tabular">{items.length}</p>
        </Card>
        <Card className="border-0 p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <p className="label-caps">
            Low stock
          </p>
          <p className="mt-1 text-2xl font-bold tabular text-amber-600 dark:text-amber-400">
            {lowStock}
          </p>
        </Card>
        <Card className="border-0 p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
          <p className="label-caps">
            Out of stock
          </p>
          <p className="mt-1 text-2xl font-bold tabular text-red-600 dark:text-red-400">
            {outOfStock}
          </p>
        </Card>
      </div>

      <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <div className="relative min-w-56 flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code"
              className="h-9 pl-9"
              aria-label="Search inventory"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => v && setCategoryFilter(v)}
          >
            <SelectTrigger className="h-9 w-48">
              {categoryFilter === "all"
                ? "All Categories"
                : (categories.find((c) => c.id === categoryFilter)?.name ??
                  "All Categories")}
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
          <Select value={stockFilter} onValueChange={(v) => v && setStockFilter(v)}>
            <SelectTrigger className="h-9 w-40">
              {{ all: "All stock", low: "Low stock", out: "Out of stock" }[
                stockFilter
              ] ?? "All stock"}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stock</SelectItem>
              <SelectItem value="low">Low stock</SelectItem>
              <SelectItem value="out">Out of stock</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setCategoryFilter("all");
                setStockFilter("all");
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            </div>
            <p className="mt-4 text-sm font-medium">
              {hasFilters ? "No items match these filters" : "No items yet"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasFilters
                ? "Try a different search or filter."
                : "Add your first inventory item to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="hidden md:table-cell">Unit</TableHead>
                  <TableHead className="hidden lg:table-cell">Updated</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const out = item.quantityAvailable <= 0;
                  const low =
                    !out && item.quantityAvailable <= LOW_STOCK_THRESHOLD;
                  return (
                    <TableRow
                      key={item.id}
                      className={
                        out
                          ? "bg-red-50/50 dark:bg-red-950/20"
                          : low
                            ? "bg-amber-50/50 dark:bg-amber-950/20"
                            : ""
                      }
                    >
                      <TableCell className="pl-4 font-mono text-xs font-medium">
                        {item.code}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => loadHistory(item)}
                          className="text-left font-medium text-primary hover:underline"
                        >
                          {item.name}
                        </button>
                        <p className="text-xs text-muted-foreground sm:hidden">
                          {item.category.name}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary" className="font-normal">
                          {item.category.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            out
                              ? "font-bold text-red-600 dark:text-red-400"
                              : low
                                ? "font-semibold text-amber-600 dark:text-amber-400"
                                : "font-medium"
                          }
                        >
                          {item.quantityAvailable}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {item.unit}
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                        {formatDate(item.updatedAt)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openLogDialog(item)}
                          >
                            Log
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(item)}
                          >
                            Edit
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setDeactivateTarget(item)}
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Add item */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
            <DialogDescription>
              Add a new item to track in inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Item Code</Label>
              <Input
                id="code"
                placeholder="e.g. LAB-MICRO-001"
                maxLength={LIMITS.itemCode}
                value={newItem.code}
                onChange={(e) =>
                  setNewItem({ ...newItem, code: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="itemName">Name</Label>
              <Input
                id="itemName"
                placeholder="e.g. Microscope"
                maxLength={LIMITS.itemName}
                value={newItem.name}
                onChange={(e) =>
                  setNewItem({ ...newItem, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={newItem.categoryId}
                onValueChange={(v) =>
                  v && setNewItem({ ...newItem, categoryId: v })
                }
              >
                <SelectTrigger className="w-full">
                  {categories.find((c) => c.id === newItem.categoryId)?.name ?? (
                    <span className="text-muted-foreground">Select category</span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categories.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Create a category first.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                placeholder="e.g. pieces, boxes, litres"
                maxLength={LIMITS.unit}
                value={newItem.unit}
                onChange={(e) =>
                  setNewItem({ ...newItem, unit: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem} disabled={addingItem}>
              {addingItem ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit item */}
      <Dialog
        open={editItem !== null}
        onOpenChange={(open) => !open && setEditItem(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {editItem?.name}</DialogTitle>
            <DialogDescription>
              Correct an item&apos;s details. Stock history is unaffected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editCode">Item Code</Label>
              <Input
                id="editCode"
                maxLength={LIMITS.itemCode}
                value={editDraft.code}
                onChange={(e) =>
                  setEditDraft({ ...editDraft, code: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editItemName">Name</Label>
              <Input
                id="editItemName"
                maxLength={LIMITS.itemName}
                value={editDraft.name}
                onChange={(e) =>
                  setEditDraft({ ...editDraft, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={editDraft.categoryId}
                onValueChange={(v) =>
                  v && setEditDraft({ ...editDraft, categoryId: v })
                }
              >
                <SelectTrigger className="w-full">
                  {categories.find((c) => c.id === editDraft.categoryId)?.name ?? (
                    <span className="text-muted-foreground">Select category</span>
                  )}
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
              <Label htmlFor="editUnit">Unit</Label>
              <Input
                id="editUnit"
                maxLength={LIMITS.unit}
                value={editDraft.unit}
                onChange={(e) =>
                  setEditDraft({ ...editDraft, unit: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log stock movement */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Stock Movement</DialogTitle>
            <DialogDescription>
              {logItem
                ? `${logItem.name} — ${logItem.quantityAvailable} ${logItem.unit} in stock`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select value={logAction} onValueChange={(v) => v && setLogAction(v)}>
                <SelectTrigger className="w-full">
                  {labelFor(INVENTORY_ACTION_LABELS, logAction)}
                </SelectTrigger>
                <SelectContent>
                  {INVENTORY_ACTIONS.map((action) => (
                    <SelectItem key={action} value={action}>
                      {labelFor(INVENTORY_ACTION_LABELS, action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                step={1}
                max={
                  logAction !== "PURCHASED" && logItem
                    ? logItem.quantityAvailable
                    : undefined
                }
                value={logQuantity}
                onChange={(e) => setLogQuantity(e.target.value)}
              />
              {logAction !== "PURCHASED" && logItem && (
                <p className="text-xs text-muted-foreground">
                  At most {logItem.quantityAvailable} {logItem.unit} available.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="logDate">Date</Label>
              <Input
                id="logDate"
                type="date"
                max={today}
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="details">Details</Label>
              <Textarea
                id="details"
                rows={3}
                maxLength={LIMITS.logDetails}
                placeholder="e.g. Purchased from ABC Suppliers, invoice #123"
                value={logDetails}
                onChange={(e) => setLogDetails(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitLog} disabled={submittingLog}>
              {submittingLog ? "Saving..." : "Save entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{historyItem?.name} — Stock History</DialogTitle>
            <DialogDescription>
              {historyItem
                ? `${historyItem.quantityAvailable} ${historyItem.unit} currently in stock`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {isAdmin && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showVoided}
                onChange={(e) => {
                  setShowVoided(e.target.checked);
                  if (historyItem) loadHistory(historyItem, e.target.checked);
                }}
                className="h-4 w-4 accent-primary"
              />
              Show voided entries
            </label>
          )}

          {loadingHistory ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading history...
            </div>
          ) : historyLogs.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No stock movements recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {historyLogs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-lg border px-3 py-2.5 ${
                    log.voidedAt ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                        actionColor[log.action] ?? "bg-muted"
                      }`}
                    >
                      {labelFor(INVENTORY_ACTION_LABELS, log.action)}
                    </span>
                    <span className="text-sm font-medium">
                      {log.action === "PURCHASED" ? "+" : "−"}
                      {log.quantity}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(log.date)}
                    </span>
                    {log.voidedAt && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950 dark:text-red-300">
                        VOIDED
                      </span>
                    )}
                    {isAdmin && !log.voidedAt && (
                      <button
                        onClick={() => {
                          setVoidTarget(log);
                          setVoidReason("");
                        }}
                        className="ml-auto text-xs font-medium text-muted-foreground hover:text-red-600 hover:underline"
                      >
                        Void
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{log.details}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Logged by {log.loggedBy.name}
                  </p>
                  {log.voidedAt && (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                      Voided by {log.voidedBy?.name ?? "an admin"}
                      {log.voidReason ? `: ${log.voidReason}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void a log entry */}
      <Dialog
        open={voidTarget !== null}
        onOpenChange={(open) => !open && setVoidTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Void this stock entry?</DialogTitle>
            <DialogDescription>
              The entry stays on record but stops counting towards stock. This is
              how a mistyped quantity gets corrected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="voidReason">Reason</Label>
            <Textarea
              id="voidReason"
              rows={3}
              maxLength={LIMITS.logDetails}
              placeholder="e.g. Quantity entered as 100 instead of 10"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleVoid}
              disabled={!voidReason.trim()}
            >
              Void entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categories */}
      <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="New category name"
              maxLength={LIMITS.categoryName}
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddCategory();
              }}
            />
            <Button
              onClick={handleAddCategory}
              disabled={addingCategory || !newCategoryName.trim()}
            >
              Add
            </Button>
          </div>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {categories.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No categories yet.
              </p>
            ) : (
              categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {category._count.items} item
                      {category._count.items === 1 ? "" : "s"}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      disabled={category._count.items > 0}
                      title={
                        category._count.items > 0
                          ? "Move or deactivate its items first"
                          : undefined
                      }
                      onClick={() => setDeleteCategoryTarget(category)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Report preview */}
      <Dialog open={reportOpen} onOpenChange={closeReport}>
        <DialogContent className="max-h-[90vh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Inventory Report</DialogTitle>
            <DialogDescription>
              Generated from current stock records.
            </DialogDescription>
          </DialogHeader>
          {loadingReport ? (
            <div className="py-24 text-center text-sm text-muted-foreground">
              Generating report...
            </div>
          ) : reportPdfUrl ? (
            <iframe
              src={reportPdfUrl}
              title="Inventory report preview"
              className="h-[60vh] w-full rounded-lg border"
            />
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={downloadReport}
              disabled={!reportPdfUrl}
            >
              Download PDF
            </Button>
            <Button onClick={uploadToDrive} disabled={uploadingToDrive}>
              {uploadingToDrive ? "Uploading..." : "Save to Google Drive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title={`Deactivate ${deactivateTarget?.name}?`}
        description="The item is hidden from stock views and no new movements can be logged against it. Its history is preserved."
        confirmLabel="Deactivate"
        destructive
        onConfirm={handleDeactivate}
      />

      <ConfirmDialog
        open={deleteCategoryTarget !== null}
        onOpenChange={(open) => !open && setDeleteCategoryTarget(null)}
        title={`Delete category "${deleteCategoryTarget?.name}"?`}
        description="This cannot be undone."
        confirmLabel="Delete category"
        destructive
        onConfirm={handleDeleteCategory}
      />
    </div>
  );
}
