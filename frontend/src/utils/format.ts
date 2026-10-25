export const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ');
export const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(
    'en-GB',
    options ?? { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
  ).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value));
export const initials = (name: string) =>
  name
    .replace(/^Dr\. /, '')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
