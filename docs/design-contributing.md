# Design contribution guide

The Figma file is the visual-system source of truth; production semantic CSS tokens are the implementation contract. Design dark and light modes together and verify 1440×900 and 768×1024 layouts.

Use Inter for interface text and JetBrains Mono for timestamps, logs, and technical metadata. Bind colors, typography, spacing, radii, and elevation to semantic variables. Repeated screen UI must use component instances and Auto Layout.

Contributions must include visible keyboard focus, WCAG 2.2 AA contrast, reduced-motion behavior, 40×40 minimum interactive targets, loading/error/empty states, and a clear label whenever data crosses from local to localhost or external services. Full editing is supported at 768px and above; below that width the product shows a support guard.
