import type { Meta, StoryObj } from "@storybook/react";
import { TripPreviewPage } from "@/components/trip-preview";
import { barcelonaTrip, emptyTrip, mobileTrip, printTrip } from "./tripPreview.fixtures";

const meta = {
  title: "Trip Preview/TripIt Style",
  component: TripPreviewPage
} satisfies Meta<typeof TripPreviewPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  args: barcelonaTrip,
  parameters: {
    viewport: { defaultViewport: "desktop" }
  }
};

export const Mobile: Story = {
  args: mobileTrip,
  parameters: {
    viewport: { defaultViewport: "mobile" }
  }
};

export const EmptyTripState: Story = {
  args: emptyTrip
};

export const MultiDayWithWeatherAndDirections: Story = {
  args: barcelonaTrip
};

export const PrintMode: Story = {
  args: printTrip,
  parameters: {
    docs: {
      description: {
        story: "Use the toolbar to hide maps and directions before print/export."
      }
    }
  }
};
