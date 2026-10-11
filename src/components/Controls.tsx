import type { ReactNode } from 'react';
import { Dialog } from 'radix-ui';
import { Button } from './ui/button';
import { NumberInput } from './NumberInput';
import { Slider } from './ui/slider';
export function Control({ label, value, min, max, step, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (value: number) => void }) {
  return <div className="control"><div className="control-heading"><label htmlFor={`control-${label}`}>{label}</label><div className="number-input"><NumberInput id={`control-${label}`} value={value} min={min} max={max} step={step} onValueChange={onChange} /><span>{suffix}</span></div></div><Slider thumbLabel={label} value={[value]} min={min} max={max} step={step} onValueChange={values => onChange(values[0])} /></div>;
}
export function Modal({ title, description, open, onOpenChange, children, wide = false }: { title: string; description: string; open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode; wide?: boolean }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="modal-overlay" /><Dialog.Content className={`modal ${wide ? 'modal-wide' : ''}`}><div className="modal-heading"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close dialog">×</Button></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function downloadText(name: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
