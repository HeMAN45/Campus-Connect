import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Download, ExternalLink, Flag, Lock, Pencil, Pin, RotateCcw, Send, Trash2, Unlock, Users } from 'lucide-react';
import { PostHeader, PostStatusTags, TypeStrip } from '../components/post/PostCard.jsx';
import { ImageGrid } from '../components/post/Images.jsx';
import { RsvpButtons } from '../components/post/EventBits.jsx';
import VoteButtons from '../components/post/VoteButtons.jsx';
import CommentSection from '../components/comments/CommentSection.jsx';
import ReportModal from '../components/ReportModal.jsx';
import Linkify from '../components/Linkify.jsx';
import { ConfirmModal, ErrorState, Field, Menu, Modal, PageLoader, Spinner, TypeTag, UserName, Avatar } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { openConversation } from '../lib/dm.js';
import { POST_TYPES } from '../lib/postTypes.js';
import { yearLabel } from '../lib/format.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

function EditModal({ post, onClose, onSaved }) {
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api(`/posts/${post.id}`, { method: 'PATCH', body: { title, body } });
      onSaved(r.post);
      onClose();
    } catch (e) {
      setErrors(e.fields?.title || e.fields?.body ? e.fields : { title: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Edit post"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            Save changes
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field id="e-title" label="Title" error={errors.title}>
          <input id="e-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} data-autofocus />
        </Field>
        <Field id="e-body" label="Description" error={errors.body}>
          <textarea id="e-body" className="textarea" rows={8} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
        </Field>
        <p className="help">Posts can be edited for 24 hours after posting.</p>
      </div>
    </Modal>
  );
}

function RsvpListModal({ post, onClose }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api(`/posts/${post.id}/rsvps`)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, [post.id]);
  return (
    <Modal
      title="RSVPs"
      onClose={onClose}
      footer={
        <a className="btn-secondary" href={`/api/posts/${post.id}/rsvps?format=csv`} download>
          <Download size={16} /> Download CSV
        </a>
      }
    >
      {!items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="text-ink-2">No RSVPs yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((r) => (
            <li key={r.id} className="py-2.5 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <Link to={`/u/${r.id}`} className="font-medium hover:underline">
                  {r.name}
                </Link>
                <span className="block text-meta text-ink-2 truncate">
                  {[r.dept, r.role === 'student' ? yearLabel(r.year) : r.role === 'teacher' ? 'Faculty' : null].filter(Boolean).join(' . ')}
                </span>
              </span>
              <span className={`tag ${r.status === 'going' ? 'text-success border-success/40 bg-success-soft' : 'text-ink-2 border-line'}`}>{r.status}</span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  const load = async () => {
    try {
      setData(await api(`/posts/${id}`));
      setError(null);
    } catch (e) {
      setError(e);
    }
  };
  useEffect(() => {
    setData(null);
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!data) return <PageLoader />;

  const { post, viewer } = data;
  const setPost = (p) => setData((d) => ({ ...d, post: { ...d.post, ...p } }));
  const own = viewer.isOwner;
  const t = POST_TYPES[post.type];
  const resolvable = ['request', 'lost', 'found'].includes(post.type);
  const resolveLabel = post.type === 'request' ? 'Mark as fulfilled' : 'Mark as resolved';

  const act = async (fn, message) => {
    try {
      const r = await fn();
      if (r?.post) setPost(r.post);
      if (message) toast(message);
    } catch (e) {
      toast(e.message);
    }
  };
  const resolve = (resolved) =>
    act(() => api(`/posts/${post.id}/resolve`, { method: 'POST', body: { resolved } }), resolved ? 'Marked as done. Nice!' : 'Reopened');
  const dm = async (prefill) => {
    try {
      await openConversation(navigate, post.author.id, prefill);
    } catch (e) {
      toast(e.message);
    }
  };
  const join = async () => {
    try {
      await api(`/communities/${post.community.slug}/join`, { method: 'POST' });
      setData((d) => ({ ...d, viewer: { ...d.viewer, isMember: true } }));
      toast(`You joined ${post.community.name}`);
    } catch (e) {
      toast(e.message);
    }
  };

  const menu = [
    viewer.canEdit && { label: 'Edit', icon: Pencil, onClick: () => setModal('edit') },
    own && resolvable && post.status === 'resolved' && { label: 'Reopen', icon: RotateCcw, onClick: () => resolve(false) },
    viewer.canPin && {
      label: post.isPinned ? 'Unpin' : 'Pin to top',
      icon: Pin,
      onClick: () => act(() => api(`/posts/${post.id}/pin`, { method: 'POST', body: { pinned: !post.isPinned } }), post.isPinned ? 'Unpinned' : 'Pinned'),
    },
    (own || viewer.canModerate) && {
      label: post.commentsLocked ? 'Turn on comments' : 'Turn off comments',
      icon: post.commentsLocked ? Unlock : Lock,
      onClick: () => act(() => api(`/posts/${post.id}/lock-comments`, { method: 'POST', body: { locked: !post.commentsLocked } })),
    },
    viewer.canSeeRsvps && { label: 'View RSVPs', icon: Users, onClick: () => setModal('rsvps') },
    !own && { label: `Message ${post.author.name.split(' ')[0]}`, icon: Send, onClick: () => dm() },
    !own && { label: 'Report', icon: Flag, onClick: () => setModal('report') },
    viewer.canDelete && { label: 'Delete', icon: Trash2, danger: true, onClick: () => setModal('delete') },
  ];

  return (
    <div className="max-w-[760px] mx-auto">
      <button onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="btn-ghost btn-sm mb-3 -ml-2 max-md:ml-1">
        <ArrowLeft size={16} /> Back
      </button>

      <article className="card border-l-[3px] p-4 md:p-6 max-md:rounded-none max-md:border-x-0" style={{ borderLeftColor: t.hex }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeTag type={post.type} />
            <PostStatusTags post={post} />
          </div>
          <Menu items={menu} label="Post options" />
        </div>
        <div className="mt-3">
          <PostHeader post={post} />
        </div>
        <h1 className="mt-4 text-h2 md:text-[24px] md:leading-8 font-bold">{post.title}</h1>
        {post.body && (
          <div className="mt-3 text-body text-ink">
            <Linkify text={post.body} />
          </div>
        )}

        {(post.event || post.item || post.type === 'request' || post.type === 'doubt') && (
          <div className="mt-5 p-4 rounded-sm bg-surface-2 border border-line space-y-3">
            <TypeStrip post={post} detail />
            {post.event && (
              <>
                <RsvpButtons post={post} onChange={(ev) => setPost({ event: ev })} />
                {post.event.url && (
                  <a href={post.event.url} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary btn-sm">
                    <ExternalLink size={15} /> Registration link
                  </a>
                )}
              </>
            )}
          </div>
        )}

        {post.images.length > 0 && (
          <div className="mt-5">
            <ImageGrid images={post.images} />
          </div>
        )}

        <div className="mt-5 flex items-center gap-3 flex-wrap">
          <VoteButtons kind="posts" id={post.id} score={post.score} myVote={post.myVote} isOwn={own} />
          <div className="ml-auto flex gap-2 flex-wrap">
            {own && resolvable && post.status === 'open' && (
              <button className="btn-primary btn-sm" onClick={() => resolve(true)}>
                <CheckCircle2 size={16} /> {resolveLabel}
              </button>
            )}
            {!own && post.status === 'open' && post.type === 'request' && (
              <button className="btn-primary btn-sm" onClick={() => dm(`Hi, I can help with: ${post.title}`)}>
                <Send size={15} /> Offer help
              </button>
            )}
            {!own && post.status === 'open' && (post.type === 'lost' || post.type === 'found') && (
              <button className="btn-primary btn-sm" onClick={() => dm(post.type === 'lost' ? `Hi, about your lost item: ${post.title}. I think I found it.` : `Hi, I think the item you found is mine: ${post.title}`)}>
                <Send size={15} /> {post.type === 'lost' ? 'I found it' : "It's mine"}
              </button>
            )}
          </div>
        </div>
      </article>

      {post.type === 'doubt' && own && post.status === 'open' && post.commentCount > 0 && (
        <p className="text-meta text-ink-2 mt-3 px-3 md:px-0">Got a helpful answer? Tap "Accept answer" on it so others with the same doubt find it fast.</p>
      )}

      <div className="mt-6 px-3 md:px-0">
        <CommentSection post={post} viewer={viewer} onPostChange={setPost} onJoin={join} />
      </div>

      {post.author && !own && post.author.role === 'teacher' && (
        <div className="mt-8 mx-3 md:mx-0 card p-4 flex items-center gap-3">
          <Avatar user={post.author} size={40} />
          <div className="flex-1 min-w-0">
            <UserName user={post.author} />
            <p className="text-meta text-ink-2">{post.author.designation}</p>
          </div>
          <Link to={`/u/${post.author.id}`} className="btn-secondary btn-sm">
            Cabin and hours
          </Link>
        </div>
      )}

      {modal === 'edit' && <EditModal post={post} onClose={() => setModal(null)} onSaved={setPost} />}
      {modal === 'rsvps' && <RsvpListModal post={post} onClose={() => setModal(null)} />}
      {modal === 'report' && <ReportModal targetType="post" targetId={post.id} onClose={() => setModal(null)} />}
      {modal === 'delete' && (
        <ConfirmModal
          title="Delete this post?"
          text="This can't be undone."
          confirmLabel="Delete post"
          danger
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await api(`/posts/${post.id}`, { method: 'DELETE' });
            toast('Post deleted');
            navigate('/', { replace: true });
          }}
        />
      )}

    </div>
  );
}
