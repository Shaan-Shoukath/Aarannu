# 07 – Libraries Used

## Dependency Overview

| Library                 | Version | Purpose                         | Required? |
| ----------------------- | ------- | ------------------------------- | --------- |
| `@supabase/supabase-js` | ^2.95.3 | Backend SDK (auth, DB, storage) | Yes       |
| `react`                 | ^19.2.0 | UI framework                    | Yes       |
| `react-dom`             | ^19.2.0 | React DOM renderer              | Yes       |
| `react-router-dom`      | ^7.x    | Client-side routing             | Yes       |
| `html2canvas`           | ^1.x    | DOM-to-image conversion         | Yes       |
| `tailwindcss`           | ^4.x    | Utility-first CSS               | Yes       |
| `@tailwindcss/vite`     | ^4.x    | Tailwind Vite integration       | Yes (dev) |

---

## @supabase/supabase-js

### Why?

This is the official JavaScript SDK for Supabase. It provides a unified interface to interact with all Supabase services: Auth, Database (PostgREST), Storage, and Realtime.

### Key functions used:

```javascript
import { createClient } from '@supabase/supabase-js';

// Initialize (once, singleton)
const supabase = createClient(url, anonKey, options);

// ─── AUTH ───
supabase.auth.signUp({ email, password })        // Create new user
supabase.auth.signInWithPassword({ email, password }) // Login
supabase.auth.signOut()                           // Logout
supabase.auth.getSession()                        // Get current session
supabase.auth.getUser()                           // Get current user object
supabase.auth.onAuthStateChange(callback)         // Listen for auth events

// ─── DATABASE ───
supabase.from('table').select('*')                // Read rows
supabase.from('table').insert({ ... })            // Insert row(s)
supabase.from('table').update({ ... }).eq(...)    // Update row(s)
supabase.from('table').delete().eq(...)           // Delete row(s)

// Query modifiers:
  .eq('column', value)         // WHERE column = value
  .gt('column', value)         // WHERE column > value
  .order('column', { ascending: false })
  .single()                    // Expect exactly 1 row

// ─── STORAGE ───
supabase.storage.from('bucket').upload(path, file, options)
supabase.storage.from('bucket').createSignedUrl(path, expiresIn)
supabase.storage.from('bucket').remove([paths])
```

### Security note:

The `anon` key is embedded in the frontend. This is by design — it only grants access allowed by RLS policies. The `service_role` key has full access and must NEVER be used in the frontend.

---

## React

### Why?

React is the industry-standard library for building component-based UIs. It was chosen because:

- Supabase has first-class React support and examples.
- Large ecosystem and community for troubleshooting.
- Component model fits the ID card use case (reusable `IDCard` component).

### Key concepts used:

```javascript
// Hooks
useState(); // Manage component state (forms, loading, errors)
useEffect(); // Side effects (data fetching on mount, auth listener)
useRef(); // DOM references (for html2canvas to capture)
forwardRef(); // Pass refs through component boundaries

// Patterns
// Conditional rendering (approved? → show button)
// List rendering (map over generatedIds)
// Controlled components (form inputs bound to state)
```

### Why React 19?

- Automatic batching of state updates (better performance).
- Improved concurrent rendering.
- Stable and production-ready at the time of this project.

---

## react-router-dom

### Why?

Provides client-side routing without full page reloads. Essential for SPAs.

### Key functions used:

```javascript
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom';

// Router setup (in App.jsx)
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  </Routes>
</BrowserRouter>

// Navigation
const navigate = useNavigate();
navigate('/dashboard', { replace: true });  // Programmatic redirect

// Links
<Link to="/signup">Create account</Link>    // Declarative navigation

// Redirect
<Navigate to="/dashboard" replace />         // Redirect component
```

### Why `replace: true`?

After login, we use `replace: true` so the login page isn't in the browser history. This prevents the user from pressing "Back" and landing on the login form after authentication.

---

## html2canvas

### Why?

html2canvas renders a DOM element (the ID card) into an HTML5 Canvas element, which can then be exported as a PNG image. This is the core mechanism for ID card generation.

### How it works:

```
DOM Node (IDCard.jsx)
    │
    ▼ html2canvas reads the DOM tree
    │
HTML5 Canvas (in-memory)
    │
    ▼ canvas.toBlob()
    │
PNG Blob (ready for upload)
```

### Key usage:

```javascript
import html2canvas from "html2canvas";

const canvas = await html2canvas(domElement, {
  scale: 2, // 2× resolution (retina quality)
  useCORS: true, // Allow cross-origin images
  backgroundColor: "#ffffff", // White background
  logging: false, // Suppress console logs in production
});

// Convert to blob for upload
const blob = await new Promise((resolve) =>
  canvas.toBlob(resolve, "image/png", 1.0),
);
```

### Limitations:

- Cannot render CSS `backdrop-filter` (blur effects) — they're approximated.
- External fonts must be loaded before capture.
- SVGs with external references may not render.
- Performance degrades with very complex DOM trees.

### Why not use a server-side renderer (e.g., Puppeteer)?

- Would require a custom backend (contradicts our architecture).
- html2canvas runs entirely in the browser — zero server cost.
- Quality is sufficient for ID card use cases.

---

## Tailwind CSS

### Why?

Utility-first CSS framework that allows rapid UI development without writing custom CSS files. Every class maps to a single CSS property.

### Key features used:

```html
<!-- Responsive design -->
<div class="grid grid-cols-1 md:grid-cols-3">
  <!-- Colors (design tokens) -->
  <div class="bg-[#1152d4] text-white">
    <!-- Spacing & sizing -->
    <div class="px-6 py-4 w-full max-w-110">
      <!-- Flexbox & Grid -->
      <div class="flex items-center justify-between gap-3">
        <!-- Typography -->
        <span class="text-sm font-semibold uppercase tracking-wider">
          <!-- Shadows & borders -->
          <div
            class="shadow-lg shadow-[#1152d4]/25 rounded-xl border border-slate-200"
          >
            <!-- Transitions -->
            <button class="transition-all duration-200 hover:bg-[#1152d4]/90">
              <!-- Arbitrary values (for exact Figma specs) -->
              <span class="text-[10px]">Small</span>
              <span class="text-[8px]">Tiny</span>
            </button>
          </div></span
        >
      </div>
    </div>
  </div>
</div>
```

### Why not regular CSS / CSS Modules / styled-components?

- **Regular CSS:** Hard to maintain at scale, global namespace collisions.
- **CSS Modules:** Better scoping, but verbose for utility-style patterns.
- **styled-components:** Runtime CSS-in-JS has performance overhead.
- **Tailwind:** Zero runtime overhead (classes are pre-generated), great for matching Figma designs exactly.

### Integration with Vite:

```javascript
// vite.config.js
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

```css
/* index.css */
@import "tailwindcss";
```

The `@tailwindcss/vite` plugin integrates Tailwind directly into Vite's build pipeline — no separate PostCSS config needed.
