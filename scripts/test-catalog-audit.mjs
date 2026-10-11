import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

// Deliberately corrupt one output at a time, confirm the comprehensive audit catches it,
// and restore original bytes even if the assertion fails. Run only in a development checkout.
const runAudit=()=>spawnSync(process.execPath,['scripts/audit-catalog.mjs'],{encoding:'utf8',maxBuffer:4*1024*1024});
const baseline=runAudit();
assert.equal(baseline.status,0,baseline.stderr);
const cases=[
  {name:'SVG geometry',file:'public/icons/1st-bracket.svg',change:buffer=>Buffer.from(buffer.toString().replace('M6 3','M6 4')),message:'SVG differs from official React geometry'},
  {name:'category membership',file:'public/catalog.json',change:buffer=>{const value=JSON.parse(buffer);value.icons[0].categories=['ai'];return Buffer.from(JSON.stringify(value));},message:'Local count differs'},
  {name:'hidden upstream differences',file:'public/catalog.json',change:buffer=>{const value=JSON.parse(buffer);value.coverage.missingFromPackage=[];return Buffer.from(JSON.stringify(value));},message:'Known website artwork differences were hidden'},
  {name:'archive integrity',file:'public/free-icons.zip',change:buffer=>buffer.subarray(0,buffer.length-128),message:'invalid zip data'},
];
for(const scenario of cases) {
  const original=await fs.readFile(scenario.file);
  try {
    const changed=scenario.change(original);assert(!changed.equals(original),'Corruption fixture changed nothing');
    await fs.writeFile(scenario.file,changed);
    const result=runAudit();
    assert.notEqual(result.status,0,`${scenario.name}: corrupted data incorrectly passed audit`);
    assert(result.stderr.includes(scenario.message),`${scenario.name}: failed for an unexpected reason: ${result.stderr}`);
    console.log(`PASS: audit rejects altered ${scenario.name}`);
  } finally { await fs.writeFile(scenario.file,original); }
}
console.log('All tamper checks passed; original artifact bytes restored.');
