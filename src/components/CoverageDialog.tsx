import type { Catalog, ProjectState } from '../types';
import { Modal, downloadText } from './Controls';
import { Button } from './ui/button';
export default function CoverageDialog({ catalog, state, open, onOpenChange }: { catalog: Catalog; state: ProjectState; open: boolean; onOpenChange: (open: boolean) => void }) {
  const c = catalog.coverage;
  const issues = c.missingFromPackage.length + c.missingFromWebsite.length + c.categoryMismatches.length;
  function report() {
    downloadText('free-icons-comparison-report.json', JSON.stringify({ exportedAt: new Date().toISOString(), source: catalog.sourceUrl, packageVersion: catalog.packageVersion, generatedAt: catalog.generatedAt, coverage: c, categories: catalog.categories, icons: catalog.icons.map(icon => ({ ...icon, comparison: state.icons[icon.id] ?? null })) }, null, 2));
  }
  return <Modal title="Catalogue coverage" description="Website categories are checked against the installed free package. Each count reflects unique icons." open={open} onOpenChange={onOpenChange} wide>
    <div className="coverage-stats"><div><strong>{c.websiteCount.toLocaleString()}</strong><span>On the free website</span></div><div><strong>{c.packageCount.toLocaleString()}</strong><span>In the package</span></div><div><strong>{c.mappedCount.toLocaleString()}</strong><span>Name-mapped icons</span></div><div><strong>{catalog.categories.length}</strong><span>Source categories</span></div></div>
    <div className={`coverage-notice ${issues ? 'has-issues' : ''}`}>{issues ? `${issues} catalogue differences recorded. See details below.` : 'All source categories and package icons are accounted for.'}</div>
    {issues > 0 && <details className="coverage-details"><summary>View catalogue differences</summary><p>Website artwork not represented or not verified: {c.missingFromPackage.join(', ') || 'None'}</p><p>Missing from website: {c.missingFromWebsite.join(', ') || 'None'}</p><p>Explained category count differences: {c.categoryMismatches.join(', ') || 'None'}</p></details>}
    <div className="mapping-table"><table><thead><tr><th>Category</th><th>Website</th><th>Local</th><th>Reviewed</th></tr></thead><tbody>{catalog.categories.map(category => <tr key={category.id}><td><a href={category.sourceUrl} target="_blank" rel="noreferrer">{category.name}</a></td><td>{category.expectedCount}</td><td className={category.actualCount !== category.expectedCount ? 'error-text' : ''}>{category.actualCount}</td><td>{catalog.icons.filter(icon => icon.categories.includes(category.id) && state.icons[icon.id]?.reviewed).length}</td></tr>)}</tbody></table></div>
    <div className="modal-footer"><p>Hugeicons free {catalog.packageVersion}<br />Synced {new Date(catalog.generatedAt).toLocaleString()}<br /><a href="/audit.json" target="_blank" rel="noreferrer">Detailed audit</a> · <a href="/manifest.json" target="_blank" rel="noreferrer">Name mappings</a><br /><a href="/LICENSE-hugeicons.txt" target="_blank" rel="noreferrer">MIT licence and attribution</a></p><Button onClick={report}>Export comparison report</Button></div>
  </Modal>;
}
