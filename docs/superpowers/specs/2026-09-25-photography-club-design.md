# Frame & Motion Photography Club — Design Specification

## Goal

Create a polished, single-page promotional website for a photography and videography club. The site should make the club feel creative and welcoming while giving visitors an immediate sense of the work it creates.

## Approved decisions

- Use vanilla semantic HTML, modern CSS, Tailwind CSS, and Vite.
- Do not use React or another component framework.
- Use a full-bleed cinematic hero that transitions into an irregular, image-first gallery.
- Use curated remote image URLs with neutral CSS fallbacks.
- Represent motion work with static poster images and a small play marker; do not load video files.
- Load `Barlow Condensed` and `DM Sans` from Google Fonts.
- Keep gallery and club content in static HTML rather than rendering it at runtime.

## Product scope

- One responsive landing page with four sections: hero, selected work, about, and contact.
- A compact sticky navigation bar with links to the page sections and a mobile menu.
- A photo-forward gallery showing a mix of photography and motion-oriented work.
- Contact links use the working defaults `hello@frameandmotion.club`, `@frameandmotion.club`, and monthly meetups in Berlin and online.
- No backend, account system, form submission, or content management system in this first version.

## Visual direction

Use an editorial, image-first direction: near-black surfaces, warm off-white text, and a restrained amber accent. The hero uses a full-bleed featured image with a dark gradient overlay so the club name and call to action remain readable. The layout uses generous spacing, condensed display typography, neutral sans-serif body copy, asymmetric gallery sizing, and subtle border treatments instead of heavy shadows. The result should feel like a small creative collective rather than a generic business site.

Use `Barlow Condensed` for display headings and `DM Sans` for body copy. Use CSS custom properties or Tailwind theme tokens for the shared color, typography, and spacing system.

## Page structure

1. **Hero** — club name, short positioning statement, primary CTA to `#work`, and a large featured image. The hero should occupy most of the first viewport on desktop while retaining a clear content block on mobile.
2. **Selected work** — a responsive gallery with six curated images. Desktop uses an irregular grid with varied spans and aspect ratios; tablet keeps a compact multi-column layout; mobile uses a single column with consistent spacing. Each image has descriptive alternative text, a small caption, and a motion marker for static poster cards.
3. **About** — concise club story, a few membership/community details, and a small stat strip for members, meetups, and years active.
4. **Contact** — invitation to collaborate or join, an email CTA, social links, and location/meeting information.

## Technical architecture

- Vite provides the development server and production build.
- Tailwind CSS is integrated through the Vite plugin. Utility classes live in `index.html`; global rules, font imports, theme tokens, image fallbacks, and motion/accessibility rules live in `src/input.css`.
- `index.html` contains the complete semantic page structure: header, navigation, hero, work gallery, about section, and contact section.
- `src/main.js` imports the stylesheet and contains only progressive enhancements: mobile menu state, Escape handling, anchor-link closing, and image error fallback handling.
- The mobile menu is not required to read or navigate the page. Links and section content remain available when JavaScript is unavailable.
- Remote image URLs are presentation-only dependencies. No API calls or runtime data fetching are required.
- Modern HTML/CSS features are intentional: semantic landmarks, `fetchpriority` for the hero image, `loading="lazy"` for below-the-fold images, `decoding="async"`, `aspect-ratio`, `clamp()` typography, `:focus-visible`, and `prefers-reduced-motion` handling.

## Navigation and interaction

- Add a skip link targeting the main content.
- Use real anchor links to `#work`, `#about`, and `#contact`; the hero CTA targets `#work`.
- On mobile, the menu button uses an accessible label, `aria-expanded`, and `aria-controls`. The menu closes when an anchor is selected or Escape is pressed.
- Keep the header compact and sticky. The header must remain readable over the hero and across dark section surfaces.
- Preserve visible focus indicators for all links, controls, and menu states.
- Respect `prefers-reduced-motion: reduce`; disable nonessential transitions and smooth scrolling when requested.

## Image and content behavior

- Use six curated remote images for the gallery, mixing portrait, landscape, documentary, and motion-poster imagery.
- The featured hero image loads eagerly with high fetch priority. Gallery images below the hero use native lazy loading.
- Give every meaningful image descriptive alternative text. Decorative elements use empty alternative text and remain hidden from assistive technology where appropriate.
- Wrap remote images in image frames with a neutral background. When an image fails, hide the broken image element through the small enhancement script and retain the frame as a deliberate fallback block.
- Use static poster cards for motion-oriented work. The play marker is decorative and does not imply an embedded video player.
- Keep captions concise and representative of the club’s point of view rather than functioning as a CMS.

## Accessibility and error handling

- Meet WCAG AA contrast for text, controls, focus indicators, and amber accents.
- Use semantic headings in a logical hierarchy and landmark elements for navigation, main content, and footer/contact content.
- Ensure the mobile menu button communicates its current state and remains usable by keyboard.
- External social links open in a new tab with `rel="noreferrer"`.
- Keep image dimensions or aspect-ratio containers stable to prevent layout shift.
- Keep the page readable if JavaScript, remote images, or Google Fonts fail; system font fallbacks and neutral image backgrounds provide graceful degradation.

## Validation

- Run the project lint command after implementation.
- Run the production build to catch JavaScript, CSS, and asset issues.
- Manually verify the layout at mobile, tablet, and desktop widths.
- Verify keyboard navigation, skip-link behavior, mobile-menu open/close behavior, focus visibility, reduced-motion behavior, image fallbacks, lazy loading, and all contact-link destinations.
- Confirm that the page remains understandable with JavaScript disabled.

## Success criteria

A visitor can understand what the club does, browse representative photography and motion work, learn why the community exists, and find a clear way to contact or join within one page load on desktop or mobile. The site remains accessible, visually coherent, and progressively enhanced without React.
