import canonicalTokens from "../../design-system/almidy.tokens.json";

export type AlmidyTokenContract = {
  colors: {
    "brand-gold": string;
    "brand-gold-deep": string;
    "brand-gold-text": string;
    "bg-light": string;
    "bg-light-mist": string;
    "text-primary": string;
    "text-secondary": string;
    "border-subtle": string;
  };
  spacing: {
    "card-padding": string;
    "element-gap": string;
    "content-inset": string;
  };
  radius: {
    card: string;
    control: string;
  };
};

export const almidyTokens: AlmidyTokenContract = canonicalTokens;

export default almidyTokens;
