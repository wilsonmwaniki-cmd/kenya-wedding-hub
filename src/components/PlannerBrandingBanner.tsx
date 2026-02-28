import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { Building2, Mail, Phone, Globe } from 'lucide-react';

export default function PlannerBrandingBanner() {
  const { profile } = useAuth();
  const { isPlanner, selectedClient } = usePlanner();

  if (!isPlanner || !selectedClient) return null;

  const hasCompanyInfo = profile?.company_name || profile?.company_email || profile?.company_phone;
  if (!hasCompanyInfo) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-foreground">{profile.company_name || profile.full_name}</span>
      </div>
      {profile.company_email && (
        <a href={`mailto:${profile.company_email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Mail className="h-3.5 w-3.5" />{profile.company_email}
        </a>
      )}
      {profile.company_phone && (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />{profile.company_phone}
        </span>
      )}
      {profile.company_website && (
        <a href={profile.company_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <Globe className="h-3.5 w-3.5" />{profile.company_website.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  );
}
