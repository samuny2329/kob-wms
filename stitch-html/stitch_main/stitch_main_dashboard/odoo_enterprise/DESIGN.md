# Design System Specification: The Executive Atelier

## 1. Overview & Creative North Star
This design system moves beyond the functional utility of standard ERP interfaces to establish **"The Executive Atelier"**—a digital workspace that feels bespoke, architectural, and curated. 

While enterprise software often relies on rigid grids and heavy containment, this system breathes through intentional asymmetry and **Tonal Layering**. We reject the "template" aesthetic by favoring white space as a structural element over physical lines. The goal is to transform complex data entry into a high-end editorial experience, where the user feels they are navigating a premium publication rather than a database.

---

## 2. Colors & Chromatic Depth
The palette is anchored by the authoritative `#714B67` (Primary Container), balanced against a sophisticated, near-white `#f8f9fa` (Background).

### The "No-Line" Rule
To achieve a signature premium feel, **1px solid borders are prohibited for sectioning.** Boundaries must be defined strictly through:
*   **Background Shifts:** Use `surface_container_low` for secondary content areas sitting on a `surface` background.
*   **Spatial Separation:** Use the Spacing Scale (specifically `8` and `12`) to create mental groupings.

### Surface Hierarchy & Nesting
Treat the UI as physical layers of fine paper. 
*   **Level 0:** `surface` (#f8f9fa) - The base canvas.
*   **Level 1:** `surface_container_low` (#f3f4f5) - Used for sidebars or secondary navigation.
*   **Level 2:** `surface_container_highest` (#e1e3e4) - Used for active states or deeply nested utility panels.

### The "Glass & Gradient" Rule
For floating elements (modals, dropdowns), use a **Glassmorphism** effect:
*   Apply `surface_container_lowest` (#ffffff) at 85% opacity with a `20px` backdrop-blur. 
*   **Signature Textures:** For primary CTAs, use a subtle linear gradient from `primary` (#57344f) to `primary_container` (#714B67) at a 135-degree angle to provide "soul" and depth.

---

## 3. Typography: Editorial Authority
We use **Inter** not as a system font, but as a design tool. The hierarchy is designed to guide the eye through dense information with ease.

*   **Display & Headline (The Statement):** Use `display-md` or `headline-lg` for dashboard summaries. These should have a slight negative letter-spacing (-0.02em) to feel "tight" and professional.
*   **Titles (The Anchor):** `title-md` (1.125rem) is the workhorse for card titles and section headers.
*   **Body (The Content):** `body-md` (0.875rem) is the standard for data. It provides high legibility while allowing more information on screen.
*   **Labels (The Utility):** `label-md` (0.75rem) should use `on_surface_variant` (#4e444a) to reduce visual noise.

---

## 4. Elevation & Depth
Depth is a functional tool, not a decoration. We achieve hierarchy through **Tonal Layering** rather than traditional shadows.

*   **The Layering Principle:** To lift a card, do not add a shadow. Instead, place a `surface_container_lowest` (#ffffff) card on a `surface_container_low` (#f3f4f5) background. The 4px `DEFAULT` roundness provides the necessary edge definition.
*   **Ambient Shadows:** If an element must "float" (e.g., a Global Search bar), use an extra-diffused shadow: `0 12px 32px rgba(113, 75, 103, 0.08)`. Notice the shadow is tinted with the Primary color, not black.
*   **The "Ghost Border" Fallback:** For high-density data tables where separation is critical, use a "Ghost Border": `outline_variant` (#d1c3ca) at 15% opacity. It should be felt, not seen.

---

## 5. Components

### Buttons: The Tactile Interaction
*   **Primary:** Background: `#714B67`, Text: `#ffffff`, Roundness: `4px`. On hover, shift to `primary` (#57344f).
*   **Secondary:** Background: `surface_container_lowest`, Border: Ghost Border (20% opacity), Text: `primary_container`.
*   **Tertiary:** No background. Text: `primary_container`. Use for low-emphasis actions like "Cancel."

### Jewel Icons
Icons are the "jewelry" of the system.
*   **Container:** 12px (`xl`) rounded square.
*   **Background:** Use the `tertiary_container` or `secondary_container` for a colorful, soft-touch look.
*   **Pictogram:** White, flat, minimalist vectors centered within.

### Input Fields & Controls
*   **Text Inputs:** Use `surface_container_lowest` with a subtle `outline_variant` Ghost Border. When focused, the border transitions to a 2px `primary_container` (#714B67).
*   **Checkboxes & Radios:** Use `primary_container` for the checked state. Avoid hard corners; ensure the 4px roundness is respected even in small components.

### Cards & Lists
*   **Forbid Dividers:** Never use a line to separate list items. Use 12px of vertical padding and a hover state of `surface_container_high` to indicate interactivity.
*   **App Grid:** Use a generous `spacing-8` (2rem) gutter between app icons to prevent the "cluttered drawer" look.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use `surface_container_lowest` (#ffffff) for the main content area to make it feel like the "primary sheet" of the workspace.
*   **Do** use the `primary_container` (#714B67) for the top navigation bar to anchor the experience.
*   **Do** leverage the `4px` roundness for structural elements and the `12px` roundness for decorative/icon elements to create a "Signature Contrast."

### Don't:
*   **Don't** use 100% black (#000000) for text. Use `on_surface` (#191c1d) for better optical comfort.
*   **Don't** use "Drop Shadows" on buttons. Use tonal color shifts to indicate depth.
*   **Don't** cram elements. If in doubt, increase the spacing by one increment on the scale (e.g., move from `4` to `5`).
*   **Don't** use borders to separate the sidebar from the main content. Use a background shift from `surface_container_low` to `surface_container_lowest`.