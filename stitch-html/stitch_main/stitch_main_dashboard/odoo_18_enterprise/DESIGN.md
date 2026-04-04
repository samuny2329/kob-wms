# Design System Document: The Executive Operator

## 1. Overview & Creative North Star

### Creative North Star: "The Architectural Ledger"
In warehouse and enterprise operations, data density is often the enemy of clarity. This design system rejects the "cluttered dashboard" trope, instead adopting **The Architectural Ledger** philosophy. It treats enterprise data as a high-end editorial layout: authoritative, dense but breathable, and meticulously organized through tonal depth rather than structural clutter.

We are moving away from the "boxy" legacy of ERPs. By leveraging the Odoo 18 visual refinements, we use the signature `#714B67` purple not just as a brand mark, but as a navigational anchor. The system balances "Enterprise Density"—the need to see 50 lines of inventory at once—with a "High-End Editorial" finish that reduces cognitive load for warehouse operators.

---

## 2. Colors: Tonal Architecture

This system operates on a "No-Line" philosophy. Traditional 1px borders create visual "noise" that exhausts the eye in high-density environments. Instead, we define space through background shifts and elevation.

### Primary Palette & Tonal Soul
- **Primary (`#57344f`) & Primary Container (`#714B67`):** Use the deeper `#57344f` for high-action touchpoints and the signature `#714B67` for headers and primary navigation.
- **Signature Texture:** Avoid flat primary blocks. Use a subtle linear gradient (Top-Left: `primary` to Bottom-Right: `primary_container`) for main action buttons and Hero states to provide "soul" and depth.

### The "No-Line" Rule
Prohibit 1px solid borders for sectioning. Boundaries must be defined solely through:
1.  **Background Color Shifts:** A `surface_container_low` section sitting on a `surface` background.
2.  **Glassmorphism:** For floating modals or "quick-view" warehouse pick-lists, use `surface_container_lowest` at 85% opacity with a `20px` backdrop-blur.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested physical layers.
*   **Level 0 (Base):** `surface` (#f9f9f9) - The canvas.
*   **Level 1 (Sections):** `surface_container_low` (#f3f3f3) - For grouping large data sets.
*   **Level 2 (Cards/Modules):** `surface_container_lowest` (#ffffff) - To make specific data points "pop."

---

## 3. Typography: The Editorial Scale

We use **Inter** for its neutral, technical precision. The hierarchy is designed to highlight critical warehouse metrics (SKU counts, bin locations) while maintaining a professional executive feel.

*   **Display (sm/md/lg):** Reserved for high-level warehouse KPIs (e.g., "98% Fulfillment"). Use `on_surface` with tight letter-spacing (-0.02em).
*   **Headline (sm/md):** Used for module titles. These should feel authoritative and anchored.
*   **Title (sm/md):** The workhorse for table headers and section names.
*   **Body (md):** The standard for data entry. Use `on_surface_variant` (#4e444a) for secondary labels to create a clear visual distinction from primary data.
*   **Label (sm/md):** Specifically for "Warehouse Tags" (e.g., "Zone A," "Fragile").

---

## 4. Elevation & Depth: Tonal Layering

Shadows and lines are replaced by **The Layering Principle**. Depth is achieved by "stacking" container tiers.

*   **Ambient Shadows:** For floating action buttons or "Quick-Add" inventory panels, use an extra-diffused shadow: `box-shadow: 0 12px 32px -4px rgba(87, 52, 79, 0.08);`. Note the use of the `primary` color in the shadow tint to maintain tonal warmth.
*   **The Ghost Border Fallback:** If a border is required for high-density data accessibility, use `outline_variant` at **15% opacity**. Never use 100% opaque lines.
*   **Layering Logic:** 
    *   *Step 1:* Global background is `surface`.
    *   *Step 2:* Warehouse "Zones" are grouped in `surface_container_low`.
    *   *Step 3:* Individual "Pick Tickets" are cards using `surface_container_lowest`.

---

## 5. Components: Functional Refinement

### Buttons
*   **Primary:** Linear gradient (`primary` to `primary_container`), `md` (0.375rem) roundedness.
*   **Secondary:** `surface_container_highest` background with `on_surface` text. No border.
*   **Tertiary:** Ghost style. `primary` text, background appears only on hover as `primary_fixed_dim` at 20% opacity.

### Warehouse Cards & Lists
*   **The No-Divider Rule:** Forbid 1px horizontal lines between list items. Use 8px of vertical white space (Spacing Scale) or alternating `surface` and `surface_container_low` backgrounds (zebra striping) for readability.
*   **Interactive Density:** In warehouse "Scanning" views, reduce padding to `4px` (sm) but increase `title-sm` font weight to `600` to ensure legibility under harsh lighting.

### Status Chips
*   **The "Vibrant Mute" Look:** Use `secondary_container` for "In Progress" and `tertiary_container` for "Stocked." The text color must always be the "On-Container" variant for AA accessibility.

### Input Fields
*   **Minimalist Frame:** No bottom line or full box. Use `surface_container_high` as a solid background fill with a `sm` (0.125rem) rounded bottom edge. On focus, transition the background to `surface_container_lowest` and add a 2px `primary` bottom-border.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `primary_fixed` for "Active" states in the sidebar; it provides a soft, premium highlight that doesn't overwhelm the eye.
*   **Do** leverage `surface_bright` for interactive elements that need to stand out against the `surface` background.
*   **Do** use `xl` (0.75rem) roundedness for large layout containers to soften the "industrial" feel of the warehouse app.

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#1a1c1c) to keep the editorial feel.
*   **Don't** use standard "Drop Shadows." If an element needs to float, it must use the Ambient Shadow spec (tinted with the primary color).
*   **Don't** use 1px dividers to separate data columns. Use 16px to 24px of horizontal gutter space instead.