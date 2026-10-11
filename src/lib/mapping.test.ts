import { describe, expect, it } from 'vitest';
import type { IconEntry } from '../types';
import { matchIconName, normalizeIconName } from './mapping';

const icon = (id: string, name: string, exportName: string): IconEntry => ({
  id, name, exportName, categories: [], sourceUrl: '', referenceUrl: '', localUrl: '',
});

describe('exact icon mapping', () => {
  it('maps filenames and package export suffixes without dropping variant numbers', () => {
    expect(normalizeIconName('uploads\\Arrow-Down_01IconStrokeRounded.svg')).toBe('arrowdown01');
    expect(normalizeIconName('ArrowDown02Icon.svg')).toBe('arrowdown02');
    const first = icon('arrow-down-01', 'Arrow Down 01', 'ArrowDown01Icon');
    const second = icon('arrow-down-02', 'Arrow Down 02', 'ArrowDown02Icon');
    expect(matchIconName('arrow_down_01.svg', [first, second])).toBe(first);
    expect(matchIconName('ArrowDown02StrokeRounded.svg', [first, second])).toBe(second);
  });

  it('accepts canonical ids, names and export names but does not guess similar names', () => {
    const entry = icon('calendar-01', 'Calendar', 'Calendar01Icon');
    expect(matchIconName('Calendar.svg', [entry])).toBe(entry);
    expect(matchIconName('Calendar01Icon.svg', [entry])).toBe(entry);
    expect(matchIconName('Calender.svg', [entry])).toBeUndefined();
    expect(matchIconName('calendar-02.svg', [entry])).toBeUndefined();
    expect(matchIconName('', [entry])).toBeUndefined();
  });

  it('rejects ambiguous normalized names instead of selecting the first', () => {
    const a = icon('foo-bar', 'First', 'FirstIcon');
    const b = icon('foo_bar', 'Second', 'SecondIcon');
    expect(matchIconName('FooBar.svg', [a, b])).toBeUndefined();
    const c = icon('baz', 'Foo Bar', 'ThirdIcon');
    expect(matchIconName('foo-bar.svg', [a, c])).toBeUndefined();
  });
});
