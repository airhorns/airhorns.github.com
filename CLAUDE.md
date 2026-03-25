# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal portfolio/blog site (harry.me) built with Vite + React + TypeScript. Features an interactive WebGPU boid simulation on the homepage and an MDX-powered blog.

## Commands

- `npm run dev` — dev server on port 8080
- `npm run build` — production build to `/dist`
- `npm run lint` — ESLint
- `npm run test` — Vitest (once), `npm run test:watch` for watch mode

## Architecture

**Routing**: React Router SPA. Routes defined in `src/App.tsx`. Dynamic post route: `/posts/:slug`.

**Blog system**: MDX posts live in `src/content/posts/`. Posts are loaded eagerly via `import.meta.glob()` in `src/lib/posts.ts` with remark-frontmatter for metadata (title, date, description, slug).

**3D boid simulation**: The homepage renders a Three.js scene (`src/components/FlockingCanvas.tsx`) using React Three Fiber. Physics run on a WebGPU compute shader (`src/lib/boids-gpu.ts`) with brute-force O(n²) neighbor search over 3000+ boids. GPU state is managed via refs to survive React re-renders.

**UI components**: shadcn/ui primitives in `src/components/ui/`. Styling uses Tailwind CSS with HSL CSS custom properties defined in `src/index.css`.

**Path alias**: `@` maps to `./src` (configured in both `vite.config.ts` and `tsconfig.json`).

## Key Files

- `src/lib/boids-gpu.ts` — WebGPU compute shader and simulation setup
- `src/lib/boids-assumptions.ts` — boid physics constants and math
- `src/components/FlockingCanvas.tsx` — 3D visualization with InstancedMesh
- `src/components/Footer.tsx` — navigation header/footer with route-based animations
- `src/components/PageBackground.tsx` — animated gradient + noise overlay
- `src/lib/posts.ts` — MDX post loading and querying
