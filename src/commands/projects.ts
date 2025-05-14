import {
  SlashCommandBuilder,
  CommandInteraction,
  EmbedBuilder,
} from "discord.js";
import fs from "fs";
import path from "path";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("projects")
    .setDescription("List all available projects"),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply();

    try {
      const projectsDir = path.join(__dirname, "..", "data", "projects");

      // Create directory if it doesn't exist
      if (!fs.existsSync(projectsDir)) {
        fs.mkdirSync(projectsDir, { recursive: true });
        return interaction.editReply("No projects have been created yet.");
      }

      // Read project directories
      const projects = fs
        .readdirSync(projectsDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      if (projects.length === 0) {
        return interaction.editReply("No projects have been created yet.");
      }

      // Create an embed to display the projects
      const embed = new EmbedBuilder()
        .setTitle("Available Projects")
        .setColor("#0099ff")
        .setDescription(
          "Here are the projects that I can answer questions about:"
        )
        .addFields(
          projects.map((project) => {
            // Get document types for each project
            const projectFiles = fs
              .readdirSync(path.join(projectsDir, project))
              .filter((file) => file.endsWith(".txt"))
              .map((file) => file.replace(".txt", ""))
              .join(", ");

            return {
              name: project,
              value: projectFiles
                ? `Available documentation: ${projectFiles}`
                : "No documentation yet",
            };
          })
        )
        .setTimestamp()
        .setFooter({
          text: "Use /ask with a project name to ask questions about a specific project",
        });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error listing projects:", error);
      return interaction.editReply(
        "There was an error listing the projects. Please try again later."
      );
    }
  },
};
