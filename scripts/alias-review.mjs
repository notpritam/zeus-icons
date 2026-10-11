import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export async function readAliasReview(pkg,groups,{live=false}={}) {
  const review=JSON.parse(await fs.readFile(new URL('./upstream-alias-review.json',import.meta.url),'utf8'));
  assert.equal(review.packageVersion,pkg.version,'Alias visual review must be repeated for a different package version');
  const actualGroups=Object.entries(groups).filter(([,items])=>items.length>1);
  assert.equal(review.groups.length,actualGroups.length,'The website alias groups changed; review free previews before publishing');
  for(const [exportName,items] of actualGroups) {
    const reviewed=review.groups.find(g=>g.exportName===exportName);assert(reviewed,`Unreviewed alias group ${exportName}`);
    assert.deepEqual(new Set(reviewed.previews.map(p=>p.sourceName)),new Set(items.map(i=>i.icon.name)),`Alias names changed for ${exportName}`);
    if(reviewed.status==='identical-preview') assert.equal(new Set(reviewed.previews.map(p=>p.sha256)).size,1);
    else assert(reviewed.affectedSource&&reviewed.reason,'An unresolved alias must explain its status');
    if(live) for(const preview of reviewed.previews) {
      const response=await fetch(preview.previewUrl,{signal:AbortSignal.timeout(30000)});
      assert(response.ok,`Free preview HTTP ${response.status}: ${preview.previewUrl}`);
      const bytes=Buffer.from(await response.arrayBuffer());
      assert.equal(createHash('sha256').update(bytes).digest('hex'),preview.sha256,`Free alias preview changed; review required: ${preview.sourceName}`);
    }
  }
  return review;
}
export function unresolvedArtwork(review) {
  return review.groups.filter(g=>g.status!=='identical-preview').map(g=>`${g.affectedSource}: ${g.reason}`);
}
