"use client";

import { Autocomplete } from "@react-google-maps/api";
import { useRef, useState } from "react";

export type SelectedPlace = {
  title: string;
  location: string;
  lat: number;
  lng: number;
};

type PlaceAutocompleteInputProps = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: SelectedPlace) => void;
};

export function PlaceAutocompleteInput({
  value,
  onChange,
  onPlaceSelect
}: PlaceAutocompleteInputProps) {
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [error, setError] = useState("");

  function handlePlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    const location = place?.geometry?.location;

    if (!place || !location) {
      setError("Choose a place from the Google suggestions.");
      return;
    }

    const title = place.name || value;
    const formattedAddress = place.formatted_address || value;
    setError("");
    onChange(formattedAddress);
    onPlaceSelect({
      title,
      location: formattedAddress,
      lat: location.lat(),
      lng: location.lng()
    });
  }

  return (
    <div className="grid gap-2">
      <Autocomplete
        fields={["formatted_address", "geometry.location", "name"]}
        onLoad={(autocomplete) => {
          autocompleteRef.current = autocomplete;
        }}
        onPlaceChanged={handlePlaceChanged}
      >
        <input
          placeholder="Search hotel, airport, restaurant, park..."
          value={value}
          onChange={(event) => {
            setError("");
            onChange(event.target.value);
          }}
        />
      </Autocomplete>
      {error ? <p className="text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}
