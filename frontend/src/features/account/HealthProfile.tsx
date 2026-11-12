import { LockKeyhole, LogOut, Plus, RefreshCw, Save, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Notice, PageHeading, Panel } from '../../components/ui';
import {
  AccountApiError,
  ENTRIES_PER_SECTION_MAX,
  ENTRY_NAME_MAX,
  ENTRY_NOTE_MAX,
  PROFILE_SECTIONS,
  getHealthProfile,
  saveHealthProfile,
  type AccountSession,
  type HealthProfile as SavedProfile,
  type HealthProfileUpdate,
  type ProfileSectionKey,
  type SectionState,
} from '../../services/api/account';
import { useAccount } from './AccountProvider';
import { HEALTH_PROFILE_ROUTE } from './SignIn';

const SIGN_IN_LINK = `/sign-in?next=${encodeURIComponent(HEALTH_PROFILE_ROUTE)}`;

const SECTION_COPY: Record<
  ProfileSectionKey,
  {
    title: string;
    description: string;
    question: string;
    none: string;
    recorded: string;
    item: string;
    add: string;
  }
> = {
  medicines: {
    title: 'Current medicines',
    description: 'Medicines you take now, as you would describe them',
    question: 'Current medicines',
    none: 'I take no medicines',
    recorded: 'I take medicines',
    item: 'Medicine',
    add: 'Add medicine',
  },
  allergies: {
    title: 'Allergies',
    description: 'Anything you are allergic to, with an optional note',
    question: 'Allergies',
    none: 'No known allergies',
    recorded: 'I have allergies to list',
    item: 'Allergy',
    add: 'Add allergy',
  },
  conditions: {
    title: 'Health conditions',
    description: 'Conditions you have been told you have',
    question: 'Health conditions',
    none: 'No conditions to list',
    recorded: 'I have conditions to list',
    item: 'Condition',
    add: 'Add condition',
  },
};

interface DraftEntry {
  key: number;
  name: string;
  note: string;
}
type Draft = Record<ProfileSectionKey, { state: SectionState; entries: DraftEntry[] }>;
type Errors = Record<string, string>;

const entryId = (section: ProfileSectionKey, key: number, field: 'name' | 'note') =>
  `profile-${section}-${key}-${field}`;

/** The request a draft would send. Entries are only sent for "recorded" sections. */
function toUpdate(draft: Draft, version: number): HealthProfileUpdate {
  const section = (key: ProfileSectionKey) => ({
    state: draft[key].state,
    entries:
      draft[key].state === 'recorded'
        ? draft[key].entries.map((e) => ({ name: e.name.trim(), note: e.note.trim() || null }))
        : [],
  });
  return {
    version,
    medicines: section('medicines'),
    allergies: section('allergies'),
    conditions: section('conditions'),
  };
}

/** Field errors keyed like the API's 422 paths, e.g. "medicines.entries.0.name". */
export function validateDraft(draft: Draft): Errors {
  const errors: Errors = {};
  for (const section of PROFILE_SECTIONS) {
    const { state, entries } = draft[section];
    if (state !== 'recorded') continue;
    if (!entries.length) errors[section] = 'Add at least one entry, or choose another option.';
    const seen = new Set<string>();
    entries.forEach((entry, index) => {
      const name = entry.name.trim();
      const path = `${section}.entries.${index}`;
      if (!name) errors[`${path}.name`] = 'Enter a name, or remove this entry.';
      else if (name.length > ENTRY_NAME_MAX)
        errors[`${path}.name`] = `Use ${ENTRY_NAME_MAX} characters or fewer.`;
      else if (seen.has(name.toLocaleLowerCase()))
        errors[`${path}.name`] = 'This name is already listed in this section.';
      seen.add(name.toLocaleLowerCase());
      if (entry.note.trim().length > ENTRY_NOTE_MAX)
        errors[`${path}.note`] = `Use ${ENTRY_NOTE_MAX} characters or fewer.`;
    });
  }
  return errors;
}

function formatSaved(value: string) {
  return new Date(value).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function ProfileEditor({ session }: { session: AccountSession }) {
  const { sessionEnded } = useAccount();
  const nextKey = useRef(0);
  const [saved, setSaved] = useState<SavedProfile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadError, setLoadError] = useState<AccountApiError | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const fromProfile = useCallback(
    (profile: SavedProfile): Draft =>
      Object.fromEntries(
        PROFILE_SECTIONS.map((section) => [
          section,
          {
            state: profile[section].state,
            entries: profile[section].entries.map((e) => ({
              key: nextKey.current++,
              name: e.name,
              note: e.note ?? '',
            })),
          },
        ]),
      ) as Draft,
    [],
  );

  const handleSessionError = useCallback(
    (error: unknown) => {
      if (
        error instanceof AccountApiError &&
        (error.kind === 'session-expired' || error.kind === 'not-signed-in')
      ) {
        sessionEnded();
        return true;
      }
      return false;
    },
    [sessionEnded],
  );

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoadError(null);
      setSaved(null);
      getHealthProfile({ signal }).then(
        (profile) => {
          setSaved(profile);
          setDraft(fromProfile(profile));
          setErrors({});
          setFormError(null);
          setConflict(false);
          setConfirmation(null);
        },
        (error: unknown) => {
          if (signal?.aborted || handleSessionError(error)) return;
          setLoadError(
            error instanceof AccountApiError ? error : new AccountApiError('unexpected'),
          );
        },
      );
    },
    [fromProfile, handleSessionError],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  if (loadError)
    return (
      <Panel title="Your health profile could not be loaded">
        <div className="padded stack">
          <div className="form-alert" role="alert">
            {loadError.message}
            {loadError.requestId && <small> Request ID: {loadError.requestId}</small>}
          </div>
          <div>
            <Button variant="secondary" onClick={() => load()}>
              <RefreshCw size={14} />
              Try again
            </Button>
          </div>
        </div>
      </Panel>
    );
  if (!saved || !draft)
    return (
      <div className="profile-loading" role="status">
        <span className="sr-only">Loading your health profile</span>
        <div className="skeleton" aria-hidden="true" />
        <div className="skeleton" aria-hidden="true" />
      </div>
    );

  const update = toUpdate(draft, saved.version);
  // Saved entries are already trimmed with blank notes as null, so they compare
  // directly with the request this draft would send.
  const dirty =
    JSON.stringify(update) !==
    JSON.stringify({
      version: saved.version,
      medicines: saved.medicines,
      allergies: saved.allergies,
      conditions: saved.conditions,
    });

  function change(section: ProfileSectionKey, next: Draft[ProfileSectionKey]) {
    setDraft((current) => (current ? { ...current, [section]: next } : current));
    setConfirmation(null);
  }

  function chooseState(section: ProfileSectionKey, state: SectionState) {
    const current = draft![section];
    let entries = current.entries;
    if (state === 'recorded' && !entries.length) {
      const key = nextKey.current++;
      entries = [{ key, name: '', note: '' }];
      requestAnimationFrame(() => document.getElementById(entryId(section, key, 'name'))?.focus());
    }
    change(section, { state, entries });
  }

  function addEntry(section: ProfileSectionKey) {
    const key = nextKey.current++;
    const current = draft![section];
    change(section, { ...current, entries: [...current.entries, { key, name: '', note: '' }] });
    requestAnimationFrame(() => document.getElementById(entryId(section, key, 'name'))?.focus());
  }

  function removeEntry(section: ProfileSectionKey, key: number) {
    const current = draft![section];
    const index = current.entries.findIndex((e) => e.key === key);
    const entries = current.entries.filter((e) => e.key !== key);
    change(section, { ...current, entries });
    // Keep focus in the section: the next entry, the previous one, or the add button.
    const target = entries[index] ?? entries[index - 1];
    requestAnimationFrame(() =>
      (target
        ? document.getElementById(entryId(section, target.key, 'name'))
        : document.getElementById(`profile-${section}-add`)
      )?.focus(),
    );
  }

  function editEntry(
    section: ProfileSectionKey,
    key: number,
    field: 'name' | 'note',
    value: string,
  ) {
    const current = draft![section];
    change(section, {
      ...current,
      entries: current.entries.map((e) => (e.key === key ? { ...e, [field]: value } : e)),
    });
  }

  function focusFirstError(found: Errors) {
    const first = Object.keys(found)[0];
    if (!first) return;
    const [section, , index, field] = first.split('.') as [
      ProfileSectionKey,
      string,
      string,
      string,
    ];
    const entry = draft![section]?.entries[Number(index)];
    const target =
      entry && (field === 'name' || field === 'note')
        ? document.getElementById(entryId(section, entry.key, field))
        : document.getElementById(`profile-${section}-state-recorded`);
    target?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || conflict) return;
    const found = validateDraft(draft!);
    setErrors(found);
    setConfirmation(null);
    if (Object.keys(found).length) {
      setFormError('Some entries need attention. Nothing has been saved yet.');
      focusFirstError(found);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      const result = await saveHealthProfile(update, session.csrf_token);
      setSaved(result);
      setDraft(fromProfile(result));
      setConfirmation(`Saved ${formatSaved(result.updated_at ?? new Date().toISOString())}.`);
      toast.success('Health profile saved.');
    } catch (error) {
      if (handleSessionError(error)) return;
      if (error instanceof AccountApiError && error.kind === 'conflict') setConflict(true);
      else if (error instanceof AccountApiError && error.kind === 'invalid') {
        const mapped = Object.fromEntries(
          error.fieldErrors.map((f) => [f.path.join('.'), f.message]),
        );
        setErrors(mapped);
        setFormError('The server did not accept some entries. Nothing has been saved.');
        focusFirstError(mapped);
      } else
        setFormError(
          error instanceof AccountApiError ? error.message : 'Saving failed. Please try again.',
        );
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    setDraft(fromProfile(saved!));
    setErrors({});
    setFormError(null);
  }

  const errorCount = Object.keys(errors).length;
  return (
    <form className="health-profile-form" noValidate onSubmit={submit}>
      <div className="profile-status" role="status">
        {confirmation ? (
          <strong>{confirmation}</strong>
        ) : saved.updated_at ? (
          <span>Last saved {formatSaved(saved.updated_at)}.</span>
        ) : (
          <span>Nothing saved yet. Every section starts as “Not recorded yet”.</span>
        )}
      </div>
      {conflict && (
        <div className="form-alert form-alert-warning" role="alert">
          <p>
            <strong>This profile was changed in another tab or device.</strong> Your changes here
            have not been saved, so nothing was overwritten. Load the latest version, then make your
            changes again.
          </p>
          <Button variant="secondary" size="sm" type="button" onClick={() => load()}>
            <RefreshCw size={14} />
            Load latest version
          </Button>
        </div>
      )}
      {formError && (
        <div className="form-alert" role="alert">
          {formError}
          {errorCount > 0 && <small> {errorCount} field(s) highlighted below.</small>}
        </div>
      )}
      {PROFILE_SECTIONS.map((section) => {
        const copy = SECTION_COPY[section];
        const { state, entries } = draft[section];
        const sectionError = errors[section];
        return (
          <Panel
            key={section}
            className="profile-section"
            title={copy.title}
            description={copy.description}
            headingId={`profile-${section}-title`}
          >
            <div className="padded">
              <fieldset
                className="choice-group"
                aria-describedby={sectionError ? `profile-${section}-error` : undefined}
              >
                <legend className="sr-only">{copy.question}</legend>
                {(
                  [
                    ['not_recorded', 'Not recorded yet'],
                    ['none', copy.none],
                    ['recorded', copy.recorded],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="choice"
                    htmlFor={`profile-${section}-state-${value}`}
                  >
                    <input
                      type="radio"
                      id={`profile-${section}-state-${value}`}
                      name={`profile-${section}-state`}
                      checked={state === value}
                      onChange={() => chooseState(section, value)}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              {sectionError && (
                <p className="field-error" id={`profile-${section}-error`}>
                  {sectionError}
                </p>
              )}
              {state === 'recorded' && (
                <>
                  {entries.length > 0 && (
                    <ol className="profile-entries" aria-label={`${copy.title} entries`}>
                      {entries.map((entry, index) => {
                        const nameError = errors[`${section}.entries.${index}.name`];
                        const noteError = errors[`${section}.entries.${index}.note`];
                        const nameId = entryId(section, entry.key, 'name');
                        const noteId = entryId(section, entry.key, 'note');
                        return (
                          <li key={entry.key} className="profile-entry">
                            <div className="field">
                              <label htmlFor={nameId}>
                                {copy.item} {index + 1}
                              </label>
                              <input
                                id={nameId}
                                value={entry.name}
                                onChange={(e) =>
                                  editEntry(section, entry.key, 'name', e.target.value)
                                }
                                aria-invalid={!!nameError}
                                aria-describedby={nameError ? `${nameId}-error` : undefined}
                                autoComplete="off"
                                maxLength={ENTRY_NAME_MAX + 20}
                              />
                              {nameError && (
                                <span className="field-error" id={`${nameId}-error`}>
                                  {nameError}
                                </span>
                              )}
                            </div>
                            <div className="field">
                              <label htmlFor={noteId}>Note (optional)</label>
                              <input
                                id={noteId}
                                value={entry.note}
                                onChange={(e) =>
                                  editEntry(section, entry.key, 'note', e.target.value)
                                }
                                aria-invalid={!!noteError}
                                aria-describedby={noteError ? `${noteId}-error` : undefined}
                                autoComplete="off"
                                maxLength={ENTRY_NOTE_MAX + 20}
                              />
                              {noteError && (
                                <span className="field-error" id={`${noteId}-error`}>
                                  {noteError}
                                </span>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="profile-entry-remove"
                              onClick={() => removeEntry(section, entry.key)}
                              aria-label={`Remove ${copy.item.toLowerCase()} ${index + 1}${entry.name.trim() ? `: ${entry.name.trim()}` : ''}`}
                            >
                              <X size={14} />
                              Remove
                            </Button>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    id={`profile-${section}-add`}
                    onClick={() => addEntry(section)}
                    disabled={entries.length >= ENTRIES_PER_SECTION_MAX}
                  >
                    <Plus size={14} />
                    {copy.add}
                  </Button>
                  {entries.length >= ENTRIES_PER_SECTION_MAX && (
                    <small className="muted">
                      {' '}
                      Up to {ENTRIES_PER_SECTION_MAX} entries per section.
                    </small>
                  )}
                </>
              )}
            </div>
          </Panel>
        );
      })}
      <div className="form-actions profile-actions">
        {dirty && !conflict && <span className="muted text-small">You have unsaved changes.</span>}
        <Button type="button" variant="secondary" onClick={discard} disabled={!dirty || saving}>
          Discard changes
        </Button>
        <Button type="submit" disabled={saving || conflict || !dirty}>
          <Save size={14} />
          {saving ? 'Saving…' : 'Save health profile'}
        </Button>
      </div>
    </form>
  );
}

export function HealthProfilePage() {
  const { state, ensureChecked, recheck, signOut } = useAccount();
  useEffect(ensureChecked, [ensureChecked]);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      toast.success('Signed out. Your health profile was cleared from this page.');
    } catch {
      toast.warning(
        'Signed out on this page, but the server could not be reached to end the session. It ends on its own after 30 minutes without use.',
      );
    } finally {
      setSigningOut(false);
    }
  }

  let content;
  if (state.status === 'not-configured')
    content = (
      <Notice>
        <strong>Health profiles need the MedAssist API.</strong> This build is not connected to it,
        so there is nothing to sign in to. The other patient demos still work with fictional
        records.
      </Notice>
    );
  else if (state.status === 'unchecked' || state.status === 'checking')
    content = (
      <p className="muted" role="status">
        Checking whether you are signed in…
      </p>
    );
  else if (state.status === 'unavailable')
    content = (
      <div className="stack">
        <div className="form-alert" role="alert">
          {state.error.message}
        </div>
        <div>
          <Button variant="secondary" onClick={recheck}>
            <RefreshCw size={14} />
            Try again
          </Button>
        </div>
      </div>
    );
  else if (state.status === 'signed-out')
    content = (
      <Panel
        title={
          state.reason === 'expired'
            ? 'Your session has ended'
            : state.reason === 'signed-out'
              ? 'You have signed out'
              : 'Sign in to see your health profile'
        }
      >
        <div className="padded stack">
          <p className="muted">
            {state.reason === 'expired'
              ? 'Sign in again to continue. Changes that were not saved have been cleared from this page.'
              : state.reason === 'signed-out'
                ? 'Your health profile has been cleared from this page.'
                : 'Your health profile is private to your account. Use a fictional demo account.'}
          </p>
          <div>
            <Button asChild>
              <Link to={SIGN_IN_LINK}>
                <LockKeyhole size={15} />
                Sign in
              </Link>
            </Button>
          </div>
        </div>
      </Panel>
    );
  else
    content = (
      <>
        <div className="profile-account">
          <span>
            Signed in as <strong>{state.session.account.display_name}</strong>
          </span>
          <Button variant="secondary" size="sm" onClick={handleSignOut} disabled={signingOut}>
            <LogOut size={14} />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
        <ProfileEditor key={state.session.csrf_token} session={state.session} />
      </>
    );

  return (
    <>
      <PageHeading
        eyebrow="Patient · Private"
        title="Health profile"
        description="Record current medicines, allergies and health conditions in your own account. Only your signed-in session can read or change it."
      />
      <div className="health-profile-notice">
        <Notice kind="safe">
          Academic prototype: use fictional entries only. MedAssist does not check medicines,
          diagnose or give advice from this profile.
        </Notice>
      </div>
      {content}
    </>
  );
}
