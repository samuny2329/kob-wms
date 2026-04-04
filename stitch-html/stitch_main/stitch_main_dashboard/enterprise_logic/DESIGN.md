```markdown
# Design System Specification: The Precision Ledger

This design system is a high-density, professional framework engineered for the complexities of a Warehouse Management System (WMS) SLA Tracker. It moves beyond the generic "enterprise dashboard" by utilizing an editorial, data-first approach that prioritizes cognitive clarity and tonal depth over traditional structural lines.

---

### 1. Overview & Creative North Star: "The Analytical Architect"

The Creative North Star for this system is **"The Analytical Architect."** In a high-stakes WMS environment, the UI must act as an authoritative but quiet partner. We achieve this through **high-density layouts** that don't feel cluttered, using intentional white space and tonal layering rather than borders to organize information.

By rejecting the "boxed-in" look of standard ERPs, we use the **Inter** typeface's geometric precision and a sophisticated palette of **Plum (#714B67)** and **Teal (#00696e)** to create a sense of executive oversight. The interface feels like a premium financial broadsheet—dense with data, yet perfectly legible and structured.

---

### 2. Color & Tonal Architecture

Color is used as a functional tool for categorization and urgency, not just decoration.

*   **Primary (The Executive):** `primary` (#57344f) and `primary_container` (#714b67). Used for high-level navigation and primary actions. It represents the "Plum" authority of the brand.
*   **Secondary (The Action):** `secondary` (#00696e). This teal is reserved for operational data—tracking numbers, active SLA timers, and "In Progress" states.
*   **The "No-Line" Rule:** 1px solid borders for sectioning are strictly prohibited. Boundaries are defined through background shifts. A `surface_container_low` (#f3f4f5) sidebar sits against a `surface` (#f8f9fa) background.
*   **Surface Hierarchy & Nesting:** Use nesting to define data priority.
    *   **Level 0:** `background` (#f8f9fa) - The canvas.
    *   **Level 1:** `surface_container` (#edeeef) - The primary data density areas.
    *   **Level 2:** `surface_container_lowest` (#ffffff) - Individual data cards or "active" modules.
*   **Signature Textures:** For hero data points (e.g., "Total Shipments"), use a subtle linear gradient from `primary` (#57344f) to `primary_container` (#714b67) at a 135-degree angle to provide a premium "ink on paper" feel.

---

### 3. Typography: Editorial Precision

We utilize **Inter** across all scales, leveraging its tall x-height for readability in high-density tables.

*   **Display (The Headline):** Use `display-sm` (2.25rem) sparingly for daily summary percentages.
*   **Headline (The Section):** `headline-sm` (1.5rem) should be used for major module headers (e.g., "SLA Performance by Zone").
*   **Title (The Label):** `title-sm` (1rem) is the workhorse for table headers and card titles. Use Medium weight (500) to distinguish from body text.
*   **Body (The Data):** `body-md` (0.875rem) is the default for all grid data. This provides the high-density "Odoo" feel while maintaining legibility.
*   **Label (The Metadata):** `label-sm` (0.6875rem) in All-Caps is used for secondary metadata, like timestamps or "Last Updated" markers.

---

### 4. Elevation & Depth: Tonal Layering

Traditional shadows are too heavy for high-density WMS trackers. Instead, we use **Layering Principles.**

*   **The Layering Principle:** To "lift" an element, change its surface token. An active SLA row should shift from `surface_container` to `surface_container_lowest`.
*   **Ambient Shadows:** Use only for floating modals or context menus. 
    *   *Shadow Specs:* `0px 4px 20px rgba(25, 28, 29, 0.06)`. The tint is derived from `on_surface` to keep it natural.
*   **Ghost Borders:** If an element requires a border for accessibility (e.g., an input field), use `outline_variant` (#d1c3ca) at 20% opacity. 
*   **Glassmorphism:** For sticky headers or global filters, use `surface_container_lowest` at 85% opacity with a `backdrop-blur: 12px`. This maintains the "Analytical Architect" vibe by showing the data scrolling beneath the controls.

---

### 5. Components

#### Buttons
*   **Primary:** Fill `primary_container`. Text `on_primary`. Radius `4px`. No shadow.
*   **Secondary:** Ghost style. No background, `outline` border at 20%, text `secondary`.
*   **Sizing:** Use a 32px height for "Compact" (default) and 40px for "Actionable" (page-level).

#### Data Tables (The Core)
*   **Header:** `surface_container_high` background, `title-sm` typography, `on_surface_variant` text color.
*   **Rows:** No horizontal dividers. Use a `surface_container_low` hover state to highlight the row. 
*   **Density:** Cell padding should be 8px vertical, 12px horizontal.

#### SLA Status Chips
*   **Late:** `error_container` background with `on_error_container` text.
*   **On Track:** `secondary_container` background with `on_secondary_container` text.
*   **Urgent:** Custom `primary_fixed` background with `on_primary_fixed` text.

#### Input Fields
*   **Default:** `surface_container_lowest` background with a 1px "Ghost Border" of `outline_variant` (20%).
*   **Active:** Border changes to 1px `primary` (#57344f).

---

### 6. Do's and Don'ts

#### Do
*   **DO** use whitespace as a separator. If two sections feel too close, increase the vertical gap rather than adding a line.
*   **DO** use Teal (`secondary`) to draw the eye toward "Live" or "Changing" data points.
*   **DO** keep the `4px` radius consistent. It provides a professional, "machined" look suitable for logistics.

#### Don't
*   **DON'T** use 100% black text. Always use `on_surface` (#191c1d) to maintain tonal softness.
*   **DON'T** use heavy drop shadows on cards. It breaks the high-density "flat-ledger" aesthetic.
*   **DON'T** use standard blue for links. Use `secondary` (#00696e) to stay within the WMS brand palette.

---

### 7. Creative Director’s Final Note
This design system is about **intentionality.** Every pixel should serve a purpose in the WMS workflow. By removing the "clutter" of borders and shadows and replacing them with a sophisticated hierarchy of surface tones, we provide the user with a high-performance tool that feels as premium as it is functional.```