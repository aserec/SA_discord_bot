import { Events, Interaction } from "discord.js";
import { handleQueueButtonInteraction } from "../utils/updateQueueMessage";

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction: Interaction) {
    if (interaction.isButton()) {
      // Check if this is a queue button interaction
      if (
        interaction.customId === "complete-request" ||
        interaction.customId === "reject-request" ||
        interaction.customId === "delete-request"
      ) {
        await handleQueueButtonInteraction(interaction);
      }
    } else if (interaction.isStringSelectMenu()) {
      // Handle select menu interaction
      if (interaction.customId === "request-select") {
        await handleQueueButtonInteraction(interaction);
      }
    }
  },
};
