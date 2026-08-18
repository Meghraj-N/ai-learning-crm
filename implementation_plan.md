# Premium Courses Page UI Redesign Plan

## Goal
Redesign the `/dashboard/courses` page into a polished, premium, production-grade SaaS application while preserving all existing functionality, routes, and business logic. The design should align with the standard of modern SaaS applications like Linear and Vercel.

## Proposed Changes

### 1. Refactor `page.tsx` Structure
- Keep server-side data fetching intact.
- Replace the raw `<Card>`, `<Table>`, and other generic wrappers with a premium layout.
- Separate the list into a reusable `CourseCard` and `CourseList` components for cleaner architecture.
- Maintain the exact same search and filter logic (using forms and query params).

### 2. Header & Action Area Redesign
- Use standard muted text for descriptions.
- The "New course" button will have a more premium feel, matching `var(--color-primary)`.

### 3. Filter Bar Modernization
- Transform the generic input and select boxes into a refined filter bar.
- Use subtle borders and focus states (`focus:ring-1`, `focus:border-primary`).

### 4. Course Cards Redesign
- Implement a grid layout for courses (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
- The course cards will feature:
  - An aspect-video thumbnail placeholder or actual image if available.
  - A prominent status badge with semantic colors.
  - A subtle hover effect (`hover:border-active`, `transition-all`).
  - Clear metrics (modules, lessons) positioned in a subtle footer.
  - "Last updated" or "Created" info.

### 5. Empty & Error State Polish
- The EmptyState component has already been verified to exist and looks decent. I will ensure it perfectly fits inside the new layout without weird borders.
- The Error state now correctly logs to the console for observability.

## Verification Plan
- Verify no existing logic (search, filter, pagination, roles) is broken.
- Ensure the UI matches a dark, premium aesthetic.
