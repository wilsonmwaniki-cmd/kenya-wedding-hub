import { useAuth } from '@/contexts/AuthContext';
import { usePlanner } from '@/contexts/PlannerContext';
import { Building2, Mail, Phone, Globe } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

export default function PlannerBrandingBanner() {
  const { profile } = useAuth();
  const { isPlanner, selectedClient } = usePlanner();

  if (!isPlanner || !selectedClient) return null;

  const hasCompanyInfo = profile?.company_name || profile?.company_email || profile?.company_phone;
  if (!hasCompanyInfo) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-[26px] border border-[#ead8c4] bg-[radial-gradient(circle_at_top_left,rgba(227,144,100,0.14),transparent_24%),linear-gradient(180deg,rgba(255,250,245,0.94),rgba(249,242,233,0.92))] px-5 py-4 shadow-[0_18px_40px_rgba(28,22,18,0.05)]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10 border border-[#d8bb8c]/40 bg-[#fff7ef]">
          {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            <Building2 className="h-3.5 w-3.5" />
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary/80">Planner studio</p>
          <span className="font-editorial text-2xl font-semibold leading-none text-foreground">{profile.company_name || profile.full_name}</span>
        </div>
      </div>
      {profile.company_email && (
        <a href={`mailto:${profile.company_email}`} className="flex items-center gap-1.5 rounded-full border border-[#ebdccb] bg-white/70 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <Mail className="h-3.5 w-3.5" />{profile.company_email}
        </a>
      )}
      {profile.company_phone && (
        <span className="flex items-center gap-1.5 rounded-full border border-[#ebdccb] bg-white/70 px-3 py-2 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />{profile.company_phone}
        </span>
      )}
      {profile.company_website && (
        <a href={profile.company_website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border border-[#ebdccb] bg-white/70 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
          <Globe className="h-3.5 w-3.5" />{profile.company_website.replace(/^https?:\/\//, '')}
        </a>
      )}
      </div>
    </div>
  );
}
