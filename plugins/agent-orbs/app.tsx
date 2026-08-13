import { definePluginApp } from "@bb/plugin-sdk/app";
import { mountAgentOrbs } from "./agent-orbs.js";
import "./app.css";

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "agent-orbs",
    mount: mountAgentOrbs,
  });
});
