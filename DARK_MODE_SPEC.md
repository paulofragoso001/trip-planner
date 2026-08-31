# Almidy Native Dark Mode Specification

## Palette

| Role | Dark value |
| --- | --- |
| Canvas / grouped | `#151310` / `#1B1916` |
| Surface / neutral | `#211F1B` / `#292620` |
| Primary / secondary / tertiary text | `#F4F0E8` / `#B8B1A6` / `#8F887D` |
| Accent / pressed / text | `#DDBB72` / `#C69B4D` / `#E4C27B` |
| Success / danger / info | `#72B98A` / `#E27A72` / `#8FA8C5` |

Borders, dividers, disabled fills, and inputs use warm primary-text alpha variants. Increased Contrast independently strengthens applicable text and border roles.

## Fixed and platform-owned roles

On-media text, image gradients, scrims, map rendering, and renderer colors remain fixed because imagery or rendering composition owns their contrast. UIKit-native controls may retain adaptive system colors where platform behavior is the semantic requirement. No parallel Dark namespace is allowed.

## Runtime and governance

Views consume dynamic semantic `UIColor`s. Components that copy colors into `CALayer` or `UIButton.Configuration` refresh resolved colors after appearance changes. Appearance never changes geometry, typography, icons, behavior, or data. Figma should use one semantic variable collection with Light and Dark modes; fixed roles must be marked fixed. Coolors is a communication aid and must not replace semantic ownership. The authoritative suite is 12 Light plus 12 Dark deterministic PNGs under exact RGBA comparison, with the original Light set unchanged.

## Shared contract relationship

Normal Light/Dark values are mirrored by the versioned shared contract in `design-system/almidy.tokens.json`. Increased Contrast remains platform-owned because accessibility adjustment mechanics differ. Native dynamic providers remain the iOS implementation; the shared JSON expresses intent and does not encode UIKit behavior. Cross-platform ownership and fixed-role boundaries are documented in `DESIGN_TOKENS_CROSS_PLATFORM.md`.
