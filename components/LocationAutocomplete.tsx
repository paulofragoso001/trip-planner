"use client";

import { useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useRef } from "react";
import { googleMapsLibraries } from "@/lib/google-maps";

type LocationAutocompleteProps = {
  onSelect: (location: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  bounds?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral | null;
  country?: string;
  biasToUserLocation?: boolean;
};

export default function LocationAutocomplete({
  onSelect,
  bounds,
  country = "us",
  biasToUserLocation = true
}: LocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries: googleMapsLibraries
  });

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) {
      return;
    }

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry.location"],
      componentRestrictions: { country },
      types: ["(regions)"]
    });
    autocompleteRef.current = autocomplete;

    if (bounds) {
      autocomplete.setBounds(bounds);
    } else if (biasToUserLocation && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const userBounds = new google.maps.LatLngBounds(
            { lat: latitude - 0.5, lng: longitude - 0.5 },
            { lat: latitude + 0.5, lng: longitude + 0.5 }
          );
          autocomplete.setBounds(userBounds);
        },
        () => {
          // Location permission is optional. Autocomplete still works with country restriction.
        },
        { maximumAge: 300000, timeout: 3000 }
      );
    }

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;

      if (!location) {
        return;
      }

      onSelect({
        address: place.formatted_address || inputRef.current?.value || "",
        lat: location.lat(),
        lng: location.lng()
      });
    });

    return () => {
      listener.remove();
      autocompleteRef.current = null;
    };
  }, [biasToUserLocation, bounds, country, isLoaded, onSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={
        isLoaded
          ? "Search for a city or country..."
          : "Loading locations..."
      }
      className="w-full rounded-lg border border-line p-3"
      disabled={!isLoaded}
    />
  );
}
