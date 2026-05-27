# Wayline Budget + Collaborative Map UI Wireframe

## Page shell

### Desktop
- Left sidebar for navigation.
- Top header with trip title, date range, share button, and add buttons.
- Main 3-column grid: timeline, map, budget.
- Right rail activity feed.

### Mobile
- Top app bar.
- Bottom tab bar for Timeline, Map, Budget, Activity.
- Full-screen map with bottom sheet details.
- Sticky budget summary card.

## Desktop wireframe

```text
Wayline | Trip title - Destination - Dates | Share | +Expense | +Plan
Sidebar | Timeline                         | Budget summary
Overview| [Flight]                         | Planned: $4,200
Trips   | [Hotel]                          | Actual: $3,870
Budget  | [Dinner]                         | Remaining: $330
Map     | [Meeting]                        | Overspend: Low
Activity|                                  | Category bars
Sharing |                                  | Alerts
Settings|                                  | Receipt uploads
Activity feed: comments, edits, expense updates, shares
```

## Trip header

### Elements
- Trip title.
- Date range.
- Destination.
- Budget status chip.
- Share button.
- Add expense button.
- Add plan button.

### States
- Budget under target: green chip.
- Near limit: amber chip.
- Over budget: red chip.

## Timeline panel

### Sections
- Day groupings.
- Unscheduled items.
- Drag handles for reorder.
- Inline edit button.
- Link to map pin.

### Item card
- Type icon.
- Title.
- Time.
- Location.
- Cost tag.
- Collaboration badge if being edited.

## Map panel

### Controls
- Search field.
- Add pin button.
- Route toggle.
- Filter chips.
- Share view button.

### Pin types
- Flight.
- Hotel.
- Restaurant.
- Activity.
- Meeting.
- Custom note.

### Pin details drawer
- Place name.
- Linked itinerary item.
- Notes.
- Expense links.
- Comment thread.
- Edit and delete actions.

## Budget panel

### KPI cards
- Planned spend.
- Actual spend.
- Remaining budget.
- Overspend risk.

### Category list
- Flights.
- Lodging.
- Ground transport.
- Food.
- Activities.
- Misc.

### Alerts
- Over budget warning.
- Category warning.
- Large expense flag.
- Missing receipt flag.

### Expense table
- Date.
- Merchant.
- Category.
- Amount.
- Paid by.
- Linked plan item.
- Receipt status.

## Activity feed

### Entries
- Expense added.
- Budget crossed threshold.
- Pin moved.
- Comment posted.
- Traveler invited.
- Itinerary item edited.

### Feed behavior
- Live updates.
- Relative timestamps.
- Filter by type.
- Jump-to-source action.

## Share modal

### Inputs
- Invite email.
- Role selector.
- Permission toggles.
- Message field.

### Roles
- Owner.
- Editor.
- Commenter.
- Viewer.

## Mobile wireframe

```text
Back | Trip title | Share | More
Budget: $3,870 / $4,200
[green/amber/red chip]
Tabs: Timeline | Map | Budget
Main content
Bottom sheet details
```

## Mobile interactions
- Swipe between tabs.
- Tap pin to open bottom sheet.
- Long press itinerary item to drag.
- Floating add button on map.
- Add expense via bottom sheet.

## Component inventory
- SidebarNav.
- TripHeader.
- BudgetKpiCard.
- BudgetCategoryBar.
- ExpenseTable.
- TimelineList.
- ItineraryItemCard.
- InteractiveMap.
- PinDetailsDrawer.
- ActivityFeed.
- ShareModal.
- AddExpenseSheet.
- AddPlanSheet.

## Priority build order
1. Trip header and shell.
2. Budget KPIs and expense table.
3. Timeline list with edit states.
4. Map with pins and detail drawer.
5. Sharing modal and permissions.
6. Real-time activity feed.
7. Mobile bottom sheets and tab bar.
