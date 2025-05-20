import {
  SlashCommandBuilder,
  CommandInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ComponentType,
} from "discord.js";
import { mockDb } from "../utils/mockDb";

// Mock function to get user's projects from tags
const getUserProjects = (userTags: string[]): string[] => {
  // This is a mock implementation. In reality, you would parse the user's roles/tags
  // to determine which projects they are part of
  return ["Project-A", "Project-B", "Project-C"].filter((project) =>
    userTags.some((tag) => tag.includes(project))
  );
};

// Mock function to get user's approved technologies from tags
const getUserTechnologies = (userTags: string[]): string[] => {
  // This is a mock implementation. In reality, you would parse the user's roles/tags
  // to determine which technologies they are approved for
  return ["Python", "JavaScript", "TypeScript", "React", "Node.js"].filter(
    (tech) => userTags.some((tag) => tag.includes(tech))
  );
};

// Function to save request to mock database
const saveRequest = async (request: any): Promise<boolean> => {
  try {
    await mockDb.collection("requests").insertOne(request);
    return true;
  } catch (error) {
    console.error("Error saving request:", error);
    return false;
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("request-items")
    .setDescription("Request items for a project"),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // Get user's roles/tags
      const member = interaction.guild?.members.cache.get(interaction.user.id);
      const userTags = member?.roles.cache.map((role) => role.name) || [];

      // Get user's projects and technologies
      const userProjects = getUserProjects(userTags);
      const userTechnologies = getUserTechnologies(userTags);

      if (userProjects.length === 0) {
        return interaction.editReply("You are not part of any projects.");
      }

      if (userTechnologies.length === 0) {
        return interaction.editReply(
          "You don't have any approved technologies."
        );
      }

      // Create project selection menu
      const projectSelect = new StringSelectMenuBuilder()
        .setCustomId("project-select")
        .setPlaceholder("Select a project")
        .addOptions(
          userProjects.map((project) => ({
            label: project,
            value: project,
          }))
        );

      const projectRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          projectSelect
        );

      // Send project selection menu
      const projectResponse = await interaction.editReply({
        content: "Please select a project:",
        components: [projectRow],
      });

      // Wait for project selection
      const projectCollector = projectResponse.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      let selectedProject: string | null = null;

      projectCollector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) return;
        selectedProject = i.values[0];
        await i.deferUpdate();
        projectCollector.stop(); // Stop the collector after receiving the selection
      });

      // Wait for project selection
      await new Promise((resolve) => {
        projectCollector.on("end", resolve);
      });

      if (!selectedProject) {
        return interaction.editReply("No project selected. Request cancelled.");
      }

      // Create technology selection menu
      const techSelect = new StringSelectMenuBuilder()
        .setCustomId("tech-select")
        .setPlaceholder("Select technologies")
        .setMinValues(1)
        .setMaxValues(userTechnologies.length)
        .addOptions(
          userTechnologies.map((tech) => ({
            label: tech,
            value: tech,
          }))
        );

      const techRow =
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          techSelect
        );

      // Send technology selection menu
      const techResponse = await interaction.editReply({
        content: "Please select technologies:",
        components: [techRow],
      });

      // Wait for technology selection
      const techCollector = techResponse.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        time: 60000,
      });

      let selectedTechnologies: string[] = [];

      techCollector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) return;
        selectedTechnologies = i.values;
        await i.deferUpdate();
        techCollector.stop(); // Stop the collector after receiving the selection
      });

      // Wait for technology selection
      await new Promise((resolve) => {
        techCollector.on("end", resolve);
      });

      if (selectedTechnologies.length === 0) {
        return interaction.editReply(
          "No technologies selected. Request cancelled."
        );
      }

      // Create request object
      const request = {
        userId: interaction.user.id,
        username: interaction.user.tag,
        project: selectedProject,
        technologies: selectedTechnologies,
        timestamp: new Date(),
        status: "pending",
      };

      // Save request
      const saved = await saveRequest(request);

      if (saved) {
        return interaction.editReply({
          content: `Request submitted successfully!\nProject: ${selectedProject}\nTechnologies: ${selectedTechnologies.join(
            ", "
          )}`,
          components: [],
        });
      } else {
        return interaction.editReply({
          content: "Failed to submit request. Please try again later.",
          components: [],
        });
      }
    } catch (error) {
      console.error("Error in request-items command:", error);
      return interaction.editReply({
        content:
          "There was an error processing your request. Please try again later.",
        components: [],
      });
    }
  },
};
