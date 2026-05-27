# Wayline Budget + Collaborative Map Component Tree

## App routes
- `/dashboard/trips`
- `/dashboard/trips/[tripId]`
- `/dashboard/trips/[tripId]/budget`
- `/dashboard/trips/[tripId]/map`
- `/dashboard/trips/[tripId]/sharing`

## File structure

```txt
app/
  dashboard/
    trips/
      page.tsx
      [tripId]/
        page.tsx
        budget/page.tsx
        map/page.tsx
        sharing/page.tsx
components/
  trip/
    trip-shell.tsx
    trip-header.tsx
    trip-tabs.tsx
    trip-overview.tsx
    trip-timeline.tsx
    trip-activity-feed.tsx
  budget/
    budget-summary.tsx
    budget-kpi-cards.tsx
    budget-category-bars.tsx
    expense-table.tsx
    add-expense-sheet.tsx
  map/
    interactive-map.tsx
    map-controls.tsx
    map-pin.tsx
    pin-details-drawer.tsx
  sharing/
    share-modal.tsx
    permission-picker.tsx
    collaborator-list.tsx
  ui/
    sheet.tsx
    dialog.tsx
    tabs.tsx
    badge.tsx
    button.tsx
    card.tsx
```

## Page composition

### Trip detail page
- `TripShell`
  - `TripHeader`
  - `TripTabs`
  - `TripOverview`
    - `TripTimeline`
    - `InteractiveMap`
    - `BudgetSummary`
    - `TripActivityFeed`

### Budget route
- `TripShell`
  - `TripHeader`
  - `TripTabs`
  - `BudgetSummary`
    - `BudgetKpiCards`
    - `BudgetCategoryBars`
    - `ExpenseTable`
    - `AddExpenseSheet`

### Map route
- `TripShell`
  - `TripHeader`
  - `TripTabs`
  - `InteractiveMap`
    - `MapControls`
    - `MapPin`
    - `PinDetailsDrawer`

### Sharing route
- `TripShell`
  - `TripHeader`
  - `TripTabs`
  - `ShareModal`
    - `PermissionPicker`
    - `CollaboratorList`

## Component responsibilities

### TripShell
- Provide layout, responsive grid, and shared trip state.
- Manage selected trip, active tab, and mobile shell behavior.
- Hydrate trip data from Supabase or server actions.

### TripHeader
- Show title, destination, dates, budget status, and primary actions.
- Emit events for add expense, add plan, and sharing.

### TripTabs
- Switch between overview, timeline, map, budget, activity, and sharing.
- Render desktop tabs and mobile bottom nav.

### TripTimeline
- Render day-grouped itinerary items.
- Support drag reorder, inline edit, and map-link actions.

### InteractiveMap
- Render pins, route lines, selected place state, and filters.
- Support click-to-select and drag-to-adjust location.

### BudgetSummary
- Show planned vs actual spend, remaining amount, and overspend risk.
- Host category bars and expense table on the budget route.

### TripActivityFeed
- Show live collaboration events and budget alerts.
- Support filtering and jump-to-source links.

### ShareModal
- Invite collaborators.
- Set role and permissions.
- List current collaborators.

## Shared state
- `tripId`
- `trip`
- `activeTab`
- `selectedPinId`
- `selectedExpenseId`
- `selectedPlanItemId`
- `collaborators`
- `presence`
- `isMobile`
- `budgetTotals`
- `expenses`
- `timelineItems`
- `activityEvents`

## Data hooks
- `useTrip(tripId)`
- `useTripExpenses(tripId)`
- `useTripTimeline(tripId)`
- `useTripPins(tripId)`
- `useTripPresence(tripId)`
- `useTripActivity(tripId)`
- `useTripCollaborators(tripId)`

## MVP order
1. `TripShell`
2. `TripHeader`
3. `TripTabs`
4. `BudgetSummary`
5. `ExpenseTable`
6. `TripTimeline`
7. `InteractiveMap`
8. `ShareModal`
9. `TripActivityFeed`
