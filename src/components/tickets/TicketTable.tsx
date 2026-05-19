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

interface Ticket {
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

export default function TicketTable({ tickets }: { tickets: Ticket[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-20 pl-4">#</TableHead>
          <TableHead>Title</TableHead>
          <TableHead className="hidden md:table-cell">Category</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
          <TableHead className="hidden md:table-cell">Deadline</TableHead>
          <TableHead className="hidden sm:table-cell pr-4">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id} className="group">
            <TableCell className="pl-4">
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
                className="font-medium text-gray-900 group-hover:text-primary transition-colors"
              >
                {ticket.title}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground md:hidden">
                {ticket.category.replace(/_/g, " ")}
              </p>
            </TableCell>
            <TableCell className="hidden md:table-cell">
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                {ticket.category.replace(/_/g, " ")}
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
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {ticket.manager.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                  <span className="text-sm">{ticket.manager.name}</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </TableCell>
            <TableCell className="hidden md:table-cell text-sm">
              {ticket.deadline ? (
                <span className={new Date(ticket.deadline) < new Date() ? "text-red-600 font-medium" : "text-muted-foreground"}>
                  {new Date(ticket.deadline).toLocaleDateString()}
                </span>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="hidden sm:table-cell pr-4 text-sm text-muted-foreground">
              {new Date(ticket.createdAt).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
