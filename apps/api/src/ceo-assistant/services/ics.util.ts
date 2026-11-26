/**
 * Minimal, dependency-free iCalendar (.ics) builder for meeting invites.
 * Produces a VCALENDAR that Google Calendar, Outlook and Apple Calendar all accept:
 * METHOD:REQUEST adds/updates the event on the attendee's calendar, METHOD:CANCEL removes it.
 */

export type IcsPerson = { email: string; name?: string };

export type IcsOptions = {
  uid: string;
  sequence: number;
  method: 'REQUEST' | 'CANCEL';
  status: 'CONFIRMED' | 'CANCELLED';
  title: string;
  description?: string | null;
  location?: string | null;
  start: Date;
  end: Date;
  organizer: IcsPerson;
  attendees: IcsPerson[];
};

const pad = (n: number) => String(n).padStart(2, '0');

/** UTC timestamp in iCalendar basic format: 20261126T110000Z */
function toIcsDate(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** escape text per RFC 5545 (backslash, semicolon, comma, newline) */
function esc(s: string): string {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** fold long content lines to <=75 octets, continuation lines start with a space (RFC 5545 §3.1) */
function fold(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [];
  let rest = line;
  out.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    out.push(' ' + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest.length) out.push(' ' + rest);
  return out.join('\r\n');
}

export function buildIcs(o: IcsOptions): string {
  const cn = (p: IcsPerson) => (p.name ? `;CN=${esc(p.name)}` : '');
  const descParts = [o.description?.trim() || '', o.location ? `Join: ${o.location}` : ''].filter(Boolean);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'PRODID:-//EZ Manage//Executive Hub//EN',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    `METHOD:${o.method}`,
    'BEGIN:VEVENT',
    `UID:${o.uid}`,
    `SEQUENCE:${o.sequence}`,
    `DTSTAMP:${toIcsDate(new Date())}`,
    `DTSTART:${toIcsDate(o.start)}`,
    `DTEND:${toIcsDate(o.end)}`,
    `SUMMARY:${esc(o.title)}`,
    ...(descParts.length ? [`DESCRIPTION:${esc(descParts.join('\n\n'))}`] : []),
    ...(o.location ? [`LOCATION:${esc(o.location)}`] : []),
    `ORGANIZER${cn(o.organizer)}:mailto:${o.organizer.email}`,
    ...o.attendees.map(
      (a) => `ATTENDEE${cn(a)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`,
    ),
    `STATUS:${o.status}`,
    'TRANSP:OPAQUE',
    // a 15-minute reminder (only meaningful for live invites, not cancellations)
    ...(o.method === 'REQUEST'
      ? ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'TRIGGER:-PT15M', 'END:VALARM']
      : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n');
}
