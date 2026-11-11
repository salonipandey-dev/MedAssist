import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../tests/e2e/fixtures/consultations.json';
import {
  ConsultationApiError,
  type ConsultationListing,
  type ConsultationPage,
  type ConsultationQuery,
} from '../../services/api/consultations';
import { Consultations } from './Consultations';

const listConsultations = vi.hoisted(() => vi.fn());
vi.mock('../../services/api/consultations', async (original) => ({
  ...(await original<typeof import('../../services/api/consultations')>()),
  listConsultations,
}));

const all = fixture.items as ConsultationListing[];
const pageOf = (...ids: string[]): ConsultationPage => ({
  items: all.filter((item) => ids.includes(item.id)),
  total: ids.length,
  limit: 50,
  offset: 0,
  requestId: null,
});
const everything = pageOf(...all.map((item) => item.id));

/** A request the test settles by hand, to control the order responses arrive in. */
function deferred() {
  let resolve!: (page: ConsultationPage) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<ConsultationPage>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const queries = () => listConsultations.mock.calls.map((call) => call[0] as ConsultationQuery);
const names = () =>
  within(screen.getByRole('list', { name: 'Consultation listings' }))
    .getAllByRole('listitem')
    .map((item) => item.querySelector('strong')!.textContent);
const flush = () => act(async () => {});
const type = (text: string) =>
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search consultations' }), {
    target: { value: text },
  });

function renderScreen(path = '/app/patient/consultations') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Consultations />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:8000');
  listConsultations.mockReset();
  listConsultations.mockResolvedValue(everything);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('Find Consultations with the directory API', () => {
  it('shows a loading state, then the listings and the total from the API', async () => {
    const first = deferred();
    listConsultations.mockReturnValueOnce(first.promise);
    renderScreen();

    expect(screen.getByText('Loading consultation listings')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Consultation listings' })).toBeNull();
    expect(queries()).toEqual([{}]);

    await act(async () => first.resolve({ ...everything, total: 12 }));

    expect(names()).toHaveLength(9);
    expect(screen.getByRole('heading', { name: 'Consultation directory' })).toBeInTheDocument();
    expect(screen.getAllByText('Showing 9 of 12 listings')).not.toHaveLength(0);
    expect(screen.getAllByText('Fictional record')).toHaveLength(9);
    expect(screen.getByText('http://127.0.0.1:8000')).toBeInTheDocument();
  });

  it('sends each filter to the server and uses its total', async () => {
    renderScreen();
    await flush();
    listConsultations.mockResolvedValue(pageOf('c-01', 'c-02', 'c-03', 'c-08'));

    fireEvent.change(screen.getByLabelText('Fee'), { target: { value: 'Up to ₹300' } });
    await flush();
    expect(queries().at(-1)).toEqual({ maxFeeMinor: 30000 });
    expect(names()).toHaveLength(4);
    expect(screen.getAllByText('4 matching listings')).not.toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Fee'), { target: { value: 'Free (illustrative)' } });
    fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'In person' } });
    fireEvent.change(screen.getByLabelText('Specialty'), { target: { value: 'ENT' } });
    await flush();
    expect(queries().at(-1)).toEqual({ specialty: 'ENT', mode: 'in_person', feeState: 'free' });

    fireEvent.change(screen.getByLabelText('Fee'), { target: { value: 'Fee not listed' } });
    await flush();
    expect(queries().at(-1)).toMatchObject({ feeState: 'unknown' });
  });

  it('waits for typing to pause before searching and sends spaces as typed', async () => {
    renderScreen();
    await flush();
    expect(listConsultations).toHaveBeenCalledTimes(1);

    type('r');
    type('ri');
    type('riverside');
    await act(async () => vi.advanceTimersByTime(299));
    expect(listConsultations).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTime(1));
    expect(listConsultations).toHaveBeenCalledTimes(2);
    expect(queries().at(-1)).toEqual({ q: 'riverside' });

    type('riverside  ');
    await act(async () => vi.advanceTimersByTime(300));
    expect(listConsultations).toHaveBeenCalledTimes(3);
    expect(queries().at(-1)).toEqual({ q: 'riverside  ' });
  });

  it('keeps the newest results when an older response arrives late', async () => {
    renderScreen();
    await flush();
    const slow = deferred();
    const fast = deferred();
    listConsultations.mockReturnValueOnce(slow.promise).mockReturnValueOnce(fast.promise);

    fireEvent.change(screen.getByLabelText('Specialty'), { target: { value: 'Dermatology' } });
    await flush();
    const slowSignal = listConsultations.mock.calls.at(-1)![1].signal as AbortSignal;
    fireEvent.change(screen.getByLabelText('Specialty'), { target: { value: 'ENT' } });
    await flush();

    expect(slowSignal.aborted).toBe(true);
    await act(async () => fast.resolve(pageOf('c-07')));
    await act(async () => slow.resolve(pageOf('c-05', 'c-09')));

    expect(names()).toEqual(['Harbour ENT Centre (fictional)']);
    expect(screen.getAllByText('1 matching listing')).not.toHaveLength(0);
  });

  it('shows an empty state for a search with no matches and clears it with one control', async () => {
    renderScreen();
    await flush();
    listConsultations.mockResolvedValueOnce(pageOf());

    fireEvent.change(screen.getByLabelText('Specialty'), { target: { value: 'ENT' } });
    await flush();

    expect(screen.getByRole('heading', { name: 'No listings match' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    const clear = screen.getAllByRole('button', { name: 'Clear filters' });
    expect(clear).toHaveLength(1);
    fireEvent.click(clear[0]);
    await flush();
    expect(queries().at(-1)).toEqual({});
    expect(names()).toHaveLength(9);
    expect(screen.getByRole('searchbox', { name: 'Search consultations' })).toHaveFocus();
  });

  it('keeps a failure visible with its request ID and recovers on Retry', async () => {
    listConsultations.mockRejectedValueOnce(
      new ConsultationApiError('unavailable', { requestId: 'sample-request-id' }),
    );
    renderScreen();
    await flush();

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Directory temporarily unavailable');
    expect(alert).toHaveTextContent('Request ID: sample-request-id');
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.queryByText('Offline demo directory')).toBeNull();
    expect(screen.getByRole('searchbox', { name: 'Search consultations' })).toBeInTheDocument();

    listConsultations.mockRejectedValueOnce(new ConsultationApiError('network'));
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await flush();
    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the directory API');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await flush();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(names()).toHaveLength(9);
    expect(listConsultations).toHaveBeenCalledTimes(3);
  });

  it('keeps selections by ID across filter changes and failures, up to three', async () => {
    renderScreen();
    await flush();
    for (const name of ['Riverside Family Clinic', 'Lakeview Teleconsult', 'Meadow Skin Clinic'])
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Compare\\s*${name}`) }));
    const table = screen.getByRole('table', { name: 'consultation comparison' });
    expect(within(table).getAllByRole('columnheader')).toHaveLength(4);

    listConsultations.mockResolvedValueOnce(pageOf('c-05', 'c-09'));
    fireEvent.change(screen.getByLabelText('Specialty'), { target: { value: 'Dermatology' } });
    await flush();
    expect(names()).toHaveLength(2);
    expect(within(table).getByText('Riverside Family Clinic (fictional)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Comparing\s*Meadow Skin Clinic/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    const blocked = screen.getByRole('button', {
      name: /^Compare\s*Brightline Online Dermatology/,
    });
    fireEvent.click(blocked);
    expect(within(blocked.closest('li')!).getByRole('status')).toHaveTextContent(
      'You can compare up to 3 options',
    );
    expect(within(table).getAllByRole('columnheader')).toHaveLength(4);

    listConsultations.mockRejectedValueOnce(new ConsultationApiError('unavailable'));
    fireEvent.change(screen.getByLabelText('Specialty'), { target: { value: 'ENT' } });
    await flush();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
  });

  it('explains the limit inside the details dialog', async () => {
    renderScreen();
    await flush();
    for (const name of ['Riverside Family Clinic', 'Lakeview Teleconsult', 'Meadow Skin Clinic'])
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Compare\\s*${name}`) }));

    const row = screen
      .getByText('Northgate Hospital Outpatients (fictional)', { selector: 'strong' })
      .closest('li')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Details' }));
    const dialog = screen.getByRole('dialog', { name: /Northgate Hospital Outpatients/ });
    expect(dialog).toHaveTextContent('Illustrative registration and consultation fee.');
    expect(dialog).toHaveTextContent('fictional record, not externally verified');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to comparison' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent('You can compare up to 3 options');
  });
});

describe('Find Consultations without the directory API', () => {
  it('explains a missing or invalid API address without sending a request', async () => {
    for (const [origin, title] of [
      ['', 'Directory API not connected'],
      ['https://user:pass@localhost', 'Directory API address is not valid'],
    ]) {
      vi.stubEnv('VITE_API_BASE_URL', origin);
      renderScreen();
      await flush();

      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      expect(screen.queryByRole('searchbox')).toBeNull();
      expect(screen.queryByRole('list')).toBeNull();
      cleanup();
    }
    expect(listConsultations).not.toHaveBeenCalled();
  });

  it('opens the offline demo only on request and never calls the API from it', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    renderScreen();
    expect(screen.queryByText('Offline demo directory')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open offline demo' }));

    expect(screen.getByRole('heading', { name: 'Offline demo directory' })).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Sample consultation options' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(9);
    fireEvent.change(screen.getByLabelText('Fee'), { target: { value: 'Up to ₹300' } });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('4 of 9 sample options', { selector: 'p:not(.sr-only)' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Use directory API' }));
    expect(
      screen.getByRole('heading', { name: 'Directory API not connected' }),
    ).toBeInTheDocument();
    expect(listConsultations).not.toHaveBeenCalled();
  });

  it('returns to a failing API view with the failure still shown', async () => {
    listConsultations.mockRejectedValue(new ConsultationApiError('unavailable'));
    renderScreen();
    await flush();
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open offline demo' }));
    expect(screen.queryByRole('alert')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use directory API' }));
    await flush();

    expect(screen.getByRole('alert')).toHaveTextContent('Directory temporarily unavailable');
  });
});
