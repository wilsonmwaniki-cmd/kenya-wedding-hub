type AuthUserLike = {
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown>;
};

export function isTemporaryDemoUser(user: AuthUserLike | null | undefined) {
  if (!user) return false;
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers as unknown[]
    : [];
  return user.is_anonymous === true
    || user.app_metadata?.provider === 'anonymous'
    || providers.includes('anonymous');
}

export const DEMO_EXTERNAL_ACTION_MESSAGE =
  'This action is disabled in the demo. Your sample changes are still saved inside this temporary workspace.';
