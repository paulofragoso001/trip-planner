import type { PlanType } from "./types";

const badgeStyles: Record<PlanType, string> = {
  flight: "bg-[#eaf4ff] text-[#115ea8]",
  hotel: "bg-[#fff1f2] text-[#b42346]",
  activity: "bg-[#f0fdf4] text-[#157347]",
  transport: "bg-[#f7f1ff] text-[#6b3fa0]",
  meeting: "bg-[#fff7ed] text-[#b45309]",
  note: "bg-[#f4f4f5] text-[#52525b]"
};

export function PlanTypeBadge({ type }: { type: PlanType }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${
        badgeStyles[type] || badgeStyles.note
      }`}
    >
      {type}
    </span>
  );
}
