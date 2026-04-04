# Design System Document: The Executive Warehouse

## 1. Overview & Creative North Star
**Creative North Star: "The Tactile Architect"**

This design system transcends the typical "enterprise software" aesthetic by blending the high-density utility of Odoo 18 with the sophisticated atmosphere of a luxury editorial layout. We move away from the "flat box" trap of warehouse management systems (WMS) to create an interface that feels both industrially robust and digitally premium. 

By utilizing **Intentional Asymmetry** and **Tonal Depth**, we transform a high-density POS interface into a curated workspace. The system breaks the traditional grid by using the 240px sidebar as an anchor, allowing the main content area to "breathe" through layered surfaces rather than rigid lines.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a deep, authoritative plum (`#714B67`), balanced by a range of sophisticated architectural greys.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts. 
*   *Example:* A `surface-container-low` section sitting on a `surface` background provides all the definition a professional eye needs. 

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine paper.
*   **Base Level:** `surface` (#f9f9f9) - The canvas.
*   **Sidebar:** `surface-container-low` (#f3f3f3) - The structural anchor.
*   **Work Area:** `surface-container-lowest` (#ffffff) - The focus zone where data entry happens.
*   **Active Elements:** `surface-container-high` (#e8e8e8) - Used for hover states or nested utility panels.

### The "Glass & Gradient" Rule
To elevate the primary brand color, use a signature gradient for main CTAs:
*   **Signature Gradient:** Linear 135° `primary` (#57344f) to `primary-container` (#714b67). 
*   **Glassmorphism:** For floating modals or "quick-view" overlays, use `surface-container-lowest` with an 80% opacity and a `20px` backdrop-blur. This ensures the WMS data remains visible but diffused behind the active task.

---

## 3. Typography
We utilize **Inter** not just for legibility, but as a structural element. 

*   **Display & Headlines:** Use `headline-sm` (1.5rem) for main dashboard metrics. These should be set with a tighter letter-spacing (-0.02em) to feel "machined" and precise.
*   **The Power of Labels:** In a POS environment, `label-md` (0.75rem) is the workhorse. Use `on-surface-variant` (#4e444a) for labels to create a clear hierarchy against the `body-md` (0.875rem) input data.
*   **Editorial Contrast:** Pair high-density data tables with generous `title-lg` (1.375rem) headers to give the user's eyes a "place to land" before diving into the logistics.

---

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering**, mimicking natural light rather than digital shadows.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. This creates a "soft lift" that is easier on the eyes during long shifts than high-contrast shadows.
*   **Ambient Shadows:** If an element must float (e.g., a "Total Amount" bar), use a shadow: `0px 12px 32px rgba(87, 52, 79, 0.06)`. Note the tint: we use a hint of the primary color in the shadow to maintain tonal warmth.
*   **The "Ghost Border":** If a container requires a boundary (e.g., in high-glare environments), use `outline-variant` (#d1c3ca) at **15% opacity**. Never use a 100% opaque border.

---

## 5. Components

### Action Buttons (The POS Utility)
*   **Primary POS Button:** High-density height (min 48px for touch). Uses the **Signature Gradient**. Radius: `DEFAULT` (4px).
*   **Secondary/Sidebar Buttons:** Ghost style. No background, `on-surface` text. On hover, shift to `surface-container-high`.
*   **Tactile Feedback:** On press, the button should scale to `0.98` and the gradient should deepen to `primary-fixed-dim`.

### Input Fields & Text Areas
*   **Style:** Minimalist. No bottom line, no full border. Use a filled `surface-container-highest` (#e2e2e2) background with a 4px top-radius.
*   **Focus State:** The background remains, but a 2px "Ghost Border" of `primary` appears at the bottom only.

### Cards & Data Lists
*   **Strict Rule:** No divider lines between list items. Use `8px` of vertical white space and a subtle background toggle (`surface` vs `surface-container-lowest`) for zebra-striping if necessary.
*   **Packing Chips:** Use `secondary-container` (#f5dbea) with `on-secondary-container` (#725f6b) text. These are small, 4px-radius badges for status like "Picked" or "Staged."

### Contextual Warehouse Components
*   **The "Scannable Unit" Card:** A high-contrast card using `surface-container-lowest` with a thick 4px left-accent of `primary` to indicate the currently active item being packed.
*   **The Density Toggle:** A small, elegant switch in the sidebar to toggle between "Standard" and "Compact" views, adjusting the spacing scale from `md` to `sm`.

---

## 6. Do's and Don'ts

### Do
*   **Do** use whitespace as a separator. If you feel the need to add a line, add 16px of padding instead.
*   **Do** use `primary-fixed` (#ffd7f1) for subtle highlights in data visualization; it provides high contrast without the aggression of a standard "bright" color.
*   **Do** ensure all touch targets for the POS Pack interface are at least 44x44px, even if the visual "button" looks smaller.

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on-surface` (#1a1c1c) to maintain the premium, soft-ink feel.
*   **Don't** use "Alert Red" for everything. Use `error-container` (#ffdad6) for backgrounds of error states to keep the interface professional and calm under pressure.
*   **Don't** round corners beyond `lg` (0.5rem). This system relies on the "4px Radius" to maintain a serious, industrial-grade enterprise feel.