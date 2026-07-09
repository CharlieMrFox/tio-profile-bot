// index.js
// Main bot entry point.
//
// Flow (mirrors the userscript):
//   1. User runs /checkprofiles
//   2. Bot opens a Modal with a multi-line text input (like your <textarea>)
//   3. User pastes names, one per line, and submits
//   4. Bot checks each name against tester.test.io in parallel
//   5. Bot replies with an embed: found first, then missing/timed-out

import {
  Client,
  GatewayIntentBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} from 'discord.js';
import 'dotenv/config';
import { checkProfile, checkProfiles } from './profileChecker.js';

const MAX_NAMES_PER_BATCH = 40; // keep replies within Discord embed limits & be a good API citizen

// Optional: channel to post a fallback message in if a new member's DMs are closed.
// Leave unset in .env to skip the fallback (message is just logged to console instead).
const FALLBACK_CHANNEL_ID = process.env.FALLBACK_CHANNEL_ID || null;

// Role granted automatically when a member's Test IO profile is found.
// Members who already have this role are skipped entirely (no re-check, no re-DM).
const VERIFIED_ROLE_ID = process.env.VERIFIED_ROLE_ID || null;

function buildGuidanceMessage(member) {
  return (
    `Hey ${member}! 👋 Welcome to the server.\n\n` +
    `I couldn't find a Test IO profile matching your Discord name **${member.user.username}**. ` +
    `If you're already a registered tester, no worries — this just means your Discord name doesn't ` +
    `match your Test IO profile name.\n\n` +
    `If you're new to Test IO, you can sign up here: https://tester.test.io\n\n` +
    `If you already have a profile, feel free to update your Discord nickname to match it, ` +
    `or just let @celine_tlgs or @sablina know and they'll sort it out.`
  );
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ── New member joins the server ─────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  try {
    // Skip entirely if they already hold the Verified Tester role
    // (covers rejoins where a roles-persistence setup kept their roles).
    if (VERIFIED_ROLE_ID && member.roles.cache.has(VERIFIED_ROLE_ID)) {
      console.log(`[join-check] ${member.displayName} already verified, skipping.`);
      return;
    }

    // displayName falls back to username if no nickname is set — matches
    // "their Discord display name / username" as the check target.
    const name = member.displayName;
    const result = await checkProfile(name);

    if (result.found) {
      console.log(`[join-check] ${name} → profile found.`);

      if (VERIFIED_ROLE_ID) {
        try {
          await member.roles.add(VERIFIED_ROLE_ID, 'Test IO profile verified automatically');
          console.log(`[join-check] Granted Verified Tester role to ${name}.`);
        } catch (roleErr) {
          // Common causes: bot's role isn't above "Verified Tester" in the role
          // list, or the bot lacks the Manage Roles permission.
          console.error(`[join-check] Could not grant role to ${name}:`, roleErr.message);
        }
      }

      return;
    }

    console.log(`[join-check] ${name} → no profile found, sending guidance.`);

    try {
      await member.send(buildGuidanceMessage(member));
    } catch (dmErr) {
      // Most common cause: the user has DMs from server members disabled.
      console.warn(`[join-check] Could not DM ${name} (DMs likely closed).`, dmErr.message);

      if (FALLBACK_CHANNEL_ID) {
        const channel = await client.channels.fetch(FALLBACK_CHANNEL_ID).catch(() => null);
        if (channel?.isTextBased()) {
          await channel.send(
            `${member} I couldn't DM you, but: I didn't find a Test IO profile matching your name (**${name}**). ` +
              `If that's unexpected, let a team member know!`
          );
        }
      }
    }
  } catch (err) {
    console.error('[join-check] Unexpected error while checking new member:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  // ── Step 1: slash command opens the modal ──────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'checkprofiles') {
    const modal = new ModalBuilder()
      .setCustomId('tio-batch-modal')
      .setTitle('Test IO Lookup');

    const namesInput = new TextInputBuilder()
      .setCustomId('tio-names-input')
      .setLabel('Names to check (one per line)')
      .setPlaceholder('e.g.\njohn_doe\nJane Smith\ntester.pro')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(namesInput));

    await interaction.showModal(modal);
    return;
  }

  // ── Step 2: modal submission runs the checks ────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'tio-batch-modal') {
    const raw = interaction.fields.getTextInputValue('tio-names-input');
    const names = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (names.length === 0) {
      await interaction.reply({ content: 'No names entered.', ephemeral: true });
      return;
    }

    const truncated = names.length > MAX_NAMES_PER_BATCH;
    const namesToCheck = truncated ? names.slice(0, MAX_NAMES_PER_BATCH) : names;

    // Defer since the batch of HEAD requests may take a moment
    await interaction.deferReply();

    const results = await checkProfiles(namesToCheck);
    const found = results.filter((r) => r.found);
    const missing = results.filter((r) => !r.found);

    const embed = new EmbedBuilder()
      .setTitle('🔍 Test IO Lookup')
      .setColor(missing.length === 0 ? 0x23a55a : 0x5865f2)
      .setDescription(
        `**${found.length} found** · **${missing.length} not found** · ${results.length} checked` +
          (truncated ? `\n⚠️ Only checked the first ${MAX_NAMES_PER_BATCH} of ${names.length} names.` : '')
      );

    if (found.length > 0) {
      embed.addFields({
        name: '✅ Found',
        value: found.map((r) => `[${r.name}](${r.url})`).join('\n').slice(0, 1024),
      });
    }

    if (missing.length > 0) {
      embed.addFields({
        name: '❌ Not found',
        value: missing
          .map((r) => (r.timedOut ? `${r.name} *(timed out)*` : r.name))
          .join('\n')
          .slice(0, 1024),
      });
    }

    await interaction.editReply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
