# Design System Specification: High-Density Fulfillment Editorial

## 1. Overview & Creative North Star: "The Orchestrated Flow"
The Creative North Star for this design system is **The Orchestrated Flow**. In the high-stakes environment of a Warehouse Management System (WMS), "clean" is not enough. We must move beyond the "template" look of standard enterprise software by treating the interface as a high-end editorial dashboard. 

The goal is to balance **High-Density Information** with **Intentional Breathing Room**. We achieve this through "The Stacked Method"—layering tonal surfaces rather than boxing them in. By utilizing intentional asymmetry in sidebar layouts and overlapping header elements, we guide the user’s eye through complex fulfillment workflows without visual fatigue. This is a professional tool that feels like a bespoke concierge service.

---

## 2. Colors: Tonal Depth over Structural Lines
We define space through light and shadow, not lines. 

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts. A `surface-container-low` section sitting on a `surface` background is the standard for separation.

### Surface Hierarchy & Nesting
Instead of a flat grid, treat the UI as physical layers of fine paper.
*   **Background (`#F9F9F9`):** The base canvas.
*   **Sidebar (`surface-container-low` / `#F3F3F3`):** A grounded anchor for navigation.
*   **Workspace Cards (`surface-container-lowest` / `#FFFFFF`):** High-priority focus areas that "lift" off the background.
*   **Active Modals/Overlays:** Use semi-transparent `surface` colors with a 12px `backdrop-blur` to create a "Glassmorphism" effect, allowing the context of the warehouse floor to bleed through the UI.

### Signature Textures & Gradients
To avoid a "flat" SaaS feel, the primary navigation utilizes a **Signature Gradient**:
*   **Top Nav:** Linear Gradient (135deg) from `primary` (#57344F) to `primary-container` (#714B67). This provides a regal, authoritative anchor to the system.
*   **Action CTAs:** Use the Teal `secondary` (#00696e) with a subtle inner-glow (top-down) to suggest tactility.

---

## 3. Typography: The Editorial Scale
We use **Inter** not just for legibility, but as a brand voice. The hierarchy is designed to highlight critical metrics (Order Counts, SKUs) while keeping administrative labels secondary.

*   **Display-MD (2.75rem):** Reserved for high-level fulfillment KPIs (e.g., "98.4% On-Time").
*   **Title-SM (1rem, Medium 500):** The standard for card headers. It provides enough weight to anchor a section without needing a divider.
*   **Body-MD (0.875rem):** The workhorse for all data tables and lists.
*   **Label-SM (0.6875rem, All Caps, Tracking +5%):** Used for metadata like "SKU NUMBER" or "TIMESTAMP." This "Micro-Typography" adds a level of professional polish found in high-end watchmaking or editorial design.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are replaced by **Ambient Occlusion** and **Tonal Stacking**.

*   **The Layering Principle:** To separate the fulfillment queue from the detail view, place the detail view on a `surface-container-highest` panel. The 12-step difference in lightness creates an intuitive boundary.
*   **Ambient Shadows:** For floating elements like tooltips or pop-overs, use a wide-dispersion shadow: `0 8px 32px rgba(47, 49, 49, 0.06)`. The tint is derived from `on-surface`, ensuring the shadow feels like a natural obstruction of light, not a grey smudge.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility (e.g., input fields), use `outline-variant` at **20% opacity**. It should be felt, not seen.

---

## 5. Components: Style & Execution

### Buttons & Chips
*   **Primary Action:** Teal (`secondary`) with 4px radius. No border. Soft shadow on hover.
*   **Status Chips:** Use `secondary-container` for Success and `tertiary-container` for Alerts. Text should be the "on" variant (e.g., `on-secondary-container`). **Constraint:** Chips must not have borders; use tonal fill only.

### Input Fields
*   **Style:** `surface-container-lowest` fill with a `ghost border` (20% `outline-variant`).
*   **Focus State:** The border transitions to 100% `primary` opacity with a 2px outer glow of `primary-fixed-dim`.

### Cards & Lists (The "No-Divider" Rule)
*   **Execution:** Forbid 1px dividers between list items. Use **8px of vertical white space** and a subtle `surface-hover` state.
*   **Nesting:** Place list items inside a `surface-container` to group them, creating a "containerized" look that feels organized and high-density.

### Fulfillment-Specific Components
*   **The "Progress Ribbon":** A thin (4px) bar at the very top of a card using the Coral (`tertiary`) color to indicate "Action Required" or Teal (`secondary`) for "Ready to Ship."
*   **Inventory Micro-Grids:** High-density data displays should use `label-sm` for all units, maximizing information density while maintaining a clean, editorial aesthetic.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use vertical white space (16px, 24px, 32px) to separate logical groups.
*   **Do** use the Teal `secondary` color for all positive "Confirm" or "Ship" actions.
*   **Do** utilize `backdrop-blur` on the sidebar if the content behind it is dynamic.
*   **Do** keep the `4px` border radius consistent across all elements to maintain a "Professional/Sharp" identity.

### Don't
*   **Don't** use black (`#000000`). Use `on-surface` (#1A1C1C) for all text to maintain tonal softness.
*   **Don't** use 1px lines to separate sections. If you feel the need for a line, increase the background contrast between the two sections instead.
*   **Don't** use standard blue for links. Use the Purple `primary` or Teal `secondary` to stay within the brand's sophisticated palette.
*   **Don't** overcrowd the sidebar. Keep navigation top-level with clear `label-sm` headers.