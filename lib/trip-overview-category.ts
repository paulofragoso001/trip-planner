export type TripOverviewCategoryKind =
  | "flight"
  | "stay"
  | "dining"
  | "bar"
  | "route"
  | "shopping"
  | "place"
  | "other";

export function tripOverviewCategoryKind(value: string): TripOverviewCategoryKind {
  const normalized = value.toLowerCase();
  if (/flight|airport|airplane/.test(normalized)) return "flight";
  if (/hotel|lodging|stay|bed/.test(normalized)) return "stay";
  if (/restaurant|food|dinner|lunch|cafe|fork/.test(normalized)) return "dining";
  if (/bar|drink|party|wine/.test(normalized)) return "bar";
  if (/route|transport|ground|train|rail|car|taxi|transfer|bus|curvepath/.test(normalized)) return "route";
  if (/shop|bag/.test(normalized)) return "shopping";
  if (/place|activity|mappin/.test(normalized)) return "place";
  return "other";
}
export function tripOverviewCategorySymbol(value: string) {
  switch (tripOverviewCategoryKind(value)) {
    case "flight": return "airplane";
    case "stay": return "bed.double.fill";
    case "dining": return "fork.knife";
    case "bar": return "wineglass.fill";
    case "route": return "point.topleft.down.to.point.bottomright.curvepath";
    case "shopping": return "bag.fill";
    case "place": return "mappin";
    default: return "ellipsis";
  }
}
