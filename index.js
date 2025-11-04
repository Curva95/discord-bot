const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require("discord.js");
const express = require("express");
const mysql = require("mysql2/promise");

// === CONFIGURAÇÃO MYSQL (RAILWAY INTERNA) ===
let pool;
(async () => {
  try {
    const mysqlUrl = process.env.MYSQL_URL;
    if (!mysqlUrl) throw new Error("MYSQL_URL não encontrada!");

    pool = await mysql.createPool(mysqlUrl + "?connectionLimit=10");
    const [rows] = await pool.query("SELECT NOW() AS now");
    console.log("🗄️ Conectado ao MySQL com sucesso!");
    console.log("🕒 Hora atual:", rows[0].now);
  } catch (err) {
    console.error("❌ Erro ao conectar ao MySQL:", err);
  }
})();

// === CONFIGURAÇÃO DO BOT ===
if (!process.env.TOKEN) {
  console.error("ERRO: TOKEN não encontrado! Configure a variável de ambiente TOKEN.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// === EVENTO DE INICIALIZAÇÃO ===
client.once("clientReady", () => {
  console.log(`✅ Bot online como ${client.user.tag}!`);
});

// === COMANDO: !oi ===
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!oi") {
    return message.reply("Olá! Eu estou online 😎");
  }

  // === COMANDO: !dbstatus ===
  if (message.content === "!dbstatus") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply("❌ Apenas administradores podem usar este comando.");

    try {
      const [rows] = await pool.query("SELECT NOW() AS now");
      return message.reply(`🟢 Banco de dados MySQL online!\n🕒 Hora atual: ${rows[0].now}`);
    } catch (err) {
      console.error(err);
      return message.reply("❌ Erro ao conectar ao banco de dados!");
    }
  }

  // === COMANDO: !setlogs ===
  if (message.content.startsWith("!setlogs")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply("❌ Apenas administradores podem usar este comando.");

    const logChannel = message.mentions.channels.first();
    if (!logChannel) return message.reply("⚠️ Usa: `!setlogs #canal`");

    await pool.query(
      "CREATE TABLE IF NOT EXISTS configs (guild_id VARCHAR(50) PRIMARY KEY, log_channel_id VARCHAR(50))"
    );

    await pool.query(
      "INSERT INTO configs (guild_id, log_channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE log_channel_id = VALUES(log_channel_id)",
      [message.guild.id, logChannel.id]
    );

    return message.reply(`✅ Canal de logs definido para ${logChannel}`);
  }

  // === COMANDO: !setreaction ===
  if (message.content.startsWith("!setreaction")) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply("❌ Apenas administradores podem usar este comando.");

    const args = message.content.split(" ");
    const messageId = args[1];
    const emoji = args[2];
    const role = message.mentions.roles.first();

    if (!messageId || !emoji || !role)
      return message.reply("⚠️ Usa: `!setreaction <messageId> <emoji> @cargo`");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reactions (
        guild_id VARCHAR(50),
        message_id VARCHAR(50),
        emoji VARCHAR(100),
        role_id VARCHAR(50)
      )
    `);

    await pool.query(
      "INSERT INTO reactions (guild_id, message_id, emoji, role_id) VALUES (?, ?, ?, ?)",
      [message.guild.id, messageId, emoji, role.id]
    );

    message.reply(`✅ Reação configurada: ${emoji} → ${role.name}`);
  }
});

// === EVENTO: Adicionar Reação ===
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) await reaction.fetch();

  const [rows] = await pool.query(
    "SELECT * FROM reactions WHERE message_id = ? AND emoji = ?",
    [reaction.message.id, reaction.emoji.name]
  );

  if (rows.length === 0) return;
  const config = rows[0];

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);
  const role = guild.roles.cache.get(config.role_id);

  if (role) {
    await member.roles.add(role).catch(console.error);
    console.log(`✅ ${user.tag} recebeu o cargo ${role.name}`);
  }
});

// === SERVIDOR WEB (Railway mantém ativo) ===
const app = express();
app.get("/", (req, res) => res.send("Bot online! 🚀"));
app.listen(3000, () => console.log("🌐 Servidor web rodando na porta 3000"));

// === LOGIN ===
client.login(process.env.TOKEN).catch((error) => {
  console.error("Erro ao fazer login no Discord:", error);
});
