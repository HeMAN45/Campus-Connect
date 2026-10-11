import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, MapPin, MessageCircle, Pin, Send, EyeOff } from 'lucide-react';
import { Avatar, StatusTag, TypeTag, UserName } from '../ui.jsx';
import Linkify from '../Linkify.jsx';
import VoteButtons from './VoteButtons.jsx';
import { EventDateBlock, RsvpButtons } from './EventBits.jsx';
import { ImageGrid } from './Images.jsx';
import { POST_TYPES, resolvedLabel } from '../../lib/postTypes.js';
import { fmtDate, fmtEventRange, fmtTime, fmtDay, timeAgo, isPast } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { openConversation } from '../../lib/dm.js';

export function PostStatusTags({ post }) {
  const resolved = resolvedLabel(post);
  const expired = post.type === 'request' && post.status === 'open' && isPast(post.neededBy);
  return (
    <>
      {post.isPinned && (
        <StatusTag tone="ink" icon={Pin}>
          Pinned
        </StatusTag>
      )}
      {resolved && (
        <StatusTag tone="success" icon={CheckCircle2}>
          {resolved}
        </StatusTag>
      )}
      {expired && <StatusTag tone="muted">Expired</StatusTag>}
      {post.isHidden && (
        <StatusTag tone="warning" icon={EyeOff}>
          Under review
        </StatusTag>
      )}
    </>
  );
}

export function TypeStrip({ post, detail = false }) {
  if (post.event) {
    return (
      <div className="flex items-center gap-3">
        <EventDateBlock startsAt={post.event.startsAt} small={!detail} />
        <div className="min-w-0">
          <p className="font-semibold text-ink">{fmtEventRange(post.event.startsAt, post.event.endsAt)}</p>
          <p className="text-meta text-ink-2 flex items-center gap-1.5">
            <MapPin size={14} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{post.event.venue}</span>
          </p>
        </div>
      </div>
    );
  }
  if (post.item) {
    return (
      <p className="text-meta text-ink flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5">
          <MapPin size={15} className="text-ink-2" aria-hidden="true" />
          {post.item.location}
        </span>
        <span className="flex items-center gap-1.5 text-ink-2">
          <Clock size={15} aria-hidden="true" />
          {post.type === 'lost' ? 'Lost' : 'Found'} {fmtDate(post.item.date)}
        </span>
      </p>
    );
  }
  if (post.type === 'request' && post.neededBy) {
    return (
      <p className="text-meta flex items-center gap-1.5 text-warning font-medium">
        <Clock size={15} aria-hidden="true" />
        Needed by {fmtDay(post.neededBy)}, {fmtTime(post.neededBy)}
      </p>
    );
  }
  if (post.type === 'doubt') {
    return (
      <p className="text-meta text-ink-2">
        Subject: <span className="font-medium text-ink">{post.subjectTag}</span>
      </p>
    );
  }
  return null;
}

export function PostHeader({ post, showCommunity = true }) {
  return (
    <div className="flex items-start gap-3 min-w-0">
      <Avatar user={post.author} size={36} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
          <UserName user={post.author} communityType={post.community?.type} />
        </div>
        <p className="text-meta text-ink-2 flex items-center gap-1.5 flex-wrap">
          {showCommunity && post.community && (
            <>
              <Link to={`/c/${post.community.slug}`} className="hover:underline underline-offset-2 text-ink-2 font-medium" onClick={(e) => e.stopPropagation()}>
                {post.community.name}
              </Link>
              <span aria-hidden="true">.</span>
            </>
          )}
          {showCommunity && !post.community && (
            <>
              <span>Campus-wide</span>
              <span aria-hidden="true">.</span>
            </>
          )}
          {post.author?.designation && <span className="truncate max-w-[180px]">{post.author.designation} .</span>}
          <time dateTime={post.createdAt} title={new Date(post.createdAt).toLocaleString('en-IN')}>
            {timeAgo(post.createdAt)}
          </time>
          {post.editedAt && <span>. edited</span>}
        </p>
      </div>
    </div>
  );
}

export default function PostCard({ post, showCommunity = true }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const isOwn = post.author?.id === user?.id;
  const t = POST_TYPES[post.type];
  const muted = post.status === 'resolved';

  const open = (e) => {
    if (e.target.closest('a,button,input,textarea,select,[role="dialog"]')) return;
    navigate(`/post/${post.id}`);
  };

  const dm = async (e, prefill) => {
    e.stopPropagation();
    try {
      await openConversation(navigate, post.author.id, prefill);
    } catch (err) {
      toast(err.message);
    }
  };

  let action = null;
  if (post.type === 'event') action = <RsvpButtons post={post} compact />;
  else if (post.type === 'request' && post.status === 'open' && !isOwn) {
    action = (
      <button className="btn-secondary btn-sm" onClick={(e) => dm(e, `Hi, I can help with: ${post.title}`)}>
        <Send size={15} /> Offer help
      </button>
    );
  } else if ((post.type === 'lost' || post.type === 'found') && post.status === 'open' && !isOwn) {
    action = (
      <button
        className="btn-secondary btn-sm"
        onClick={(e) => dm(e, post.type === 'lost' ? `Hi, about your lost item: ${post.title}. I think I found it.` : `Hi, I think the item you found is mine: ${post.title}`)}
      >
        <Send size={15} /> {post.type === 'lost' ? 'I found it' : "It's mine"}
      </button>
    );
  } else if (post.type === 'doubt' && post.status === 'open' && !isOwn) {
    action = (
      <Link to={`/post/${post.id}#answer`} className="btn-secondary btn-sm" onClick={(e) => e.stopPropagation()}>
        Answer
      </Link>
    );
  }

  return (
    <article
      onClick={open}
      className="card border-l-[3px] px-4 py-4 md:px-5 cursor-pointer hover:border-line-strong transition-colors max-md:rounded-none max-md:border-x-0 max-md:border-l-[3px]"
      style={{ borderLeftColor: t?.hex }}
      aria-labelledby={`post-${post.id}-title`}
    >
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <TypeTag type={post.type} />
        <PostStatusTags post={post} />
      </div>
      <PostHeader post={post} showCommunity={showCommunity} />
      <h3 id={`post-${post.id}-title`} className={`mt-3 text-title font-semibold line-clamp-2 ${muted ? 'text-ink-2' : 'text-ink'}`}>
        <Link to={`/post/${post.id}`} className="hover:underline underline-offset-2 decoration-1">
          {post.title}
        </Link>
      </h3>
      {post.body && (
        <p className={`mt-1 line-clamp-3 ${muted ? 'text-ink-3' : 'text-ink-2'}`}>
          <Linkify text={post.body.replace(/\s+/g, ' ')} />
        </p>
      )}
      {(post.event || post.item || post.type === 'request' || post.type === 'doubt') && (
        <div className="mt-3">
          <TypeStrip post={post} />
        </div>
      )}
      {post.images.length > 0 && (
        <div className="mt-3">
          <ImageGrid images={post.images} preview />
        </div>
      )}
      <div className="mt-3 flex items-center gap-x-3 gap-y-2 flex-wrap">
        <VoteButtons kind="posts" id={post.id} score={post.score} myVote={post.myVote} isOwn={isOwn} />
        <Link to={`/post/${post.id}#comments`} className="inline-flex items-center gap-1.5 h-9 px-2 rounded text-meta text-ink-2 hover:bg-surface-2 hover:text-ink" onClick={(e) => e.stopPropagation()}>
          <MessageCircle size={18} aria-hidden="true" />
          <span className="tabular-nums">{post.commentCount}</span>
          <span className="sr-only md:not-sr-only">{post.commentCount === 1 ? 'comment' : 'comments'}</span>
        </Link>
        {action && <div className="ml-auto">{action}</div>}
      </div>
    </article>
  );
}
