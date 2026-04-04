# Design System Specification: The Executive Architect

## 1. Overview & Creative North Star
**Creative North Star: "The Architectural Ledger"**

This design system moves beyond the generic "enterprise dashboard" by treating information as a high-end editorial layout. While inspired by the efficiency of Odoo, this system rejects the "box-within-a-box" clutter of traditional ERPs. We utilize **The Architectural Ledger** philosophy: a high-density, professional environment that feels like a premium workspace rather than a database entry tool.

By leveraging intentional asymmetry, sophisticated tonal layering, and "ghost" boundaries, we create a signature aesthetic that communicates institutional authority and modern agility. We prioritize the "density of insight" over "density of data," ensuring that even the most complex ERP modules feel breathable and curated.

---

## 2. Colors & Surface Logic

Our palette is anchored in the deep, authoritative `primary` (#57344f), supported by a sophisticated range of greys that define the spatial logic of the interface.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections or containers. 
Structure must be achieved through **Background Shifts**. To separate a sidebar from a main content area, use `surface-container-low` (#f3f3f3) against a `surface` (#f9f9f9) background. Boundaries are felt, not seen.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the following hierarchy to define depth:
*   **Base Layer:** `surface` (#f9f9f9) - The canvas of the application.
*   **Sectional Layer:** `surface-container-low` (#f3f3f3) - Large structural areas (e.g., sidebars, secondary navigation).
*   **Component Layer:** `surface-container-lowest` (#ffffff) - Actionable cards and data modules.
*   **Elevated Layer:** `surface-container-high` (#e8e8e8) - Used for hover states or active selection indicators.

### The "Glass & Gradient" Rule
To elevate the "out-of-the-box" feel, use **Signature Textures**:
*   **Main Action Gradients:** CTAs should utilize a subtle linear gradient from `primary` (#57344f) to `primary_container` (#714b67). This prevents the "flat-button" look and adds a sense of tactile premium quality.
*   **Floating Elements:** For Modals or Popovers, use a background of `surface_container_lowest` with a 90% opacity and a `backdrop-blur` of 20px. This allows the sophisticated ERP data to bleed through softly, maintaining context.

---

## 3. Typography
We utilize **Inter** for its mathematical precision and exceptional legibility at small sizes.

*   **Display (lg/md/sm):** Reserved for high-level dashboard summaries. Use `display-md` (2.75rem) to highlight key KPIs.
*   **Headline & Title:** Use `headline-sm` (1.5rem) for module titles. These should always be `on_surface` (#1a1c1c) with a semi-bold weight to establish immediate hierarchy.
*   **Body (lg/md/sm):** Most data entry occurs at `body-md` (0.875rem). For high-density tables, `body-sm` (0.75rem) is acceptable, provided line-height is generous (1.5x) to maintain readability.
*   **Label (md/sm):** All-caps labels using `label-sm` (0.6875rem) with +0.05em tracking should be used for metadata and table headers to provide an "editorial" feel.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved through **Tonal Stacking**. A card (`surface_container_lowest`) placed on a section (`surface_container_low`) creates a natural lift. This "Paper-on-Stone" approach replaces the need for heavy shadows.

### Ambient Shadows
When an element must "float" (e.g., a dropdown or modal):
*   **Blur:** 24px - 40px.
*   **Opacity:** 4% - 6%.
*   **Tint:** Use a tinted shadow color derived from `on_surface_variant` (#4e444a) rather than pure black. This mimics natural light reflecting off professional surfaces.

### The "Ghost Border" Fallback
If a boundary is required for accessibility, use a **Ghost Border**: `outline_variant` (#d1c3ca) at 15% opacity. It should be just visible enough to guide the eye without interrupting the visual flow.

---

## 5. Components

### Cards & Lists
*   **Forbid Divider Lines:** Separate list items using vertical white space (`spacing-3` or `spacing-4`). 
*   **Alternating Tones:** For long data tables, use subtle row shading (`surface_container_low`) rather than borders.
*   **Card Radii:** Use `rounded-md` (0.375rem) for internal components and `rounded-lg` (0.5rem) for main containers to create a "nested" aesthetic.

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. White text. No border.
*   **Secondary:** `surface_container_highest` background with `on_primary_fixed_variant` text.
*   **Ghost:** No background. Text uses `primary` color. Hover state adds `surface_container_low`.

### Input Fields
*   **Default State:** `surface_container_lowest` background with a `ghost border`.
*   **Active State:** Increase border opacity to 100% using `primary` color. 
*   **Information Density:** Label should be placed *inside* the field or as a small `label-sm` above it to minimize vertical drift.

### High-Density KPIs
For ERP contexts, create "Summary Strips." These are full-width containers of `surface_container_lowest` that sit at the top of a module, housing 4-5 key metrics using `display-sm` typography and `secondary` (Teal) or `tertiary` (Red) accents for trend indicators.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use `spacing-8` (1.75rem) as your standard margin between major card elements to ensure the UI feels premium.
*   **Do** use `secondary` (Teal #00696e) sparingly for "Success" or "Growth" metrics to ensure it pops against the purple palette.
*   **Do** leverage `surface_bright` for active navigation states to draw the eye without using high-contrast colors.

### Don’t:
*   **Don’t** use 100% black text. Always use `on_surface` (#1a1c1c) for better visual comfort during long work sessions.
*   **Don’t** use standard "Drop Shadows." If it looks like a default plugin setting, it’s wrong.
*   **Don’t** crowd the interface. If the data is dense, increase the container size or use a "Drill-down" pattern rather than shrinking the typography.
*   **Don't** use lines to separate cards. Let the background color shift do the heavy lifting.