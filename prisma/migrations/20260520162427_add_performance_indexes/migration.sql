-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "Ticket_status_severity_deadline_idx" ON "Ticket"("status", "severity", "deadline");
