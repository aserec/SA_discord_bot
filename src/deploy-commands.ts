import { registerCommands } from "./utils/registerCommands";

registerCommands()
  .then(() => console.log("Commands registered successfully!"))
  .catch((error) => console.error("Error registering commands:", error));
