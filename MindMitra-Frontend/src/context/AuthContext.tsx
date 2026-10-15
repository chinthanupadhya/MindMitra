import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabaseClient';
import { syncAllReminderNotifications } from '@/lib/notifications';
import { syncNow } from '@/db/sync';
import { startReconnectSync } from '@/db/reconnectSync';
import { registerUser } from '@/services/recommendationCache';
import type { Tables } from '@/types/database';

type Caregiver = Tables<'caregivers'>;
type Patient = Tables<'patients'>;
type AccountType = 'caregiver' | 'patient' | null;

type SignUpResult = {
  error: string | null;
  // true when the account needs email confirmation before it can do anything
  // else — the profile row hasn't been created yet at this point, only the
  // auth account and its pending metadata.
  needsEmailConfirmation: boolean;
};

type AuthContextValue = {
  session: Session | null;
  accountType: AccountType;
  caregiver: Caregiver | null;
  patient: Patient | null;
  loading: boolean;
  // expectedRole locks the login to a specific account type ("patient" or
  // "caregiver"). If the credentials belong to the other type, signIn
  // rejects them so a patient can never open the caregiver dashboard (and
  // vice versa) by using the wrong login tab.
  signIn: (
    email: string,
    password: string,
    expectedRole: 'patient' | 'caregiver'
  ) => Promise<{ error: string | null }>;
  // preferredLanguage must be a code from the `languages` table (e.g. 'en',
  // 'as', 'hi') — NOT a display label — since it's a foreign key.
  signUpCaregiver: (email: string, password: string, name: string) => Promise<SignUpResult>;
  signUpPatient: (
    email: string,
    password: string,
    name: string,
    preferredLanguageCode?: string | null
  ) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  // Re-fetches the current caregiver/patient row from the database and
  // updates the cached state. Call this after any screen writes directly to
  // the patients/caregivers table (e.g. Profile editing) — without it, the
  // rest of the app keeps showing stale cached data (e.g. SOS reading an
  // emergency contact that was already saved to the database).
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [caregiver, setCaregiver] = useState<Caregiver | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  // Runs every time we have a real session. If this person signed up before
  // confirming their email (or the row creation hasn't landed yet for any
  // reason), their profile row was never created — only pending_role/
  // pending_name/pending_language were stashed in their auth metadata. The
  // first time we see them with a real session and no matching row, we try
  // to create it now from that metadata.
  //
  // Uses upsert (not insert) specifically because signUp() can trigger
  // Supabase's own auth-state-change listener almost immediately — which
  // independently calls this same function via loadProfile's fallback path.
  // Two concurrent plain inserts for the same id would race: one succeeds,
  // the other hits a duplicate-key error. upsert makes both outcomes
  // harmless — whichever runs second just rewrites the same row instead of
  // erroring, so a race can never look like a failure.
  async function createProfileFromPendingMetadata(
    activeSession: Session
  ): Promise<{ created: boolean; error: string | null }> {
    const meta = activeSession.user.user_metadata as {
      pending_role?: 'caregiver' | 'patient';
      pending_name?: string;
      pending_language?: string | null;
    };

    if (!meta?.pending_role || !meta.pending_name) {
      return { created: false, error: null };
    }

    if (meta.pending_role === 'caregiver') {
      const { error } = await supabase.from('caregivers').upsert(
        {
          id: activeSession.user.id,
          name: meta.pending_name,
          email: activeSession.user.email ?? '',
        },
        { onConflict: 'id' }
      );
      if (error) return { created: false, error: error.message };
      return { created: true, error: null };
    }

    if (meta.pending_role === 'patient') {
      const { error } = await supabase.from('patients').upsert(
        {
          id: activeSession.user.id,
          name: meta.pending_name,
          preferred_language: meta.pending_language ?? null,
        },
        { onConflict: 'id' }
      );
      if (error) return { created: false, error: error.message };
      return { created: true, error: null };
    }

    return { created: false, error: null };
  }

  // A logged-in auth user is either a caregiver or a patient (never both) —
  // their row's id always matches auth.uid() in exactly one of these two
  // tables. Check caregivers first since that's the more common account type.
  async function loadProfile(activeSession: Session) {
    const userId = activeSession.user.id;

    const { data: caregiverRow } = await supabase
      .from('caregivers')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (caregiverRow) {
      setCaregiver(caregiverRow);
      setPatient(null);
      setAccountType('caregiver');
      return;
    }

    const { data: patientRow } = await supabase
      .from('patients')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (patientRow) {
      setPatient(patientRow);
      setCaregiver(null);
      setAccountType('patient');
      // Fire-and-forget: re-sync this patient's reminders to real device
      // notifications every time they're confirmed logged in. Doesn't block
      // login on notification permission dialogs or network calls.
      syncAllReminderNotifications(patientRow.id).catch(() => {});
      // Prime the recommendation cache from this patient's existing local
      // SQLite rounds history.  Non-blocking — runs model in background so
      // the first game recommendation is instant even before a round is saved.
      registerUser(patientRow.id, patientRow.screening_assigned_level ?? null).catch(() => {});
      return;
    }

    // No profile row yet — try to create it from pending metadata.
    const { created } = await createProfileFromPendingMetadata(activeSession);
    if (created) {
      await loadProfile(activeSession); // re-run now that the row exists
      return;
    }

    setCaregiver(null);
    setPatient(null);
    setAccountType(null);
  }

  useEffect(() => {
    // Start the connectivity listener: whenever the network returns, run the
    // full local<->Supabase sync (push unsynced rounds/reports/reminders,
    // pull server-generated reports).
    startReconnectSync();

    // On app start, restore whatever session was persisted (see
    // persistSession: true in supabaseClient.ts) — this is what lets someone
    // stay logged in across app restarts and offline stretches.
    supabase.auth.getSession().then(({ data: { session: restoredSession } }) => {
      setSession(restoredSession);
      if (restoredSession) {
        loadProfile(restoredSession).finally(() => setLoading(false));
        startReconnectSync(restoredSession.user.id);
        // Initial sync: push unsynced local rows + pull server reports.
        syncNow(restoredSession.user.id).catch((e) => console.warn("Initial sync failed", e));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession);
      } else {
        setCaregiver(null);
        setPatient(null);
        setAccountType(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(
    email: string,
    password: string,
    expectedRole: 'patient' | 'caregiver'
  ) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error?.message ?? null };

    // The sign-in succeeded, but we must verify the account actually IS the
    // role the user picked on the login screen. Enforce it here (not in the
    // UI) so the guard can't be bypassed. If the credentials belong to the
    // other role, immediately sign out and report it.
    const signIn = supabase.auth.getUser().then(({ data }) => data.user?.id);
    const userId = await signIn;
    if (!userId) {
      await supabase.auth.signOut();
      return { error: "Could not verify account type. Please try again." };
    }

    const roleMatch =
      expectedRole === 'caregiver'
        ? await supabase.from('caregivers').select('id').eq('id', userId).maybeSingle()
        : await supabase.from('patients').select('id').eq('id', userId).maybeSingle();

    if (!roleMatch.data) {
      await supabase.auth.signOut();
      setCaregiver(null);
      setPatient(null);
      setAccountType(null);
      return {
        error:
          expectedRole === 'caregiver'
            ? 'This account is not a caregiver. Please use the Patient login.'
            : 'This account is not a patient. Please use the Caregiver login.',
      };
    }

    return { error: null };
  }

  async function signUpCaregiver(
    email: string,
    password: string,
    name: string
  ): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { pending_role: 'caregiver', pending_name: name } },
    });
    if (error) return { error: error.message, needsEmailConfirmation: false };

    // If Supabase returns a session immediately, email confirmation is off
    // (or was already satisfied) — create the row right now instead of
    // waiting for a later login. Otherwise, the metadata above is all we
    // have for now; the row gets created on their first real login.
    if (data.session) {
      const { error: insertError } = await createProfileFromPendingMetadata(data.session);
      if (insertError) {
        // The auth account exists but the profile row doesn't — sign back
        // out so they're not left in a half-logged-in limbo state, and
        // surface the real reason instead of a silent console.warn.
        await supabase.auth.signOut();
        return { error: insertError, needsEmailConfirmation: false };
      }
      return { error: null, needsEmailConfirmation: false };
    }

    return { error: null, needsEmailConfirmation: true };
  }

  async function signUpPatient(
    email: string,
    password: string,
    name: string,
    preferredLanguageCode?: string | null
  ): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          pending_role: 'patient',
          pending_name: name,
          pending_language: preferredLanguageCode ?? null,
        },
      },
    });
    if (error) return { error: error.message, needsEmailConfirmation: false };

    if (data.session) {
      const { error: insertError } = await createProfileFromPendingMetadata(data.session);
      if (insertError) {
        await supabase.auth.signOut();
        return { error: insertError, needsEmailConfirmation: false };
      }
      return { error: null, needsEmailConfirmation: false };
    }

    return { error: null, needsEmailConfirmation: true };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (session) {
      await loadProfile(session);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        accountType,
        caregiver,
        patient,
        loading,
        signIn,
        signUpCaregiver,
        signUpPatient,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
