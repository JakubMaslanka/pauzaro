# Frontend — React 19 + TypeScript + Zustand + Mantine 9

## Design & Styling

- **Theme**: Mantine 9 — all UI must use Mantine components, never raw HTML elements for interactive controls
- **Font**: Nunito (via `@fontsource/nunito`), sans-serif fallback
- **Primary color**: Teal (`primaryColor: "teal"` in Mantine theme)
- **Background**: Warm off-white `#F7F5F0`, sandy gold accent `#E28743`
- **Personality**: Joyful, playful, colorful — like made for a kid, NOT corporate/boring. Use emoji in UI copy, fun micro-copy for errors and labels, rounded corners (`radius: "xl"` default for buttons), animated transitions with Framer Motion
- **Animations**: Every step transition, button interaction, and state change should feel alive. Use Framer Motion for page transitions, Mantine's built-in transitions for dropdowns/modals
- **Right-click**: Context menu disabled in Tauri app (see `__root.tsx`)
- **Do NOT**: Use shadcn/ui patterns, neutral gray palettes, or flat corporate layouts. Keep it warm and fun

## Component Patterns

### Composition Over Props Drilling
Split components by responsibility. Pass children or render props instead of threading data through layers.

```tsx
// Prefer
<HabitCard habit={habit}>
  <StreakBadge streak={habit.streak} />
</HabitCard>

// Avoid
<HabitCard habit={habit} streak={habit.streak} showBadge={true} badgeVariant="streak" />
```

### Component File Structure
One component per file. Co-locate styles, types, and tests:
```
components/
  HabitCard/
    HabitCard.tsx
    HabitCard.test.tsx
    HabitCard.css
```

### No Inline Component Definitions
Never define components inside other components — causes remount on every render.

```tsx
// Wrong: StreakDisplay recreated every render
function HabitCard({ habit }: Props) {
  const StreakDisplay = () => <span>{habit.streak}</span>;
  return <StreakDisplay />;
}

// Right: defined outside
function StreakDisplay({ streak }: { streak: number }) {
  return <span>{streak}</span>;
}
```

## State Management (Zustand)

### Store Slices Pattern
Split stores by domain. Keep stores small and focused.

```tsx
interface HabitSlice {
  habits: Habit[];
  addHabit: (habit: NewHabit) => void;
  removeHabit: (id: string) => void;
}

const useHabitStore = create<HabitSlice>((set) => ({
  habits: [],
  addHabit: (habit) => set((state) => ({
    habits: [...state.habits, { ...habit, id: crypto.randomUUID() }],
  })),
  removeHabit: (id) => set((state) => ({
    habits: state.filter((h) => h.id !== id),
  })),
}));
```

### Subscribe to Derived Values
Select only what you need. Prefer primitive selectors to avoid unnecessary re-renders.

```tsx
// Good: subscribes to derived boolean
const hasHabits = useHabitStore((s) => s.habits.length > 0);

// Bad: subscribes to entire array, re-renders on any habit change
const habits = useHabitStore((s) => s.habits);
const hasHabits = habits.length > 0;
```

### Don't Subscribe to State Only Used in Callbacks
Use `getState()` for values only needed in event handlers.

```tsx
// Good: no subscription, reads on demand
function handleExport() {
  const habits = useHabitStore.getState().habits;
  exportToFile(habits);
}
```

## Tauri IPC (Frontend Side)

### Typed Invoke Wrapper
Create typed wrappers around `invoke` to catch contract mismatches at compile time.

```tsx
import { invoke } from "@tauri-apps/api/core";

async function createHabit(input: NewHabit): Promise<Habit> {
  return invoke<Habit>("create_habit", { input });
}

async function listHabits(): Promise<Habit[]> {
  return invoke<Habit[]>("list_habits");
}
```

### Parallel Invocations
Use `Promise.all` for independent Tauri calls. Never waterfall.

```tsx
// Good
const [habits, streaks] = await Promise.all([
  invoke<Habit[]>("list_habits"),
  invoke<Streak[]>("get_streaks"),
]);

// Bad: sequential when independent
const habits = await invoke<Habit[]>("list_habits");
const streaks = await invoke<Streak[]>("get_streaks");
```

## TypeScript Patterns

### Discriminated Unions for State
Model async/UI states as discriminated unions — exhaustive switch catches missing cases.

```tsx
type HabitViewState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; habits: Habit[] }
  | { status: "empty" };
```

### Prefer `interface` for Object Shapes, `type` for Unions
```tsx
interface Habit {
  id: string;
  name: string;
  frequency: HabitFrequency;
}

type HabitFrequency = "daily" | "weekdays" | "custom";
type HabitAction = "complete" | "skip" | "snooze";
```

### Const Assertions for Config
```tsx
const STREAK_CONFIG = {
  maxFreezes: 2,
  freezeDurationDays: 1,
  milestones: [7, 30, 100, 365],
} as const;
```

## Performance Rules

- **Hoist default non-primitive props** — `const DEFAULT_OPTIONS = {}` at module level, not inline
- **Use `useMemo` for expensive derivations** — filtering/sorting large lists
- **Use `useCallback` with stable deps** — event handlers passed to memoized children
- **Lazy state initialization** — `useState(() => computeExpensive())` not `useState(computeExpensive())`
- **Use refs for transient values** — mouse position, timers, animation frames — not state
- **Conditional rendering** — use ternary `{x ? <A /> : <B />}`, not `{x && <A />}` (avoids rendering `0` or `""`)

## Error Handling

Wrap Tauri invocations. Never let errors disappear silently.

```tsx
async function safeInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`Tauri command "${command}" failed:`, error);
    throw error;
  }
}
```

## Testing

- **Vitest + React Testing Library** for unit/integration tests
- Files: `*.test.tsx` co-located with component
- Mock Tauri `invoke` via `vi.mock("@tauri-apps/api/core")`
- Test behavior, not implementation — query by role/label/text, not class/id
- Each test: own setup, action, assertion — no shared mutable state
