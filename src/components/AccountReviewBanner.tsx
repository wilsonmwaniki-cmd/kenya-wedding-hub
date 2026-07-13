import { Link } from 'react-router-dom';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function AccountReviewBanner() {
  const { profile } = useAuth();

  if (!profile || profile.role !== 'couple') {
    return null;
  }

  if (profile.support_review_status === 'pending') {
    return (
      <Alert variant="warning" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>We are reviewing your workspace setup</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            Your account is in a support review queue while we confirm the best planning path for this wedding. You can keep working on your current workspace.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/pricing?audience=planner">
              <Button size="sm" className="rounded-full">View Collaborative plan</Button>
            </Link>
            <Link to="/settings">
              <Button size="sm" variant="outline" className="rounded-full">Open settings</Button>
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (profile.support_review_status === 'restricted') {
    return (
      <Alert variant="destructive" className="mb-6">
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Your account needs a support check-in</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            Some actions may stay limited until support finishes reviewing this account. Your current wedding data is still preserved.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/pricing?audience=planner">
              <Button size="sm" className="rounded-full">Explore Collaborative</Button>
            </Link>
            <Link to="/settings">
              <Button size="sm" variant="outline" className="rounded-full">Review account details</Button>
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (profile.professional_use_risk_level === 'high') {
    return (
      <Alert variant="info" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>A collaborative workflow may fit better</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            It looks like your wedding may involve more moving parts or more people. Collaborative gives you proper access for planners, committee members, family, and vendors.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/pricing?audience=planner">
              <Button size="sm" className="rounded-full">See Collaborative options</Button>
            </Link>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
