"use client";

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
import { formatDate, humanizeEnum, isOverdue } from "@/lib/format";

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

interface Props {
  tickets: TicketRow[];
  /** When provided, the table renders selection checkboxes for bulk actions. */
  selection?: {
    selectedIds: Set<string>;
    onToggle: (id: string) => void;
    onToggleAll: (ids: string[], selectAll: boolean) => void;
  };
}

export default function TicketTable({ tickets, selection }: Props) {
  const allSelected =
    tickets.length > 0 &&
    tickets.every((t) => selection?.selectedIds.has(t.id));

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
                      tickets.map((t) => t.id),
                      e.target.checked
                    )
                  }
                  className="h-4 w-4 cursor-pointer rounded border-input accent-primary"
                />
              </TableHead>
            )}
            <TableHead className={selection ? "w-20" : "w-20 pl-4"}>#</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="hidden md:table-cell">Category</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
            <TableHead className="hidden md:table-cell">Deadline</TableHead>
            <TableHead className="hidden pr-4 sm:table-cell">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((ticket) => {
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
                <TableCell>
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className="font-medium text-foreground transition-colors group-hover:text-primary"
                  >
                    {ticket.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
                    {humanizeEnum(ticket.category)}
                  </p>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {humanizeEnum(ticket.category)}
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
                <TableCell className="hidden text-sm md:table-cell">
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
                <TableCell className="hidden pr-4 text-sm text-muted-foreground sm:table-cell">
                  {formatDate(ticket.createdAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
