export type FlightRefreshJobData = {
  tripId: string;
  itemId: string;
  carrier: string;
  flightNumber: string;
  year: number;
  month: number;
  day: number;
  userId: string;
};

export type FlightRefreshResult = {
  refreshed: boolean;
  cached: boolean;
  flightId: string | null;
  updatedAt: string;
};
