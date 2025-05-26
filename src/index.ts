import { Client, Events, GatewayIntentBits, Collection } from "discord.js";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { registerCommands } from "./utils/registerCommands";

// Load environment variables
config();

// Create Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Extend the Client interface to include commands
declare module "discord.js" {
  interface Client {
    commands: Collection<string, any>;
  }
}

// Initialize commands collection
client.commands = new Collection();

// Load command files
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.log(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
    );
  }
}

// Load event files
const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js") || file.endsWith(".ts"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

// Handle interaction creation
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing ${interaction.commandName}:`, error);

    // Check if the interaction is still valid
    if (interaction.replied || interaction.deferred) {
      try {
        await interaction.editReply({
          content: "There was an error while executing this command!",
          components: [],
        });
      } catch (e) {
        console.error("Error editing reply:", e);
      }
    } else {
      try {
        await interaction.reply({
          content: "There was an error while executing this command!",
          ephemeral: true,
          components: [],
        });
      } catch (e) {
        console.error("Error sending reply:", e);
      }
    }
  }
});

// Register slash commands when bot is ready
client.once(Events.ClientReady, async () => {
  console.log(`Logged in as ${client.user?.tag}!`);
  await registerCommands();
});

// Login to Discord with token
client.login(process.env.DISCORD_TOKEN);
