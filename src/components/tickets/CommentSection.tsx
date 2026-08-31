"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import InitialsAvatar from "@/components/common/Avatar";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import { apiJson, errorMessage } from "@/lib/fetcher";
import { formatDateTime } from "@/lib/format";
import { LIMITS } from "@/lib/validation";

export interface CommentItem {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  authorId: string;
  author: { id: string; name: string };
}

interface Props {
  ticketId: string;
  comments: CommentItem[];
  currentUserId: string;
  isAdmin: boolean;
  onChanged: () => void | Promise<void>;
  readonly?: boolean;
}

export default function CommentSection({
  ticketId,
  comments,
  currentUserId,
  isAdmin,
  onChanged,
  readonly,
}: Props) {
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CommentItem | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || posting) return;

    setPosting(true);
    try {
      await apiJson(`/api/tickets/${ticketId}/comments`, "POST", {
        body: trimmed,
      });
      setBody("");
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPosting(false);
    }
  }

  function startEdit(comment: CommentItem) {
    setEditingId(comment.id);
    setEditBody(comment.body);
  }

  async function saveEdit(commentId: string) {
    const trimmed = editBody.trim();
    if (!trimmed || savingEdit) return;

    setSavingEdit(true);
    try {
      await apiJson(
        `/api/tickets/${ticketId}/comments/${commentId}`,
        "PATCH",
        { body: trimmed }
      );
      setEditingId(null);
      toast.success("Comment updated");
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await apiJson(
        `/api/tickets/${ticketId}/comments/${deleteTarget.id}`,
        "DELETE"
      );
      toast.success("Comment deleted");
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleteTarget(null);
    }
  }

  const remaining = LIMITS.comment - body.length;

  return (
    <Card className="border-0 shadow-sm ring-1 ring-black/5 dark:ring-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 label-caps text-[13px]">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No comments yet. Be the first to comment.
          </p>
        )}

        {comments.map((comment) => {
          const canModify = comment.authorId === currentUserId || isAdmin;
          const isEditing = editingId === comment.id;

          return (
            <div key={comment.id} className="flex gap-3">
              <InitialsAvatar
                name={comment.author.name}
                className="mt-0.5 h-8 w-8 text-xs"
              />
              <div className="flex-1 rounded-lg bg-muted/50 px-3.5 py-2.5 ring-1 ring-black/5 dark:ring-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {comment.author.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(comment.createdAt)}
                  </span>
                  {comment.editedAt && (
                    <span
                      className="text-xs italic text-muted-foreground"
                      title={`Edited ${formatDateTime(comment.editedAt)}`}
                    >
                      (edited)
                    </span>
                  )}
                  {canModify && !readonly && !isEditing && (
                    <span className="ml-auto flex gap-2">
                      <button
                        onClick={() => startEdit(comment)}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(comment)}
                        className="text-xs font-medium text-muted-foreground hover:text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <Textarea
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      rows={3}
                      maxLength={LIMITS.comment}
                      className="resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                        disabled={savingEdit}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveEdit(comment.id)}
                        disabled={savingEdit || !editBody.trim()}
                      >
                        {savingEdit ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                    {comment.body}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {!readonly && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t pt-2">
            <Textarea
              placeholder="Write a comment..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              maxLength={LIMITS.comment}
              className="resize-none"
            />
            <div className="flex items-center justify-between">
              <span
                className={`text-xs ${
                  remaining < 100 ? "text-amber-600" : "text-muted-foreground"
                }`}
              >
                {remaining < 500 ? `${remaining} characters left` : ""}
              </span>
              <Button
                type="submit"
                size="sm"
                disabled={posting || !body.trim()}
                className="gap-1.5"
              >
                {posting ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Posting...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    Post Comment
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this comment?"
        description="The comment will be removed from the thread. The ticket's activity log will record that a comment was deleted."
        confirmLabel="Delete comment"
        destructive
        onConfirm={confirmDelete}
      />
    </Card>
  );
}
