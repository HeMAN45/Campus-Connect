import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CornerDownRight, Flag, Lock, MessageCircle, Send, Trash2 } from 'lucide-react';
import { Avatar, UserName, Menu, ConfirmModal, EmptyState, Spinner, StatusTag } from '../ui.jsx';
import { AttachButton, Previews, addFiles, imagesFromPaste } from '../ImagePicker.jsx';
import { Lightbox } from '../post/Images.jsx';
import VoteButtons from '../post/VoteButtons.jsx';
import Linkify from '../Linkify.jsx';
import ReportModal from '../ReportModal.jsx';
import { api, toForm } from '../../lib/api.js';
import { timeAgo } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

function CommentBox({ postId, parentId, onPosted, autoFocus, placeholder, compact, onCancel }) {
  const toast = useToast();
  const [body, setBody] = useState('');
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const grow = (el) => {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 288)}px`;
  };

  async function submit(e) {
    e.preventDefault();
    if (!body.trim() && !images.length) return;
    setBusy(true);
    setError('');
    try {
      const { comment } = await api(`/posts/${postId}/comments`, {
        method: 'POST',
        form: toForm({ body, parentId, imageAlt: images[0]?.alt }, { image: images[0]?.file }),
      });
      setBody('');
      setImages([]);
      if (ref.current) ref.current.style.height = '';
      onPosted(comment);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const inputId = `cb-${postId}-${parentId || 'root'}`;
  return (
    <form onSubmit={submit} className={compact ? 'mt-2' : ''}>
      <div className="card focus-within:border-accent">
        <label htmlFor={inputId} className="sr-only">
          {placeholder}
        </label>
        <textarea
          id={inputId}
          ref={ref}
          rows={compact ? 2 : 3}
          value={body}
          maxLength={2000}
          onChange={(e) => {
            setBody(e.target.value);
            grow(e.target);
          }}
          onPaste={(e) => {
            const files = imagesFromPaste(e);
            if (files.length) setImages((cur) => addFiles(cur, files, { max: 1, onError: toast }));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
          }}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-body placeholder:text-ink-3 focus:outline-none rounded"
        />
        {images.length > 0 && (
          <div className="px-3 pb-2">
            <Previews items={images} onChange={setImages} size={64} />
          </div>
        )}
        <div className="flex items-center justify-between px-1.5 pb-1.5">
          <AttachButton items={images} onChange={setImages} max={1} onError={toast} label="Attach image" />
          <div className="flex items-center gap-2">
            {onCancel && (
              <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn-primary btn-sm" disabled={busy || (!body.trim() && !images.length)}>
              {busy ? <Spinner size={14} className="text-white" /> : <Send size={15} />}
              {compact ? 'Reply' : 'Comment'}
            </button>
          </div>
        </div>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function Comment({ c, post, viewer, isReply, onReply, replyingTo, onPosted, onDeleted, onAccept, highlight }) {
  const { user } = useAuth();
  const [lightbox, setLightbox] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [report, setReport] = useState(false);
  const own = c.author?.id === user.id;
  const canAccept = post.type === 'doubt' && viewer.isOwner && !own && !c.isDeleted && !isReply;
  return (
    <div id={`c-${c.id}`} className={`flex gap-3 scroll-mt-24 ${highlight ? 'bg-accent-soft/70 -mx-2 px-2 py-1 rounded' : ''}`}>
      {c.author ? <Avatar user={c.author} size={isReply ? 28 : 32} className="mt-0.5" /> : <span className="w-8 h-8 rounded-full bg-surface-2 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-x-2 flex-wrap min-w-0">
            <UserName user={c.author} communityType={post.community?.type} showYear={false} />
            <span className="text-meta text-ink-3">
              {timeAgo(c.createdAt)}
              {c.editedAt && ' . edited'}
            </span>
            {c.isAccepted && (
              <StatusTag tone="success" icon={CheckCircle2}>
                Accepted
              </StatusTag>
            )}
          </div>
          {!c.isDeleted && (
            <Menu
              size={18}
              label="Comment options"
              items={[
                (own || viewer.canModerate) && { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirm(true) },
                !own && { label: 'Report', icon: Flag, onClick: () => setReport(true) },
              ]}
            />
          )}
        </div>
        {c.isDeleted ? (
          <p className="text-ink-3 italic">[deleted]</p>
        ) : (
          <>
            {c.body && (
              <p className="text-body text-ink">
                <Linkify text={c.body} />
              </p>
            )}
            {c.image && (
              <button type="button" className="mt-2 block" onClick={() => setLightbox(true)} aria-label={`Open image${c.image.alt ? `: ${c.image.alt}` : ''}`}>
                <img
                  src={c.image.url}
                  alt={c.image.alt || `Image from ${c.author?.name}`}
                  loading="lazy"
                  className="max-w-[min(320px,100%)] max-h-[320px] rounded-sm border border-line object-contain bg-surface-2"
                />
              </button>
            )}
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <VoteButtons kind="comments" id={c.id} score={c.score} myVote={c.myVote} isOwn={own} size={18} />
              {onReply && (
                <button type="button" className="btn-ghost btn-sm" onClick={() => onReply(c.id)}>
                  <CornerDownRight size={15} /> Reply
                </button>
              )}
              {canAccept && (
                <button type="button" className={`btn-sm ${c.isAccepted ? 'btn-on' : 'btn-ghost'}`} onClick={() => onAccept(c.isAccepted ? null : c.id)}>
                  <CheckCircle2 size={15} /> {c.isAccepted ? 'Accepted' : 'Accept answer'}
                </button>
              )}
            </div>
          </>
        )}
        {replyingTo === c.id && (
          <CommentBox
            postId={post.id}
            parentId={c.id}
            autoFocus
            compact
            placeholder={`Reply to ${c.author?.name || 'comment'}`}
            onPosted={onPosted}
            onCancel={() => onReply(null)}
          />
        )}
      </div>
      {lightbox && <Lightbox images={[c.image]} onClose={() => setLightbox(false)} />}
      {confirm && (
        <ConfirmModal
          title="Delete comment?"
          text="This can't be undone."
          confirmLabel="Delete comment"
          danger
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await api(`/comments/${c.id}`, { method: 'DELETE' });
            onDeleted(c);
          }}
        />
      )}
      {report && <ReportModal targetType="comment" targetId={c.id} onClose={() => setReport(false)} />}
    </div>
  );
}

export default function CommentSection({ post, viewer, onPostChange, onJoin }) {
  const toast = useToast();
  const [sort, setSort] = useState('top');
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const scrolled = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await api(`/posts/${post.id}/comments?sort=${sort}`);
      setItems(r.items);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, [post.id, sort]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (id) => {
    setHighlight(id);
    setTimeout(() => setHighlight(null), 1800);
  };

  useEffect(() => {
    if (!items || scrolled.current) return;
    scrolled.current = true;
    const m = window.location.hash.match(/^#c-(\d+)$/);
    if (m) {
      const el = document.getElementById(`c-${m[1]}`);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        flash(Number(m[1]));
      }
    } else if (window.location.hash === '#answer' || window.location.hash === '#comments') {
      document.getElementById('comments')?.scrollIntoView({ block: 'start' });
    }
  }, [items]);

  const onPosted = (comment) => {
    setReplyingTo(null);
    setItems((list) => {
      if (comment.parentId) return list.map((c) => (c.id === comment.parentId ? { ...c, replies: [...c.replies, comment] } : c));
      return sort === 'new' ? [comment, ...list] : [...list, comment];
    });
    onPostChange({ ...post, commentCount: post.commentCount + 1 });
    flash(comment.id);
  };

  const onDeleted = (comment) => {
    setItems((list) =>
      list
        .map((c) =>
          c.id === comment.id
            ? { ...c, isDeleted: true, body: '', image: null, author: null }
            : { ...c, replies: c.replies.filter((r) => r.id !== comment.id) },
        )
        .filter((c) => !c.isDeleted || c.replies.length),
    );
    onPostChange({
      ...post,
      commentCount: Math.max(0, post.commentCount - 1),
      ...(post.acceptedCommentId === comment.id ? { acceptedCommentId: null, status: 'open' } : {}),
    });
    toast('Comment deleted');
  };

  const onAccept = async (commentId) => {
    try {
      const r = await api(`/posts/${post.id}/accept`, { method: 'POST', body: { commentId } });
      onPostChange(r.post);
      setItems((list) => list.map((c) => ({ ...c, isAccepted: c.id === commentId })));
      toast(commentId ? 'Answer accepted. Thanks for closing the loop!' : 'Accepted answer removed');
    } catch (e) {
      toast(e.message);
    }
  };

  const accepted = items?.find((c) => c.isAccepted && !c.isDeleted);
  const closedReason = post.commentsLocked
    ? 'Comments are turned off for this post.'
    : (post.type === 'lost' || post.type === 'found') && post.status === 'resolved'
      ? 'This item has been resolved, so comments are closed.'
      : null;
  const canReply = !closedReason && viewer.isMember !== false;

  return (
    <section id="comments" aria-labelledby="comments-heading" className="scroll-mt-20">
      {accepted && (
        <div className="card border-l-[3px] border-l-success p-4 mb-5">
          <p className="section-label text-success mb-3 flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Accepted answer
          </p>
          <Comment c={{ ...accepted, replies: [] }} post={post} viewer={viewer} onPosted={onPosted} onDeleted={onDeleted} onAccept={onAccept} />
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 id="comments-heading" className="text-[18px] font-semibold">
          {post.type === 'doubt' ? 'Answers' : 'Comments'} <span className="text-ink-2 font-normal tabular-nums">({post.commentCount})</span>
        </h2>
        <div className="flex gap-1" role="radiogroup" aria-label="Sort comments">
          {['top', 'new'].map((s) => (
            <button key={s} role="radio" aria-checked={sort === s} className={sort === s ? 'chip-on' : 'chip'} onClick={() => setSort(s)}>
              {s === 'top' ? 'Top' : 'New'}
            </button>
          ))}
        </div>
      </div>

      <div id="answer" className="mb-6 scroll-mt-24">
        {closedReason ? (
          <p className="card px-4 py-3 text-ink-2 flex items-center gap-2">
            <Lock size={16} /> {closedReason}
          </p>
        ) : viewer.isMember === false ? (
          <div className="card px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-ink-2">
              Join <strong className="text-ink">{post.community.name}</strong> to comment.
            </span>
            <button className="btn-primary btn-sm" onClick={onJoin}>
              Join community
            </button>
          </div>
        ) : (
          <CommentBox
            postId={post.id}
            onPosted={onPosted}
            autoFocus={window.location.hash === '#answer'}
            placeholder={post.type === 'doubt' ? 'Write an answer. You can attach a screenshot.' : 'Add a comment'}
          />
        )}
      </div>

      {error && <p className="field-error">{error.message}</p>}
      {!items && !error && (
        <div className="py-6 flex justify-center">
          <Spinner />
        </div>
      )}
      {items && items.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title={post.type === 'doubt' ? 'No answers yet' : 'No comments yet'}
          text={post.type === 'doubt' ? 'Know the answer? Help a classmate.' : 'Start the conversation.'}
        />
      )}
      {items && items.length > 0 && (
        <ul className="space-y-6">
          {items.map((c) => (
            <li key={c.id}>
              <Comment
                c={c}
                post={post}
                viewer={viewer}
                onReply={canReply ? setReplyingTo : null}
                replyingTo={replyingTo}
                onPosted={onPosted}
                onDeleted={onDeleted}
                onAccept={onAccept}
                highlight={highlight === c.id}
              />
              {c.replies.length > 0 && (
                <ul className="mt-3 ml-4 md:ml-11 pl-4 border-l border-line space-y-4">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <Comment
                        c={r}
                        post={post}
                        viewer={viewer}
                        isReply
                        onReply={canReply ? setReplyingTo : null}
                        replyingTo={replyingTo}
                        onPosted={onPosted}
                        onDeleted={onDeleted}
                        onAccept={onAccept}
                        highlight={highlight === r.id}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {post.community && viewer.isMember === false && (
        <p className="text-meta text-ink-3 mt-6">
          Posted in{' '}
          <Link to={`/c/${post.community.slug}`} className="link">
            {post.community.name}
          </Link>
          .
        </p>
      )}
    </section>
  );
}
