export type TripCollaboratorView = {
  email: string | null;
  id: string;
  name: string;
  role: string;
  status: string;
};

export type TripSharingData = {
  collaborators: TripCollaboratorView[];
  error: string | null;
  tripId: string;
};
