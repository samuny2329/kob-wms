# WMS Pro Dark — Design System

## Overview
Dark theme variant for warehouse environments with low ambient lighting.
Reduces eye strain during long shifts and improves screen visibility in dim conditions.

## Colors
- Primary: Light Purple #C994BB — buttons, active states, navigation highlights
- Secondary: Bright Teal #4DD9D4 — success states, sync indicators, positive metrics
- Tertiary: Soft Coral #FFB3B6 — alerts, warnings, SLA breaches
- Surface: #121212 base, #1E1E1E cards, #2A2A2A elevated elements

## Layout Rules
- Sidebar: dark surface-container-low, subtle border via tonal shift
- Main content: dark surface with slightly lighter cards
- No bright borders — use subtle surface elevation differences
- Cards use 4px radius, maintain same padding as light theme
- Data tables: subtle alternating row tones

## Typography
- KPI numbers: display-md, use primary-fixed-dim for emphasis
- Section headers: headline-sm, on-surface (light text on dark bg)
- Body text: 87% white opacity for comfortable reading
- Secondary text: 60% white opacity

## Dark Mode Specific
- Avoid pure white (#FFFFFF) text — use on_surface token
- Status badges: use container colors (softer) not raw colors
- Scan feedback: maintain high contrast green/red overlays
- Charts: use brighter color variants for visibility
- Icons: use on-surface-variant, not pure white

## Do
- Use elevated surfaces (lighter dark) for interactive cards
- Maintain WCAG AA contrast ratios (4.5:1 for text)
- Use primary-fixed-dim for accent text on dark backgrounds
- Keep scan-critical information at maximum contrast

## Don't
- Don't use pure white or pure black backgrounds
- Don't reduce contrast below AA for any scan-critical text
- Don't use saturated colors on dark backgrounds — use desaturated variants
- Don't use shadows on dark theme — use surface elevation instead