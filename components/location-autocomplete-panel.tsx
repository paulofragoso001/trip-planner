"use client";

import dynamic from "next/dynamic";

const LocationAutocomplete = dynamic(() => import("@/components/LocationAutocomplete"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-line bg-[#f7f6f2] px-3 py-2 text-xs font-semibold text-slate-500">
      Loading location tools...
    </div>
  )
});

type LocationAutocompletePanelProps = {
  value: string;
  onChange: (value: string) => void;
};

export function LocationAutocompletePanel({ value, onChange }: LocationAutocompletePanelProps) {
  return (
    <LocationAutocomplete
      onInputChange={onChange}
      onSelect={(location) => onChange(location.address)}
      placeholder="Search by city, airport, hotel, or landmark"
      value={value}
    />
  );
}
