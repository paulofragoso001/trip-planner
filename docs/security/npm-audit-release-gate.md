# npm audit release gate

Last reviewed: 2026-08-05

## Production requirement

A release candidate must report zero high or critical vulnerabilities when its
locked production dependency graph is audited with:

```sh
npm audit --omit=dev --json
```

`@capacitor/cli` is a build and native-project management tool, not an
application runtime dependency. It therefore belongs in `devDependencies`.
After classifying it accordingly, the locked graph reports zero production
vulnerabilities at every severity (64 production dependencies; 0 low,
moderate, high, or critical findings).

## Development-tool exceptions

The unfiltered audit still reports findings in packages reached only through
Storybook, Cypress, or other local build tooling. These packages are omitted
from the Production installation and are not bundled into or executed by the
deployed application.

The registry/advisory state reviewed on 2026-08-05 includes:

- Storybook: `@babel/core` is affected by GHSA-4x5r-pxfx-6jf8 through
  `@storybook/nextjs`/`react-docgen`. The advisory requires a release newer
  than 7.29.0, but `@babel/core@7.29.1` is not published (`ETARGET`). This
  cannot be resolved until Babel publishes a fixed release and Storybook
  adopts it.
- Storybook: `@babel/plugin-transform-modules-systemjs`, `esbuild`, and related
  transitive packages have fixed releases, but the current Storybook graph
  does not yet select all of them. Do not force incompatible transitive
  overrides; update Storybook when its dependency ranges adopt the fixes.
- Cypress: `systeminformation`, `tmp`, `ws`, and related transitive packages
  are development-runner dependencies. Fixed versions exist, but Cypress's
  locked graph has not adopted all of them. Update Cypress when an upstream
  release resolves the graph rather than treating these as Production risks.

These exceptions do not waive the production gate. Any high or critical
finding returned by `npm audit --omit=dev --json` closes the release gate.
