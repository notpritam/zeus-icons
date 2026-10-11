import { useEffect, useState } from 'react';
import { Popover } from 'radix-ui';
import { RgbaColorPicker } from 'react-colorful';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { NumberInput } from './NumberInput';

export function IconColorControl({ color, alpha, onChange, disabled }: { color: string; alpha: number; onChange: (color: string, alpha: number) => void; disabled: boolean }) {
  const hex = color === 'currentColor' ? '#000000' : color;
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const [draft, setDraft] = useState(hex.slice(1));
  useEffect(() => setDraft(hex.slice(1)), [hex]);
  function setChannels(values: number[], opacity = alpha) {
    onChange(`#${values.map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`, opacity);
  }
  function commitHex() {
    const value = draft.replace(/^#/, '');
    if (/^[a-f\d]{6}$/i.test(value)) onChange(`#${value.toLowerCase()}`, alpha);
    else if (/^[a-f\d]{3}$/i.test(value)) onChange(`#${[...value].map(char => char + char).join('').toLowerCase()}`, alpha);
    else setDraft(hex.slice(1));
  }
  return <Popover.Root><Popover.Trigger asChild><Button variant="outline" className="icon-color-trigger" aria-label="Icon color" disabled={disabled}><i style={{ background: hex, opacity: alpha / 100 }} />{color}</Button></Popover.Trigger><Popover.Portal><Popover.Content className="icon-color-popover" sideOffset={8} collisionPadding={12} aria-label="Color picker">
    <RgbaColorPicker color={{ r: channels[0], g: channels[1], b: channels[2], a: alpha / 100 }} onChange={value => setChannels([value.r, value.g, value.b], Math.round(value.a * 100))} />
    <div className="icon-color-inputs"><label>Hex<Input aria-label="Hex" value={draft} maxLength={7} onChange={event => setDraft(event.target.value)} onBlur={commitHex} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commitHex(); } if (event.key === 'Escape') setDraft(hex.slice(1)); }} /></label>{['R', 'G', 'B'].map((label, index) => <label key={label}>{label}<NumberInput aria-label={label} min={0} max={255} value={channels[index]} onValueChange={value => setChannels(channels.map((channel, position) => position === index ? value : channel))} /></label>)}<label>A<NumberInput aria-label="A" min={0} max={100} value={alpha} onValueChange={value => onChange(color, value)} /></label></div>
  </Popover.Content></Popover.Portal></Popover.Root>;
}
