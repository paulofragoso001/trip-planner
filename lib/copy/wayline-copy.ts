export const waylineCopy = {
  productPromise: "Turn saved travel ideas into mapped trip plans.",
  productDescription:
    "Paste travel notes, links, or screenshots. Almidy finds the places, builds your trip, maps your places, and suggests what to do nearby.",
  onboardingSteps: [
    { description: "Add one note, link, or screenshot.", label: "Add" },
    { description: "Approve the places that belong.", label: "Review" },
    { description: "Create the trip plan.", label: "Plan" }
  ],
  emptyStates: {
    aiReview: "Add an idea to start review.",
      map: "Add locations to build your map.",
    myTrips: "Create one manually or build one from inspiration.",
    savedInspiration: "Paste a note, link, or screenshot.",
      smartSuggestions: "Add a mapped place to get nearby ideas.",
    timeline: "Add a place to start this itinerary.",
    tripDrafts: "Approve places from AI Review to create a draft."
  },
  location: {
      activityIdea:
        "Unscheduled activity - add a meeting point or provider before it appears on your map.",
      needsLocation: "This place needs a confirmed location before it can appear on the map.",
    providerFailed: "Location matching is temporarily unavailable. Try again.",
    wrongCity:
      "Almidy found a place with this name, but it was outside your trip destination."
  },
  suggestions: {
    intro: "Nearby ideas based on this route.",
      noMappedStops: "Add a mapped place to get nearby ideas.",
    partialFailure: "Some suggestions could not be loaded. Showing what is available.",
    unavailable: "Suggestions are temporarily unavailable. Try again."
  }
} as const;
