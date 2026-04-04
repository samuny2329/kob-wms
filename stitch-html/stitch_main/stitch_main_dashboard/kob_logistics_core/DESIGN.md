# Design System Specification: Warehouse Operations Excellence

## 1. Overview & Creative North Star
**The Creative North Star: "The Orchestrated Flow"**

This design system transcends the traditional "clunky" ERP aesthetic. It moves away from the rigid, grid-locked density of legacy software toward a high-fidelity, editorial-inspired logistics environment. The goal is to provide a "God View" of warehouse operations—picking, packing, and logistics—where information density does not equate to visual noise. 

We achieve this through **Tonal Layering** and **Intentional White Space**. By stripping away heavy borders and traditional separators, we create a UI that feels fluid and organic, allowing a warehouse manager to scan thousands of SKUs without eye fatigue. The aesthetic is "Odoo-inspired" but refined—replacing generic defaults with sophisticated, layered surfaces and a signature "frosted" depth.

---

## 2. Colors: Tonal Depth vs. Structural Lines
This system rejects the "boxed-in" feel of enterprise software. 

### The "No-Line" Rule
**Prohibit 1px solid borders for sectioning.** Boundaries are defined strictly through background color shifts. A dashboard widget does not have a border; it is a `surface-container-lowest` card sitting on a `surface-container-low` background.

### Surface Hierarchy & Nesting
Depth is achieved by stacking the Material surface tiers. In a dense logistics environment, use nesting to guide the eye:
*   **App Canvas:** `surface` (#fff7f9)
*   **Sidebar/Navigation:** `surface-container-low` (#faf1f4)
*   **Main Content Workarea:** `surface-container` (#f4ecee)
*   **Active Data Cards/Tables:** `surface-container-lowest` (#ffffff)
*   **Popovers/Modals:** `surface-bright` (#fff7f9) with Glassmorphism.

### The "Glass & Gradient" Rule
To elevate the "Odoo Purple" (#714B67), apply a subtle linear gradient to primary action buttons and header areas: 
*   **Primary CTA Gradient:** `primary` (#57344f) to `primary-container` (#714b67) at a 135-degree angle.
*   **Glassmorphism:** Use `surface_container_lowest` with 80% opacity and a `20px` backdrop-blur for floating action panels (e.g., "Active Pick List" floating widget) to create a premium, integrated feel.

---

## 3. Typography: The Editorial Scale
We use **Inter** for its neutral, high-legibility character. The hierarchy is designed to highlight critical logistics data (Quantities, Bin Locations, Tracking IDs) while keeping administrative labels secondary.

*   **Data Headliners (Headline-SM):** 1.5rem / Semi-Bold. Use for "Picking Progress" percentages or "Total Shipment" counts.
*   **The Identification Label (Title-MD):** 1.125rem / Medium. Use for SKU names and Bin Locations.
*   **The High-Density Grid (Body-MD):** 0.875rem / Regular. The workhorse for data tables.
*   **The Metadata (Label-SM):** 0.6875rem / Bold / Uppercase. Use for "Status Tags" (e.g., PACKED, SHIPPED).

---

## 4. Elevation & Depth: The Layering Principle
We convey importance through "soft lift" rather than hard shadows.

*   **Tonal Layering:** Instead of a shadow, place a `surface-container-highest` element against a `surface` background to denote a "pressed" or "nested" relationship.
*   **Ambient Shadows:** For floating elements (Modals, Context Menus), use a tinted shadow: `0px 8px 24px rgba(87, 52, 79, 0.08)`. This uses the `on-primary-fixed-variant` color as a base, making the shadow feel like a natural part of the environment rather than a grey smudge.
*   **The "Ghost Border":** If a border is required for high-density data accessibility, use `outline-variant` at 15% opacity. Never use 100% opacity lines.

---

## 5. Components

### Buttons & Action Items
*   **Primary:** Gradient fill (`primary` to `primary-container`), `DEFAULT` (4px) corners. No border. White text.
*   **Secondary:** `secondary-container` (#92eff5) fill with `on-secondary-container` (#006e73) text. Used for non-destructive warehouse actions like "Print Label."
*   **Tertiary:** No fill. `primary` text. Used for "Cancel" or "Back."

### High-Density Data Tables
*   **Container:** `surface-container-lowest`.
*   **Row Separation:** No horizontal lines. Use a `4px` vertical gap between rows and a subtle `surface-container-low` background on hover.
*   **Status Chips:** Use `tertiary-container` for positive states (Packed) and `error-container` for alerts (Delayed). Keep them small (`label-sm`) with `full` rounded corners.

### Input Fields
*   **Styling:** Filled style using `surface-container-high`. No bottom line. A `2px` `primary` indicator only appears on focus.
*   **Density:** Compact padding (8px 12px) to maximize screen real estate for barcode entry screens.

### Logistics-Specific Components
*   **The "Progress Rail":** A thin, 4px tall bar using `secondary-fixed` to show picking progress within a row.
*   **The Bin-Location Tag:** A high-contrast `inverse-surface` tag with `on-surface-variant` text, ensuring warehouse workers can spot locations instantly.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `surface-container-lowest` to make active work areas "pop" against the darker `surface` background.
*   **Do** use `inter` Medium (500) for numeric data to ensure legibility on mobile scanners.
*   **Do** leverage the `secondary` (#00696e) palette for logistics "flow" elements (tracking, shipping, motion).

### Don't
*   **Don't** use black (#000000) for text. Use `on-surface` (#1e1b1d) for a softer, premium feel.
*   **Don't** use "Drop Shadows" on standard cards. Reserve elevation for true "Z-axis" events like modals.
*   **Don't** use lines to separate list items. Use vertical spacing (e.g., 8px or 12px) to create natural groupings.