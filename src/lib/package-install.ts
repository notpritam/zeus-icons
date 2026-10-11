import type { Framework } from './component-source';

export function packageInstall(framework: Framework): { command: string; url: string; instruction: string } | undefined {
  if (framework === 'React') return {
    command: 'npm install https://github.com/notpritam/zeus-icons/releases/download/v0.1.0/zeus-icons-0.1.0.tgz',
    url: '/packages/zeus-icons-0.1.0.tgz',
    instruction: 'Install this versioned GitHub release directly in your project.',
  };
  if (framework === 'Flutter') return {
    command: 'dependencies:\n  zeus_icons:\n    path: ./zeus_icons',
    url: '/packages/zeus-icons-flutter-0.1.0.tar.gz',
    instruction: 'Extract the package into your project, then add this to pubspec.yaml.',
  };
}
