import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export default function DocumentBackLink() {
  const { user, profile } = useAuth();
  const { state } = useLocation();
  const fromInbox = state?.documentReturnTo === '/received-documents';
  const destination = !user ? '/' : fromInbox || profile?.role === 'couple'
    ? '/received-documents'
    : profile?.role === 'vendor' ? '/vendor-documents'
      : profile?.role === 'planner' ? '/planner-documents' : '/';
  return (
    <Button asChild variant="ghost" className="gap-2">
      <Link to={destination}><ArrowLeft className="h-4 w-4" />{destination === '/' ? 'Back to Zania' : 'Back to Documents'}</Link>
    </Button>
  );
}
