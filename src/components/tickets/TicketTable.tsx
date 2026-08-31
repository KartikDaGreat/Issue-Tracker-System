"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TicketStatusBadge from "./TicketStatusBadge";
import SeverityBadge from "./SeverityBadge";
import InitialsAvatar from "@/components/common/Avatar";
import {
  CATEGORY_LABELS,
  formatDate,
  isOverdue,
  labelFor,
} from "@/lib/format";

export interface TicketRow {
  id: string;
  ticketNumber: number;
  title: string;
  category: string;
  severity: string;
  status: string;
  deadline: string | null;
  createdAt: string;
  creator: { id: string; name: string };
  manager: { id: string; name: string } | null;
}

export interface TicketSection {
  label: string;
  tone: "mine" | "other";
  tickets: TicketRow[];
}

interface Props {
  /** A single ungrouped list. Ignored when `sections` is given. */
  tickets?: TicketRow[];
  /**
   * Grouped rows, rendered as banded divider rows inside one table.
   *
   * Deliberately one `<table>` rather than one per group: separate tables size
   * their columns independently, so the groups would not line up.
   */
  sections?: TicketSection[];
  /** When provided, the table renders selection checkboxes for bulk actions. */
  selection?: {
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: (ids: string[], selectAll: boolean) => void;
  };
}

const SECTION_TONES: Record<TicketSection["tone"], string> = {
  mine: "bg-primary/5 text-primary",
  other: "bg-muted/60 text-muted-foreground",
};

export default function TicketTable({ tickets, sections, selection }: Props) {
  const groups: TicketSection[] = sections ?? [
    { label: "", tone: "other", tickets: tickets ?? [] },
  ];
  const allRows = groups.flatMap((g) => g.tickets);
  const grouped = Boolean(sections);

  // Header cells: 8 fixed, plus the checkbox column when selecting.
  const columnCount = selection ? 9 : 8;

  const allSelected =
    allRows.length > 0 &&
    allRows.every((t) => selection?.selectedIds.has(t.id));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selection && (
              <TableHead className="w-10 pl-4">
                <input
                  type="checkbox"
                  aria-label="Select all tickets on this page"
                  checked={allSelected}
                  onChange={(e) =>
                    selection.onToggleAll(
                      allRows.map((t) => t.id),
                      e.target.checked,
                    )
                  }
                  className="h-4 w-4 cursor-pointer rounded border-input accent-primary"
                />
              </TableHead>
            )}
            <TableHead className={selection ? "w-20" : "w-20 pl-4"}>
              #
            </TableHead>
            <TableHead className="w-full">Title</TableHead>
            <TableHead className="hidden xl:table-cell">Category</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
            <TableHead className="hidden lg:table-cell">Deadline</TableHead>
            <TableHead className="hidden pr-4 xl:table-cell">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <Fragment key={group.label || "all"}>
              {grouped && group.tickets.length > 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={columnCount}
                    className={`border-y py-2 pl-4 text-xs font-semibold uppercase ${SECTION_TONES[group.tone]}`}
                    style={{ letterSpacing: "0.06em" }}
                  >
                    {group.label} ({group.tickets.length})
                  </TableCell>
                </TableRow>
              )}
              {group.tickets.map((ticket) => {
                const overdue =
                  isOverdue(ticket.deadline) &&
                  ticket.status !== "CLOSED" &&
                  ticket.status !== "ACKNOWLEDGED";

                return (
                  <TableRow key={ticket.id} className="group">
                    {selection && (
                      <TableCell className="pl-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ticket ${ticket.ticketNumber}`}
                          checked={selection.selectedIds.has(ticket.id)}
                          onChange={() => selection.onToggle(ticket.id)}
                          className="h-4 w-4 cursor-pointer rounded border-input accent-primary"
                        />
                      </TableCell>
                    )}
                    <TableCell className={selection ? "" : "pl-4"}>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        #{ticket.ticketNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="w-full max-w-0">
                      <Link
                        href={`/tickets/${ticket.id}`}
                        title={ticket.title}
                        className="block truncate font-medium text-foreground transition-colors group-hover:text-primary"
                      >
                        {ticket.title}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground xl:hidden">
                        {labelFor(CATEGORY_LABELS, ticket.category)}
                      </p>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {labelFor(CATEGORY_LABELS, ticket.category)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={ticket.severity} />
                    </TableCell>
                    <TableCell>
                      <TicketStatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {ticket.manager ? (
                        <div className="flex items-center gap-2">
                          <InitialsAvatar name={ticket.manager.name} />
                          <span className="text-sm">{ticket.manager.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">
                      {ticket.deadline ? (
                        <span
                          className={
                            overdue
                              ? "font-medium text-red-600 dark:text-red-400"
                              : "text-muted-foreground"
                          }
                          title={overdue ? "Overdue" : undefined}
                        >
                          {formatDate(ticket.deadline)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden pr-4 text-sm text-muted-foreground xl:table-cell">
                      {formatDate(ticket.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
