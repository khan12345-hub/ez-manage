import { resolveStatusCategory, suggestStatusCategory } from './status-category';

describe('suggestStatusCategory', () => {
  it.each([
    ['Done', 'DONE'],
    ['Done ✅', 'DONE'],
    ['Completed', 'DONE'],
    ['Resolved', 'DONE'],
    ['Paid', 'DONE'],
    ['Payment Done', 'DONE'],
    ['Reimbursement Paid', 'DONE'],
    ['Cancelled', 'DONE'],
    ['Not Done', 'ACTIVE'],
    ['Undone', 'ACTIVE'],
    ['Unpaid', 'ACTIVE'],
    ['Partially Paid', 'ACTIVE'],
    ['Pending Payment', 'NOT_STARTED'],
    ['Not Started', 'NOT_STARTED'],
    ['To Do', 'NOT_STARTED'],
    ['Working on it', 'ACTIVE'],
    ['Approved', 'ACTIVE'], // ambiguous on purpose: admin decides
    ['Stuck', 'ACTIVE'],
  ])('%s -> %s', (label, expected) => {
    expect(suggestStatusCategory(label)).toBe(expected);
  });

  it('empty label is ACTIVE', () => {
    expect(suggestStatusCategory('')).toBe('ACTIVE');
    expect(suggestStatusCategory(null)).toBe('ACTIVE');
  });
});

describe('resolveStatusCategory', () => {
  const options = [
    { id: 1, label: 'Approved', category: 'DONE' },
    { id: 2, label: 'Done', category: 'ACTIVE' }, // admin overrode the guess
  ];

  it('uses the option category, not the label guess', () => {
    expect(resolveStatusCategory({ label: 'Approved', color: '#0f0' }, options)).toBe('DONE');
    expect(resolveStatusCategory({ label: 'Done', color: '#0f0' }, options)).toBe('ACTIVE');
  });

  it('matches by option id first', () => {
    expect(resolveStatusCategory({ id: 1, label: 'renamed' }, options)).toBe('DONE');
  });

  it('falls back to the label rule for unknown labels', () => {
    expect(resolveStatusCategory({ label: 'Paid' }, options)).toBe('DONE');
    expect(resolveStatusCategory({ label: 'Not Done' }, [])).toBe('ACTIVE');
  });

  it('returns null when the cell has no status', () => {
    expect(resolveStatusCategory(null, options)).toBeNull();
    expect(resolveStatusCategory({}, options)).toBeNull();
  });
});
