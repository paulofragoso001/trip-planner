"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Comment = {
  id: string;
  trip_segment_id?: string;
  author: string | null;
  author_avatar_url: string | null;
  content: string;
  profiles?: {
    avatar_url: string | null;
    username: string | null;
  } | null;
};

type CommentsProps = {
  itemId: string;
};

export default function Comments({ itemId }: CommentsProps) {
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  async function fetchComments() {
    const response = await fetch(`/api/comments?itemId=${itemId}`);
    const data = await response.json();

    if (response.ok) {
      setComments(data);
    }
  }

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments-${itemId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trip_segment_comments",
          filter: `trip_segment_id=eq.${itemId}`
        },
        (payload) => {
          const newComment = payload.new as Comment;
          setComments((currentComments) => {
            if (currentComments.some((comment) => comment.id === newComment.id)) {
              return currentComments;
            }

            return [...currentComments, newComment];
          });
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [itemId, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function submit() {
    if (!text.trim()) {
      return;
    }

    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trip_segment_id: itemId,
        author: "Guest",
        content: text
      })
    });

    setText("");
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="mb-1 text-xs text-green-500">Live</div>
      <div className="max-h-40 space-y-3 overflow-y-auto">
        {comments.map((comment) => (
          <div key={comment.id} className="flex items-start gap-2">
            {getAvatarUrl(comment) ? (
              <img
                alt={comment.author || "Comment author"}
                className="h-6 w-6 rounded-full object-cover"
                loading="lazy"
                src={getAvatarUrl(comment)}
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-slate-100" />
            )}
            <div>
              <div className="text-sm font-medium text-slate-700">
                {comment.profiles?.username || comment.author || "Guest"}
              </div>
              <div className="text-sm text-gray-600">{comment.content}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-line p-2 text-sm"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Add comment..."
        />
        <button
          className="rounded-lg bg-black px-3 py-1 text-sm font-semibold text-white"
          type="button"
          onClick={submit}
        >
          Post
        </button>
      </div>
    </div>
  );
}

function getAvatarUrl(comment: Comment) {
  return comment.profiles?.avatar_url || comment.author_avatar_url || "";
}
