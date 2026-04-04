# Design System Document: High-Density Precision & Tonal Depth

## 1. Overview & Creative North Star: "The Architectural Ledger"
The Creative North Star for this design system is **"The Architectural Ledger."** In a high-density Warehouse Management System (WMS), the UI must behave like a sophisticated technical blueprint—authoritative, hyper-functional, yet refined. 

This system moves beyond the generic "SaaS dashboard" by embracing a high-end editorial feel. We replace rigid, boxy containers with **Tonal Layering** and **Intentional Asymmetry**. Instead of using lines to separate data, we use the "breath" of white space and subtle shifts in surface luminosity. The result is a professional environment that feels premium, calm, and incredibly efficient under heavy data loads.

---

## 2. Colors: Depth Through Sophistication
This system utilizes a deep, plum-toned primary palette paired with a clinical neutral base to ensure focus and reduced eye strain during long shifts.

### Primary & Signature Textures
- **Primary:** `#57344F` | **Primary Container:** `#714B67`
- **The "Signature Gradient":** For primary actions and hero headers, utilize a linear gradient from `#57344F` to `#714B67` (135 degrees). This adds "soul" and a sense of luxury to the functional interface.

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are prohibited for sectioning. Boundaries must be defined solely through background color shifts.
- To separate a sidebar from a main canvas, use `surface-container-low` against a `surface` background.
- This creates a seamless, "molded" look rather than a fragmented one.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the following tiers to create depth:
- **Surface (Base):** `#F9F9F9` (The foundational canvas).
- **Surface Container Lowest:** `#FFFFFF` (For high-priority interactive cards/inputs).
- **Surface Container Low:** `#F3F3F3` (For secondary information panels).
- **Surface Container High:** `#E8E8E8` (For subtle UI elevation).

### Glassmorphism
For floating utility bars or search overlays, use the `surface` color at 80% opacity with a `20px` backdrop-blur. This ensures the high-density warehouse data remains visible but softened behind the active utility.

---

## 3. Typography: Editorial Utility
We use the **Inter** family to bridge the gap between technical data and high-end aesthetics.

- **Display (Lg/Md/Sm):** Reserved for KPI highlights. Use a `-0.02em` letter spacing to give it a "tight," custom-font feel.
- **Headline & Title:** Used for module navigation and section headers. High-contrast sizing between `headline-lg` (2rem) and `title-sm` (1rem) creates an editorial hierarchy that guides the eye instantly.
- **Body & Label:** The workhorses of the WMS. `body-md` (0.875rem) is the standard for data entry. `label-sm` (0.6875rem) should be used for metadata and secondary warehouse tags, always in `on-surface-variant` color.

---

## 4. Elevation & Depth: Tonal Stacking
We reject traditional drop shadows in favor of **Ambient Light Simulation.**

- **The Layering Principle:** Depth is achieved by "stacking." A `surface-container-lowest` card sits on a `surface-container-low` section to create a soft, natural lift.
- **Ambient Shadows:** For critical floating elements (modals), use a shadow: `0px 12px 32px rgba(87, 52, 79, 0.06)`. Note the use of a plum-tinted shadow (`primary`) rather than grey; this makes the shadow feel integrated with the brand's lighting.
- **The "Ghost Border":** If a border is required for accessibility in forms, use `outline-variant` (`#D1C3CA`) at **20% opacity**. It should be a whisper of a line, never a shout.

---

## 5. Components: Functional Elegance

### Buttons
- **Primary:** The Signature Gradient (`#57344F` to `#714B67`). 4px radius. No border. White text.
- **Secondary:** Transparent background with a "Ghost Border" (20% opacity `outline-variant`).
- **Tertiary:** Text-only, using `primary` color, for low-emphasis actions within dense tables.

### Data Inputs (High-Density)
- **Structure:** Use `surface-container-lowest` (#FFFFFF) for the input field background to pop against the `surface` (#F9F9F9) page.
- **Focus State:** Instead of a thick border, use a 1px `primary` border with a subtle inner glow.

### Cards & Lists (The "Anti-Divider" Rule)
- Forbid the use of horizontal divider lines in lists. 
- **Separation:** Use `8px` of vertical white space or a hover-state background shift to `surface-container-high`.
- In high-density WMS tables, use alternating row tints: `surface` and `surface-container-low`.

### Chips & Status Indicators
- **Error/Alert:** Use the Coral (`#E46F78`) with a 10% opacity background of the same color for status chips. This ensures high visibility without "vibrating" against the plum primary colors.

---

## 6. Do’s and Don’ts

### Do:
- **Do** use "Negative Space" as a functional tool. In high-density layouts, white space is the only thing that prevents cognitive overload.
- **Do** use the `4px` border radius consistently. It is the "mechanical" signature of the system.
- **Do** prioritize Tonal Layering over lines. If you feel the need to draw a line, try changing the background color of the section first.

### Don't:
- **Don’t** use pure black `#000000` for text. Use `on-surface` (`#1A1C1C`) to maintain the "premium paper" look.
- **Don’t** use standard "Odoo purple." Always lean into the custom Plum/Coral palette provided.
- **Don’t** use heavy, dark shadows. If a shadow is visible as a "black smudge," it is too heavy. It should feel like a soft glow.
- **Don't** clutter the interface with icons. Use typography as the primary driver of hierarchy; icons should only be used as functional "anchors."