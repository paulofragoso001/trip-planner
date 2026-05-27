export type TripItObjectType =
  | "air"
  | "activity"
  | "car"
  | "parking"
  | "cruise"
  | "directions"
  | "lodging"
  | "map"
  | "note"
  | "profile"
  | "rail"
  | "restaurant"
  | "transport"
  | "trip"
  | "weather";

export type TripItListObjectType = "trip" | "object" | "points_program";

export type TripItReservationObjectType =
  | "air"
  | "lodging"
  | "car"
  | "parking"
  | "rail"
  | "transport"
  | "cruise"
  | "restaurant"
  | "activity";

export type TripItWritableObjectType = Exclude<TripItObjectType, "profile" | "weather">;

export type TripItTrip = {
  id: string;
  displayname: string;
  display_name?: string;
  startdate?: string;
  start_date?: string;
  enddate?: string;
  end_date?: string;
  primarylocation?: string;
  primary_location?: string;
  image_url?: string;
  is_private?: boolean;
  is_traveler?: boolean;
};

export type TripItAir = {
  id: string;
  tripid?: string;
  trip_id?: string;
  displayname: string;
  display_name?: string;
  flightstatus?: "on time" | "delayed" | "scheduled" | string;
  flight_status?: number | string;
  startcityname?: string;
  start_city_name?: string;
  endcityname?: string;
  end_city_name?: string;
  startdatetime?: string;
  enddatetime?: string;
  startlat?: number;
  startlng?: number;
  endlat?: number;
  endlng?: number;
};

export type TripItActivity = {
  id: string;
  tripid?: string;
  trip_id?: string;
  displayname: string;
  display_name?: string;
  location?: string;
  startdatetime?: string;
  enddatetime?: string;
  notes?: string;
  lat?: number;
  lng?: number;
};

export type TripItLodging = {
  id: string;
  tripid?: string;
  trip_id?: string;
  displayname: string;
  display_name?: string;
  location?: string;
  startdate?: string;
  enddate?: string;
  lat?: number;
  lng?: number;
};

export type TripItWeather = {
  id: string;
  tripid?: string;
  trip_id?: string;
  displayname: string;
  display_name?: string;
  location?: string;
  date?: string;
  avghightempc?: number;
  avg_high_temp_c?: number;
  avglowtempc?: number;
  avg_low_temp_c?: number;
  condition?: string;
};

export type TripItDirections = {
  id: string;
  tripid?: string;
  trip_id?: string;
  displayname: string;
  display_name?: string;
  fromObjectId?: string;
  toObjectId?: string;
  summary?: string;
  distance?: string;
  duration?: string;
};

export type TripItDayBundle = {
  dayLabel: string;
  weather?: TripItWeather;
  air?: TripItAir;
  lodging?: TripItLodging;
  activity?: TripItActivity;
  directions?: TripItDirections[];
};

export type TripItTripBundle = TripItTrip & {
  objects: TripItDayBundle[];
};

export type TripItObject =
  | TripItTrip
  | TripItAir
  | TripItActivity
  | TripItLodging
  | TripItWeather
  | TripItDirections;

export type TripItResponse<T> = {
  timestamp?: number;
  num_bytes?: number;
  numbytes?: number;
  data: T;
  page_num?: number;
  page_size?: number;
  max_page?: number;
  warnings?: string[];
  errors?: string[];
};

export type TripItRawResponse<T> = {
  timestamp?: number | string;
  num_bytes?: number | string;
  numbytes?: number | string;
  page_num?: number | string;
  page_size?: number | string;
  max_page?: number | string;
  Warning?: unknown;
  Error?: unknown;
} & T;
