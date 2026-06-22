export const dashboardActionRoutes = {
  globe: {
    locateUserEvent: "wayline:home-use-current-location",
    mapModeRoute: "/dashboard/map",
    openMap: "/dashboard/map"
  },
  imports: {
    forwardReservation: "/dashboard/imports#reservation-forwarding",
    importSources: "/dashboard/imports",
    socialImportWorker: "/dashboard/imports#social-imports"
  },
  plan: {
    addIdea: "/dashboard/plan#saved-inspiration",
    promoteIdeas: "/dashboard/plan#ai-review",
    reviewPlaces: "/dashboard/plan#ai-review",
    sampleMiami: "/dashboard/plan?sample=miami#saved-inspiration"
  },
  settings: {
    about: "/dashboard/profile",
    account: "/dashboard/account",
    help: "/dashboard/account#help",
    membership: "/dashboard/account#membership",
    preferences: "/dashboard/account#preferences",
    privacy: "/privacy",
    sync: "/dashboard/account#sync",
    talkToUs: "mailto:support@wayline.app",
    terms: "/terms"
  },
  trips: {
    create: "/dashboard/trips?view=list#new-trip",
    list: "/dashboard/trips",
    map: "/dashboard/map",
    stats: "/dashboard/profile/stats"
  }
} as const;
