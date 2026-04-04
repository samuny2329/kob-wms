# Design System Specification: The Fluid Enterprise

## 1. Overview & Creative North Star
**Creative North Star: "The Architectural Utility"**
This design system moves beyond the rigid, boxy constraints of traditional ERP software. Our goal is to transform complex business data into an editorial-grade experience. We achieve this through **Architectural Utility**: a philosophy where the interface is built like a modern high-end office—clean, expansive, and organized through physical depth rather than structural lines.

We break the "template" look by utilizing intentional white space and **Tonal Layering**. By prioritizing background shifts over borders, we create a layout that feels integrated and breathable, allowing the vibrant application iconography to serve as the primary navigational beacons.

---

## 2. Colors & Surface Philosophy

Our palette is anchored by a deep, authoritative purple, balanced against a sophisticated range of cool grays.

### The Color Tokens
*   **Primary (Brand Core):** `#57344f` — Used for high-level brand moments.
*   **Primary Container (The Nav):** `#714b67` — The signature "Odoo Purple" reserved for the top utility bar.
*   **Secondary (The Action):** `#006a68` — Used for "Success" paths and primary action buttons.
*   **Surface (Background):** `#f8f9fa` — The desaturated canvas for all applications.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. Boundaries must be defined solely through background color shifts. 
*   *Example:* A `surface-container-low` (`#f3f4f5`) sidebar sitting against a `surface` (`#f8f9fa`) main content area.

### Surface Hierarchy & Nesting
Treat the UI as stacked sheets of fine paper. Use these tiers to define importance:
*   **Surface Container Lowest (`#ffffff`):** Reserved for the "active" card or data entry area. This provides the highest contrast against the background.
*   **Surface (`#f8f9fa`):** The default application background.
*   **Surface Container High (`#e7e8e9`):** Used for non-interactive header bars or secondary side panels.

### The "Glass & Gradient" Rule
To elevate the system above standard utility, use **Glassmorphism** for floating dropdowns and modals.
*   **Token:** `primary-container` at 85% opacity with a `24px` backdrop-blur. 
*   **CTAs:** Use a subtle linear gradient from `primary` (`#57344f`) to `primary-container` (`#714b67`) at a 135-degree angle to provide "soul" and depth to buttons.

---

## 3. Typography: The Editorial Sans

We utilize **Inter** for its neutral, highly legible characteristics, but we apply it with editorial intentionality—using tight tracking for displays and generous leading for body text.

*   **Display (Large Scale):** `display-lg` (3.5rem) / `display-md` (2.75rem). Use these for dashboard "Big Numbers" or empty-state heroes.
*   **Headlines:** `headline-sm` (1.5rem). Used for Page Titles. Always use a `on-surface` (`#191c1d`) color to ensure authority.
*   **Utility & Labels:** `label-md` (0.75rem). This is the workhorse of the system. Use for table headers and metadata.
*   **Body:** `body-md` (0.875rem). Standardize on this for all user input and data rows to maximize information density without sacrificing legibility.

---

## 4. Elevation & Depth

### The Layering Principle
Depth is achieved by "stacking" surface tiers. 
*   **Dashboard Logic:** Place `surface-container-lowest` cards on the `surface` background. This creates a soft, natural lift (0.25rem corner radius) without the need for heavy shadows.

### Ambient Shadows
When a "Floating" effect is required (e.g., a Kanban card being dragged):
*   **Blur:** `16px` to `32px`.
*   **Color:** `#191c1d` (on-surface) at **4% to 6% opacity**. 
*   **Avoid:** Pure black or grey shadows. The shadow must feel like a "tint" of the background.

### The "Ghost Border" Fallback
If a border is required for accessibility (e.g., input fields), use the `outline-variant` (`#d1c3ca`) at **20% opacity**. Never use a 100% opaque border.

---

## 5. Components

### The Navigation Bar (Top Utility)
*   **Background:** `primary-container` (`#714b67`).
*   **Text/Icons:** White at 90% opacity. 
*   **Interaction:** Active apps should have a subtle background highlight of `primary` (`#57344f`) with a `0.25rem` radius.

### Buttons
*   **Primary:** Gradient of `primary` to `primary-container`. White text. Radius: `md` (0.375rem).
*   **Secondary:** `surface-container-highest` background with `on-surface` text. No border.
*   **Tertiary:** Transparent background, `primary` text. Use for "Cancel" or "Discard" actions.

### Cards & Lists
*   **Constraint:** Forbid divider lines. 
*   **Logic:** Separate list items using the Spacing Scale (e.g., `2.5` / 0.5rem gap) or a subtle hover state shift to `surface-container-low`.

### App Icons (The Signature)
*   **Shape:** `xl` (0.75rem) roundedness.
*   **Styling:** Vibrant flat backgrounds (Blue, Orange, Green) with a single, simplified white glyph centered. No complex shadows or gradients on the icon itself.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical layouts in dashboards (e.g., a 70/30 split) to guide the eye.
*   **Do** use `0.9rem` (Spacing 4) as your "Standard Unit" of padding for all containers.
*   **Do** rely on iconography colors to provide the "visual energy" while the UI remains neutral.

### Don’t
*   **Don’t** use a shadow on a card if it is already sitting on a contrasting surface tier.
*   **Don’t** use high-contrast dividers (`#000000`). If you must divide, use a `1px` gap showing the background color beneath.
*   **Don’t** use "Standard Blue" for links. Use the `primary` purple or `secondary` teal to maintain the brand's sophisticated tone.