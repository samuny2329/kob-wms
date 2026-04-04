# Design System Specification: The Precision Authority

## 1. Overview & Creative North Star
This design system is engineered for the "Precision Authority." It is a high-fidelity framework that balances the density of enterprise-grade data with the elegance of high-end editorial design. Moving away from the "cluttered" look of traditional ERPs, this system uses a strict logic of tonal layering and compact typography to create an environment that feels both powerful and effortless.

**Creative North Star: The Digital Architect**
The system treats the UI as a structured, architectural environment. It rejects the "template" look by using intentional color shifts and depth to guide the user’s eye, ensuring that even the most complex data sets feel curated and intentional. We prioritize clarity through hierarchy rather than borders, and professionalism through subtle, polished details.

---

## 2. Colors & Surface Logic
The palette is rooted in a deep, sophisticated purple, contrasted against a clean, cool-neutral foundation. 

### The "No-Line" Rule
To achieve a premium, custom feel, **1px solid borders are strictly prohibited for sectioning.** Boundaries must be defined solely through background color shifts or subtle tonal transitions. 
*   Use `surface` (#f8f9fa) for the main application background.
*   Use `surface-container-low` (#f3f4f5) to define sidebars or secondary regions.
*   Use `surface-container-lowest` (#ffffff) for primary content cards and active work areas.

### Surface Hierarchy & Nesting
Treat the UI as a series of nested physical layers. An inner container should always use a tier that creates a soft distinction from its parent.
*   **Parent:** `surface` (#f8f9fa)
*   **Child Container:** `surface-container-lowest` (#ffffff)
*   **Active/Elevated Element:** `surface-bright` (#f8f9fa)

### The Glass & Gradient Rule
For the top navigation and floating action menus, use a signature treatment to break the flat aesthetic:
*   **Navigation Bar:** Use `primary` (#57344f) with a subtle linear gradient toward `primary-container` (#714b67).
*   **Glassmorphism:** For floating overlays (e.g., user profiles or app switchers), use `primary-container` at 85% opacity with a `20px` backdrop blur. This ensures the UI feels integrated into the space rather than hovering awkwardly above it.

---

## 3. Typography
We utilize **Inter** for its modern, neutral character and excellent legibility at small sizes.

*   **Display & Headlines:** Use `headline-md` (1.75rem) for main dashboard titles. Keep letter-spacing at -0.02em to maintain an "editorial" feel.
*   **Functional Titles:** `title-sm` (1rem) is the workhorse for card titles and section headers.
*   **Data Density:** Use `body-sm` (0.75rem) and `label-md` (0.75rem) for table data and metadata. The "compact" nature of this scale is what gives the system its "pro" enterprise feel.
*   **Visual Soul:** Pair `primary` color text for high-level labels with `on-surface-variant` (#4e444a) for secondary descriptions to create a rich, multi-tonal typographic landscape.

---

## 4. Elevation & Depth
Depth is a tool for information architecture, not just decoration.

### The Layering Principle
Achieve lift by stacking surface tokens. For example, place a `surface-container-lowest` card on a `surface-container-low` section. This creates a natural, soft distinction without the need for high-contrast lines.

### Ambient Shadows
When an element must float (Modals, Popovers):
*   **Shadow Color:** Use a tinted version of `on-surface` (e.g., #191c1d at 8% opacity).
*   **Blur:** Use large, diffused values (12px to 24px) to mimic natural ambient light.
*   **Forbid:** Never use pure black (#000000) shadows; they feel "cheap" and digital.

### The "Ghost Border" Fallback
If a border is required for accessibility in input fields:
*   Use the `outline-variant` (#d1c3ca) at 40% opacity. 
*   **Strictly Forbid:** 100% opaque, high-contrast borders.

---

## 5. Components

### Buttons
*   **Primary:** Background `primary` (#57344f), Text `on-primary` (#ffffff). Corner radius `md` (0.375rem).
*   **Secondary:** Background `surface-container-high` (#e7e8e9), Text `on-surface` (#191c1d).
*   **Tertiary:** No background. Text `primary` (#57344f).
*   **Interaction:** On hover, primary buttons should shift to `primary-container` (#714b67).

### Cards & Lists
*   **The Divider Ban:** Do not use line dividers between list items. Use the spacing scale—`spacing-2` (0.4rem) or `spacing-3` (0.6rem)—to create rhythmic separation.
*   **Card Styling:** Background `surface-container-lowest` (#ffffff), radius `lg` (0.5rem), and a soft ambient shadow (4% opacity).

### App Icons
*   **Structure:** Rounded square containers with `radius-xl` (0.75rem).
*   **Visual Style:** Use vibrant, solid background colors (e.g., `secondary` #00696e or `tertiary` #34451e) with pure white (#ffffff) glyphs centered within.

### Input Fields
*   **Default State:** `surface-container-lowest` background with a `ghost border`.
*   **Active State:** Increase border opacity to 100% using `primary` (#57344f) and add a subtle `primary-fixed` (#ffd7f1) outer glow (2px).
*   **Typography:** Labels must use `label-md` in `on-surface-variant`.

---

## 6. Do’s and Don’ts

### Do
*   **Use Tonal Shifts:** Always use `surface-container` variations to separate the sidebar from the main workspace.
*   **Maintain Density:** Use `spacing-4` (0.9rem) as the standard padding for cards to maintain a "pro" feel.
*   **Leverage Inter's Weights:** Use SemiBold for `title-sm` to make headers pop against dense data.

### Don’t
*   **Don't use "True Black":** Avoid #000000 for text or shadows. Use `on-surface` (#191c1d).
*   **Don't use Large Radii:** Never exceed `0.75rem` for functional components; large curves feel "consumer-grade" and reduce available data space.
*   **Don't use Dividers:** Avoid horizontal rules (`<hr>`). If you feel you need a line, use a background color change instead.