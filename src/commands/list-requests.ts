import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
} from "discord.js";
import { mockDb } from "../utils/mockDb";
import { populateMockDb } from "../utils/populateMockDb";
import { table, Alignment } from "table";

interface Request {
  project: string;
  technologies: string[];
  username: string;
  status: string;
  timestamp: Date;
}

// Get unique projects and technologies from the database
const getUniqueValues = async () => {
  const requests = await mockDb.collection("requests").find();
  const projects = new Set<string>();
  const technologies = new Set<string>();

  requests.forEach((request: Request) => {
    projects.add(request.project);
    request.technologies.forEach((tech: string) => technologies.add(tech));
  });

  return {
    projects: Array.from(projects),
    technologies: Array.from(technologies),
  };
};

// Format timestamp to a more readable format
const formatTimestamp = (date: Date): string => {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("list-requests")
    .setDescription("List all item requests")
    .addStringOption((option) =>
      option
        .setName("config")
        .setDescription(
          "Configuration option (e.g., 'repeat' to use last selections)"
        )
        .setRequired(false)
    ),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Populate the mock database with sample requests
      await populateMockDb();

      const configOption = interaction.options.get("config");
      const repeat = configOption?.value === "repeat";
      let selectedProject: string | null = null;
      let selectedTechnologies: string[] = [];

      // If repeat is true, try to get the last selections
      if (repeat) {
        const lastSelections = await mockDb
          .collection("lastSelections")
          .findOne({
            command: "list-requests",
          });
        if (lastSelections) {
          selectedProject = lastSelections.project;
          selectedTechnologies = lastSelections.technologies || [];
        }
      }

      // If not repeating or no last selections found, show the selection menus
      if (!selectedProject || selectedTechnologies.length === 0) {
        // Get unique values from the database
        const { projects, technologies } = await getUniqueValues();

        if (projects.length === 0 && technologies.length === 0) {
          return interaction.editReply("No requests have been made yet.");
        }

        // Create project selection menu
        const projectSelect = new StringSelectMenuBuilder()
          .setCustomId("project-select")
          .setPlaceholder("Select a project")
          .addOptions([
            { label: "All Projects", value: "all" },
            ...projects.map((project) => ({
              label: project,
              value: project,
            })),
          ]);

        // Create technology selection menu (multiselect)
        const techSelect = new StringSelectMenuBuilder()
          .setCustomId("tech-select")
          .setPlaceholder("Select technologies")
          .setMinValues(1)
          .setMaxValues(technologies.length)
          .addOptions([
            { label: "All Technologies", value: "all" },
            ...technologies.map((tech) => ({
              label: tech,
              value: tech,
            })),
          ]);

        const projectRow =
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            projectSelect
          );
        const techRow =
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            techSelect
          );

        // Send both selection menus
        const response = await interaction.editReply({
          content: "Please select a project and technologies:",
          components: [projectRow, techRow],
        });

        // Create collectors for both dropdowns
        const collector = response.createMessageComponentCollector({
          componentType: ComponentType.StringSelect,
          time: 60000,
        });

        collector.on("collect", async (i) => {
          if (i.user.id !== interaction.user.id) return;

          if (i.customId === "project-select") {
            selectedProject = i.values[0];
          } else if (i.customId === "tech-select") {
            selectedTechnologies = i.values;
          }

          await i.deferUpdate();

          // If both selections are made, stop the collector
          if (selectedProject && selectedTechnologies.length > 0) {
            collector.stop();
          }
        });

        // Wait for both selections
        await new Promise((resolve) => {
          collector.on("end", resolve);
        });

        if (!selectedProject || selectedTechnologies.length === 0) {
          return interaction.editReply({
            content: "Selection cancelled or timed out.",
            components: [],
          });
        }

        // Save the selections for future use
        await mockDb.collection("lastSelections").updateOne(
          { command: "list-requests" },
          {
            $set: {
              project: selectedProject,
              technologies: selectedTechnologies,
            },
          }
        );
      }

      // Build query based on selections
      const query: any = {};
      if (selectedProject !== "all") {
        query.project = selectedProject;
      }
      if (!selectedTechnologies.includes("all")) {
        query.technologies = { $in: selectedTechnologies };
      }

      // Get requests from mock database
      const requests = await mockDb.collection("requests").find(query);

      if (requests.length === 0) {
        return interaction.editReply({
          content: "No requests found matching your criteria.",
          components: [],
        });
      }

      // Create a single embed for all requests
      const embed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle("Item Requests")
        .setDescription(
          `Found ${requests.length} request(s)${
            selectedProject !== "all" ? ` for project "${selectedProject}"` : ""
          }${
            selectedTechnologies.length > 0 &&
            !selectedTechnologies.includes("all")
              ? ` with technologies "${selectedTechnologies.join(", ")}"`
              : ""
          }`
        );

      // Prepare table data
      const tableData = [
        ["Project", "Technologies", "Name", "Status", "Time"], // Header
        ...requests.map((request: Request) => [
          request.project,
          request.technologies.join(", "),
          request.username.split("#")[0],
          request.status,
          formatTimestamp(request.timestamp),
        ]),
      ];

      // Configure table options
      const tableConfig = {
        border: {
          topBody: "─",
          topJoin: "┬",
          topLeft: "┌",
          topRight: "┐",
          bottomBody: "─",
          bottomJoin: "┴",
          bottomLeft: "└",
          bottomRight: "┘",
          bodyLeft: "│",
          bodyRight: "│",
          bodyJoin: "│",
          joinBody: "─",
          joinLeft: "├",
          joinRight: "┤",
          joinJoin: "┼",
        },
        columns: {
          0: { alignment: "left" as Alignment },
          1: { alignment: "left" as Alignment },
          2: { alignment: "left" as Alignment },
          3: { alignment: "left" as Alignment },
          4: { alignment: "left" as Alignment },
        },
      };

      // Generate the table
      const tableOutput = table(tableData, tableConfig);

      // Split the table into chunks if it's too long
      const MAX_FIELD_LENGTH = 1000; // Discord's limit is 1024, leaving some margin
      const tableLines = tableOutput.split("\n");
      const chunks: string[] = [];
      let currentChunk: string[] = [];

      for (const line of tableLines) {
        if ((currentChunk.join("\n") + "\n" + line).length > MAX_FIELD_LENGTH) {
          chunks.push(currentChunk.join("\n"));
          currentChunk = [line];
        } else {
          currentChunk.push(line);
        }
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join("\n"));
      }

      // Add each chunk as a separate field
      chunks.forEach((chunk, index) => {
        embed.addFields({
          name: index === 0 ? "Requests" : "\u200B", // Use zero-width space for subsequent fields
          value: `\`\`\`\n${chunk}\n\`\`\``,
        });
      });

      // Send the embed
      await interaction.editReply({
        embeds: [embed],
        components: [],
      });
    } catch (error) {
      console.error("Error in list-requests command:", error);
      return interaction.editReply({
        content:
          "There was an error fetching the requests. Please try again later.",
        components: [],
      });
    }
  },
};
