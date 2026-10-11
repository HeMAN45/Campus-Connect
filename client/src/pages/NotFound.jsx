import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui.jsx';

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      text="This page doesn't exist or was moved."
      action={
        <Link to="/" className="btn-primary">
          Back to Home
        </Link>
      }
    />
  );
}
