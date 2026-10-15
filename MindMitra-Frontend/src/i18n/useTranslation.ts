import { useAuth } from '@/context/AuthContext';
import { translate } from './translations';

/**
 * Returns a t(key) function scoped to the current patient's saved
 * preferred_language. Falls back to English if no patient is logged in
 * (e.g. a caregiver session) or the language isn't set yet.
 */
export function useTranslation() {
  const { patient } = useAuth();
  const languageCode = patient?.preferred_language ?? 'en';

  return {
    t: (key: Parameters<typeof translate>[1]) => translate(languageCode, key),
    languageCode,
  };
}
