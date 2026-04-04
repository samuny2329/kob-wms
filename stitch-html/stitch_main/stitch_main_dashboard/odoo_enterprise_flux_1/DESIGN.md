# Design System Strategy: The Industrial Atelier

## 1. Overview & Creative North Star
**The Creative North Star: "Precision Elegance"**
This design system moves beyond the utility-first aesthetic of traditional logistics software. It treats high-density warehouse data not as a cluttered spreadsheet, but as a high-end editorial layout. By combining the structural rigor of a Warehouse Management System (WMS) with the tonal sophistication of a premium brand, we create an environment that reduces cognitive load while feeling authoritative and intentional.

We break the "template" look by utilizing **Tonal Layering** and **Intentional Asymmetry**. Instead of rigid grids separated by heavy lines, we use subtle shifts in surface color and "ghost" boundaries to guide the eye. It is an aesthetic of "Soft Industrialism"—highly functional, yet visually serene.

## 2. Color Strategy & Surface Architecture
Our palette uses deep, desaturated purples to provide a sense of stability, contrasted against surgical teals for action and precision.

*   **Primary (`#57344f`) & Primary Container (`#714b67`):** Reserved for high-authority moments and global navigation.
*   **Tertiary/Accents (`#00474b`, `#006166`):** Used exclusively for "Precision" data points—inventory accuracy, successful scans, and active shipments.

### The "No-Line" Rule
Standard UI relies on 1px borders to separate content. **In this system, 1px solid borders are prohibited for sectioning.** Boundaries must be defined by:
1.  **Background Shifts:** Placing a `surface-container-lowest` card on a `surface-container-low` background.
2.  **Vertical Space:** Using the spacing scale to create distinct visual groups.
3.  **Tonal Transitions:** A subtle change from `surface` to `surface-dim` to indicate a new functional zone.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of materials. 
*   **The Base:** `surface` (#F9F9F9) – The warehouse floor.
*   **The Workbench:** `surface-container-low` (#F3F3F3) – The Sidebar and navigation zones.
*   **The Focal Point:** `surface-container-lowest` (#FFFFFF) – Active data cards and input forms.
*   **The Signature Header:** A linear gradient from `primary` (#57344F) to `primary-container` (#714B67). This creates a "weighted" top that grounds the entire application.

### The "Glass & Gradient" Rule
Floating modals or transient overlays must use **Glassmorphism**. Utilize `surface-container-lowest` at 80% opacity with a `20px` backdrop-blur. This ensures the high-density data underneath remains visible as a "texture," preventing the user from losing their place in the warehouse workflow.

## 3. Typography
We use **Inter** for its neutral, highly legible character. The hierarchy is designed for "Scan-and-Act" workflows.

*   **Display & Headline (The Metrics):** `display-sm` (2.25rem/36px) or larger. Use **Bold** for inventory counts and KPI values. This is the "What."
*   **Labels (The Context):** `label-sm` (11px). Must be **UPPERCASE** with `tracking-wider` (0.05em). This is the "Category."
*   **Body (The Detail):** `body-md` (0.875rem/14px). Used for SKU descriptions and secondary notes.

By pairing tiny, wide-tracked labels with massive, bold values, we create an editorial contrast that allows a warehouse manager to read the screen from five feet away.

## 4. Elevation & Depth
Depth in this system is achieved through **Tonal Layering**, not shadows.

*   **The Layering Principle:** To lift a component, don't add a shadow; change its surface. A card (`surface-container-lowest`) sitting on a workspace (`surface-container-low`) provides all the "lift" needed.
*   **Ambient Shadows:** If an element must float (e.g., a critical alert or a floating action button), use a "Whisper Shadow": `Y: 8px, Blur: 24px, Color: on-surface @ 4%`.
*   **The Ghost Border Fallback:** For input fields or secondary buttons, use a "Ghost Border": `outline-variant` (#D1C3CA) at **15% opacity**. It provides a suggestion of a container without breaking the tonal flow.
*   **3px Accent Accentuation:** Every high-level KPI card must feature a vertical `3px` solid border on the left side using `tertiary` (#00A09D) or `primary` (#714B67). This is our signature mark of "Premium Functionality."

## 5. Components

### KPI Cards (The Signature Component)
*   **Background:** `surface-container-lowest` (#FFFFFF).
*   **Border:** `none` (except the 3px left-accent).
*   **Label:** 11px Uppercase, `on-surface-variant`.
*   **Value:** 24px+ Bold, `on-surface`.

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary-container`), 4px radius. No border.
*   **Secondary:** Ghost Border (`outline-variant` @ 20%). Text color: `primary`.
*   **Tertiary:** Transparent background, `label-md` uppercase styling.

### Input Fields (High-Density)
*   **Surface:** `surface-container-highest` (#E2E2E2) at 40% opacity.
*   **Bottom Border:** 1px `outline-variant` for "Industrial" grounding.
*   **State:** On focus, the 1px border transforms into the `tertiary` (#017E84) color.

### Inventory Lists
*   **Divider Rule:** No horizontal lines. 
*   **Alternating Tones:** Use `surface-container-lowest` and `surface-container-low` to distinguish rows.
*   **Interactive Row:** On hover, shift to `surface-bright`.

### Additional Component: The "Scan Status" Bar
A full-width, 4px tall progress bar at the very top of a content pane using the `tertiary_fixed` (#95F1F8) color to show real-time shipment loading progress.

## 6. Do's and Don'ts

### Do
*   **Do** use white space as your primary separator.
*   **Do** use the 4px radius consistently across all containers and buttons.
*   **Do** trust the tonal layering; if two elements look "stuck together," move one further down the `surface-container` scale.
*   **Do** ensure high-contrast accessibility for the 11px labels by using `on-surface-variant`.

### Don't
*   **Don't** use 100% black text. Always use `on-surface` (#1A1C1C).
*   **Don't** use standard "Odoo Purple" (#714B67) for everything. Use it sparingly for primary actions to maintain its visual impact.
*   **Don't** use rounded corners larger than 4px. This is an industrial tool; it needs to feel sharp and precise, not "bubbly."
*   **Don't** use drop shadows on cards. Use tonal shifts. Only floating modals get shadows.