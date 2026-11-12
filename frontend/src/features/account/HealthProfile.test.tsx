import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountApiError,
  type AccountSession,
  type HealthProfile,
} from '../../services/api/account';
import { AccountProvider } from './AccountProvider';
import { HealthProfilePage, validateDraft } from './HealthProfile';

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getHealthProfile: vi.fn(),
  saveHealthProfile: vi.fn(),
}));
vi.mock('../../services/api/account', async (original) => ({
  ...(await original<typeof import('../../services/api/account')>()),
  ...api,
}));

const CSRF = 'c'.repeat(43);
const session: AccountSession = {
  account: {
    display_name: 'Patient A (fictional)',
    email: 'patient.a@example.test',
    role: 'patient',
  },
  csrf_token: CSRF,
  expires_at: '2026-11-12T20:00:00Z',
  idle_expires_at: '2026-11-12T12:30:00Z',
};
const empty: HealthProfile = {
  version: 0,
  updated_at: null,
  medicines: { state: 'not_recorded', entries: [] },
  allergies: { state: 'not_recorded', entries: [] },
  conditions: { state: 'not_recorded', entries: [] },
};
const savedB: HealthProfile = {
  version: 1,
  updated_at: '2026-11-12T12:00:00Z',
  medicines: { state: 'recorded', entries: [{ name: 'Velorin (fictional)', note: null }] },
  allergies: { state: 'none', entries: [] },
  conditions: { state: 'not_recorded', entries: [] },
};

const region = (name: string) => screen.getByRole('region', { name });
const saveButton = () => screen.getByRole('button', { name: 'Save health profile' });

function renderPage() {
  return render(
    <AccountProvider>
      <MemoryRouter initialEntries={['/app/patient/health-profile']}>
        <HealthProfilePage />
      </MemoryRouter>
    </AccountProvider>,
  );
}

async function renderLoaded(profile: HealthProfile = empty) {
  api.getHealthProfile.mockResolvedValue(profile);
  renderPage();
  await screen.findByRole('region', { name: 'Current medicines' });
}

function addEntry(section: string, choice: string, item: string, name: string, note = '') {
  const area = region(section);
  const recorded = within(area).getByRole('radio', { name: choice });
  if (!(recorded as HTMLInputElement).checked) fireEvent.click(recorded);
  else fireEvent.click(within(area).getByRole('button', { name: new RegExp(`^Add `) }));
  const inputs = within(area).getAllByLabelText(new RegExp(`^${item} \\d+$`));
  const input = inputs[inputs.length - 1];
  fireEvent.change(input, { target: { value: name } });
  const notes = within(area).getAllByLabelText('Note (optional)');
  fireEvent.change(notes[notes.length - 1], { target: { value: note } });
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8000');
  for (const fn of Object.values(api)) fn.mockReset();
  api.getSession.mockResolvedValue(session);
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('Health profile screen', () => {
  it('explains that the API is needed when this build has none', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    renderPage();

    expect(screen.getByText(/Health profiles need the MedAssist API/)).toBeInTheDocument();
    expect(api.getSession).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in and loads nothing', async () => {
    api.getSession.mockRejectedValue(new AccountApiError('not-signed-in'));
    renderPage();

    const link = await screen.findByRole('link', { name: 'Sign in' });
    expect(link).toHaveAttribute('href', '/sign-in?next=%2Fapp%2Fpatient%2Fhealth-profile');
    expect(api.getHealthProfile).not.toHaveBeenCalled();
  });

  it('shows an empty profile with every section not recorded', async () => {
    await renderLoaded();

    expect(screen.getByText(/Nothing saved yet/)).toBeInTheDocument();
    for (const name of ['Current medicines', 'Allergies', 'Health conditions'])
      expect(within(region(name)).getByRole('radio', { name: 'Not recorded yet' })).toBeChecked();
    expect(saveButton()).toBeDisabled();
  });

  it('saves entries in all three sections with the loaded version and CSRF token', async () => {
    await renderLoaded();
    api.saveHealthProfile.mockImplementation(async (update) => ({
      ...update,
      version: 1,
      updated_at: '2026-11-12T12:00:00Z',
    }));

    addEntry('Current medicines', 'I take medicines', 'Medicine', 'Tarvexol (fictional)', 'Daily');
    addEntry('Allergies', 'I have allergies to list', 'Allergy', 'Sample pollen X');
    addEntry('Health conditions', 'I have conditions to list', 'Condition', 'Sample condition Q');
    fireEvent.click(saveButton());

    expect(await screen.findByText(/^Saved /)).toBeInTheDocument();
    expect(api.saveHealthProfile).toHaveBeenCalledWith(
      {
        version: 0,
        medicines: {
          state: 'recorded',
          entries: [{ name: 'Tarvexol (fictional)', note: 'Daily' }],
        },
        allergies: { state: 'recorded', entries: [{ name: 'Sample pollen X', note: null }] },
        conditions: { state: 'recorded', entries: [{ name: 'Sample condition Q', note: null }] },
      },
      CSRF,
    );
  });

  it('keeps "none" separate from "not recorded"', async () => {
    await renderLoaded();
    api.saveHealthProfile.mockImplementation(async (update) => ({
      ...update,
      updated_at: '2026-11-12T12:00:00Z',
      version: 1,
    }));

    fireEvent.click(within(region('Allergies')).getByRole('radio', { name: 'No known allergies' }));
    fireEvent.click(saveButton());

    await screen.findByText(/^Saved /);
    const update = api.saveHealthProfile.mock.calls[0][0];
    expect(update.allergies).toEqual({ state: 'none', entries: [] });
    expect(update.medicines).toEqual({ state: 'not_recorded', entries: [] });
  });

  it('shows validation errors next to the fields and saves nothing', async () => {
    await renderLoaded();

    fireEvent.click(
      within(region('Current medicines')).getByRole('radio', { name: 'I take medicines' }),
    );
    fireEvent.click(saveButton());

    const input = within(region('Current medicines')).getByLabelText('Medicine 1');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a name, or remove this entry.');
    expect(screen.getByRole('alert')).toHaveTextContent('Nothing has been saved yet.');
    expect(api.saveHealthProfile).not.toHaveBeenCalled();
  });

  it('reports a conflicting edit and reloads the latest version on request', async () => {
    await renderLoaded(savedB);
    api.saveHealthProfile.mockRejectedValue(
      new AccountApiError('conflict', { status: 409, currentVersion: 2 }),
    );

    fireEvent.click(within(region('Allergies')).getByRole('radio', { name: 'Not recorded yet' }));
    fireEvent.click(saveButton());

    expect(await screen.findByText(/changed in another tab or device/)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    api.getHealthProfile.mockResolvedValue({ ...savedB, version: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Load latest version' }));
    await screen.findByRole('region', { name: 'Current medicines' });
    expect(screen.queryByText(/changed in another tab or device/)).not.toBeInTheDocument();
    expect(api.getHealthProfile).toHaveBeenCalledTimes(2);
  });

  it('clears the profile and asks to sign in again when the session has ended', async () => {
    await renderLoaded(savedB);
    api.saveHealthProfile.mockRejectedValue(
      new AccountApiError('session-expired', { status: 401 }),
    );

    fireEvent.click(within(region('Allergies')).getByRole('radio', { name: 'Not recorded yet' }));
    fireEvent.click(saveButton());

    expect(
      await screen.findByRole('heading', { name: 'Your session has ended' }),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Velorin (fictional)')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Current medicines' })).not.toBeInTheDocument();
  });

  it('removes profile data from the page on sign-out', async () => {
    await renderLoaded(savedB);
    api.signOut.mockResolvedValue(undefined);
    expect(screen.getByDisplayValue('Velorin (fictional)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'You have signed out' })).toBeInTheDocument();
    expect(api.signOut).toHaveBeenCalledWith(CSRF);
    expect(screen.queryByDisplayValue('Velorin (fictional)')).not.toBeInTheDocument();
  });

  it('shows a retry when the profile cannot be loaded', async () => {
    api.getHealthProfile.mockRejectedValueOnce(new AccountApiError('unavailable', { status: 503 }));
    api.getHealthProfile.mockResolvedValueOnce(empty);
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await screen.findByRole('region', { name: 'Current medicines' });
  });
});

describe('validateDraft', () => {
  it('matches the server rules for entries', () => {
    const draft = {
      medicines: {
        state: 'recorded' as const,
        entries: [
          { key: 1, name: 'Velorin', note: '' },
          { key: 2, name: ' velorin ', note: '' },
          { key: 3, name: '', note: 'x'.repeat(301) },
        ],
      },
      allergies: { state: 'recorded' as const, entries: [] },
      conditions: { state: 'none' as const, entries: [] },
    };

    expect(validateDraft(draft)).toEqual({
      'medicines.entries.1.name': 'This name is already listed in this section.',
      'medicines.entries.2.name': 'Enter a name, or remove this entry.',
      'medicines.entries.2.note': 'Use 300 characters or fewer.',
      allergies: 'Add at least one entry, or choose another option.',
    });
  });
});
