# Design System Document: Precision Industrialism

## 1. Overview & Creative North Star
**Creative North Star: "The Kinetic Architect"**

This design system rejects the "clunky" reputation of industrial software. Instead, it embraces a high-density, editorial approach to warehouse management. We are moving away from the generic "admin dashboard" look toward a "Kinetic Architect" aesthetic: a system that feels like a high-performance instrument—precise, weighted, and intentional.

The system breaks the standard "box-in-a-box" template by using **tonal layering** and **intentional asymmetry**. We treat the scanning interface not as a series of forms, but as a flight deck. Information density is high, but visual noise is non-existent. We prioritize the "Scan-Action" loop through high-contrast typography and subtle textural depth.

---

## 2. Colors & Surface Philosophy

The palette is anchored in the Odoo-inspired deep plum (`primary`), balanced by a clinical, high-utility grey scale.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off the UI. Separation must be achieved through background shifts. 
*   Use `surface_container_low` (#f3f3f3) for the sidebar.
*   Use `surface` (#f9f9f9) for the main workspace.
*   Use `surface_container_lowest` (#ffffff) for active scanning zones.

### Surface Hierarchy & Nesting
Depth is achieved by stacking layers of increasing "purity." 
1.  **Base:** `surface` (#f9f9f9)
2.  **Sectioning:** `surface_container` (#eeeeee)
3.  **Active Work Item:** `surface_container_lowest` (#ffffff) - This creates a natural "lift" without the clutter of shadows.

### The "Glass & Gradient" Rule
To elevate the industrial feel, the main `primary` action areas (like the "Validate" or "Ship" buttons) should not be flat. Apply a subtle linear gradient from `primary` (#57344f) to `primary_container` (#714b67) at a 135° angle. 

For overlays or "toast" notifications, use **Glassmorphism**: 
*   **Fill:** `surface_container_highest` (#e2e2e2) at 80% opacity.
*   **Effect:** Backdrop blur (12px to 20px).

---

## 3. Typography: The Data Hierarchy

We pair the humanist precision of **Inter** with the utilitarian clarity of **Monospace**.

*   **Display & Headlines (Inter):** Used for shipment IDs and high-level status. Bold weights (700+) with tight letter-spacing (-0.02em) to feel "machined."
*   **Monospace (Source Code Pro or similar):** Reserved exclusively for Barcode strings, AWB numbers, and SKU codes. This visual distinction tells the operator's brain: *"This is raw data to be scanned."*

**Hierarchy Table:**
*   **Headline-LG:** `2rem / Inter / 700` — Main Order ID.
*   **Title-SM:** `1rem / Inter / 600` — Section headers.
*   **Body-MD (Monospace):** `0.875rem` — Barcode data & Serial numbers.
*   **Label-SM:** `0.6875rem / Inter / 500 / All Caps` — Meta-data labels (e.g., "WEIGHT", "ZONE").

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are forbidden unless an element is "Floating" (e.g., a modal).

*   **The Layering Principle:** Place a `surface_container_lowest` card on a `surface_container_low` background. The slight shift in hex value provides enough contrast for the eye without adding visual "weight."
*   **Ambient Shadows:** For modals, use a "Tinted Shadow": `drop-shadow(0 12px 24px rgba(87, 52, 79, 0.08))`. The purple tint in the shadow creates a sophisticated, cohesive atmosphere.
*   **The "Ghost Border":** For input fields or secondary zones, use the `outline_variant` (#d1c3ca) at **15% opacity**. It should be felt, not seen.

---

## 5. Components: Industrial Precision

### Buttons
*   **Primary:** Gradient (#57344f to #714b67). 4px radius. White text. Minimalist "glow" on hover using a 4% white overlay.
*   **Secondary:** `surface_container_highest` (#e2e2e2) with `on_surface` (#1a1c1c) text. No border.

### Scanning Input Fields
*   **Style:** `surface_container_lowest` (#ffffff) background.
*   **State:** When active/focused, use a 2px `primary` bottom-border only (Editorial style) rather than a full box glow.
*   **Typography:** All input text for barcodes should be Monospace.

### Industrial Data Chips
*   **Status Chips:** No background. Use a "Ghost Border" (15% `on_surface`) and a small 6px circular dot of the status color (e.g., `error` #ba1a1a for "Damaged").

### Lists & Inventory Grids
*   **No Dividers:** Separate list items using 8px of vertical white space and a subtle background hover state using `surface_container_high` (#e8e8e8).
*   **High-Density:** Reduce padding to 8px top/bottom to allow more data on rugged tablets.

---

## 6. Do's and Don'ts

### Do
*   **Do** use 4px (`DEFAULT`) radius for all components to maintain the "Industrial" feel.
*   **Do** use Monospace for any string of characters that can be scanned by a laser.
*   **Do** use `tertiary_container` (#4b5d33) for "Success/Packed" states to provide a sophisticated contrast to the purple primary.

### Don't
*   **Don't** use 100% black (#000000). Use `on_surface` (#1a1c1c) for all text to maintain a premium, ink-like feel.
*   **Don't** use standard "Select" dropdowns. In a WMS, use high-density button groups or "Command Palettes" to keep the operator's hands moving.
*   **Don't** use generic icons. Use "Duotone" icons where the secondary path is set to 30% opacity of the `primary` color.

---

## 7. Signature Interaction: The "Pulse"
When a barcode is successfully scanned, the entire container should flash a 10% opacity `primary` (#714b67) overlay for 150ms. This provides a tactile, "physical" confirmation of data entry without the need for intrusive popups.