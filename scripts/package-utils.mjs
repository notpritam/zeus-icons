import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as packageIcons from '@hugeicons/core-free-icons';

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.resolve('@hugeicons/core-free-icons'))),'../..');
export async function readPackage() {
  const metadata=JSON.parse(await fs.readFile(path.join(PACKAGE_ROOT,'package.json'),'utf8'));
  const source=await fs.readFile(path.join(PACKAGE_ROOT,'dist/esm/index.js'),'utf8');
  const modules=[...source.matchAll(/export \{ ([^}]+) \} from '\.\/([^']+)\.js';/g)].map(match=>{
    const exportName=match[2];
    const aliases=[...match[1].matchAll(/default as (\w+)/g)].map(m=>m[1]);
    if(!packageIcons[exportName]) throw new Error(`Missing canonical module export ${exportName}`);
    return {exportName,aliases,nodes:packageIcons[exportName]};
  });
  if(!modules.length||new Set(modules.map(m=>m.exportName)).size!==modules.length) throw new Error('Invalid package module index');
  const exportedNames=modules.flatMap(m=>m.aliases);
  if(exportedNames.length!==Object.keys(packageIcons).length) throw new Error('Package export parser lost aliases');
  return {version:metadata.version,license:await fs.readFile(path.join(PACKAGE_ROOT,'LICENSE.md'),'utf8'),modules};
}
export function normalizeIdentifier(value) {
  return value.replace(/(?:FreeIcons|Icon)$/,'').toLowerCase().replace(/[^a-z0-9]/g,'');
}
// Numeric spellings differ between the site's slugs and the package's explicit names.
// Keeping these reviewed translations explicit avoids conflating arrow-down-01 (direction)
// with arrow-down-0-1 (numeric sorting), despite punctuation-insensitive equality.
export const SLUG_EXPORT_OVERRIDES = {
  '1st-bracket': 'FirstBracketIcon',
  '1st-bracket-circle': 'FirstBracketCircleIcon',
  '1st-bracket-square': 'FirstBracketSquareIcon',
  '2nd-bracket': 'SecondBracketIcon',
  '2nd-bracket-circle': 'SecondBracketCircleIcon',
  '2nd-bracket-square': 'SecondBracketSquareIcon',
  '3rd-bracket': 'ThirdBracketIcon',
  '3rd-bracket-circle': 'ThirdBracketCircleIcon',
  '3rd-bracket-square': 'ThirdBracketSquareIcon',
  '24-hours-clock': 'TwentyFourHoursClockIcon',
  '3-d-view': 'ThreeDViewIcon',
  '3-g-signal': 'ThreeGSignalIcon',
  '3d-move': 'ThreeDMoveIcon',
  '3d-printer': 'ThreeDPrinterIcon',
  '3d-rotate': 'ThreeDRotateIcon',
  '3d-scale': 'ThreeDScaleIcon',
  '4-g-signal': 'FourGSignalIcon',
  '4k': 'FourKIcon',
  '5-g-signal': 'FiveGSignalIcon',
  '7z-01': 'SevenZ01Icon',
  '7z-02': 'SevenZ02Icon',
  'arrange-by-numbers-1-9': 'ArrangeByNumbersOneNineIcon',
  'arrange-by-numbers-9-1': 'ArrangeByNumbersNineOneIcon',
  'arrow-down-0-1': 'ArrowDownZeroOneIcon',
  'arrow-down-1-0': 'ArrowDownOneZeroIcon',
  'arrow-up-0-1': 'ArrowUpZeroOneIcon',
  'arrow-up-1-0': 'ArrowUpOneZeroIcon',
  'axis-3d': 'AxisThreeDIcon',
  'c++': 'CppIcon',
  'file-axis-3d': 'FileAxisThreeDIcon',
  'modern-tv-4-k': 'ModernTvFourKIcon',
  'move-3d': 'MoveThreeDIcon',
  'printer-3d': 'PrinterThreeDIcon',
  'root-1st-bracket': 'RootFirstBracketIcon',
  'root-2nd-bracket': 'RootSecondBracketIcon',
  'root-3rd-bracket': 'RootThirdBracketIcon',
  'rotate-3d': 'RotateThreeDIcon',
  'scale-3d': 'ScaleThreeDIcon',
  'sorting-1-9': 'SortingOneNineIcon',
  'sorting-9-1': 'SortingNineOneIcon',
};
export function normalizeSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g,'');
}
export function matchPackage(website,pkg) {
  const canonical=new Map();const aliases=new Map();
  for(const module of pkg.modules) {
    const key=normalizeIdentifier(module.exportName);
    if(canonical.has(key)) throw new Error(`Ambiguous canonical export ${key}`);
    canonical.set(key,module);
    for(const alias of module.aliases) {
      const id=normalizeIdentifier(alias);
      if(!aliases.has(id)) aliases.set(id,new Set());
      aliases.get(id).add(module);
    }
  }
  const matched=[];const missing=[];
  for(const icon of website.icons) {
    const override=SLUG_EXPORT_OVERRIDES[icon.name];
    const key=override?normalizeIdentifier(override):normalizeSlug(icon.name);
    const candidates=canonical.has(key)?[canonical.get(key)]:[...(aliases.get(key)??[])];
    if(candidates.length>1) throw new Error(`Ambiguous website mapping ${icon.name}`);
    if(candidates.length===0) missing.push(icon);
    else matched.push({icon,module:candidates[0],matchedBy:override?'explicit-numeric-name':canonical.has(key)?'canonical':'export-alias'});
  }
  const seen=new Set(matched.map(m=>m.module.exportName));
  return {matched,missing,unlisted:pkg.modules.filter(m=>!seen.has(m.exportName))};
}
export const attributeName = name => name.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`);
export const escapeXml = value => String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function renderOrderedNodes(nodes) {
  // Match @hugeicons/react: secondary (opacity) paths are painted first.
  return [...nodes].sort(([,a],[,b])=>b.opacity!==undefined?1:a.opacity!==undefined?-1:0);
}
export function serializeSvg(nodes) {
  // Preserve every official path attribute. React's `key` is bookkeeping, not SVG geometry.
  const children=renderOrderedNodes(nodes).map(([tag,attributes])=>{
    if(!/^[a-z][a-z0-9]*$/.test(tag)) throw new Error(`Unsupported SVG node: ${tag}`);
    const attrs=Object.entries(attributes).filter(([key])=>key!=='key').map(([name,value])=>`${attributeName(name)}="${escapeXml(value)}"`).join(' ');
    return `  <${tag}${attrs?' '+attrs:''}/>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">\n${children}\n</svg>\n`;
}
