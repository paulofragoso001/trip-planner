"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { isNativeCapacitorRuntime } from "@/lib/native/capacitor-runtime";
import {
  autocompleteNativeMap,
  resolveNativeMapAutocomplete,
  type NativeMapAutocompleteSuggestion
} from "@/lib/native/use-wallet-route-sync";
import type { LocationSelection } from "@/components/LocationAutocomplete";
import { loadAppleMapKitToken } from "@/lib/map/apple-mapkit-token";

type AppleLocationAutocompleteProps = {
  ariaLabel?: string;
  id?: string;
  inputClassName?: string;
  name?: string;
  onInputChange?: (value: string) => void;
  onSelect: (location: LocationSelection) => void;
  placeholder?: string;
  required?: boolean;
  value?: string;
};

type MapKitAutocompleteResult = {
  coordinate?: { latitude: number; longitude: number };
  displayLines?: string[];
};

type MapKitSearch = {
  autocomplete: (query: string, options?: Record<string, unknown>) => Promise<{
    results?: MapKitAutocompleteResult[];
  }>;
};

type MapKitWindow = Window & {
  mapkit?: {
    Search: new () => MapKitSearch;
    init?: (options: { authorizationCallback: (done: (token: string) => void) => void }) => void;
    initialized?: boolean;
  };
};

const MAPKIT_SCRIPT_ID = "almidy-apple-mapkit-js";
const MAPKIT_SCRIPT_SRC = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
let mapKitReady: Promise<void> | null = null;

export function AppleLocationAutocomplete({
  ariaLabel,
  id,
  inputClassName,
  name,
  onInputChange,
  onSelect,
  placeholder,
  required,
  value = ""
}: AppleLocationAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputValue, setInputValue] = useState(value);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<NativeMapAutocompleteSuggestion[]>([]);
  const requestGeneration = useRef(0);
  const native = isNativeCapacitorRuntime();

  useEffect(() => setInputValue(value), [value]);

  useEffect(() => {
    const query = inputValue.trim();
    if (!focused || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const generation = ++requestGeneration.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const results = native
          ? await autocompleteNativeMap(query)
          : await autocompleteMapKitJS(query);

        if (generation === requestGeneration.current) {
          setSuggestions(results.slice(0, 6));
        }
      } catch {
        if (generation === requestGeneration.current) {
          setSuggestions([]);
          setError("Apple Maps suggestions are unavailable. You can still type a destination.");
        }
      } finally {
        if (generation === requestGeneration.current) setLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [focused, inputValue, native]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    setInputValue(nextValue);
    setSuggestions([]);
    setError(null);
    onInputChange?.(nextValue);
  }

  async function selectSuggestion(suggestion: NativeMapAutocompleteSuggestion) {
    setLoading(true);
    setError(null);

    try {
      const selected = native
        ? await resolveNativeMapAutocomplete(suggestion.title, suggestion.subtitle)
        : await resolveMapKitJSAutocomplete(suggestion);

      if (!selected) throw new Error("No coordinate returned");
      setInputValue(selected.address);
      setSuggestions([]);
      onInputChange?.(selected.address);
      onSelect(selected);
    } catch {
      setError("Apple Maps could not resolve that destination. Try another suggestion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-w-0 overflow-visible">
      <input
        ref={inputRef}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        className={inputClassName}
        id={id}
        name={name}
        onBlur={() => window.setTimeout(() => setFocused(false), 150)}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        required={required}
        type="text"
        value={inputValue}
      />
      {suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[90] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          {suggestions.map((suggestion) => (
            <button
              className="block w-full px-4 py-3 text-left transition hover:bg-blue-50 focus:bg-blue-50 focus:outline-none disabled:opacity-60"
              disabled={loading}
              key={suggestion.id}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void selectSuggestion(suggestion)}
              type="button"
            >
              <span className="block text-sm font-bold text-slate-900">{suggestion.title}</span>
              {suggestion.subtitle ? <span className="mt-0.5 block text-xs font-semibold text-slate-500">{suggestion.subtitle}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      {loading ? <p className="mt-2 text-xs font-semibold text-slate-500">Searching Apple Maps...</p> : null}
      {error ? <p className="mt-2 text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

async function autocompleteMapKitJS(query: string): Promise<NativeMapAutocompleteSuggestion[]> {
  await ensureMapKitJS();
  const mapkit = (window as MapKitWindow).mapkit;
  if (!mapkit) throw new Error("MapKit JS is unavailable");

  const response = await new mapkit.Search().autocomplete(query);
  return (response.results ?? []).map((result, index) => ({
    id: `mapkit-${index}-${result.displayLines?.join("-") ?? query}`,
    subtitle: result.displayLines?.slice(1).join(", ") ?? "",
    title: result.displayLines?.[0] ?? query
  }));
}

async function resolveMapKitJSAutocomplete(suggestion: NativeMapAutocompleteSuggestion): Promise<LocationSelection | null> {
  await ensureMapKitJS();
  const mapkit = (window as MapKitWindow).mapkit;
  if (!mapkit) return null;

  const response = await new mapkit.Search().autocomplete(`${suggestion.title}, ${suggestion.subtitle}`);
  const result = response.results?.find((candidate) => candidate.coordinate);
  const coordinate = result?.coordinate;
  if (!coordinate) return null;

  const address = [suggestion.title, suggestion.subtitle].filter(Boolean).join(", ");
  return {
    address,
    formattedAddress: address,
    lat: coordinate.latitude,
    lng: coordinate.longitude,
    name: suggestion.title,
    providerMetadata: {
      provider: "apple_mapkit_js",
      source: "search_autocomplete",
      title: suggestion.title,
      subtitle: suggestion.subtitle
    }
  };
}

async function ensureMapKitJS() {
  const mapkit = (window as MapKitWindow).mapkit;
  if (mapkit?.initialized) return;
  if (!mapKitReady) {
    mapKitReady = new Promise<void>((resolve, reject) => {
      const script = document.getElementById(MAPKIT_SCRIPT_ID) as HTMLScriptElement | null || document.createElement("script");
      script.id = MAPKIT_SCRIPT_ID;
      script.src = MAPKIT_SCRIPT_SRC;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("MapKit JS failed to load"));
      if (!script.parentNode) document.head.appendChild(script);
    }).then(async () => {
      const runtime = (window as MapKitWindow).mapkit;
      if (!runtime?.init || runtime.initialized) return;
      const token = await loadAppleMapKitToken();
      if (!token) throw new Error("MapKit JS token unavailable");
      runtime.init({ authorizationCallback: (done) => done(token) });
    });
  }
  await mapKitReady;
}
