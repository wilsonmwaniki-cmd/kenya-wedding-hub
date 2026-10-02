import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useWeddingEntitlements } from '@/hooks/useWeddingEntitlements';
import { getDocumentOrganiser } from '@/lib/documentOrganiser';

export function useDocumentOrganiser() {
  const { user } = useAuth();
  const wedding = useWeddingEntitlements();
  const query = useQuery({
    queryKey: ['document-organiser', user?.id, wedding.weddingId, wedding.couplePlanTier],
    queryFn: () => getDocumentOrganiser(wedding.weddingId!),
    enabled: Boolean(user && wedding.weddingId && !wedding.loading),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return { ...query, pending: wedding.loading || (Boolean(wedding.weddingId) && query.isPending) };
}
