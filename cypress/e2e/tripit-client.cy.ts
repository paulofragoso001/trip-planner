/// <reference types="cypress" />

import { TripItClient } from "../../api/tripit";

describe("TripItClient", () => {
  it("uses TripIt v1 list and get URL shapes", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = new TripItClient({
      baseUrl: "https://mock.example.test/",
      fetcher: async (url, init) => {
        requests.push({ url: String(url), init });
        return jsonResponse({ timestamp: "1257208295", Trip: [] });
      }
    });

    await client.listTrips({ includeObjects: true, pageNum: 2 });
    await client.getTrip("2785341", { includeObjects: true });

    expect(requests[0].url).to.eq(
      "https://mock.example.test/v1/list/trip/include_objects/true/page_num/2/format/json"
    );
    expect(requests[1].url).to.eq(
      "https://mock.example.test/v1/get/trip/id/2785341/include_objects/true/format/json"
    );
  });

  it("wraps create and replace payloads using TripIt object keys", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const client = new TripItClient({
      baseUrl: "https://mock.example.test",
      fetcher: async (url, init) => {
        requests.push({ url: String(url), init });
        return jsonResponse({ Trip: { id: "770846" } });
      }
    });

    await client.createObject("trip", { primary_location: "New York, NY" });
    await client.replaceObject("note", "68872927", { display_name: "Updated note" });

    expect(requests[0].url).to.eq("https://mock.example.test/v1/create/format/json");
    expect(JSON.parse(String(requests[0].init?.body))).to.deep.eq({
      Trip: { primary_location: "New York, NY" }
    });

    expect(requests[1].url).to.eq(
      "https://mock.example.test/v1/replace/note/id/68872927/format/json"
    );
    expect(JSON.parse(String(requests[1].init?.body))).to.deep.eq({
      NoteObject: { display_name: "Updated note" }
    });
  });

  it("normalizes keyed TripIt JSON responses into the data wrapper", async () => {
    const client = new TripItClient({
      baseUrl: "https://mock.example.test",
      fetcher: async () =>
        jsonResponse({
          timestamp: "1285611997",
          num_bytes: "880",
          WeatherObject: {
            id: "19720471",
            display_name: "Weather - Chicago, IL"
          }
        })
    });

    const response = await client.getObject("weather", "19720471");

    expect(response.timestamp).to.eq(1285611997);
    expect(response.num_bytes).to.eq(880);
    expect(response.data).to.deep.eq({
      id: "19720471",
      display_name: "Weather - Chicago, IL"
    });
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
