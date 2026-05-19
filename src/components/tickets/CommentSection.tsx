"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
}

interface Props {
  ticketId: string;
  comments: Comment[];
  onCommentAdded: () => void;
  readonly?: boolean;
}

export default function CommentSection({
  ticketId,
  comments,
  onCommentAdded,
  readonly,
}: Props) {
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setLoading(true);

    const res = await fetch(`/api/tickets/${ticketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim() }),
    });

    if (res.ok) {
      setBody("");
      onCommentAdded();
    } else {
      toast.error("Failed to add comment");
    }
    setLoading(false);
  }

  return (
    <Card className="border-0 shadow-sm ring-1 ring-black/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">No comments yet. Be the first to comment.</p>
        )}
        {comments.map((comment) => {
          const initials = comment.author.name
            .split(" ")
            .map((n) => n[0])
            .join("");
          return (
            <div key={comment.id} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </span>
              <div className="flex-1 rounded-lg bg-gray-50 px-3.5 py-2.5 ring-1 ring-black/5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {comment.author.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {comment.body}
                </p>
              </div>
            </div>
          );
        })}

        {!readonly && <form onSubmit={handleSubmit} className="flex flex-col gap-2 pt-2 border-t">
          <Textarea
            placeholder="Write a comment..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={loading || !body.trim()} className="gap-1.5">
              {loading ? (
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
        </form>}
      </CardContent>
    </Card>
  );
}
