"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";

export type LocationSelection = {
  address: string;
  formattedAddress?: string | null;
  lat: number;
  lng: number;
  name?: string | null;
  placeId?: string | null;
  providerMetadata?: Record<string, unknown>;
};

type LocationAutocompleteProps = {
  onSelect: (location: LocationSelection) => void;
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

type AutocompleteMode = "loading" | "suggestions" | "legacy" | "unavailable";

type SuggestionOption = {
  id: string;
  label: string;
  secondaryLabel: string;
  prediction: google.maps.places.PlacePrediction;
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
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [isResolvingSuggestion, setIsResolvingSuggestion] = useState(false);
  const [modernSuggestionsFailed, setModernSuggestionsFailed] = useState(false);
  const [mode, setMode] = useState<AutocompleteMode>("loading");
  const [placeError, setPlaceError] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionOption[]>([]);

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
          const places = window.google?.maps?.places;
          const hasModernSuggestions = Boolean(
            places?.AutocompleteSuggestion?.fetchAutocompleteSuggestions
          );
          const hasLegacyAutocomplete = Boolean(places?.Autocomplete);

          if (hasModernSuggestions) {
            setMode("suggestions");
          } else if (hasLegacyAutocomplete) {
            setMode("legacy");
          } else {
            setMode("unavailable");
          }
        }
      } catch {
        if (active) {
          setMode("unavailable");
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
    if (mode !== "unavailable") {
      setPlaceError("");
    }
    setSuggestions([]);
    onInputChange?.(nextValue);
  }

  useEffect(() => {
    const input = inputRef.current;

    if (!input || mode !== "legacy" || !window.google?.maps?.places?.Autocomplete) {
      return;
    }

    const options: google.maps.places.AutocompleteOptions = {
      fields: ["formatted_address", "geometry", "name", "place_id", "types"],
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
      _onSelect({
        address,
        formattedAddress: place.formatted_address || null,
        lat,
        lng,
        name: place.name || null,
        placeId: place.place_id || null,
        providerMetadata: {
          provider: "google_places",
          source: "legacy_autocomplete",
          types: place.types || []
        }
      });
    });

    return () => {
      listener.remove();
    };
  }, [_onSelect, bounds, country, mode, onInputChange]);

  useEffect(() => {
    if (mode !== "suggestions" || modernSuggestionsFailed) {
      return;
    }

    const query = inputValue.trim();

    if (!isFocused || query.length < 2 || !window.google?.maps?.places?.AutocompleteSuggestion) {
      setSuggestions([]);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        const request: google.maps.places.AutocompleteRequest = {
          input: query,
          sessionToken: getSessionToken()
        };

        if (bounds) {
          request.locationBias = bounds;
        }

        if (country) {
          request.includedRegionCodes = [country.toUpperCase()];
        }

        const response =
          await window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            request
          );

        if (!active) {
          return;
        }

        setSuggestions(
          response.suggestions
            .map((suggestion) => suggestion.placePrediction)
            .filter((prediction): prediction is google.maps.places.PlacePrediction =>
              Boolean(prediction)
            )
            .slice(0, 6)
            .map((prediction) => ({
              id: prediction.placeId,
              label: prediction.mainText?.text || prediction.text?.text || "Place",
              secondaryLabel: prediction.secondaryText?.text || "",
              prediction
            }))
        );
        setPlaceError("");
      } catch {
        if (active) {
          setSuggestions([]);
          setModernSuggestionsFailed(true);

          if (window.google?.maps?.places?.Autocomplete) {
            setMode("legacy");
            setPlaceError("");
          } else {
            setMode("unavailable");
            setPlaceError("Places suggestions are unavailable. You can still type a destination.");
          }
        }
      }
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [bounds, country, inputValue, isFocused, modernSuggestionsFailed, mode]);

  async function selectSuggestion(option: SuggestionOption) {
    setIsResolvingSuggestion(true);
    setPlaceError("");

    try {
      const place = option.prediction.toPlace();
      const { place: resolvedPlace } = await place.fetchFields({
        fields: ["id", "displayName", "formattedAddress", "location", "types", "googleMapsURI"]
      });
      const selected = selectionFromPlace(resolvedPlace, option.label);

      if (!selected) {
        setPlaceError("Choose a destination with a mapped location.");
        return;
      }

      setInputValue(selected.address);
      setSuggestions([]);
      sessionTokenRef.current = null;
      onInputChange?.(selected.address);
      _onSelect(selected);
    } catch {
      setPlaceError("Wayline could not resolve that Google result. Try another destination.");
    } finally {
      setIsResolvingSuggestion(false);
    }
  }

  function getSessionToken() {
    if (!sessionTokenRef.current && window.google?.maps?.places?.AutocompleteSessionToken) {
      sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
    }

    return sessionTokenRef.current || undefined;
  }

  const showManualWarning = mode === "unavailable" && inputValue.trim().length > 0;

  return (
    <div className="relative space-y-2">
      <input
        ref={inputRef}
        aria-label={ariaLabel}
        className={inputClassName}
        name={name}
        onChange={handleChange}
        onBlur={() => {
          window.setTimeout(() => setIsFocused(false), 150);
        }}
        onFocus={() => setIsFocused(true)}
        type="text"
        placeholder={placeholder}
        required={required}
        value={inputValue}
      />
      {mode === "suggestions" && suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%-4px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {suggestions.map((suggestion) => (
            <button
              className="block w-full px-4 py-3 text-left transition hover:bg-blue-50 focus:bg-blue-50 focus:outline-none disabled:opacity-60"
              disabled={isResolvingSuggestion}
              key={suggestion.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
              type="button"
            >
              <span className="block text-sm font-bold text-slate-900">
                {suggestion.label}
              </span>
              {suggestion.secondaryLabel ? (
                <span className="mt-0.5 block text-xs font-semibold text-slate-500">
                  {suggestion.secondaryLabel}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {mode === "loading" ? (
        <p className="text-xs font-semibold text-slate-500">
          Places autocomplete is loading. You can still type a destination.
        </p>
      ) : null}
      {showManualWarning ? (
        <p className="text-xs font-semibold text-amber-700">
          Destination saved manually. Map and AI matching may work better after selecting a Google result.
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

function selectionFromPlace(
  place: google.maps.places.Place,
  fallbackName: string
): LocationSelection | null {
  const lat = readCoordinate(place.location || undefined, "lat");
  const lng = readCoordinate(place.location || undefined, "lng");
  const address = place.formattedAddress || place.displayName || fallbackName;

  if (!address || typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  return {
    address,
    formattedAddress: place.formattedAddress || null,
    lat,
    lng,
    name: place.displayName || fallbackName,
    placeId: place.id || null,
    providerMetadata: {
      googleMapsUri: place.googleMapsURI || null,
      provider: "google_places",
      source: "autocomplete_suggestions",
      types: place.types || []
    }
  };
}
