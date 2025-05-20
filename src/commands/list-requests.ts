import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { mockDb } from "../utils/mockDb";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list-requests")
    .setDescription("List all item requests")
    .addStringOption((option) =>
      option
        .setName("filter")
        .setDescription("Filter requests by project or technology")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("Type of filter")
        .setRequired(false)
        .addChoices(
          { name: "Project", value: "project" },
          { name: "Technology", value: "technology" }
        )
    ),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const filterValue = interaction.options.get("filter")?.value as string;
      const filterType = interaction.options.get("type")?.value as string;

      // Build query based on filters
      const query: any = {};
      if (filterValue && filterType) {
        if (filterType === "project") {
          query.project = filterValue;
        } else if (filterType === "technology") {
          query.technologies = filterValue;
        }
      }

      // Get requests from mock database
      const requests = await mockDb.collection("requests").find(query);

      if (requests.length === 0) {
        return interaction.editReply(
          filterValue
            ? `No requests found${
                filterType ? ` for ${filterType} "${filterValue}"` : ""
              }.`
            : "No requests have been made yet."
        );
      }

      // Create an embed for each request
      const embeds = requests.map((request) => {
        return new EmbedBuilder()
          .setColor("#0099ff")
          .setTitle(`Request from ${request.username}`)
          .addFields(
            { name: "Project", value: request.project, inline: true },
            {
              name: "Technologies",
              value: request.technologies.join(", "),
              inline: true,
            },
            {
              name: "Status",
              value: request.status,
              inline: true,
            },
            {
              name: "Timestamp",
              value: request.timestamp.toLocaleString(),
              inline: false,
            }
          )
          .setFooter({ text: `Request ID: ${request.userId}` });
      });

      // Send the first embed
      await interaction.editReply({ embeds: [embeds[0]] });

      // If there are more embeds, send them as follow-up messages
      for (let i = 1; i < embeds.length; i++) {
        await interaction.followUp({ embeds: [embeds[i]], ephemeral: true });
      }

      // Add a summary message
      await interaction.followUp({
        content: `Found ${requests.length} request(s)${
          filterValue ? ` for ${filterType} "${filterValue}"` : ""
        }.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error in list-requests command:", error);
      return interaction.editReply(
        "There was an error fetching the requests. Please try again later."
      );
    }
  },
};
