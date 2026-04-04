```markdown
# Design System: The Architectural Ledger

## 1. Overview & Creative North Star
The "Architectural Ledger" is the Creative North Star for this design system. We are moving beyond the cluttered, legacy ERP look toward a high-density environment that feels as intentional and structured as a modern blueprint. 

While most enterprise software relies on rigid grids and heavy borders, this system utilizes **asymmetric breathing room** and **tonal layering** to organize complex data. We treat the UI not as a flat screen, but as a series of stacked, precision-cut sheets of paper and glass. By emphasizing "White Space as Structure," we ensure that even the most data-heavy modules feel light, professional, and authoritative.

## 2. Colors & Surface Logic
The palette is rooted in the signature `#714B67` (Primary), but its power comes from the sophisticated neutrals surrounding it.

### The "No-Line" Rule
**Explicit Instruction:** Prohibit the use of 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts or subtle tonal transitions. To separate a sidebar from a main content area, use `surface-container-low` against a `surface` background. The eye should perceive the edge through the change in value, not a drawn line.

### Surface Hierarchy & Nesting
Depth is achieved by stacking the `surface-container` tiers. This creates a "Physical Layering" effect:
*   **Base Layer:** `surface` (#f8f9fa) – The desk on which everything sits.
*   **Secondary Content:** `surface-container-low` (#f3f4f5) – Slim sidebars and secondary navigation.
*   **Active Workspaces:** `surface-container-lowest` (#ffffff) – Data tables and form sheets. This provides the highest contrast for readability.
*   **Floating Overlays:** `surface-bright` with Glassmorphism – Modals and popovers.

### The "Glass & Gradient" Rule
To elevate the "Architectural" feel, the top navigation bar must utilize **Glassmorphism**. Use `surface` at 80% opacity with a `20px` backdrop-blur. 
*   **Signature CTAs:** Use a subtle linear gradient from `primary` (#57344f) to `primary_container` (#714b67) at a 135-degree angle. This adds "visual soul" and prevents the interface from feeling "flat-pack."

## 3. Typography
The system uses **Inter** exclusively, leaning on its mathematical precision to maintain clarity in high-density views.

*   **Display & Headlines:** Use `headline-sm` (1.5rem) for module titles. Keep weight at Medium (500) to maintain an editorial, "Ledger" feel.
*   **The Data Core:** The bulk of the ERP experience lives in `body-sm` (0.75rem) and `label-md` (0.75rem). In high-density tables, use `label-md` for headers with `on_surface_variant` (#4e444a) to create a clear hierarchy between metadata and primary data.
*   **Intentional Asymmetry:** Align headlines to the far left of the container, but allow body text to sit within a narrower, centered column for long-form reading, creating a sophisticated editorial rhythm.

## 4. Elevation & Depth
Traditional shadows are too heavy for a modern ERP. We use **Tonal Layering** and **Ambient Light**.

*   **The Layering Principle:** Instead of a shadow, place a `surface-container-lowest` card on a `surface-container-low` background. The difference in hex code provides all the separation necessary.
*   **Ambient Shadows:** For floating elements (like a user profile dropdown), use a "Whisper Shadow": `0px 4px 20px rgba(25, 28, 29, 0.06)`. The color is a tint of `on_surface`, never pure black.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility (e.g., in high-contrast modes), use `outline_variant` (#d1c3ca) at 20% opacity. Never use 100% opaque borders.

## 5. Components

### Slim Sidebar (220px)
The navigation spine. Use `surface-container-low`. Active states are indicated by a `surface-container-highest` background and a 4px vertical "pill" of `primary` on the far left edge. Icons are 18px flat white symbols inside `0.375rem` (md) rounded-square containers.

### High-Density Data Tables
*   **Layout:** Forbid divider lines. Use `8px` vertical padding for rows. 
*   **Zebra Striping:** Use `surface-container-lowest` for the base and `surface-container-low` for alternating rows.
*   **Header:** Fixed `title-sm` with a `surface-dim` bottom tonal shift.

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. Border radius: `0.375rem` (md).
*   **Secondary:** Ghost style. No background, `primary` text. On hover, apply `surface-container-high`.
*   **Action Chips:** Used for status (e.g., "Invoiced"). Use `tertiary_container` with `on_tertiary_container` text. Keep radius at `full` for a distinct "pill" look that contrasts with the architectural squares elsewhere.

### Input Fields
*   **Style:** Minimalist "Underline" or "Soft Box" style. Avoid heavy outlines. 
*   **Focus:** Transition the background from `surface-container` to `surface-container-lowest` and change the bottom 2px "indicator" to `primary`.

## 6. Do's and Don'ts

### Do:
*   **Use Whitespace as a Tool:** Increase the margin between logical groups of data rather than adding a line.
*   **Respect the Sidebar:** Keep the sidebar at exactly 220px to maintain the "Slim Architectural" aesthetic.
*   **Stack Surfaces:** Place white elements on gray backgrounds to guide the user's eye to the "work area."

### Don't:
*   **No "Box-in-a-Box":** Avoid nesting cards with borders. Use shifts in background color (e.g., a `surface-container-high` section inside a `surface-container-low` page).
*   **No High-Contrast Shadows:** If a shadow looks like a shadow, it’s too dark. It should feel like a soft glow.
*   **No Standard Grids:** Break the horizontal flow occasionally with an overlapping element or an inset column to keep the "Editorial" feel alive. Drawing the eye to specific data points is more important than perfect symmetry.

---
*This design system is a living document intended to guide the creation of the next generation of enterprise tools through the lens of precision and sophisticated layering.*```