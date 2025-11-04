const { Client, GatewayIntentBits, Partials, PermissionsBitField } = require("discord.js");
const express = require("express");
const mysql = require("mysql2/promise");

// 🔐 Verifica variáveis essenciais
if (!process.env.TOKEN) {
  console.error("❌ ERRO: TOKEN não encontrado!");
  process.exit(1);
}
if (!process.env.MYSQLUSER || !process.env.MYSQLPASSWORD || !process.env.MYSQLDATABASE) {
  console.error("❌ ERRO: Variáveis do MySQL ausentes!");
  process.exit(1);
}

// 🌐 Conexão ao MySQL (via endpoint público Railway)
let pool;

(async () => {
  try {
    pool = await mysql.createPool({
      host: "centerbeam.proxy.rlwy.net",
      port: 32486,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      connectionLimit: 10,
    });

    // Cria tabela se não existir
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reactions (
        message_id VARCHAR(50),
        emoji VARCHAR(100),
        role_id VARCHAR(50)
      )
    `);

    const [rows] = await pool.query("SELECT NOW() AS now");
    console.log("🗄️ Conectado ao MySQL com sucesso!");
    console.log("🕒 Hora atual:", rows[0].now);
  } catch (err) {
    console.error("❌ Erro ao conectar ao MySQL:", err);
  }
})();

// 🤖 Inicializa o bot Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once("clientReady", () => {
  console.log(`✅ Bot online como ${client.user.tag}!`);
});

// 📜 Comando para configurar reação
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!setreaction")) return;

  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return message.reply("❌ Apenas administradores podem usar este comando.");
  }

  const args = message.content.split(" ");
  const [msgId, emoji, roleId] = args.slice(1);

  if (!msgId || !emoji || !roleId) {
    return message.reply("⚠️ Uso correto: `!setreaction <msgId> <emoji> <roleId>`");
  }

  try {
    await pool.query("INSERT INTO reactions (message_id, emoji, role_id) VALUES (?, ?, ?)", [
      msgId,
      emoji,
      roleId,
    ]);
    message.reply("✅ Reação configurada e salva na base de dados!");
  } catch (err) {
    console.error("❌ Erro ao salvar no MySQL:", err);
    message.reply("⚠️ Erro ao salvar configuração no banco de dados!");
  }
});

// 🎭 Evento de reação
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();

    const [rows] = await pool.query(
      "SELECT * FROM reactions WHERE message_id = ? AND emoji = ?",
      [reaction.message.id, reaction.emoji.name]
    );

    if (rows.length === 0) return;

    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(rows[0].role_id);

    if (role) {
      await member.roles.add(role);
      console.log(`✅ Cargo ${role.name} atribuído a ${user.tag}`);
    }
  } catch (err) {
    console.error("❌ Erro ao adicionar cargo:", err);
  }
});

// 💻 Express (mantém o bot vivo no Railway)
const app = express();
app.get("/", (req, res) => res.send("Bot online! 🚀"));
app.listen(3000, () => console.log("🌐 Servidor web rodando na porta 3000"));

// 🚀 Login no Discord
client.login(process.env.TOKEN).catch((err) => {
  console.error("❌ Erro ao fazer login no Discord:", err);
});
