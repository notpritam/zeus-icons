import fs from 'node:fs/promises';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { readWebsite, SOURCE_URL } from './fetch-upstream.mjs';
import { readPackage, matchPackage, serializeSvg } from './package-utils.mjs';
import { readAliasReview, unresolvedArtwork } from './alias-review.mjs';

const output=path.resolve('public');
const website=await readWebsite({refresh:process.argv.includes('--refresh')});
const pkg=await readPackage();
const {matched,missing,unlisted}=matchPackage(website,pkg);
if(missing.length||unlisted.length) {
  console.error(JSON.stringify({missingFromPackage:missing.map(i=>i.name),missingFromWebsite:unlisted.map(m=>m.exportName)},null,2));
  throw new Error('Upstream coverage changed. Investigate explicit name mappings before publishing; existing catalogue left untouched.');
}
const groups=Object.groupBy(matched,m=>m.module.exportName);
const aliasReview=await readAliasReview(pkg,groups,{live:process.argv.includes('--refresh')});
const artworkDifferences=unresolvedArtwork(aliasReview);
const manifests=[];
const icons=[];
const svgFiles={};
const references=new Map();
for(const entries of Object.values(groups)) {
  const module=entries[0].module;
  const canonicalSlug=module.exportName.replace(/Icon$/,'').replace(/([a-z0-9])([A-Z])/g,'$1-$2').replace(/([a-z])([0-9])/g,'$1-$2').toLowerCase();
  const primary=entries.find(e=>e.icon.name===canonicalSlug)??entries.find(e=>/^[a-z0-9-]+$/.test(e.icon.name))??entries[0];
  const id=/^[a-z0-9-]+$/.test(primary.icon.name)?primary.icon.name:canonicalSlug;
  const sourceUrl=`https://hugeicons.com/icon/${encodeURIComponent(primary.icon.name)}?style=stroke-rounded`;
  const categories=[...new Set(entries.map(e=>e.icon.category))];
  icons.push({id,name:id.split('-').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' '),exportName:module.exportName,categories,sourceUrl,referenceUrl:`/reference/${id}.json`,localUrl:`/icons/${id}.svg`});
  manifests.push({id,upstreamAliasReview:aliasReview.groups.find(g=>g.exportName===module.exportName)??null,websitePrimaryName:primary.icon.name,exportName:module.exportName,packageAliases:module.aliases,websiteAliases:entries.map(e=>({name:e.icon.name,category:e.icon.category,sourceUrl:`https://hugeicons.com/icon/${encodeURIComponent(e.icon.name)}?style=stroke-rounded`,matchedBy:e.matchedBy}))});
  svgFiles[`icons/${id}.svg`]=strToU8(serializeSvg(module.nodes));
  references.set(id,JSON.stringify(module.nodes)+'\n');
}
icons.sort((a,b)=>a.id.localeCompare(b.id,'en'));
manifests.sort((a,b)=>a.id.localeCompare(b.id,'en'));
if(new Set(icons.map(i=>i.id)).size!==icons.length) throw new Error('Duplicate catalogue identity');
const categories=website.categories.map(category=>({...category,actualCount:icons.filter(i=>i.categories.includes(category.id)).length}));
const categoryMismatches=categories.filter(c=>c.expectedCount!==c.actualCount).map(c=>`${c.name}: ${c.expectedCount} website entries map to ${c.actualCount} unique package icons (website aliases are deduplicated).`);
const generatedAt=new Date().toISOString();
const catalog={generatedAt,packageVersion:pkg.version,sourceUrl:SOURCE_URL,icons,categories,coverage:{websiteCount:website.websiteCount,packageCount:pkg.modules.length,mappedCount:icons.length,missingFromPackage:artworkDifferences,missingFromWebsite:[],categoryMismatches}};
const manifest={generatedAt,sourcePackage:'@hugeicons/core-free-icons',packageVersion:pkg.version,style:'stroke-rounded',license:'MIT',websiteEntryCount:website.websiteCount,canonicalIconCount:icons.length,icons:manifests};
const upstream={capturedAt:website.capturedAt,sourceUrl:SOURCE_URL,websiteCount:website.websiteCount,categories:website.categories,icons:website.icons.map(({name,category,version,style,type,uuid})=>({name,category,version,style,type,uuid}))};
const aliasGroups=manifests.filter(m=>m.websiteAliases.length>1);
const report={generatedAt,status:'complete-package-with-upstream-artwork-differences',packageVersion:pkg.version,style:'stroke-rounded',websiteEntryCount:website.websiteCount,packageIconCount:pkg.modules.length,exportedIconCount:icons.length,websiteAliasCount:website.websiteCount-icons.length,categoryCount:categories.length,missingFromPackage:artworkDifferences,upstreamAliasReview:aliasReview,missingFromWebsite:[],unexpectedCategoryMismatches:[],categoryAliasDifferences:categoryMismatches,aliases:aliasGroups,notes:[
  'All artwork comes from the installed MIT-licensed @hugeicons/core-free-icons package; no Pro artwork is included.',
  'Website metadata is taken from all public stroke-rounded catalogue pages. Source category labels, ordering, and entry counts are preserved.',
  'Ten website entries collapse onto another canonical package module. One preview pair is byte-identical; four pairs have confirmed design conflicts; five pairs have different rasters with unverified artwork equivalence. Package aliases do not prove website artwork identity.',
  'Category actual counts describe unique exported icons. Website expected counts include aliases; five categories have explained count differences.',
  'The official package aliases four-square/foursquare and trade-mark/trademark across two source categories despite distinct free website designs. Both source category memberships are retained as metadata; the missing website designs are explicitly reported.',
  'SVG exports preserve official node attributes and React render order, including mixed filled/stroked shapes and opacity. No geometry is traced from website previews.'
]};
const json=value=>JSON.stringify(value,null,2)+'\n';
const packageManifest=json(manifest);
const zip={...svgFiles,'LICENSE-hugeicons.txt':strToU8(pkg.license),'manifest.json':strToU8(packageManifest),'categories.json':strToU8(json(categories)),'README.txt':strToU8(`Free Icons export\n\n${icons.length} canonical Stroke Rounded SVGs from @hugeicons/core-free-icons ${pkg.version}.\nOriginal artwork: Hugeicons, MIT license included.\nThe website lists ${website.websiteCount} entries; manifest.json records all source and package aliases.\nFour website alias pairs have confirmed design conflicts and five pairs have unverified raster differences; see upstreamAliasReview entries in manifest.json. The exported SVGs match the installed package, not every distinct website preview.\nSVGs use a 24 x 24 viewBox and preserve official attributes, including default stroke widths.\n`) };
// Generate in a separate directory, then replace only this script's owned outputs.
const staging=path.resolve('.cache/catalog-output');
await fs.rm(staging,{recursive:true,force:true});
await fs.mkdir(path.join(staging,'icons'),{recursive:true});
await fs.mkdir(path.join(staging,'reference'),{recursive:true});
for(const [filename,content] of Object.entries(svgFiles)) await fs.writeFile(path.join(staging,filename),content);
for(const [id,content] of references) await fs.writeFile(path.join(staging,'reference',`${id}.json`),content);
const documents={'catalog.json':json(catalog),'manifest.json':packageManifest,'upstream-metadata.json':json(upstream),'audit.json':json(report),'LICENSE-hugeicons.txt':pkg.license,'free-icons.zip':zipSync(zip,{level:6})};
for(const [filename,content] of Object.entries(documents)) await fs.writeFile(path.join(staging,filename),content);
await fs.mkdir(output,{recursive:true});
for(const filename of ['icons','reference',...Object.keys(documents)]) {
  await fs.rm(path.join(output,filename),{recursive:true,force:true});
  await fs.rename(path.join(staging,filename),path.join(output,filename));
}
console.log(JSON.stringify({websiteEntries:website.websiteCount,canonicalIcons:icons.length,categories:categories.length,websiteAliases:aliasGroups.length,confirmedWebsiteDesignConflicts:aliasReview.groups.filter(g=>g.status==='confirmed-design-conflict').length,unverifiedWebsitePreviewDifferences:aliasReview.groups.filter(g=>g.status==='unverified-raster-difference').length,explainedCategoryCountDifferences:categoryMismatches,zipBytes:documents['free-icons.zip'].length},null,2));
