import ReactGA from "react-ga4";

const MEASUREMENT_ID = "G-799BV0VW3Z";

export const initAnalytics = () => {
  ReactGA.initialize(MEASUREMENT_ID);
};

export const logPageView = (screenName) => {
  ReactGA.send({ hitType: "pageview", page: screenName });
};

export const logEvent = (category, action, label) => {
  ReactGA.event({ category, action, label });
};
