# SuperAnnotate Discord Bot

A Discord bot made in TypeScript that helps manage and consult a custom LLM to answer frequently asked questions, guidelines, and other documents related to different projects.


## Setup

1. **Clone the repository**
   ```
   git clone https://github.com/aserec/SA_discord_bot.git
   cd SA_discord_bot
   ```

2. **Install dependencies**
   ```
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory with the following content:
   ```
   # Discord Bot Token
   DISCORD_TOKEN=your_discord_token_here
   DISCORD_CLIENT_ID=your_client_id_here
   DISCORD_GUILD_ID=your_guild_id_here

   # OpenAI API Key
   OPENAI_API_KEY=your_openai_api_key_here

   # Node Environment
   NODE_ENV=development
   ```

4. **Register slash commands**
   ```
   npm run deploy
   ```

5. **Build the bot**
   ```
   npm run build
   ```

6. **Start the bot**
   ```
   npm start
   ```

   For development with hot reloading:
   ```
   npm run dev
   ```

## Usage

## Commands

### /setup-queue-monitor
Set up a queue monitor in a specified channel. This command:
- Lets you choose a channel for the monitor.
- Optionally filter requests by project name.
- Optionally show/hide reassignment requests.
- The bot creates a webhook in the channel, posts the current queue, and keeps it updated.
- Requires permissions to manage webhooks and send messages.

### /request-items
Request items (technologies) for a project. This command:
- Optionally, you can use the "repeat" config to reuse your last selections.
- If not repeating, you select a project and technologies from dropdowns (based on your roles).
- Confirms your selection before submitting.
- If you already have a request for the project, it updates it with new technologies.
- Otherwise, it creates a new request.

### /request-reassignment
Request reassignment of an item in a project. This command:
- You must specify the item number and project.
- Checks if you have access to the project.
- Confirms your request before submitting.
- Prevents duplicate reassignment requests for the same item/project/user.

## Project Structure

```
src/
├── commands/       # Slash commands
├── events/         # Discord event handlers
├── utils/          # Utility functions
├── data/           # Project documents
│   └── projects/   # Project-specific folders
└── index.ts        # Entry point
```

## Development

### Adding New Commands

1. Create a new file in the `src/commands` directory.
2. Export an object with `data` (SlashCommandBuilder) and `execute` (function) properties.
3. Run `npm run deploy` to register the new commands with Discord.
4. The command will be automatically loaded when the bot starts.