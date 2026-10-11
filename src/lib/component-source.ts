export const FRAMEWORKS = ['React', 'React native', 'Vue', 'Svelte', 'Flutter', 'Angular', 'Web'] as const;
export type Framework = typeof FRAMEWORKS[number];
export interface ComponentDefaults { size: number; color: string; opacity: number; strokeWidth?: number }

export function componentName(name: string, style: string, exportName = ''): string {
  const base = exportName.replace(/Icon$/, '') || name.split('-').map(word => Array.from(word).map((char, i) => /[a-z0-9]/i.test(char) ? i === 0 ? char.toUpperCase() : char : `U${char.codePointAt(0)!.toString(16).toUpperCase()}`).join('')).join('');
  return `${/^\d/.test(base) ? 'Icon' : ''}${base}${style.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('')}Icon`;
}
export function componentStyle(name: string): string {
  return name.match(/(Stroke|Solid|Duotone|Twotone|Bulk)(Rounded|Standard|Sharp)Icon$/)!.slice(1).join('-').toLowerCase();
}
export function splitSvg(svg: string) {
  const match = svg.match(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/);
  if (!match) throw new Error('A complete SVG is required.');
  const attrs = Object.fromEntries([...match[1].matchAll(/([\w:-]+)="([^"]*)"/g)].map(item => [item[1], item[2]]));
  const paint = match[2].match(/(?:stroke|fill)="(#[a-f\d]{6})"/i)?.[1];
  const defaults: ComponentDefaults = { size: Number(attrs.width) || 24, color: attrs.color || paint || 'currentColor', opacity: attrs.opacity ? Number(attrs.opacity) : 1 };
  const root = Object.entries(attrs).filter(([key]) => !['width', 'height', 'color', 'opacity', 'xmlns'].includes(key)).map(([key, value]) => `${key}="${value}"`).join(' ');
  const body = match[2].trim().replace(/(stroke|fill)="(#[a-f\d]{6})"/gi, (original, attribute: string, value: string) => value.toLowerCase() === defaults.color.toLowerCase() ? `${attribute}="currentColor"` : original);
  return { root, body, defaults };
}
function jsx(value: string) { return value.replace(/([\w]+)-([a-z-]+)=/g, (_match, first: string, rest: string) => `${first}${rest.replace(/(^|-)([a-z])/g, (_: string, _dash: string, letter: string) => letter.toUpperCase())}=`); }
const extensions: Record<Framework, string> = { React: 'tsx', 'React native': 'tsx', Vue: 'vue', Svelte: 'svelte', Flutter: 'dart', Angular: 'ts', Web: 'svg' };
export function componentExtension(framework: Framework) { return extensions[framework]; }
export function componentSource(framework: Framework, name: string, svg: string, notice: string): string {
  const { root, body, defaults: { size, color, opacity } } = splitSvg(svg);
  const comment = `/*\n${notice.replaceAll('*/', '* /')}\n*/`;
  const xmlNotice = `<!--\n${notice.replaceAll('--', '—')}\n-->`;
  const colorLiteral = JSON.stringify(color);
  const nativeXml = `<svg xmlns="http://www.w3.org/2000/svg" ${root}>${body}</svg>`;
  if (framework === 'React') return `${comment}\nimport type { SVGProps } from 'react';\n\nexport type ${name}Props = SVGProps<SVGSVGElement> & { size?: number | string; title?: string };\n\nexport default function ${name}({ size = ${size}, color = ${colorLiteral}, opacity = ${opacity}, title, ...props }: ${name}Props) {\n  return (\n    <svg xmlns="http://www.w3.org/2000/svg" ${jsx(root)} width={size} height={size} color={color} opacity={opacity} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} {...props}>\n      {title && <title>{title}</title>}\n      ${jsx(body)}\n    </svg>\n  );\n}\n`;
  if (framework === 'React native') return `${comment}\nimport { SvgXml, type SvgProps } from 'react-native-svg';\n\nexport default function ${name}({ size = ${size}, color = ${JSON.stringify(color === 'currentColor' ? '#000000' : color)}, opacity = ${opacity}, ...props }: SvgProps & { size?: number }) {\n  return <SvgXml xml={${JSON.stringify(nativeXml)}} width={size} height={size} color={color} opacity={opacity} {...props} />;\n}\n`;
  if (framework === 'Vue') return `${xmlNotice}\n<script setup lang="ts">\nwithDefaults(defineProps<{ size?: number | string; color?: string; opacity?: number; title?: string }>(), { size: ${size}, color: ${colorLiteral}, opacity: ${opacity} });\n</script>\n\n<template>\n  <svg xmlns="http://www.w3.org/2000/svg" ${root} :width="size" :height="size" :color="color" :opacity="opacity" :role="title ? 'img' : undefined" :aria-hidden="title ? undefined : true">\n    <title v-if="title">{{ title }}</title>\n    ${body}\n  </svg>\n</template>\n`;
  if (framework === 'Svelte') return `${xmlNotice}\n<script lang="ts">\n  import type { SVGAttributes } from 'svelte/elements';\n  let { size = ${size}, color = ${colorLiteral}, opacity = ${opacity}, title, ...props }: SVGAttributes<SVGSVGElement> & { size?: number | string; title?: string } = $props();\n</script>\n\n<svg xmlns="http://www.w3.org/2000/svg" ${root} width={size} height={size} {color} {opacity} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} {...props}>\n  {#if title}<title>{title}</title>{/if}\n  ${body}\n</svg>\n`;
  if (framework === 'Angular') return `${comment}\nimport { Component, input } from '@angular/core';\n\n@Component({\n  selector: 'free-icon-${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}',\n  standalone: true,\n  template: \`<svg xmlns="http://www.w3.org/2000/svg" ${root} [attr.width]="size()" [attr.height]="size()" [attr.color]="color()" [attr.opacity]="opacity()" [attr.role]="title() ? 'img' : null" [attr.aria-hidden]="title() ? null : true">@if (title()) {<title>{{ title() }}</title>}${body}</svg>\`,\n})\nexport class ${name} {\n  readonly size = input<number | string>(${size});\n  readonly color = input(${colorLiteral});\n  readonly opacity = input(${opacity});\n  readonly title = input<string>();\n}\n`;
  if (framework === 'Flutter') return `${comment}\nimport 'package:flutter/widgets.dart';\nimport 'package:flutter_svg/flutter_svg.dart';\n\nclass ${name} extends StatelessWidget {\n  const ${name}({super.key, this.size = ${size}, this.color, this.opacity = ${opacity}, this.semanticLabel});\n  final double size;\n  final Color? color;\n  final double opacity;\n  final String? semanticLabel;\n\n  @override\n  Widget build(BuildContext context) {\n    final tint = color ?? ${color === 'currentColor' ? 'IconTheme.of(context).color ?? const Color(0xFF000000)' : `const Color(0xFF${color.replace('#', '').slice(0, 6).padEnd(6, '0')})`};\n    return Opacity(\n      opacity: opacity.clamp(0.0, 1.0).toDouble(),\n      child: SvgPicture.string(\n        r'''${nativeXml}''',\n        width: size, height: size,\n        colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),\n        semanticsLabel: semanticLabel,\n      ),\n    );\n  }\n}\n`;
  return `${xmlNotice}\n${svg.replace(/<!--[\s\S]*?-->/g, '').trim()}\n`;
}
export function componentUsage(framework: Framework, name: string, { size, color, opacity, strokeWidth }: ComponentDefaults): string {
  const props = `size={${size}} color=${JSON.stringify(color)} opacity={${opacity}}${framework === 'React' && strokeWidth !== undefined ? ` strokeWidth={${strokeWidth}}` : ''}`;
  if (framework === 'React') return `import { ${name} } from 'zeus-icons/${componentStyle(name)}/${name}';\n\n<${name} ${props} />`;
  if (framework === 'React native') return `import ${name} from './${name}';\n\n<${name} size={${size}} color=${JSON.stringify(color === 'currentColor' ? '#000000' : color)} opacity={${opacity}} />`;
  if (framework === 'Vue') return `<script setup>\nimport ${name} from './${name}.vue';\n</script>\n\n<template>\n  <${name} :size="${size}" color=${JSON.stringify(color)} :opacity="${opacity}" />\n</template>`;
  if (framework === 'Svelte') return `<script>\n  import ${name} from './${name}.svelte';\n</script>\n\n<${name} ${props} />`;
  if (framework === 'Angular') return `import { Component } from '@angular/core';\nimport { ${name} } from './${name}';\n\n@Component({\n  selector: 'app-example',\n  standalone: true,\n  imports: [${name}],\n  template: '<free-icon-${name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()} [size]="${size}" color="${color}" [opacity]="${opacity}" />',\n})\nexport class Example {}`;
  if (framework === 'Flutter') return `import 'package:flutter/widgets.dart';\nimport 'package:zeus_icons/${componentStyle(name).replaceAll('-', '_')}/${name}.dart';\n\nconst ${name}(size: ${size}, opacity: ${opacity}${color === 'currentColor' ? '' : `, color: Color(0xFF${color.replace('#', '').toUpperCase()})`});`;
  return `<img src="./${name}.svg" width="${size}" height="${size}" alt="" />`;
}
