import { describe, expect, it } from 'vitest';
import { componentName, componentSource, componentUsage } from './component-source';

const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" color="#123456" opacity="0.5"><g opacity="0.4"><path fill="currentColor" fill-rule="evenodd" d="M2 2H22V22H2Z M8 8H16V16H8Z"/></g></svg>';
describe('real framework components', () => {
  it('keeps named React usage short and separate from its complete component', () => {
    const name = componentName('home-01', 'solid-rounded', 'Home01Icon');
    expect(name).toBe('Home01SolidRoundedIcon');
    const usage = componentUsage('React', name, { size: 48, color: '#123456', opacity: 0.5 });
    expect(usage).toContain(`import { ${name} } from 'zeus-icons/solid-rounded/${name}'`);
    expect(usage).toContain(`<${name} size={48} color="#123456" opacity={0.5} />`);
    expect(usage).not.toContain('<path');
    const source = componentSource('React', name, svg, 'Source notice');
    expect(source).toContain('export default function Home01SolidRoundedIcon');
    expect(source).toContain('size = 48');
    expect(source).toContain('color = "#123456"');
    expect(source).toContain('fillRule="evenodd"');
    expect(source).toContain('width={size}');
    expect(source).toContain('...props');
  });
  it('avoids invalid identifiers and collisions for punctuation and digit names', () => {
    const names = ['c++', 'c-plus-plus', 're:', 're', '1st-bracket', 'package-add-01 ', 'package-add-01'];
    const results = names.map(name => componentName(name, 'solid-rounded'));
    expect(new Set(results).size).toBe(names.length);
    for (const name of results) expect(name).toMatch(/^[A-Z][A-Za-z0-9]*Icon$/);
  });
  it('preserves holes and opacity in actual source for every supported framework', () => {
    for (const framework of ['React', 'React native', 'Vue', 'Svelte', 'Angular', 'Flutter', 'Web'] as const) {
      const result = componentSource(framework, 'Home01SolidRoundedIcon', svg, 'Source notice');
      expect(result).toContain('M2 2H22V22H2Z M8 8H16V16H8Z');
      expect(result).toContain('0.4');
      expect(result).toContain('Source notice');
      expect(result).toContain('evenodd');
    }
  });
  it('turns customized free paint into a working color prop', () => {
    const source = componentSource('React', 'Home01StrokeRoundedIcon', '<svg width="48" viewBox="0 0 24 24"><path stroke="#3464ab" stroke-width="3" d="M0 0L24 24"/></svg>', 'MIT');
    expect(source).toContain('color = "#3464ab"');
    expect(source).toContain('stroke="currentColor"');
    expect(source).not.toContain('stroke="#3464ab"');
  });
});
