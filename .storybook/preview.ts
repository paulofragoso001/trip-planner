import type { Preview } from "@storybook/react";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    viewport: {
      viewports: {
        desktop: {
          name: "Desktop",
          styles: {
            width: "1440px",
            height: "900px"
          }
        },
        mobile: {
          name: "Mobile",
          styles: {
            width: "390px",
            height: "844px"
          }
        }
      }
    },
    a11y: {
      element: "#storybook-root",
      config: {},
      options: {}
    }
  }
};

export default preview;
