import { definePluginApp } from "@bb/plugin-sdk/app";
import { ComposerBeamBanner } from "./beam.js";
import "./app.css";

export default definePluginApp((app) => {
  app.composer.customize({
    id: "composer-beam",
    banners: [
      {
        id: "beam",
        chrome: "bare",
        component: ComposerBeamBanner,
      },
    ],
  });
});
