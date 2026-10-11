import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { Input } from './ui/input';

type Props = Omit<ComponentProps<typeof Input>, 'type' | 'value' | 'onChange' | 'min' | 'max'> & {
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
};

/** Keep incomplete numbers editable; apply bounds only when the user commits. */
export function NumberInput({ value, min, max, onValueChange, onBlur, onFocus, onKeyDown, ...props }: Props) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setDraft(String(value)); }, [value, editing]);
  function commit() {
    const parsed = draft.trim() ? Number(draft) : NaN;
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : value;
    setDraft(String(next));
    if (next !== value) onValueChange(next);
  }
  return <Input {...props} type="number" min={min} max={max} value={draft}
    onChange={event => setDraft(event.target.value)}
    onFocus={event => { setEditing(true); onFocus?.(event); }}
    onBlur={event => { commit(); setEditing(false); onBlur?.(event); }}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); commit(); }
      if (event.key === 'Escape') { event.preventDefault(); setDraft(String(value)); }
      onKeyDown?.(event);
    }} />;
}
