import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'cheerio';

export const SOURCE_URL = 'https://hugeicons.com/icons/stroke-rounded';
export const CACHE_DIR = path.resolve('.cache/hugeicons');
export async function fetchPage(page, {refresh=false} = {}) {
  await fs.mkdir(CACHE_DIR, {recursive:true});
  const file = path.join(CACHE_DIR, `stroke-rounded-${page}.html`);
  if (!refresh) {try { return await fs.readFile(file, 'utf8'); } catch(error) { if(error.code!=='ENOENT') throw error; }}
  const url = page === 1 ? SOURCE_URL : `${SOURCE_URL}?page=${page}`;
  let lastError;
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'FreeIconsWorkbench/1.0 (free MIT catalogue verification)'}});
      if(!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
      const html=await response.text();
      parsePage(html, page);
      await fs.writeFile(file,html);
      return html;
    } catch(error) { lastError=error; if(attempt<2) await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1))); }
  }
  throw lastError;
}
export function parsePage(html, expectedPage) {
  const $=load(html);
  // Read the public Next.js hydration payload as JSON strings; never evaluate site scripts.
  const data=$('script').toArray().map(e=>$(e).text()).filter(s=>s.startsWith('self.__next_f.push(')).map(s=>{
    const payload=JSON.parse(s.slice('self.__next_f.push('.length,-1));
    return typeof payload[1]==='string' ? payload[1] : '';
  }).join('');
  const paginationMatches=[...data.matchAll(/"paginationData":(\{[^}]+\})/g)];
  if(paginationMatches.length!==1) throw new Error(`Page ${expectedPage}: missing or ambiguous pagination`);
  const pagination=JSON.parse(paginationMatches[0][1]);
  if(pagination.page!==expectedPage) throw new Error(`Page ${expectedPage}: upstream returned page ${pagination.page}`);
  const icons=[...data.matchAll(/"icon":(\{[^}]+\})/g)].map(m=>JSON.parse(m[1]));
  const unique=new Map();
  for(const icon of icons) {
    if(icon.style!=='stroke'||icon.type!=='rounded') throw new Error(`Unexpected non-free style ${icon.uuid}`);
    if(!/^[a-z0-9+:' -]+$/.test(icon.name)||!/^[a-z0-9-]+$/.test(icon.category)) throw new Error(`Invalid icon identity ${icon.name}`);
    if(icon.uuid!==`${icon.name}-stroke-rounded`) throw new Error(`Icon UUID mismatch ${icon.uuid}`);
    if(unique.has(icon.name)) throw new Error(`Duplicate icon ${icon.name} on page ${expectedPage}`);
    unique.set(icon.name,icon);
  }
  const expected=Math.min(pagination.limit,pagination.total-(expectedPage-1)*pagination.limit);
  if(icons.length!==expected) throw new Error(`Page ${expectedPage}: expected ${expected}, got ${icons.length}`);
  const categories=$('a[href^="/icons/stroke-rounded/"]').toArray().map(e=>{
    const link=$(e); const spans=link.find('span');
    return {id:link.attr('href').split('/').at(-1),name:spans.first().text(),expectedCount:Number(spans.last().text()),sourceUrl:new URL(link.attr('href'),'https://hugeicons.com').href};
  });
  if(!categories.length||categories.some(c=>!c.id||!c.name||!Number.isInteger(c.expectedCount))) throw new Error('Invalid category metadata');
  return {pagination,icons,categories};
}
export async function readWebsite({refresh=false,progress=console.log}={}) {
  const first=parsePage(await fetchPage(1,{refresh}),1);
  const pages=[first];let next=2;
  await Promise.all(Array.from({length:3},async()=>{
    while(next<=first.pagination.totalPages) {
      const page=next++;
      const parsed=parsePage(await fetchPage(page,{refresh}),page);
      if(parsed.pagination.total!==first.pagination.total) throw new Error('Upstream count changed during sync; retry with --refresh');
      if(JSON.stringify(parsed.categories)!==JSON.stringify(first.categories)) throw new Error('Upstream categories changed during sync; retry with --refresh');
      pages[page-1]=parsed;
      if(page%10===0||page===first.pagination.totalPages) progress(`Read free catalogue page ${page}/${first.pagination.totalPages}`);
    }
  }));
  const icons=pages.flatMap(p=>p.icons);
  if(new Set(icons.map(i=>i.name)).size!==first.pagination.total) throw new Error('Website pagination contains missing or duplicate icons');
  return {sourceUrl:SOURCE_URL,capturedAt:new Date().toISOString(),websiteCount:first.pagination.total,categories:first.categories,icons};
}
if(import.meta.url===new URL(process.argv[1], 'file:').href) {
  const website=await readWebsite({refresh:process.argv.includes('--refresh')});
  await fs.writeFile(path.join(CACHE_DIR,'website.json'),JSON.stringify(website,null,2)+'\n');
  console.log(`Fetched ${website.icons.length} free icons and ${website.categories.length} categories.`);
}
