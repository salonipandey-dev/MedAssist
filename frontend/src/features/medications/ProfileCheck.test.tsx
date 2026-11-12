import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountApiError,
  type AccountSession,
  type MedicationCheck,
} from '../../services/api/account';
import { AccountProvider } from '../account/AccountProvider';
import { ProfileCheck } from './ProfileCheck';

const api = vi.hoisted(() => ({
  getSession: vi.fn(),
  getMedicationCheck: vi.fn(),
}));
vi.mock('../../services/api/account', async (original) => ({
  ...(await original<typeof import('../../services/api/account')>()),
  ...api,
}));

const session: AccountSession = {
  account: {
    display_name: 'Patient A (fictional)',
    email: 'patient.a@example.test',
    role: 'patient',
  },
  csrf_token: 'c'.repeat(43),
  expires_at: '2026-11-12T20:00:00Z',
  idle_expires_at: '2026-11-12T12:30:00Z',
};
const fixture = {
  id: 'medassist-fictional-medication-rules',
  version: '1.0.0',
  is_fictional: true,
} as const;
const entry = (section: 'medicines' | 'allergies' | 'conditions', name: string, id: string) => ({
  section,
  entry: name,
  matched_id: id,
  matched_name: name,
});
const duplicate: MedicationCheck['matches'][number] = {
  rule_id: 'DEMO-DUP-001',
  check: 'duplicate_ingredient',
  title: 'Same ingredient in two recorded medicines',
  explanation: 'Two recorded medicines list the same invented ingredient in the demo dataset.',
  entries: [
    entry('medicines', 'Brivanol 250 tablets', 'prd-brivanol-250'),
    entry('medicines', 'Coldaway Day Relief', 'prd-coldaway-day'),
  ],
  ingredients: ['brivanol'],
};
const result = (overrides: Partial<MedicationCheck>): MedicationCheck => ({
  fixture,
  profile_version: 2,
  outcome: 'no_matching_rules',
  complete: true,
  matches: [],
  unresolved: [],
  missing: [],
  recognised: [],
  ...overrides,
});

function renderCheck() {
  return render(
    <AccountProvider>
      <MemoryRouter initialEntries={['/app/patient/medications']}>
        <ProfileCheck />
      </MemoryRouter>
    </AccountProvider>,
  );
}

async function runCheck() {
  renderCheck();
  fireEvent.click(await screen.findByRole('button', { name: 'Check my saved profile' }));
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

describe('Check my saved profile', () => {
  it('sends nothing when this build has no API', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    renderCheck();

    expect(screen.getByText(/needs the MedAssist API/)).toBeInTheDocument();
    expect(api.getSession).not.toHaveBeenCalled();
    expect(api.getMedicationCheck).not.toHaveBeenCalled();
  });

  it('asks a signed-out visitor to sign in and come back', async () => {
    api.getSession.mockRejectedValue(new AccountApiError('not-signed-in'));
    renderCheck();

    const link = await screen.findByRole('link', { name: 'Sign in' });
    expect(link).toHaveAttribute('href', '/sign-in?next=%2Fapp%2Fpatient%2Fmedications');
    expect(api.getMedicationCheck).not.toHaveBeenCalled();
  });

  it('shows each matched rule with the entries and rule behind it', async () => {
    api.getMedicationCheck.mockResolvedValue(
      result({ outcome: 'matches_found', matches: [duplicate] }),
    );
    await runCheck();

    expect(await screen.findByRole('heading', { name: '1 demo rule matched' })).toBeVisible();
    const [item] = within(screen.getByRole('list', { name: 'Matched demo rules' })).getAllByRole(
      'listitem',
    );
    expect(item).toHaveTextContent('Same ingredient in two recorded medicines');
    expect(item).toHaveTextContent(
      'Brivanol 250 tablets (medicine) · Coldaway Day Relief (medicine)',
    );
    expect(item).toHaveTextContent('brivanol');
    expect(item).toHaveTextContent('DEMO-DUP-001');
    expect(screen.getAllByText('Fictional demo').length).toBeGreaterThan(0);
    expect(screen.getByText(/ask a pharmacist or clinician/)).toBeInTheDocument();
    expect(screen.queryByText('More information needed')).not.toBeInTheDocument();
  });

  it('says no demo rules matched only when every input was covered', async () => {
    api.getMedicationCheck.mockResolvedValue(result({}));
    await runCheck();

    expect(await screen.findByRole('heading', { name: 'No matching demo rules' })).toBeVisible();
    expect(screen.getByText(/recognised every saved entry/)).toBeInTheDocument();
  });

  it('lists ambiguous, unknown and unrecorded inputs and links to the Health Profile', async () => {
    api.getMedicationCheck.mockResolvedValue(
      result({
        outcome: 'more_information_needed',
        complete: false,
        unresolved: [
          {
            section: 'medicines',
            entry: 'Coldaway',
            reason: 'ambiguous',
            candidates: ['Coldaway Day Relief', 'Coldaway Night Relief'],
          },
          { section: 'medicines', entry: 'Calmora syrup', reason: 'unknown', candidates: [] },
        ],
        missing: [
          { section: 'allergies', reason: 'not_recorded', affected_checks: ['allergy_ingredient'] },
        ],
      }),
    );
    await runCheck();

    expect(await screen.findByRole('heading', { name: 'More information needed' })).toBeVisible();
    const gaps = screen.getByRole('list', { name: 'What the demo rules could not check' });
    expect(gaps).toHaveTextContent('could mean Coldaway Day Relief or Coldaway Night Relief');
    expect(gaps).toHaveTextContent('Calmora syrup (medicine): not in the demo dataset');
    expect(gaps).toHaveTextContent('Allergies: not recorded');
    expect(screen.getByRole('link', { name: 'Update your Health Profile' })).toHaveAttribute(
      'href',
      '/app/patient/health-profile',
    );
    expect(screen.queryByText('No matching demo rules')).not.toBeInTheDocument();
  });

  it('shows a warning and incomplete information together', async () => {
    api.getMedicationCheck.mockResolvedValue(
      result({
        outcome: 'matches_found',
        complete: false,
        matches: [duplicate],
        missing: [
          {
            section: 'conditions',
            reason: 'not_recorded',
            affected_checks: ['medicine_condition'],
          },
        ],
      }),
    );
    await runCheck();

    expect(await screen.findByRole('heading', { name: '1 demo rule matched' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'More information needed' })).toBeVisible();
  });

  it('reruns the check on request', async () => {
    api.getMedicationCheck
      .mockResolvedValueOnce(result({ outcome: 'matches_found', matches: [duplicate] }))
      .mockResolvedValueOnce(result({}));
    await runCheck();
    await screen.findByRole('heading', { name: '1 demo rule matched' });

    fireEvent.click(screen.getByRole('button', { name: 'Run the check again' }));

    expect(await screen.findByRole('heading', { name: 'No matching demo rules' })).toBeVisible();
    expect(api.getMedicationCheck).toHaveBeenCalledTimes(2);
  });

  it('asks to sign in again when the session has ended', async () => {
    api.getMedicationCheck.mockRejectedValue(
      new AccountApiError('session-expired', { status: 401 }),
    );
    await runCheck();

    expect(await screen.findByText(/Your session has ended/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('reports an unavailable service with its request ID', async () => {
    api.getMedicationCheck.mockRejectedValue(
      new AccountApiError('unavailable', { status: 503, requestId: 'req-7' }),
    );
    await runCheck();

    expect(await screen.findByRole('alert')).toHaveTextContent('Request ID: req-7');
  });
});
