# Design System Document: The Precision Orchestrator

## 1. Overview & Creative North Star
The "Precision Orchestrator" is a high-density, editorial approach to industrial logistics. While standard warehouse systems often feel like cluttered spreadsheets, this system treats data as a curated exhibition. 

**Creative North Star: "The Industrial Gallery"**
This system breaks the "template" look by eschewing heavy containers in favor of **Tonal Architecture**. We replace the rigid 1px border with intentional shifts in surface luminance. By utilizing Inter’s geometric clarity and a sophisticated "Plum & Teal" palette, we create an environment that feels authoritative yet breathable. The layout relies on purposeful asymmetry—where heavy data tables are balanced by expansive, airy headers and overlapping "floating" status modules—ensuring that high-density information never feels suffocating.

---

## 2. Colors & Surface Architecture
Our palette transitions from the deep, grounded `primary` (#57344f) to the vibrant, utilitarian `secondary` (#00696e). 

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts or tonal transitions.
- Use `surface_container_low` (#f3f4f5) for the main workspace.
- Use `surface_container_lowest` (#ffffff) for active data cards to create a "lifted" effect.
- Use `surface_dim` (#d9dadb) for sidebar navigation to ground the interface.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. A warehouse dashboard should never be flat:
1. **Base Layer:** `background` (#f8f9fa).
2. **Intermediate Zones:** `surface_container` (#edeeef) for grouping related data modules.
3. **Primary Content:** `surface_container_lowest` (#ffffff) for the actual interactive data points.

### The "Glass & Gradient" Rule
To elevate the Odoo 18 aesthetic into a premium tier, use **Glassmorphism** for utility panels (e.g., filter drawers or floating action toolbars). Apply `surface` colors at 85% opacity with a `20px` backdrop blur. 
**Signature Texture:** Apply a subtle linear gradient (from `primary_container` to `primary`) on high-level CTA buttons to provide a "machined" feel that implies durability and professional polish.

---

## 3. Typography
We utilize **Inter** not just for legibility, but as a structural element. 

- **Display & Headlines:** Use `display-sm` and `headline-md` for warehouse KPIs. The tight tracking and bold weights of Inter create an "Editorial Technical" look.
- **Data Pairs:** Pair `label-md` (in `on_surface_variant`) with `title-sm` (in `on_surface`). This creates a clear hierarchy where the "Key" is a quiet metadata layer and the "Value" is the hero.
- **Intentional Contrast:** Use `secondary` (#00696e) for `label-sm` status indicators to immediately draw the eye to operational states (e.g., "In Transit" or "Stock Low").

---

## 4. Elevation & Depth
In this system, depth is a tool for focus, not decoration.

- **The Layering Principle:** Depth is achieved by stacking. Place a `surface_container_lowest` card on a `surface_container_low` section. This creates a natural, soft lift that mimics fine stationery.
- **Ambient Shadows:** When a floating state is required (e.g., a "Scan Item" modal), use an extra-diffused shadow: `box-shadow: 0 12px 32px -4px rgba(25, 28, 29, 0.06)`. Note the use of `on_surface` as the shadow tint to keep it organic.
- **The "Ghost Border" Fallback:** If a border is required for high-density data accessibility, use the `outline_variant` token at **15% opacity**. This provides a "suggestion" of a line without breaking the visual flow.
- **Glassmorphism:** Use semi-transparent `surface_bright` with a blur for top navigation bars, allowing the plum-colored primary accents of the content to bleed through as the user scrolls.

---

## 5. Components

### Buttons
- **Primary:** `primary` background, `on_primary` text. Use a 4px radius.
- **Secondary:** `secondary_container` background with `on_secondary_container` text. 
- **Tertiary/Ghost:** No background. Use `on_surface` text. These must only be used for low-priority actions to avoid visual noise.

### Cards & Lists
**Forbid the use of divider lines.** 
- Separate list items using 8px of vertical white space (from the spacing scale).
- Use a subtle background hover state of `surface_container_high` (#e7e8e9) to indicate interactivity.

### High-Density Data Inputs
- **Input Fields:** Use `surface_container_low` as the fill color. The bottom edge should have a 2px "Focus Bar" using the `secondary` color that expands from the center upon activation.
- **Chips:** For inventory status (e.g., "Hazardous," "Perishable"), use `tertiary_container` with a `label-sm` font.

### Inventory-Specific Components
- **The "Stock Pulse" Indicator:** A small, circular `secondary` element that pulses subtly to indicate real-time data syncing.
- **Miniature Warehouse Map:** A 2D top-down view using `surface_dim` for aisles and `primary_container` for active picking zones.

---

## 6. Do's and Don'ts

### Do
- **Do** use `surface_container_highest` to highlight "Critical Path" items (like an overdue shipment).
- **Do** lean into Inter's tabular lining figures for all numeric inventory counts to ensure perfect vertical alignment.
- **Do** use the `secondary` (Teal) for success states and the `error` (Red) sparingly to maintain the Plum/Teal sophisticated balance.

### Don't
- **Don't** use 100% black text. Always use `on_surface` (#191c1d) to maintain the "Editorial" softness.
- **Don't** use standard drop shadows on cards. Stick to Tonal Layering.
- **Don't** use 1px dividers between table rows. Instead, use a subtle `surface_variant` background on every other row (zebra striping) at 30% opacity.
- **Don't** use rounded corners larger than `sm` (4px) for functional elements; we want the system to feel precise and "engineered."