import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
const manifest = JSON.parse(await readFile('public/traced/manifest.json', 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (manifest.count !== manifest.entries.length || new Set(manifest.entries.map(e => e.id)).size !== manifest.count) throw new Error('Invalid trace count or duplicate IDs');
for (const entry of manifest.entries) {
  if (entry.style === 'stroke-rounded') throw new Error('Free icon in Pro trace batch');
  if (hash(await readFile(`public${entry.svgUrl}`)) !== entry.svgSha256 || hash(await readFile(`public${entry.imageUrl}`)) !== entry.sourceSha256) throw new Error(`Hash mismatch: ${entry.id}`);
}
let cached=[];
try { cached=JSON.parse(await readFile('.local/tracing/browser-audit.json','utf8')).results??[]; } catch(error) { if(error.code!=='ENOENT')throw error; }
const cache=new Map(cached.map(e=>[e.id,e]));
const reusable=manifest.entries.filter(e=>cache.get(e.id)?.svgSha256===e.svgSha256&&cache.get(e.id)?.sourceSha256===e.sourceSha256);
const reusableIds=new Set(reusable.map(e=>e.id));
const pending=manifest.entries.filter(e=>!reusableIds.has(e.id));
const browser = await chromium.launch();
try {
  const report = {results:reusable.map(e=>cache.get(e.id)), failures:[]};
  await mkdir('.local/tracing', {recursive:true});
  const base=process.argv[2] ?? 'http://127.0.0.1:8937';
  for(let start=0;start<pending.length;start+=60){
  const page = await browser.newPage();
  await page.goto(new URL('/traced/progress.json',base).href);
  const chunk = await page.evaluate(async entries => {
    async function raster(url, dimension) {
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = dimension;
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0, dimension, dimension);
      const data=ctx.getImageData(0, 0, dimension, dimension).data;
      canvas.width=canvas.height=1;image.removeAttribute("src");
      return data;
    }
    const results = [], failures = [];
    for (const entry of entries) {
      try {
        const response = await fetch(entry.svgUrl); const svg = await response.text();
        if (!response.ok || !response.headers.get('content-type').includes('image/svg+xml')) throw new Error('Invalid SVG response');
        const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
        if (doc.querySelector('parsererror') || doc.documentElement.getAttribute('viewBox') !== '0 0 24 24') throw new Error('Invalid SVG document');
        for (const el of doc.querySelectorAll('*')) if (!['svg','g','path'].includes(el.localName)) throw new Error(`Unexpected SVG element: ${el.localName}`);
        if (doc.querySelectorAll('path').length !== entry.paths || /<image|data:image|<script|href=/.test(svg)) throw new Error('Not a standalone vector trace');
        if (!svg.includes('Generated image trace') || svg.includes('MIT License')) throw new Error('Incorrect source notice');
        const [a,b] = await Promise.all([raster(entry.imageUrl, entry.sourceWidth), raster(entry.svgUrl, entry.sourceWidth)]); let intersection=0,union=0;
        for(let i=3;i<a.length;i+=4){intersection+=Math.min(a[i],b[i]);union+=Math.max(a[i],b[i]);}
        const overlap=100*intersection/union;
        const modelled = entry.geometry?.method === 'shape-model';
        // Thin exact SVG arcs have different edge antialiasing in librsvg and
        // Chromium (up to 2.3 overlap points in this batch). Judge reconstructed
        // models against the reference independently, with a stricter 95% floor;
        // do not confuse cross-renderer pixel differences with geometric defects.
        if (!Number.isFinite(overlap) || overlap < (modelled ? 95 : 90) || (!modelled && Math.abs(overlap-entry.overlap)>2)) throw new Error(`Unexpected alpha overlap: ${overlap}`);
        if (modelled && /bracket-circle$/.test(entry.name)) {
          const circle = [...doc.querySelectorAll('path')].find(path => /^M22\.75\s+12\s*A/.test(path.getAttribute('d')));
          if (!circle) throw new Error('Missing analytic circular frame');
          for (let s=0;s<2*Math.PI*10.75;s+=.1) {
            const p=circle.getPointAtLength(s);
            if(Math.abs(Math.hypot(p.x-12,p.y-12)-10.75)>.012)throw new Error('Circular frame contains a radial defect');
          }
        }
        results.push({id:entry.id,svgSha256:entry.svgSha256,sourceSha256:entry.sourceSha256,overlap,rendererDifference:overlap-entry.overlap});
      } catch(error){failures.push({id:entry.id,error:String(error)});}
    }
    return {results,failures};
  }, pending.slice(start,start+60));
  report.results.push(...chunk.results); report.failures.push(...chunk.failures);
  await page.close();
  await writeFile('.local/tracing/browser-audit.json', JSON.stringify(report));
  console.log(`Verified ${report.results.length}/${manifest.entries.length} generated SVGs; ${report.failures.length} failures`);
  }
  await mkdir('.local/tracing', { recursive: true });
  await writeFile('.local/tracing/browser-audit.json', JSON.stringify(report,null,2));
  console.log(JSON.stringify({checked:report.results.length,failures:report.failures,minimumOverlap:Math.min(...report.results.map(e=>e.overlap)),maximumOverlap:Math.max(...report.results.map(e=>e.overlap)),meanOverlap:report.results.reduce((n,e)=>n+e.overlap,0)/report.results.length},null,2));
  if(report.failures.length)process.exitCode=1;
} finally {await browser.close();}
