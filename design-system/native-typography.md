# Native typography guardrails

Almidy’s native titles should feel calm, premium, and elegant. Build hierarchy with size, spacing, contrast, layout, position, and composition—not heavy font weight.

## Allowed weights

- Regular for display text, body copy, and supporting labels.
- Medium for titles, section headings, and primary controls.
- Semibold only for compact labels or controls when readability or accessibility requires it.

## Disallowed app-title weights

Do not use `boldSystemFont`, bold, heavy, black, or extra-bold weights for native app titles. Use the helpers in `AlmidyDesignTokens.Font` for new UIKit typography.

Provider-owned marks and system-rendered controls may retain their required typography and brand treatment. These exceptions do not permit heavy custom Almidy titles.

Run `npm run native:typography:check` before committing native typography changes.
