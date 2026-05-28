import "server-only";

export class TravelProviderError extends Error {
  code: string;
  provider: string;
  recoverable: boolean;

  constructor(
    provider: string,
    code: string,
    message: string,
    options: { recoverable?: boolean } = {}
  ) {
    super(message);
    this.name = "TravelProviderError";
    this.code = code;
    this.provider = provider;
    this.recoverable = options.recoverable ?? true;
  }
}

export function logTravelProviderEvent(
  event: string,
  details: Record<string, unknown>
) {
  console.info(
    JSON.stringify({
      area: "travel_data",
      event,
      ...details
    })
  );
}
