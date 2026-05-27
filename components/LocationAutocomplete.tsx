"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

type LocationAutocompleteProps = {
  onSelect: (location: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  ariaLabel?: string;
  bounds?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral | null;
  country?: string;
  biasToUserLocation?: boolean;
  inputClassName?: string;
  name?: string;
  placeholder?: string;
  required?: boolean;
  value?: string;
  onInputChange?: (value: string) => void;
};

export default function LocationAutocomplete({
  onSelect: _onSelect,
  ariaLabel,
  bounds,
  country,
  biasToUserLocation: _biasToUserLocation = true,
  inputClassName = "google-places-autocomplete",
  name,
  placeholder = "Search for a place (hotel, restaurant, attraction...)",
  required = false,
  value = "",
  onInputChange
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputValue, setInputValue] = useState(value);
  const [placeError, setPlaceError] = useState("");
  const [placesReady, setPlacesReady] = useState(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    let active = true;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadPlaces() {
      attempts += 1;

      if (typeof window === "undefined") {
        return;
      }

      if (!window.google?.maps?.importLibrary) {
        if (active && attempts < 40) {
          retryTimer = setTimeout(loadPlaces, 250);
        }
        return;
      }

      try {
        await window.google.maps.importLibrary("places");

        if (active) {
          setPlacesReady(Boolean(window.google?.maps?.places?.Autocomplete));
        }
      } catch {
        if (active) {
          setPlacesReady(false);
        }
      }
    }

    loadPlaces();

    return () => {
      active = false;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, []);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    setInputValue(nextValue);
    setPlaceError("");
    onInputChange?.(nextValue);
  }

  useEffect(() => {
    const input = inputRef.current;

    if (!input || !placesReady || !window.google?.maps?.places?.Autocomplete) {
      return;
    }

    const options: google.maps.places.AutocompleteOptions = {
      fields: ["formatted_address", "geometry", "name"],
      types: ["geocode", "establishment"]
    };

    if (bounds) {
      options.bounds = bounds;
    }

    if (country) {
      options.componentRestrictions = { country };
    }

    const autocomplete = new window.google.maps.places.Autocomplete(input, options);
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      const lat = readCoordinate(location, "lat");
      const lng = readCoordinate(location, "lng");
      const address = place.formatted_address || place.name || input.value;

      if (!address || typeof lat !== "number" || typeof lng !== "number") {
        setPlaceError("Choose a destination with a mapped location.");
        return;
      }

      setPlaceError("");
      setInputValue(address);
      onInputChange?.(address);
      _onSelect({ address, lat, lng });
    });

    return () => {
      listener.remove();
    };
  }, [_onSelect, bounds, country, onInputChange, placesReady]);

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        aria-label={ariaLabel}
        className={inputClassName}
        name={name}
        onChange={handleChange}
        type="text"
        placeholder={placeholder}
        required={required}
        value={inputValue}
      />
      {!placesReady ? (
        <p className="text-xs font-semibold text-slate-500">
          Places autocomplete is loading. You can still type a destination.
        </p>
      ) : null}
      {placeError ? (
        <p className="text-xs font-semibold text-red-700">{placeError}</p>
      ) : null}
    </div>
  );
}

function readCoordinate(
  location: { lat?: number | (() => number); lng?: number | (() => number) } | undefined,
  key: "lat" | "lng"
) {
  const value = location?.[key];

  return typeof value === "function" ? value() : value;
}
