// ==========================
// 🤖 BOT DISCORD + MYSQL (CommonJS)
// ==========================
require('dotenv').config(); // Carrega variáveis do .env

const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  PermissionFlagsBits 
} = require("discord.js");
const mysql = require("mysql2/promise");
const express = require("express");

// ==========================
// 🌐 CONFIGURAÇÃO EXPRESS
// ==========================
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Bot ativo!"));
app.listen(PORT, () => console.log(`🌍 Servidor web ativo na porta ${PORT}`));

// ==========================
// 🗄️ CONFIGURAÇÃO MYSQL
// ==========================
let pool;
async function initDB() {
  try {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      port: process.env.MYSQL_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
    });

    const [rows] = await pool.query("SELECT NOW() AS now");
    console.log("🗄️ Conectado ao MySQL com sucesso!");
    console.log("🕒 Hora atual:", rows[0].now);

    // ==============================
    // Atualizar tabela reactions automaticamente
    // ==============================
    await pool.query(`
      ALTER TABLE reactions
      ADD COLUMN IF NOT EXISTS guild_id VARCHAR(50) NOT NULL
    `);

    await pool.query(`
      ALTER TABLE reactions
      ADD UNIQUE KEY IF NOT EXISTS uniq_reaction (guild_id, message_id, emoji)
    `);

    console.log("✅ Tabela 'reactions' atualizada com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao conectar ou atualizar o MySQL:", err);
  }
}

// ==========================
// ⚙️ CONFIGURAÇÃO DISCORD
// ==========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ],
});

// ==========================
// 🧩 DEFINIÇÃO DOS COMANDOS
// ==========================
const commands = [
  new SlashCommandBuilder()
    .setName("setreaction")
    .setDescription("📌 Configura uma mensagem de regras e o cargo que será dado ao reagir")
    .addStringOption(option =>
      option.setName("mensagem_id")
        .setDescription("ID da mensagem para adicionar a reação")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("emoji")
        .setDescription("Emoji que concede o cargo")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName("cargo")
        .setDescription("Cargo a ser atribuído ao reagir")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setlogchannel")
    .setDescription("📝 Define o canal onde as logs serão enviadas")
    .addChannelOption(option =>
      option.setName("canal")
        .setDescription("Canal de logs")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("dbstatus")
    .setDescription("🧠 Mostra o estado da base de dados")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map(cmd => cmd.toJSON());

// ==========================
// 🚀 LOGIN E REGISTO DE COMANDOS GLOBAIS
// ==========================
client.once("ready", async () => {
  console.log(`✅ Bot online como ${client.user.tag}!`);
  await initDB();

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("⏳ Registrando comandos globais...");
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Comandos globais registrados com sucesso!");
  } catch (err) {
    console.error("❌ Erro ao registrar comandos globais:", err);
  }
});

// ==========================
// 🧠 EXECUÇÃO DOS COMANDOS
// ==========================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ Apenas administradores podem usar este comando!", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  // Comando: setreaction
  if (commandName === "setreaction") {
    const msgId = interaction.options.getString("mensagem_id");
    const emoji = interaction.options.getString("emoji");
    const role = interaction.options.getRole("cargo");

    try {
      await pool.query(
        `INSERT INTO reactions (guild_id, message_id, emoji, role_id) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE emoji = ?, role_id = ?`,
        [interaction.guildId, msgId, emoji, role.id, emoji, role.id]
      );

      await interaction.editReply(`✅ Reação configurada!\n**Mensagem ID:** \`${msgId}\`\n**Emoji:** ${emoji}\n**Cargo:** ${role.name}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao salvar a reação no banco.");
    }
  }

  // Comando: setlogchannel
  else if (commandName === "setlogchannel") {
    const canal = interaction.options.getChannel("canal");

    try {
      await pool.query(
        `INSERT INTO log_channels (guild_id, channel_id) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE channel_id = ?`,
        [interaction.guildId, canal.id, canal.id]
      );

      await interaction.editReply(`📝 Canal de logs definido: ${canal}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao salvar o canal de logs.");
    }
  }

  // Comando: dbstatus
  else if (commandName === "dbstatus") {
    try {
      const [rows] = await pool.query("SELECT NOW() AS now");
      await interaction.editReply(`✅ Conectado à DB! Hora atual: ${rows[0].now}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro na base de dados.");
    }
  }
});

// ==========================
// 🎯 EVENTO REACTION ROLE
// ==========================
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) await reaction.fetch();
  const guild = reaction.message.guild;
  if (!guild) return;

  try {
    const [rows] = await pool.query(
      "SELECT role_id FROM reactions WHERE guild_id = ? AND message_id = ? AND emoji = ?",
      [guild.id, reaction.message.id, reaction.emoji.name]
    );

    if (rows.length === 0) return;

    const roleId = rows[0].role_id;
    const member = await guild.members.fetch(user.id);
    if (member && roleId) {
      await member.roles.add(roleId);
    }

    // Log opcional
    const [logRows] = await pool.query("SELECT channel_id FROM log_channels WHERE guild_id = ?", [guild.id]);
    if (logRows.length > 0) {
      const logChannel = guild.channels.cache.get(logRows[0].channel_id);
      if (logChannel) {
        logChannel.send(`✅ ${user.tag} recebeu o cargo <@&${roleId}> ao reagir com ${reaction.emoji.name}`);
      }
    }
  } catch (err) {
    console.error("❌ Erro no reaction role:", err);
  }
});

// ==========================
// 🔑 LOGIN FINAL
// ==========================
if (!process.env.TOKEN) {
  console.error("❌ ERRO: TOKEN não encontrado!");
  process.exit(1);
}

client.login(process.env.TOKEN);
