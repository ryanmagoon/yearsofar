# Frontend

- **Component base: shadcn/ui + Tailwind.** When adding UI primitives (dialogs, dropdowns, selects, tooltips, etc.), pull in the shadcn/ui component rather than hand-rolling one. Hand-rolled markup is fine only for layout and one-off presentational elements.
- **Never use `var()` inside the `animation` shorthand in global CSS.** Turbopack's CSS optimizer can't statically resolve the animation-name past a `var()`, so it silently strips both the `@keyframes` and the rule from the built CSS. Use longhand properties (`animation-name`, `animation-duration`, `animation-timing-function: var(--ease)`, `animation-fill-mode`), and verify computed styles in the browser after adding any keyframe animation.
- **Design/animation work goes through the emil-design-eng skill.** Load it before writing or reviewing UI code and apply its checklist (press feedback, custom easing, sub-300ms durations, `prefers-reduced-motion`).
