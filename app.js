let trips = [
  {
    id: "la",
    name: "Los Angeles launch week",
    destination: "Los Angeles",
    route: "New York to Los Angeles",
    start: "2026-05-14",
    end: "2026-05-18",
    status: "Upcoming",
    documents: [
      ["Passport", "Verified"],
      ["AA 418 boarding pass", "Ready May 13"],
      ["Hotel receipt", "Attached"]
    ],
    items: [
      {
        type: "flight",
        title: "AA 418 to Los Angeles",
        detail: "JFK Terminal 8 to LAX Terminal 4",
        date: "2026-05-14",
        time: "8:20 AM",
        price: 418
      },
      {
        type: "ground",
        title: "Ride to The LINE",
        detail: "Pickup at LAX arrivals, door 5B",
        date: "2026-05-14",
        time: "11:35 AM",
        price: 54
      },
      {
        type: "stay",
        title: "The LINE Los Angeles",
        detail: "3515 Wilshire Blvd, king room",
        date: "2026-05-14",
        time: "3:00 PM",
        price: 840
      },
      {
        type: "activity",
        title: "Dinner at Bestia",
        detail: "Reservation for 2, Arts District",
        date: "2026-05-15",
        time: "7:30 PM",
        price: 160
      },
      {
        type: "flight",
        title: "AA 2754 to New York",
        detail: "LAX Terminal 4 to JFK Terminal 8",
        date: "2026-05-18",
        time: "1:10 PM",
        price: 392
      }
    ]
  },
  {
    id: "lisbon",
    name: "Lisbon design sprint",
    destination: "Lisbon",
    route: "Boston to Lisbon",
    start: "2026-07-02",
    end: "2026-07-09",
    status: "Planning",
    documents: [
      ["Passport", "Verified"],
      ["Travel insurance", "Attached"]
    ],
    items: [
      {
        type: "flight",
        title: "TAP 218 overnight flight",
        detail: "BOS to LIS, seat 14A",
        date: "2026-07-02",
        time: "6:05 PM",
        price: 690
      },
      {
        type: "stay",
        title: "Baixa House",
        detail: "Rua dos Fanqueiros, apartment 3",
        date: "2026-07-03",
        time: "2:00 PM",
        price: 1180
      },
      {
        type: "activity",
        title: "Sprint kickoff",
        detail: "Beta-i workspace, room Azul",
        date: "2026-07-04",
        time: "10:00 AM",
        price: 0
      }
    ]
  },
  {
    id: "chicago",
    name: "Chicago customer visits",
    destination: "Chicago",
    route: "Newark to Chicago",
    start: "2026-04-30",
    end: "2026-05-02",
    status: "Ready",
    documents: [
      ["United boarding pass", "Ready"],
      ["Hotel folio", "Pending"]
    ],
    items: [
      {
        type: "flight",
        title: "UA 1129 to Chicago",
        detail: "EWR Terminal C to ORD Terminal 1",
        date: "2026-04-30",
        time: "7:45 AM",
        price: 310
      },
      {
        type: "activity",
        title: "Customer workshop",
        detail: "West Loop office",
        date: "2026-04-30",
        time: "1:00 PM",
        price: 0
      },
      {
        type: "stay",
        title: "The Hoxton Chicago",
        detail: "Fulton Market, confirmation HX8821",
        date: "2026-04-30",
        time: "4:00 PM",
        price: 430
      }
    ]
  }
];

const icons = {
  flight: '<path d="M22 16 2 9l8-2 4-5 2 1-2 5 5 2 3 6ZM2 19h20" />',
  stay: '<path d="M3 20V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12M3 13h18M7 13V9h4v4" />',
  activity: '<path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z" /><path d="M12 10.5h.01" />',
  ground: '<path d="M5 17h14l-1.4-6.2A3 3 0 0 0 14.7 8H9.3a3 3 0 0 0-2.9 2.8L5 17ZM7 17v2M17 17v2M7 13h10" />'
};

const bookingSites = [
  { name: "American Airlines", category: "Airlines", type: "flight", connected: true, sample: "Flight AA 418 from JFK to LAX on May 14 at 8:20 AM. Confirmation AA8F21." },
  { name: "Delta Air Lines", category: "Airlines", type: "flight", connected: false, sample: "Flight DL 924 from LGA to ATL on May 16 at 10:15 AM. Confirmation DL7K42." },
  { name: "United Airlines", category: "Airlines", type: "flight", connected: true, sample: "Flight UA 1129 from EWR to ORD on Apr 30 at 7:45 AM. Confirmation UA1129." },
  { name: "JetBlue", category: "Airlines", type: "flight", connected: false, sample: "Flight B6 615 from JFK to SFO on Jun 8 at 6:30 PM. Confirmation JB44Q2." },
  { name: "Marriott", category: "Hotels", type: "stay", connected: false, sample: "Hotel Marriott Marquis from May 14 to May 17. Check-in at 3:00 PM. Confirmation MQ5517." },
  { name: "Hilton", category: "Hotels", type: "stay", connected: true, sample: "Hotel Hilton Chicago from Apr 30 to May 2. Check-in at 4:00 PM. Confirmation HC8802." },
  { name: "Hyatt", category: "Hotels", type: "stay", connected: false, sample: "Hotel Hyatt Regency from Jul 3 to Jul 7. Check-in at 3:00 PM. Confirmation HY9118." },
  { name: "Airbnb", category: "Agencies", type: "stay", connected: false, sample: "Airbnb stay in Venice Beach from May 14 to May 18. Check-in at 4:00 PM. Confirmation HM82LA." },
  { name: "Booking.com", category: "Agencies", type: "stay", connected: true, sample: "Booking.com hotel The LINE Los Angeles from May 14 to May 17. Confirmation BK2219." },
  { name: "Expedia", category: "Agencies", type: "stay", connected: false, sample: "Expedia package for Los Angeles from May 14 to May 18. Hotel check-in at 3:00 PM. Itinerary 728182." },
  { name: "Enterprise", category: "Car Rentals", type: "ground", connected: false, sample: "Rental car Enterprise at LAX on May 14 at 12:00 PM. Return May 18 at 10:30 AM. Confirmation EN4412." },
  { name: "Hertz", category: "Car Rentals", type: "ground", connected: false, sample: "Rental car Hertz at ORD on Apr 30 at 10:30 AM. Return May 2 at 3:00 PM. Confirmation HZ9081." },
  { name: "Amtrak", category: "Transportation", type: "ground", connected: false, sample: "Amtrak train 2159 from New York to Washington on May 22 at 9:00 AM. Confirmation AM2159." },
  { name: "Uber", category: "Transportation", type: "ground", connected: true, sample: "Ride with Uber from LAX to The LINE on May 14 at 11:35 AM. Estimated fare $54." },
  { name: "OpenTable", category: "Activities", type: "activity", connected: false, sample: "Dinner at Bestia May 15 7:30 PM via OpenTable. Reservation for 2." },
  { name: "Viator", category: "Activities", type: "activity", connected: false, sample: "Viator tour Griffith Observatory on May 16 at 2:00 PM. Confirmation VT7731." },
  { name: "Eventbrite", category: "Activities", type: "activity", connected: false, sample: "Eventbrite ticket Product Leaders Summit on May 17 at 9:30 AM. Order EB2026." },
  { name: "Resy", category: "Activities", type: "activity", connected: false, sample: "Reservation at Republique May 16 8:00 PM through Resy. Party of 2." }
];

const integrations = [
  {
    id: "maps",
    name: "Google Maps",
    label: "Live links",
    connected: true,
    description: "Open trip destinations, hotel areas, and plan addresses in Google Maps.",
    action: "Open map"
  },
  {
    id: "google",
    name: "Google",
    label: "Gmail + Calendar",
    connected: false,
    description: "Stage Gmail confirmation imports and create Google Calendar handoff links.",
    action: "Import sample"
  },
  {
    id: "openai",
    name: "OpenAI",
    label: "AI extraction",
    connected: false,
    description: "Turn messy confirmation text into structured itinerary items.",
    action: "Extract"
  }
];

const builderApps = [
  {
    id: "flights",
    name: "Flight Search",
    category: "Move",
    partner: "Google Flights",
    status: "Link ready",
    description: "Compare flight options and add selected confirmations back into the timeline.",
    url: (trip) => `https://www.google.com/travel/flights?q=${encodeURIComponent(`flights to ${trip.destination}`)}`,
    item: (trip) => planItem("flight", `Flight options for ${trip.destination}`, "Compare fares, stops, and baggage rules", trip.start, "9:00 AM", 0)
  },
  {
    id: "stays",
    name: "Places to stay",
    category: "Stay",
    partner: "Google Travel",
    status: "Link ready",
    description: "Research hotels, rentals, neighborhoods, and check-in logistics.",
    url: (trip) => `https://www.google.com/travel/hotels/${encodeURIComponent(trip.destination)}`,
    item: (trip) => planItem("stay", `${trip.destination} stay shortlist`, "Compare hotels, rentals, amenities, and cancellation terms", trip.start, "3:00 PM", 0)
  },
  {
    id: "rides",
    name: "Airport rides",
    category: "Move",
    partner: "Uber / Lyft",
    status: "Estimate",
    description: "Plan pickup windows and ground transfers around arrivals.",
    url: (trip) => googleMapsDirectionsUrl(`${trip.destination} airport to hotel`),
    item: (trip) => planItem("ground", "Airport transfer", `${trip.destination} airport to lodging`, trip.start, "11:30 AM", 55)
  },
  {
    id: "rail",
    name: "Rail and transit",
    category: "Move",
    partner: "Maps Transit",
    status: "Live link",
    description: "Check train, subway, and public-transit options near the trip.",
    url: (trip) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${trip.destination} transit station`)}`,
    item: (trip) => planItem("ground", `${trip.destination} transit pass`, "Review local transit routes and day-pass options", trip.start, "12:00 PM", 0)
  },
  {
    id: "restaurants",
    name: "Restaurants",
    category: "Do",
    partner: "OpenTable / Resy",
    status: "Book",
    description: "Find and stage dining reservations for the itinerary.",
    url: (trip) => `https://www.google.com/search?q=${encodeURIComponent(`${trip.destination} restaurants reservations`)}`,
    item: (trip) => planItem("activity", `${trip.destination} dinner reservation`, "Shortlist restaurants and reserve a table", trip.start, "7:30 PM", 120)
  },
  {
    id: "activities",
    name: "Tours and tickets",
    category: "Do",
    partner: "Viator / Eventbrite",
    status: "Discover",
    description: "Add tours, events, museums, and timed tickets.",
    url: (trip) => `https://www.google.com/search?q=${encodeURIComponent(`${trip.destination} tours events tickets`)}`,
    item: (trip) => planItem("activity", `${trip.destination} activity shortlist`, "Pick timed tickets, tours, and local events", trip.start, "2:00 PM", 75)
  },
  {
    id: "weather",
    name: "Weather",
    category: "Prepare",
    partner: "Google Weather",
    status: "Forecast",
    description: "Check forecast windows before packing and booking outdoor plans.",
    url: (trip) => `https://www.google.com/search?q=${encodeURIComponent(`${trip.destination} weather ${formatDateRange(trip.start, trip.end)}`)}`,
    document: ["Weather check", "Review 7 days before departure"],
    item: (trip) => planItem("activity", "Weather and packing review", `Check ${trip.destination} forecast`, trip.start, "8:00 AM", 0)
  },
  {
    id: "currency",
    name: "Currency",
    category: "Prepare",
    partner: "Google Finance",
    status: "Estimate",
    description: "Plan cash, exchange rates, cards, and local payment norms.",
    url: () => "https://www.google.com/finance/",
    document: ["Payment plan", "Cards, cash, exchange noted"]
  },
  {
    id: "packing",
    name: "Packing list",
    category: "Prepare",
    partner: "Almidy",
    status: "Checklist",
    description: "Generate essentials from destination, weather, bookings, and documents.",
    url: (trip) => `https://www.google.com/search?q=${encodeURIComponent(`packing list for ${trip.destination}`)}`,
    document: ["Packing checklist", "Generated from trip details"]
  },
  {
    id: "documents",
    name: "Travel documents",
    category: "Prepare",
    partner: "Wallet",
    status: "Vault",
    description: "Track passport, IDs, insurance, tickets, visas, and receipts.",
    url: (trip) => `https://www.google.com/search?q=${encodeURIComponent(`${trip.destination} travel requirements`)}`,
    document: ["Entry requirements", "Needs review"]
  },
  {
    id: "budget",
    name: "Budget",
    category: "Plan",
    partner: "Sheets",
    status: "Estimate",
    description: "Track projected spend across flights, stays, food, transport, and activities.",
    url: () => "https://sheets.new",
    item: (trip) => planItem("activity", "Budget review", "Reconcile bookings, daily spend, and reimbursement notes", trip.start, "5:00 PM", 0)
  },
  {
    id: "notes",
    name: "Notes and docs",
    category: "Plan",
    partner: "Google Docs",
    status: "Draft",
    description: "Create a trip brief with addresses, confirmation numbers, and backup plans.",
    url: () => "https://docs.new",
    document: ["Trip brief", "Drafted"]
  },
  {
    id: "calendar",
    name: "Calendar",
    category: "Plan",
    partner: "Google Calendar",
    status: "Handoff",
    description: "Add timed itinerary items to a calendar and share with travelers.",
    url: (trip) => googleCalendarUrl(trip.items[0]),
    item: (trip) => planItem("activity", "Calendar sync review", "Confirm all timed plans are on shared calendars", trip.start, "4:00 PM", 0)
  },
  {
    id: "collab",
    name: "Share with travelers",
    category: "Share",
    partner: "Email / WhatsApp",
    status: "Share",
    description: "Prepare a concise trip summary for family, coworkers, or travel companions.",
    url: (trip) => `mailto:?subject=${encodeURIComponent(trip.name)}&body=${encodeURIComponent(`${trip.name}\n${formatDateRange(trip.start, trip.end)}\n${trip.items.length} plans saved in Almidy.`)}`,
    document: ["Shared summary", "Ready to send"]
  }
];

const discoveryCategories = [
  { id: "visited", label: "Most visited", type: "activity", query: (place) => `most visited places in ${place}` },
  { id: "routes", label: "Best routes", type: "ground", query: (place) => `best travel routes in ${place}` },
  { id: "places", label: "Places to visit", type: "activity", query: (place) => `best places to visit in ${place}` },
  { id: "restaurants", label: "Restaurants", type: "activity", query: (place) => `best restaurants in ${place}` },
  { id: "parks", label: "Parks", type: "activity", query: (place) => `best parks in ${place}` },
  { id: "malls", label: "Malls", type: "activity", query: (place) => `best malls shopping areas in ${place}` },
  { id: "areas", label: "Areas", type: "activity", query: (place) => `best neighborhoods areas to stay in ${place}` },
  { id: "map", label: "Map view", type: "activity", query: (place) => `top attractions in ${place}` }
];

const discoverySuggestions = ["Japan", "France", "Italy", "Brazil", "Thailand", "Morocco", "Canada", "South Africa"];

const timeZoneByCode = {
  JFK: "America/New_York",
  EWR: "America/New_York",
  LGA: "America/New_York",
  BOS: "America/New_York",
  LAX: "America/Los_Angeles",
  SFO: "America/Los_Angeles",
  ORD: "America/Chicago",
  ATL: "America/New_York",
  LIS: "Europe/Lisbon"
};

const timeZoneByPlace = {
  "los angeles": "America/Los_Angeles",
  chicago: "America/Chicago",
  lisbon: "Europe/Lisbon",
  tokyo: "Asia/Tokyo",
  "new york": "America/New_York",
  boston: "America/New_York"
};

const airlineTrackingUrls = {
  AA: (flight) => `https://www.aa.com/travelInformation/flights/status/detail?search=${encodeURIComponent(flight)}`,
  UA: (flight) => `https://www.united.com/en/us/flightstatus/details/${encodeURIComponent(flight.replace(/\s+/g, ""))}`,
  DL: (flight) => `https://www.delta.com/flightstatus/search/${encodeURIComponent(flight.replace(/\s+/g, ""))}`,
  B6: (flight) => `https://www.jetblue.com/flight-tracker-and-status?flight=${encodeURIComponent(flight.replace(/\s+/g, ""))}`,
  TAP: (flight) => `https://www.flytap.com/en-us/flight-status?flightNumber=${encodeURIComponent(flight.replace(/\s+/g, ""))}`
};

const rentalTrackingUrls = {
  Enterprise: "https://www.enterprise.com/en/car-rental/view-modify-cancel.html",
  Hertz: "https://www.hertz.com/rentacar/reservation/",
  Avis: "https://www.avis.com/en/reservation/lookup",
  Budget: "https://www.budget.com/en/reservation/lookup"
};

let activeTripId = trips[0].id;
let activeFilter = "all";
let activeSiteCategory = "all";
let activeSiteSearch = "";
let activeBuilderCategory = "all";
let activeBuilderSearch = "";
let activeGlobalSearch = "";
let activeDiscoveryPlace = "";
let deletedPlans = {};
let managerUnlocked = false;
let db = null;
let dbReady = false;
let saveTimer = null;

const formatDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const formatMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const $ = (selector) => document.querySelector(selector);

function getActiveTrip() {
  return trips.find((trip) => trip.id === activeTripId) || trips[0];
}

function matchesSearch(value, query = activeGlobalSearch) {
  if (!query) return true;
  return String(value).toLowerCase().includes(query.toLowerCase());
}

function tripSearchText(trip) {
  return [
    trip.name,
    trip.destination,
    trip.route,
    trip.status,
    trip.documents.map((doc) => doc.join(" ")).join(" "),
    trip.items.map((item) => `${item.title} ${item.detail} ${item.type}`).join(" ")
  ].join(" ");
}

function itemSearchText(item) {
  return `${item.title} ${item.detail} ${item.type} ${item.date} ${item.time}`;
}

function renderTrips() {
  const filteredTrips = trips.filter((trip) => matchesSearch(tripSearchText(trip)));
  $("#tripList").innerHTML = filteredTrips
    .map((trip) => {
      const active = trip.id === activeTripId ? " active" : "";
      return `
        <button class="trip-button${active}" data-trip-id="${trip.id}">
          <span>
            <strong>${trip.name}</strong>
            <span>${formatDateRange(trip.start, trip.end)}</span>
          </span>
        </button>
      `;
    })
    .join("") || `<p class="empty-state">No trips match this search.</p>`;
}

function renderOverview() {
  const trip = getActiveTrip();
  const total = trip.items.reduce((sum, item) => sum + item.price, 0);
  const next = trip.items[0] || planItem("activity", "No active plans", "Restore archived plans or import a new itinerary", trip.start, "9:00 AM", 0);
  const nextMeta = trip.items[0] ? getTrackingMeta(next, trip) : { localTime: "Timeline empty", status: "Needs plan" };

  $("#tripTitle").textContent = trip.name;
  $("#tripStatus").textContent = trip.status;
  $("#tripRoute").textContent = trip.route;
  $("#tripDates").textContent = formatDateRange(trip.start, trip.end);
  $("#nextItem").textContent = next.title;
  $("#nextItemMeta").textContent = `${nextMeta.localTime} - ${nextMeta.status}`;
  $("#tripSpend").textContent = formatMoney.format(total);
  $("#tripSpendMeta").textContent = `${trip.items.length} itinerary items`;
  $("#docCount").textContent = `${trip.documents.length} saved`;
  $("#mapTitle").textContent = trip.destination;
  $("#mapMeta").textContent = `${Math.max(2, trip.items.length - 2)} saved places`;
  $("#mapsSearchLink").href = googleMapsSearchUrl(trip.destination);
  $("#mapsDirectionsLink").href = googleMapsDirectionsUrl(trip.destination);
}

function renderTimeline() {
  const trip = getActiveTrip();
  const items = (activeFilter === "all" ? trip.items : trip.items.filter((item) => item.type === activeFilter))
    .filter((item) => matchesSearch(itemSearchText(item)));
  $("#timelineLiveClock").textContent = `Updated ${formatClock(new Date())} - ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

  $("#timeline").innerHTML = items
    .map((item) => {
      const meta = getTrackingMeta(item, trip);
      const trackingLinks = getTrackingLinks(item, trip, meta);
      return `
        <article class="timeline-item ${meta.statusClass}">
          <div class="item-icon ${item.type}" aria-hidden="true">
            <svg viewBox="0 0 24 24">${icons[item.type] || icons.activity}</svg>
          </div>
          <div class="timeline-main">
            <div class="timeline-meta">
              <div>
                <strong>${item.title}</strong>
                <span class="tracking-status">${meta.status}</span>
              </div>
              <span class="price-tag">${item.price ? formatMoney.format(item.price) : "Included"}</span>
            </div>
            <p>${item.detail}</p>
            <div class="timeline-intel">
              <span>${meta.localTime}</span>
              <span>${meta.timeZoneLabel}</span>
              <span>${meta.location}</span>
            </div>
            <div class="timeline-actions">
              ${trackingLinks.map((link) => `<a href="${link.url}" target="_blank" rel="noreferrer">${link.label}</a>`).join("")}
              <a href="${googleCalendarUrl(item)}" target="_blank" rel="noreferrer">Calendar</a>
            </div>
          </div>
        </article>
      `;
    })
    .join("") || `<p class="empty-state">No itinerary items match this search.</p>`;
}

function renderDocuments() {
  const trip = getActiveTrip();
  const documents = trip.documents.filter(([name, status]) => matchesSearch(`${name} ${status}`));
  $("#documents").innerHTML = documents
    .map(([name, status]) => {
      return `
        <div class="doc-row">
          <strong>${name}</strong>
          <span>${status}</span>
        </div>
      `;
    })
    .join("") || `<p class="empty-state">No documents match this search.</p>`;
}

function renderIntegrations() {
  const active = integrations.filter((integration) => integration.connected).length;
  const filteredIntegrations = integrations.filter((integration) => matchesSearch(`${integration.name} ${integration.label} ${integration.description}`));
  $("#integrationCount").textContent = `${active} active`;
  $("#integrationList").innerHTML = filteredIntegrations
    .map((integration) => {
      const connectedClass = integration.connected ? " connected" : "";
      const initials = integration.name.split(" ").map((part) => part[0]).join("").slice(0, 2);
      const toggleText = integration.connected ? "Connected" : "Connect";
      return `
        <article class="integration-card${connectedClass}">
          <div class="integration-logo" aria-hidden="true">${initials}</div>
          <div class="integration-copy">
            <div>
              <strong>${integration.name}</strong>
              <span>${integration.label}</span>
            </div>
            <p>${integration.description}</p>
            <div class="integration-actions">
              <button class="connection-toggle" data-integration-toggle="${integration.id}">${toggleText}</button>
              <button class="ghost-mini" data-integration-action="${integration.id}">${integration.action}</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("") || `<p class="empty-state">No integrations match this search.</p>`;
}

function renderDestinationDiscovery() {
  const trip = getActiveTrip();
  const place = activeDiscoveryPlace || trip.destination;
  $("#destinationSearchInput").value = activeDiscoveryPlace;
  $("#destinationDiscoveryCount").textContent = `${discoveryCategories.length} ideas`;
  $("#destinationChipRow").innerHTML = discoverySuggestions
    .map((country) => `<button class="destination-chip" data-discovery-place="${country}">${country}</button>`)
    .join("");
  $("#destinationResults").innerHTML = discoveryCategories
    .map((category) => {
      const query = category.query(place);
      const searchUrl = googleSearchUrl(query);
      const mapsUrl = googleMapsSearchUrl(query);
      return `
        <article class="destination-card">
          <div>
            <strong>${category.label}</strong>
            <span>${query}</span>
          </div>
          <div class="destination-actions">
            <a class="ghost-mini" href="${searchUrl}" target="_blank" rel="noreferrer">Google</a>
            <a class="ghost-mini" href="${mapsUrl}" target="_blank" rel="noreferrer">Maps</a>
            <button class="connection-toggle" data-discovery-add="${category.id}">Add</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderBuilderApps() {
  const filteredApps = builderApps.filter((app) => {
    const matchesCategory = activeBuilderCategory === "all" || app.category === activeBuilderCategory;
    const searchText = `${app.name} ${app.partner} ${app.category} ${app.description}`.toLowerCase();
    return matchesCategory && searchText.includes(activeBuilderSearch.toLowerCase()) && matchesSearch(searchText);
  });

  $("#builderCount").textContent = `${builderApps.length} apps`;
  $("#builderSupportedCount").textContent = `${filteredApps.length} ready`;
  $("#builderAppList").innerHTML = filteredApps
    .map((app) => {
      const index = builderApps.indexOf(app);
      return `
        <article class="builder-app-card">
          <div class="builder-app-top">
            <div>
              <strong>${app.name}</strong>
              <span>${app.partner} - ${app.category}</span>
            </div>
            <span class="app-status">${app.status}</span>
          </div>
          <p>${app.description}</p>
          <div class="builder-app-actions">
            <a class="ghost-mini" href="${app.url(getActiveTrip())}" target="_blank" rel="noreferrer">Open</a>
            <button class="connection-toggle" data-builder-add="${index}">Add to trip</button>
          </div>
        </article>
      `;
    })
    .join("") || `<p class="empty-state">No trip builder apps match this search.</p>`;
}

function renderBookingSites() {
  const filteredSites = bookingSites.filter((site) => {
    const matchesCategory = activeSiteCategory === "all" || site.category === activeSiteCategory;
    const searchText = `${site.name} ${site.category}`.toLowerCase();
    return matchesCategory && searchText.includes(activeSiteSearch.toLowerCase()) && matchesSearch(searchText);
  });
  const connected = bookingSites.filter((site) => site.connected).length;

  $("#connectedCount").textContent = `${connected} connected`;
  $("#supportedCount").textContent = `${bookingSites.length} supported`;
  $("#bookingList").innerHTML = filteredSites
    .map((site, index) => {
      const sourceIndex = bookingSites.indexOf(site);
      const connectedClass = site.connected ? " connected" : "";
      const buttonLabel = site.connected ? "Connected" : "Connect";
      return `
        <article class="booking-site${connectedClass}">
          <div class="booking-logo" aria-hidden="true">${site.name.slice(0, 2).toUpperCase()}</div>
          <div class="booking-copy">
            <strong>${site.name}</strong>
            <span>${site.category} confirmation parser</span>
          </div>
          <button class="connection-toggle" data-site-index="${sourceIndex}">${buttonLabel}</button>
          <button class="icon-button small sample-button" data-sample-index="${sourceIndex}" aria-label="Load ${site.name} sample">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </article>
      `;
    })
    .join("") || `<p class="empty-state">No booking sites match this search.</p>`;
}

function renderSearchSummary() {
  const trip = getActiveTrip();
  const query = activeGlobalSearch;
  const counts = {
    trips: trips.filter((item) => matchesSearch(tripSearchText(item), query)).length,
    plans: trip.items.filter((item) => matchesSearch(itemSearchText(item), query)).length,
    docs: trip.documents.filter(([name, status]) => matchesSearch(`${name} ${status}`, query)).length,
    apps: builderApps.filter((app) => matchesSearch(`${app.name} ${app.partner} ${app.category} ${app.description}`, query)).length,
    booking: bookingSites.filter((site) => matchesSearch(`${site.name} ${site.category}`, query)).length
  };
  $("#searchSummaryTitle").textContent = query ? `Searching "${query}"` : "Everything connected";
  $("#searchCounts").innerHTML = Object.entries(counts)
    .map(([label, count]) => `<span>${count} ${label}</span>`)
    .join("");
  $("#clearSearchButton").style.visibility = query ? "visible" : "hidden";
}

function renderInvestorMetrics() {
  const trip = getActiveTrip();
  const totalSpend = trip.items.reduce((sum, item) => sum + item.price, 0);
  const connectedSuppliers = bookingSites.filter((site) => site.connected).length;
  const activeIntegrations = integrations.filter((integration) => integration.connected).length;
  const metrics = [
    ["Trips modeled", trips.length],
    ["Plans organized", trip.items.length],
    ["Suppliers ready", bookingSites.length],
    ["Connected tools", activeIntegrations + connectedSuppliers],
    ["Docs tracked", trip.documents.length],
    ["Demo GMV", formatMoney.format(totalSpend)]
  ];

  $("#investorMetrics").innerHTML = metrics
    .map(([label, value]) => `
      <article class="metric-card">
        <strong>${value}</strong>
        <span>${label}</span>
      </article>
    `)
    .join("");
}

function renderManagementRecovery() {
  const trip = getActiveTrip();
  const archives = deletedPlans[trip.id] || [];
  const totalItems = archives.reduce((sum, archive) => sum + archive.items.length, 0);
  $("#recoveryCount").textContent = `${totalItems} archived`;
  $("#managerLock").style.display = managerUnlocked ? "none" : "grid";
  if (!managerUnlocked) {
    $("#recoveryList").innerHTML = `<p class="empty-state">Management access required to restore cleared trip plans.</p>`;
    return;
  }
  $("#recoveryList").innerHTML = archives
    .map((archive, index) => `
      <article class="recovery-card">
        <div>
          <strong>${archive.items.length} timeline items</strong>
          <span>Cleared ${formatArchiveTime(archive.clearedAt)}</span>
        </div>
        <button class="connection-toggle" data-restore-archive="${index}">Restore</button>
      </article>
    `)
    .join("") || `<p class="empty-state">No archived plans for this trip.</p>`;
}

function formatDateShort(value) {
  return formatDate.format(new Date(`${value}T12:00:00`));
}

function formatDateRange(start, end) {
  return `${formatDateShort(start)}-${formatDateShort(end)}, ${new Date(`${end}T12:00:00`).getFullYear()}`;
}

function render() {
  renderTrips();
  renderOverview();
  renderTimeline();
  renderDocuments();
  renderIntegrations();
  renderDestinationDiscovery();
  renderBuilderApps();
  renderBookingSites();
  renderSearchSummary();
  renderInvestorMetrics();
  renderManagementRecovery();
}

function setDatabaseStatus(status) {
  $("#databaseStatus").textContent = status;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open("wayline-travel-db", 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("state")) {
        database.createObjectStore("state", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readState() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("state", "readonly");
    const store = transaction.objectStore("state");
    const request = store.get("app");
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function writeState() {
  if (!dbReady) return Promise.resolve();
  const state = {
    id: "app",
    version: 1,
    savedAt: new Date().toISOString(),
    activeTripId,
    activeGlobalSearch,
    trips,
    deletedPlans,
    bookingConnections: bookingSites.map(({ name, connected }) => ({ name, connected })),
    integrations: integrations.map(({ id, connected }) => ({ id, connected }))
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("state", "readwrite");
    const store = transaction.objectStore("state");
    const request = store.put(state);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function buildSharePayload() {
  const trip = getActiveTrip();
  return {
    type: "wayline-trip-share",
    version: 1,
    exportedAt: new Date().toISOString(),
    trip,
    deletedPlans: deletedPlans[trip.id] || []
  };
}

function encodeSharePayload(payload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeSharePayload(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function getShareLink() {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#share=${encodeSharePayload(buildSharePayload())}`;
}

function openShareDialog() {
  const link = getShareLink();
  const trip = getActiveTrip();
  $("#shareLinkInput").value = link;
  $("#shareLinkInput").setAttribute("value", link);
  $("#emailShareLink").href = `mailto:?subject=${encodeURIComponent(`Almidy trip: ${trip.name}`)}&body=${encodeURIComponent(link)}`;
  $("#shareDialog").showModal();
}

function exportTripFile() {
  const trip = getActiveTrip();
  const blob = new Blob([JSON.stringify(buildSharePayload(), null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${trip.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.wayline-trip.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function importSharedTripFromHash() {
  const match = window.location.hash.match(/^#share=(.+)$/);
  if (!match) return false;
  try {
    const payload = decodeSharePayload(match[1]);
    if (payload.type !== "wayline-trip-share" || !payload.trip) return false;
    const sharedTrip = {
      ...payload.trip,
      id: `${payload.trip.id || "shared"}-${Date.now()}`,
      name: `${payload.trip.name} (Shared)`
    };
    trips.unshift(sharedTrip);
    activeTripId = sharedTrip.id;
    if (Array.isArray(payload.deletedPlans) && payload.deletedPlans.length) {
      deletedPlans[sharedTrip.id] = payload.deletedPlans;
    }
    history.replaceState(null, "", window.location.pathname);
    return true;
  } catch (error) {
    return false;
  }
}

function applyStoredState(state) {
  if (!state) return;
  if (Array.isArray(state.trips) && state.trips.length) {
    trips = state.trips;
  }
  if (state.activeTripId && trips.some((trip) => trip.id === state.activeTripId)) {
    activeTripId = state.activeTripId;
  }
  if (Array.isArray(state.bookingConnections)) {
    state.bookingConnections.forEach((stored) => {
      const site = bookingSites.find((item) => item.name === stored.name);
      if (site) site.connected = Boolean(stored.connected);
    });
  }
  if (Array.isArray(state.integrations)) {
    state.integrations.forEach((stored) => {
      const integration = integrations.find((item) => item.id === stored.id);
      if (integration) integration.connected = Boolean(stored.connected);
    });
  }
  if (typeof state.activeGlobalSearch === "string") {
    activeGlobalSearch = state.activeGlobalSearch;
    $("#globalSearch").value = activeGlobalSearch;
  }
  if (state.deletedPlans && typeof state.deletedPlans === "object") {
    deletedPlans = state.deletedPlans;
  }
}

async function initDatabase() {
  try {
    setDatabaseStatus("Opening");
    db = await openDatabase();
    applyStoredState(await readState());
    const importedSharedTrip = importSharedTripFromHash();
    dbReady = true;
    setDatabaseStatus(importedSharedTrip ? "Shared trip loaded" : "Saved");
    render();
    await saveAppState();
  } catch (error) {
    dbReady = false;
    importSharedTripFromHash();
    setDatabaseStatus("Browser only");
    render();
  }
}

function scheduleSave() {
  if (!dbReady) return;
  setDatabaseStatus("Saving");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveAppState, 250);
}

async function saveAppState() {
  if (!dbReady) return;
  try {
    await writeState();
    setDatabaseStatus("Saved");
  } catch (error) {
    setDatabaseStatus("Save failed");
  }
}

function planItem(type, title, detail, date, time, price) {
  return { type, title, detail, date, time, price };
}

function parseImportText(options = {}) {
  importPlanText($("#importText").value, options);
}

function importPlanText(sourceText, options = {}) {
  const text = sourceText.trim();
  if (!text) return;

  const trip = getActiveTrip();
  const sentences = text.split(/[.\n]+/).map((part) => part.trim()).filter(Boolean);
  const additions = sentences.map((sentence) => {
    const lower = sentence.toLowerCase();
    const vendor = bookingSites.find((site) => lower.includes(site.name.toLowerCase()));
    const type = vendor ? vendor.type : lower.includes("flight") ? "flight" : lower.includes("hotel") || lower.includes("airbnb") ? "stay" : lower.includes("ride") || lower.includes("rental car") || lower.includes("train") ? "ground" : "activity";
    const dateMatch = sentence.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2}/i);
    const timeMatch = sentence.match(/\d{1,2}:\d{2}\s?(am|pm)/i);
    const confirmationMatch = sentence.match(/confirmation\s+([a-z0-9-]+)/i);
    return {
      type,
      title: extractPlanTitle(sentence, type, options.ai).slice(0, 70),
      detail: buildImportDetail(vendor, confirmationMatch, options.ai),
      date: dateMatch ? inferDate(dateMatch[0], trip.start) : trip.start,
      time: timeMatch ? timeMatch[0].toUpperCase() : "9:00 AM",
      price: 0
    };
  });

  trip.items = [...trip.items, ...additions].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  render();
  scheduleSave();
}

async function readTripFile(file) {
  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "pptx") {
    return readPptxText(file);
  }
  const text = await file.text();
  if (extension === "json") {
    return readJsonTripText(text);
  }
  if (extension === "ics") {
    return readCalendarText(text);
  }
  if (extension === "html" || extension === "htm") {
    return stripHtml(text);
  }
  return text;
}

function readJsonTripText(text) {
  try {
    const value = JSON.parse(text);
    return flattenJson(value).join("\n");
  } catch (error) {
    return text;
  }
}

function flattenJson(value) {
  if (Array.isArray(value)) return value.flatMap(flattenJson);
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) => {
      if (entry && typeof entry === "object") return flattenJson(entry);
      return `${key}: ${entry}`;
    });
  }
  return [String(value)];
}

function readCalendarText(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => /^(SUMMARY|DESCRIPTION|LOCATION|DTSTART|DTEND)/.test(line))
    .map((line) => line.replace(/^[A-Z;=0-9-]+:/, "").replace(/\\n/g, " "))
    .join("\n");
}

function stripHtml(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function readPptxText(file) {
  const buffer = await file.arrayBuffer();
  const entries = parseZipEntries(buffer).filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name));
  if (!entries.length) {
    throw new Error("No PowerPoint slides were found.");
  }
  const slideTexts = [];
  for (const entry of entries) {
    const xml = await unzipEntryText(buffer, entry);
    slideTexts.push(extractSlideText(xml));
  }
  return slideTexts.filter(Boolean).join("\n");
}

function parseZipEntries(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;
  for (let index = bytes.length - 22; index >= 0; index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      eocd = index;
      break;
    }
  }
  if (eocd < 0) throw new Error("PowerPoint file could not be read.");
  const totalEntries = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries = [];
  for (let index = 0; index < totalEntries; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameBytes = bytes.slice(offset + 46, offset + 46 + fileNameLength);
    const name = new TextDecoder().decode(nameBytes);
    entries.push({ name, compression, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

async function unzipEntryText(buffer, entry) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const header = entry.localHeaderOffset;
  const fileNameLength = view.getUint16(header + 26, true);
  const extraLength = view.getUint16(header + 28, true);
  const dataStart = header + 30 + fileNameLength + extraLength;
  const compressed = bytes.slice(dataStart, dataStart + entry.compressedSize);
  if (entry.compression === 0) {
    return new TextDecoder().decode(compressed);
  }
  if (entry.compression !== 8 || !("DecompressionStream" in window)) {
    throw new Error("This browser cannot decompress this PowerPoint file.");
  }
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const decompressed = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(decompressed);
}

function extractSlideText(xml) {
  return [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((match) => decodeXml(match[1]))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function setFileReaderStatus(status) {
  $("#fileReaderStatus").textContent = status;
}

function extractPlanTitle(sentence, type, aiMode = false) {
  if (!aiMode) return sentence.replace(/\s+on\s+.*/i, "");
  const clean = sentence.replace(/\s+confirmation\s+[a-z0-9-]+/i, "").trim();
  const patterns = {
    flight: /flight\s+([a-z0-9 ]+?)\s+from\s+([a-z]{3})\s+to\s+([a-z]{3})/i,
    stay: /(hotel|airbnb|booking\.com hotel)\s+(.+?)\s+from\s+/i,
    ground: /(ride with|rental car|amtrak train)\s+(.+?)\s+(from|at|on)\s+/i,
    activity: /(dinner at|reservation at|tour|ticket)\s+(.+?)\s+(on\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i
  };
  const match = clean.match(patterns[type]);
  if (!match) return clean.replace(/\s+on\s+.*/i, "");
  if (type === "flight") return `Flight ${match[1].trim().toUpperCase()} ${match[2].toUpperCase()} to ${match[3].toUpperCase()}`;
  if (type === "stay") return match[2].trim();
  return match[2].trim();
}

function buildImportDetail(vendor, confirmationMatch, aiMode = false) {
  const source = vendor ? `${vendor.name} confirmation` : "pasted confirmation";
  const prefix = aiMode ? "OpenAI draft extraction from" : "Imported from";
  const confirmation = confirmationMatch ? `, ${confirmationMatch[1].toUpperCase()}` : "";
  return `${prefix} ${source}${confirmation}`;
}

function inferDate(text, fallback) {
  const year = new Date(`${fallback}T12:00:00`).getFullYear();
  const parsed = new Date(`${text} ${year} 12:00:00`);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString().slice(0, 10);
}

function googleMapsSearchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function googleSearchUrl(query) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function googleMapsDirectionsUrl(destination) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function googleCalendarUrl(item) {
  const start = calendarDateTime(item.date, item.time);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const dates = `${formatCalendarDate(start)}/${formatCalendarDate(end)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates,
    details: item.detail,
    location: item.detail
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function calendarDateTime(date, time) {
  const match = time.match(/(\d{1,2})(?::(\d{2}))?\s?(AM|PM)/i);
  const parsed = new Date(`${date}T12:00:00`);
  if (!match) return parsed;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours < 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  parsed.setHours(hours, minutes, 0, 0);
  return parsed;
}

function formatCalendarDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

function formatArchiveTime(value) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function clearCurrentTimeline() {
  const trip = getActiveTrip();
  if (!trip.items.length) return;
  const archive = {
    id: `archive-${Date.now()}`,
    clearedAt: new Date().toISOString(),
    items: trip.items
  };
  deletedPlans[trip.id] = [archive, ...(deletedPlans[trip.id] || [])];
  trip.items = [];
  render();
  scheduleSave();
}

function restoreTimelineArchive(index) {
  const trip = getActiveTrip();
  const archives = deletedPlans[trip.id] || [];
  const archive = archives[index];
  if (!archive) return;
  trip.items = [...trip.items, ...archive.items].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  archives.splice(index, 1);
  deletedPlans[trip.id] = archives;
  render();
  scheduleSave();
}

function getTrackingMeta(item, trip) {
  const zone = inferItemTimeZone(item, trip);
  const scheduled = calendarDateTime(item.date, item.time);
  const now = new Date();
  const minutesUntil = Math.round((scheduled.getTime() - now.getTime()) / 60000);
  let status = "Scheduled";
  let statusClass = "is-scheduled";
  if (minutesUntil < -120) {
    status = item.type === "stay" ? "In stay window" : "Completed";
    statusClass = "is-complete";
  } else if (minutesUntil < 0) {
    status = "In progress";
    statusClass = "is-live";
  } else if (minutesUntil <= 180) {
    status = "Coming up";
    statusClass = "is-soon";
  }

  return {
    zone,
    status,
    statusClass,
    location: inferItemLocation(item, trip),
    localTime: `${formatDateShort(item.date)} at ${item.time}`,
    timeZoneLabel: formatZoneLabel(zone, scheduled)
  };
}

function inferItemTimeZone(item, trip) {
  const text = `${item.title} ${item.detail} ${trip.destination}`.toLowerCase();
  const airportMatch = `${item.title} ${item.detail}`.match(/\b[A-Z]{3}\b/g);
  if (airportMatch) {
    const lastAirport = airportMatch[airportMatch.length - 1];
    if (timeZoneByCode[lastAirport]) return timeZoneByCode[lastAirport];
  }
  const placeMatch = Object.entries(timeZoneByPlace).find(([place]) => text.includes(place));
  return placeMatch ? placeMatch[1] : Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function inferItemLocation(item, trip) {
  const detail = item.detail || trip.destination;
  if (item.type === "flight") {
    const route = `${item.title} ${detail}`.match(/\b[A-Z]{3}\b/g);
    if (route && route.length >= 2) return `${route[0]} -> ${route[route.length - 1]}`;
  }
  if (item.type === "ground") return detail;
  if (item.type === "stay") return detail;
  return detail.includes("Imported") ? trip.destination : detail;
}

function formatZoneLabel(zone, date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "short",
    hour: "numeric",
    minute: "2-digit"
  });
  const parts = formatter.formatToParts(new Date());
  const zoneName = parts.find((part) => part.type === "timeZoneName")?.value || zone;
  const localHour = formatter.format(new Date()).replace(zoneName, "").trim();
  return `Now ${localHour} ${zoneName}`;
}

function formatClock(date) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date);
}

function getTrackingLinks(item, trip, meta) {
  const links = [{ label: "Maps", url: googleMapsSearchUrl(meta.location || item.detail || trip.destination) }];
  if (item.type === "flight") {
    const flight = extractFlightNumber(item);
    const airline = flight?.match(/^[A-Z0-9]+/)?.[0];
    if (flight && airlineTrackingUrls[airline]) {
      links.unshift({ label: "Airline", url: airlineTrackingUrls[airline](flight) });
    } else if (flight) {
      links.unshift({ label: "Flight", url: googleSearchUrl(`${flight} flight status`) });
    }
  }
  if (item.type === "ground") {
    const rentalCompany = Object.keys(rentalTrackingUrls).find((company) => `${item.title} ${item.detail}`.toLowerCase().includes(company.toLowerCase()));
    if (rentalCompany) {
      links.unshift({ label: "Rental", url: rentalTrackingUrls[rentalCompany] });
    } else {
      links.unshift({ label: "Route", url: googleMapsDirectionsUrl(meta.location || trip.destination) });
    }
  }
  if (item.type === "stay") {
    links.unshift({ label: "Hotel", url: googleSearchUrl(`${item.title} ${trip.destination} reservation`) });
  }
  return links;
}

function extractFlightNumber(item) {
  const text = `${item.title} ${item.detail}`;
  const match = text.match(/\b([A-Z]{2}|B6|TAP)\s?\d{2,4}\b/i);
  return match ? match[0].toUpperCase().replace(/^([A-Z]+)(\d)/, "$1 $2") : null;
}

$("#tripList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-trip-id]");
  if (!button) return;
  activeTripId = button.dataset.tripId;
  activeFilter = "all";
  document.querySelectorAll(".segmented button").forEach((item) => item.classList.toggle("active", item.dataset.filter === "all"));
  render();
  scheduleSave();
});

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".segmented button").forEach((item) => item.classList.toggle("active", item === button));
    render();
  });
});

$("#clearTimelineButton").addEventListener("click", clearCurrentTimeline);

$("#unlockManagerButton").addEventListener("click", () => {
  managerUnlocked = $("#managerCodeInput").value.trim() === "2468";
  $("#managerCodeInput").value = "";
  renderManagementRecovery();
});

$("#recoveryList").addEventListener("click", (event) => {
  const restoreButton = event.target.closest("[data-restore-archive]");
  if (!restoreButton || !managerUnlocked) return;
  restoreTimelineArchive(Number(restoreButton.dataset.restoreArchive));
});

$("#parseButton").addEventListener("click", parseImportText);

$("#tripFileInput").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  setFileReaderStatus("Reading");
  try {
    const text = await readTripFile(file);
    $("#filePreviewText").value = text;
    $("#importText").value = text;
    setFileReaderStatus(file.name.endsWith(".pptx") ? "Slides read" : "File read");
  } catch (error) {
    $("#filePreviewText").value = "";
    setFileReaderStatus("Read failed");
  }
});

$("#importFileButton").addEventListener("click", () => {
  const text = $("#filePreviewText").value.trim();
  if (!text) return;
  importPlanText(text, { ai: true });
  setFileReaderStatus("Imported");
});

$("#sendFileToSmartImportButton").addEventListener("click", () => {
  const text = $("#filePreviewText").value.trim();
  if (!text) return;
  $("#importText").value = text;
  $("#importText").focus();
  setFileReaderStatus("Staged");
});

$("#aiParseButton").addEventListener("click", () => {
  integrations.find((integration) => integration.id === "openai").connected = true;
  parseImportText({ ai: true });
  scheduleSave();
});

$("#integrationList").addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-integration-toggle]");
  const action = event.target.closest("[data-integration-action]");

  if (toggle) {
    const integration = integrations.find((item) => item.id === toggle.dataset.integrationToggle);
    integration.connected = !integration.connected;
    renderIntegrations();
    scheduleSave();
  }

  if (action) {
    runIntegrationAction(action.dataset.integrationAction);
  }
});

$("#destinationSearchButton").addEventListener("click", () => {
  activeDiscoveryPlace = $("#destinationSearchInput").value.trim() || getActiveTrip().destination;
  renderDestinationDiscovery();
});

$("#destinationSearchInput").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  activeDiscoveryPlace = event.target.value.trim() || getActiveTrip().destination;
  renderDestinationDiscovery();
});

$("#destinationChipRow").addEventListener("click", (event) => {
  const chip = event.target.closest("[data-discovery-place]");
  if (!chip) return;
  activeDiscoveryPlace = chip.dataset.discoveryPlace;
  renderDestinationDiscovery();
});

$("#destinationResults").addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-discovery-add]");
  if (!addButton) return;
  addDiscoveryToTrip(addButton.dataset.discoveryAdd);
});

function runIntegrationAction(id) {
  const trip = getActiveTrip();
  if (id === "maps") {
    window.open(googleMapsSearchUrl(trip.destination), "_blank", "noreferrer");
  }
  if (id === "google") {
    integrations.find((integration) => integration.id === "google").connected = true;
    $("#importText").value = [
      "Flight UA 1129 from EWR to ORD on Apr 30 at 7:45 AM. Confirmation UA1129.",
      "Hotel Hilton Chicago from Apr 30 to May 2. Check-in at 4:00 PM. Confirmation HC8802.",
      "Dinner at Bestia May 15 7:30 PM via OpenTable. Reservation for 2."
    ].join("\\n");
    $("#importText").focus();
    renderIntegrations();
    scheduleSave();
  }
  if (id === "openai") {
    integrations.find((integration) => integration.id === "openai").connected = true;
    parseImportText({ ai: true });
    scheduleSave();
  }
}

function addBuilderAppToTrip(index) {
  const app = builderApps[index];
  const trip = getActiveTrip();
  if (app.item) {
    trip.items = [...trip.items, app.item(trip)].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  }
  if (app.document && !trip.documents.some(([name]) => name === app.document[0])) {
    trip.documents = [...trip.documents, app.document];
  }
  render();
  scheduleSave();
}

function addDiscoveryToTrip(categoryId) {
  const category = discoveryCategories.find((item) => item.id === categoryId);
  if (!category) return;
  const trip = getActiveTrip();
  const place = activeDiscoveryPlace || trip.destination;
  const query = category.query(place);
  trip.items = [
    ...trip.items,
    planItem(category.type, `${category.label} in ${place}`, `Research via Google: ${query}`, trip.start, "10:00 AM", 0)
  ].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  render();
  scheduleSave();
}

$("#builderAppList").addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-builder-add]");
  if (!addButton) return;
  addBuilderAppToTrip(Number(addButton.dataset.builderAdd));
});

$("#builderSearch").addEventListener("input", (event) => {
  activeBuilderSearch = event.target.value;
  render();
});

$("#builderCategory").addEventListener("change", (event) => {
  activeBuilderCategory = event.target.value;
  render();
});

$("#bookingList").addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-site-index]");
  const sample = event.target.closest("[data-sample-index]");

  if (toggle) {
    const site = bookingSites[Number(toggle.dataset.siteIndex)];
    site.connected = !site.connected;
    renderBookingSites();
    scheduleSave();
  }

  if (sample) {
    const site = bookingSites[Number(sample.dataset.sampleIndex)];
    $("#importText").value = site.sample;
    $("#importText").focus();
  }
});

$("#siteSearch").addEventListener("input", (event) => {
  activeSiteSearch = event.target.value;
  render();
});

$("#siteCategory").addEventListener("change", (event) => {
  activeSiteCategory = event.target.value;
  render();
});

$("#globalSearch").addEventListener("input", (event) => {
  activeGlobalSearch = event.target.value.trim();
  render();
  scheduleSave();
});

$("#clearSearchButton").addEventListener("click", () => {
  activeGlobalSearch = "";
  $("#globalSearch").value = "";
  render();
  scheduleSave();
});

$("#pitchModeButton").addEventListener("click", () => {
  document.body.classList.toggle("pitch-mode");
  $("#investorBoard").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#copyPitchButton").addEventListener("click", async () => {
  const trip = getActiveTrip();
  const pitch = [
    "Almidy Travel",
    "AI travel command center for modern trip planning.",
    "",
    "Problem: Travel planning is fragmented across email, booking sites, maps, calendars, documents, wallets, and spreadsheets.",
    "Solution: A searchable itinerary workspace that imports confirmations, connects trip-building apps, and persists every plan in a database.",
    `Current demo: ${trips.length} trips, ${trip.items.length} itinerary items, ${bookingSites.length} supplier parsers, ${builderApps.length} trip-building apps, ${trip.documents.length} tracked docs.`,
    "Business model: Consumer freemium, premium sync, shared trips, business workspaces, affiliate booking revenue, and operator APIs.",
    "Roadmap: Backend auth, Gmail sync, OpenAI API extraction, cloud Postgres, mobile app, and partner marketplace."
  ].join("\\n");
  await navigator.clipboard.writeText(pitch);
  $("#copyPitchButton").textContent = "Copied";
  window.setTimeout(() => {
    $("#copyPitchButton").innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h12v12H8z" /><path d="M4 16V4h12" /></svg>Copy one-pager';
  }, 1600);
});

$("#connectionsJumpButton").addEventListener("click", () => {
  $("#bookingConnections").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#integrationsJumpButton").addEventListener("click", () => {
  $("#integrationsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#builderJumpButton").addEventListener("click", () => {
  $("#builderAppsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#saveNowButton").addEventListener("click", saveAppState);

$("#importButton").addEventListener("click", () => {
  $("#importText").focus();
});

$("#shareButton").addEventListener("click", async () => {
  openShareDialog();
});

$("#copyShareLinkButton").addEventListener("click", async (event) => {
  event.preventDefault();
  await navigator.clipboard.writeText($("#shareLinkInput").value);
  $("#copyShareLinkButton").textContent = "Copied";
  window.setTimeout(() => {
    $("#copyShareLinkButton").innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h12v12H8z" /><path d="M4 16V4h12" /></svg>Copy link';
  }, 1400);
});

$("#nativeShareButton").addEventListener("click", async (event) => {
  event.preventDefault();
  const trip = getActiveTrip();
  const url = $("#shareLinkInput").value;
  if (navigator.share) {
    await navigator.share({ title: trip.name, text: "Open this Almidy trip itinerary.", url });
  } else {
    await navigator.clipboard.writeText(url);
  }
});

$("#exportTripButton").addEventListener("click", (event) => {
  event.preventDefault();
  exportTripFile();
});

$("#newTripButton").addEventListener("click", () => {
  $("#tripDialog").showModal();
});

$("#tripForm").addEventListener("submit", (event) => {
  const submitter = event.submitter;
  if (submitter && submitter.value === "cancel") return;

  const data = new FormData(event.currentTarget);
  const destination = data.get("destination").toString();
  const newTrip = {
    id: `${destination.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    name: data.get("name").toString(),
    destination,
    route: `Home to ${destination}`,
    start: data.get("start").toString(),
    end: data.get("end").toString(),
    status: "Planning",
    documents: [["Passport", "Needs review"]],
    items: [
      {
        type: "activity",
        title: "Start planning",
        detail: `Add flights, stays, and reservations for ${destination}`,
        date: data.get("start").toString(),
        time: "9:00 AM",
        price: 0
      }
    ]
  };

  trips.unshift(newTrip);
  activeTripId = newTrip.id;
  render();
  scheduleSave();
});

initDatabase();

window.setInterval(() => {
  renderOverview();
  renderTimeline();
  renderInvestorMetrics();
}, 60000);
