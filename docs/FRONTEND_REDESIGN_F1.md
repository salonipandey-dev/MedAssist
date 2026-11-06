# MedAssist frontend redesign: F1 notes

Working note, 6 November 2026 (IST). Not report prose. Covers batch F1 only: the shared visual system, layout and navigation, the homepage, demo access, the patient overview and the profile. Base commit: `ea3e137` plus the F0 note.

## What changed

**Shared visual system** (`frontend/src/styles/global.css`, `frontend/src/main.tsx`)
- New tokens:
  - Colours: accent `#0F766E`, text `#0F172A`, muted `#475569`, border `#E2E8F0`, control border `#64748B`, background `#F8FAFC`, white surfaces.
  - Spacing scale 8–48 px. Radii 8/10/12 px. Type scale 12/14/16/20/24/30 px.
- Indigo is retired as a second accent. Its variables now resolve to neutral greys, so screens not yet restyled lose the colour without code changes. Amber and red remain as status colours only.
- Headings use Inter at weight 600. The Manrope imports were removed; the package stays in `package.json`, so the lockfile is untouched.
- Removed effects:
  - The header and dialog blur, the skeleton shimmer gradient, the fade-in keyframes, button lift-on-hover and card shadows.
  - The dark administrator sidebar and the doctor's indigo sidebar. All roles now share one shell.
- Kept: the 3 px focus outline (offset reduced to 2 px). Form controls use a 4.76:1 border colour.
- Smallest text sizes raised: 8–10 px to 12 px, 11–13 px to 14 px, 14–15 px to 16 px.
- On desktop, the sidebar's surface now continues to the bottom of full-page captures. Previously it ended at the first viewport height.

**Layout and navigation** (`AppLayout.tsx`, `PublicLayout.tsx`, `components/ui/index.tsx`, `data/mock/seed.ts`)
- Workspace sidebar: removed the "Thoughtfully connected" marketing card and the chevron that looked like a menu but was not interactive. The sidebar now has a plain footer.
- Kept unchanged: the demo ribbon, the "Sample Data" badge, the role select, the theme toggle, mobile navigation and the focus trap.
- Public header: one "Demo access" button instead of two links to the same page. The footer copy now describes the prototype.
- `Stat` icons are now optional.
- The administrator demo label "Admin command center" is now "Administrator workspace". This is a display label only.

**Homepage** (`pages/public/Pages.tsx`, `ProductPreview.tsx`, `styles/public.css`)
- Static hero: the h1 is "Healthcare records and case review in one workspace", with one primary action ("Explore Demo") and one secondary action.
- Next to the hero, a "What you can explore" list. Each module carries its limitation, and "AI urgency classification" is marked "Not available".
- Kept: the workflow stepper, with the illustration removed.
- New "What this prototype does not do" section beside the unchanged AI concept panel.
- Removed:
  - The scroll animations, the orbit rings, the floating cards and the tilted 3D preview.
  - The three feature cards with miniature art, and the duplicate patient and doctor showcase previews.
  - The illustration component.
- About 900 lines of CSS for removed elements were deleted, including their responsive overrides.

**Demo access** (`features/auth/DemoAccess.tsx`): role descriptions now say what each role can do. A subtitle states that choosing a role is not a sign-in. The duplicate footnote under the notice was removed; the authentication notice itself is unchanged.

**Patient overview** (`features/patient/Patient.tsx`, `styles/product.css`)
- Removed the dark banner and illustration, the profile-completion meter and the two duplicate action cards.
- Stat tiles have no icons.
- Remaining content:
  - Recent cases, with "Submitted" dates.
  - Recent activity.
  - Next appointment (panel note: "Fictional availability · not a booking").
  - Documents. Rows now show the case ID and date, so the two "Sample visit summary" rows can be told apart.

**Profile** (`features/patient/Profile.tsx`): eyebrow and description now state exactly what can be changed and what is not collected. The identity strip is a simple bordered row. The form and its validation are unchanged.

Truthful notices kept word-for-word include:
- the authentication notice on the demo page;
- "Case status describes workflow progress, not medical urgency" (reworded slightly, same meaning);
- the profile's "not collected" notices and the in-memory notice;
- the AI concept panel.

## Checks actually performed in this session

`npm ci` is impossible here: the npm registry is unreachable (`ENOTFOUND`). So the project's own `typecheck`, `build`, `vitest` and Playwright/axe suites were **not run**. What was run:

| Check | Command | Result |
| --- | --- | --- |
| Node source-boundary tests (the Node half of `npm test`) | `node --test tests/*.test.cjs` | 8 passed, 0 failed |
| Formatting | `prettier --check "src/**/*.{ts,tsx,css}"` (global Prettier 3.8.1; project pins 3.9.10) | All files pass |
| Partial type check | TypeScript 6.0.3 on `src/` with third-party modules stubbed as `any`, `noUnusedLocals` and `noUnusedParameters` on, compared against the same check on `ea3e137` | No new errors. Two baseline stub artefacts disappeared. This cannot catch errors in props passed to third-party components. |
| Test-dependent strings | grep for headings, accessible names and class hooks used by `tests/e2e/workflows.spec.ts` | All present |
| Preview render | esbuild + Tailwind 4.3.3 bundle of the real `src/`. Router, Radix, lucide icons, sonner, motion, recharts and react-hook-form are replaced by local stand-ins; viewed in Chromium. | Home, demo, patient overview and profile inspected at 1440 × 900 and 390 × 844, light and dark |
| Browser flows (preview build) | Replays of the e2e tests "public navigation…", "profile validates…", "mobile navigation traps focus…", plus the public mobile menu | 4/4 pass on the F1 build and on the baseline build |
| Overflow sweep (preview build) | All 34 routes at 320/375/768/1024/1440 px: horizontal overflow, exactly one h1, no page errors | The first pass found two regressions: the shared call-to-action box on other public pages (+32 px) and the topbar at 320 px on 2 admin routes (+12 px). Both were fixed. Final run: **34 routes × 5 widths, no horizontal overflow, one h1 each, no page errors.** |
| Text contrast | Own script: WCAG ratio of every visible text node against its composited background on `/`, `/demo`, `/app/patient` and profile edit mode, in light and in dark (toggled in the UI) | 8/8 runs: no text below 4.5:1 (3:1 for large text) |

Preview renders are only for inspection. Their icons are placeholder squares, and they are **not** report screenshots.

## Run on your computer

The patch file contains both commits (the F0 note and F1). From a clean clone of `main`:

```bash
git checkout -b frontend-redesign
git am medassist-frontend-f0-f1.patch
cd frontend
npm ci
npm run typecheck
npm run build
npm test
npm run format:check
npx playwright install chromium
npm run test:e2e
npm run dev        # then open http://127.0.0.1:5173
```

On Windows PowerShell, use `npm.cmd` and `npx.cmd` if script execution is blocked.

## Remaining issues

1. **The real toolchain has not been run.** `tsc` with React types, `vite build`, Vitest and the Playwright and axe suites need `npm ci`. Run the commands above, or enable package installs for a new session, before F2 builds on this.
2. **F2 screens inherit the new tokens but are not restyled yet.** Assessment, cases, review, appointments, admin, reports and settings now use larger text, neutral greys instead of indigo and the shared white sidebar. They render without overflow in the preview, but still have decorative banners, slogan eyebrows and small chart text until F2.
3. **Other public pages are outside the agreed screens.** Platform, How it works, For patients, For professionals, Security and About only received the shared tokens. Their copy still uses phrasing such as "thoughtfully" and "a considered experience". Their coded product preview also still shows a greeting ("Good morning, Mira.") that the real overview does not.
4. `@fontsource/manrope` is now unused. Remove it with `npm uninstall` when the lockfile can be regenerated.
5. `docs/FRONTEND_GUIDE.md` still describes the old teal/indigo palette and Manrope headings. This is scheduled for F4.
6. No screenshots have been captured. That is F4, with the SS01–SS12 plan in `FRONTEND_REDESIGN_F0.md`.
