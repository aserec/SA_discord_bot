import { SlashCommandBuilder, CommandInteraction, User } from "discord.js";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("send")
    .setDescription("Send a message to a user regarding a project")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to send the message to")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("project")
        .setDescription("The project name")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The message to send")
        .setRequired(true)
    ),

  async execute(interaction: CommandInteraction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const targetUser = interaction.options.get("user")?.user as User;
      const project = interaction.options.get("project")?.value as string;
      const message = interaction.options.get("message")?.value as string;

      if (!targetUser) {
        return interaction.editReply("No user was specified.");
      }

      // Format the message
      const formattedMessage = `**Message regarding project ${project}**\n\n${message}\n\n*Sent by ${interaction.user.tag}*`;

      try {
        // Try to send a DM to the user
        await targetUser.send(formattedMessage);
        return interaction.editReply(
          `Message regarding project ${project} sent to ${targetUser.tag}.`
        );
      } catch (error) {
        console.error("Error sending DM:", error);
        return interaction.editReply(
          `I was unable to send a DM to ${targetUser.tag}. They might have DMs disabled.`
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      return interaction.editReply(
        "There was an error sending the message. Please try again later."
      );
    }
  },
};
