const URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g;

// Renders plain text with safe, clickable http(s) links and preserved line breaks.
export default function Linkify({ text, className = '' }) {
  if (!text) return null;
  const parts = text.split(URL_RE);
  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="link break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part.replace(/^https?:\/\//, '').slice(0, 60)}
            {part.replace(/^https?:\/\//, '').length > 60 ? '...' : ''}
          </a>
        ) : (
          part
        ),
      )}
    </span>
  );
}
