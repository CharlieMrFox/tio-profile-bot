// deploy-commands.js
// Run once (and again any time you change command definitions):
//   node deploy-commands.js
//
// If GUILD_ID is set in .env, commands register instantly to that one server
// (best for development). Without it, commands register globally, which can
// take up to an hour to show up everywhere — better for production.

import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';

const commands = [
  new SlashCommandBuilder()
    .setName('checkprofiles')
    .setDescription('Check a batch of names against Test IO tester profiles')
    .toJSON(),
];

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

async function main() {
  try {
    console.log(`Registering ${commands.length} slash command(s)...`);

    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    await rest.put(route, { body: commands });

    console.log(
      process.env.GUILD_ID
        ? 'Commands registered to guild — should appear immediately.'
        : 'Commands registered globally — may take up to 1 hour to propagate.'
    );
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

main();
