# Velvet Orchard Design System

### 1. Overview & Creative North Star
**Creative North Star: "The Modern Atelier"**
Velvet Orchard is a design system that balances the productivity of a high-end enterprise suite with the curated aesthetics of a boutique studio. It moves away from the sterile "white-box" SaaS template, favoring a deep, saturated primary palette and a layout that breathes through intentional negative space and a "canvas" approach to application management.

The system breaks traditional grids by using a "Launch Canvas" that prioritizes focus. It leverages a sophisticated interplay between deep plums, forest greens, and teal accents to create a workspace that feels like a physical desk rather than a digital spreadsheet.

### 2. Colors
The color palette is rooted in **Fidelity**, ensuring brand colors retain their intended character while harmonizing with the neutral surfaces.

*   **Primary Roles:** A deep, authoritative Plum (`#714B67`) serves as the anchor, used for the global navigation and primary actions.
*   **Neutral Surfaces:** The system uses a cool, sophisticated grey-white (`#F8F9FA`) to reduce eye strain during long working sessions.
*   **The "No-Line" Rule:** Visual boundaries are created via tonal shifts. The interface prohibits 1px solid borders for sectioning. Instead, utilize `surface-container-low` to set off panels from the main `background`.
*   **Surface Hierarchy:**
    *   **Level 0 (Background):** `#f8f9fa` - The infinite canvas.
    *   **Level 1 (Low):** `#f3f4f5` - Subtle grouping.
    *   **Level 2 (Lowest):** `#ffffff` - Elevated components like Search or active Inputs.
*   **Signature Textures:** Floating elements like App Icons utilize a specific "App-Icon-Shadow" to lift them off the canvas, creating a tactile, physical quality.

### 3. Typography
Velvet Orchard utilizes **Inter** across all levels, but manipulates tracking and weight to differentiate between "Instrumental" and "Editorial" text.

*   **Display & Headlines:** Used for "Odoo" branding and search inputs. (Extracted: `2.25rem` for hero moments, `1.25rem` for sub-headers). High tracking-tight settings (`-0.025em`) give the headings a modern, dense feel.
*   **Body & Titles:** (Extracted: `1.125rem` and `0.875rem`). Font weights are kept at 500 (Medium) for UI labels to ensure legibility against colored backgrounds.
*   **Micro-Labels:** (Extracted: `11px`). Reserved for the status bar and tertiary metadata, using a 0.8 opacity to maintain hierarchy.

### 4. Elevation & Depth
Depth is communicated through **Tonal Layering** and a specific shadow vocabulary.

*   **The Layering Principle:** Instead of borders, components are "stacked." For example, the Search Bar (`#ffffff`) sits on the Canvas (`#f8f9fa`), defined only by its shadow.
*   **Ambient Shadows:** 
    *   **Primary Shadow:** `0 2px 4px rgba(0, 0, 0, 0.08)`. Used for app icons and elevated buttons to provide a soft, professional lift.
    *   **Small Shadow:** `shadow-sm` for the header and footer to define the fixed navigation planes.
*   **Glassmorphism:** Navigation links in the top header use `white/10` (10% opacity) backgrounds to create a subtle "glass" effect against the plum header, indicating the active state without introducing new colors.

### 5. Components
*   **App Icons:** Circular foundations (`rounded-full`) with a diverse, vibrant palette. Icons must be centered and use the "Material Symbols Outlined" set with a `FILL 1` variation for a bold, graphic look.
*   **Buttons:** Two types.
    1.  **Ghost Navigation:** `white/80` text that transitions to `white` on hover, with a `white/10` rounded background.
    2.  **Floating Action:** Circular with the `app-icon-shadow`.
*   **Inputs:** The search field is a hallmark component: `rounded-xl`, no border, `surface-container-lowest` background, and high-impact `1.125rem` text.
*   **Status Bar:** A dedicated `h-8` footer in `surface-container-high` using `11px` typography for enterprise-grade metadata.

### 6. Do's and Don'ts
**Do:**
*   Use background color shifts (`surface` vs `surface-container-low`) to define regions.
*   Use vibrant, distinct colors for app-level icons to aid rapid cognitive recognition.
*   Apply `tracking-tight` to headlines to maintain a modern, editorial edge.

**Don't:**
*   **No Hard Outlines:** Never use high-contrast borders to separate UI sections.
*   **No Sharp Corners:** Avoid `0px` rounding; maintain at least a `0.125rem` (2px) base radius for enterprise tools and `0.75rem` (12px) for user-facing interactive cards.
*   **No Pure Black:** Use `on-surface` (`#191c1d`) for text to ensure a softer, premium reading experience.