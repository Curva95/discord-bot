// ==========================
// 🤖 BOT DISCORD + MYSQL (CommonJS)
// ==========================
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
  } catch (err) {
    console.error("❌ Erro ao conectar ao MySQL:", err);
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
    .setDescription("📌 Define uma mensagem e emoji para reações automáticas.")
    .addStringOption(option =>
      option.setName("mensagem_id")
        .setDescription("ID da mensagem para adicionar reações")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("emoji")
        .setDescription("Emoji que será usado na reação")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setlogchannel")
    .setDescription("📝 Define o canal onde as logs serão enviadas.")
    .addChannelOption(option =>
      option.setName("canal")
        .setDescription("Canal onde serão enviadas as logs")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("dbstatus")
    .setDescription("🧠 Mostra o estado da base de dados.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map(cmd => cmd.toJSON());

// ==========================
// 🚀 LOGIN E REGISTO DE COMANDOS (Guilda para testes)
// ==========================
client.once("ready", async () => {
  console.log(`✅ Bot online como ${client.user.tag}!`);
  await initDB();

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("⏳ Registrando comandos na guilda para testes...");
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, process.env.GUILD_ID),
      { body: commands }
    );
    console.log("✅ Comandos registrados na guilda!");
  } catch (err) {
    console.error("❌ Erro ao registrar comandos:", err);
  }
});

// ==========================
// 🧠 EXECUÇÃO DOS COMANDOS
// ==========================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // Apenas admins
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ Apenas administradores podem usar este comando!", ephemeral: true });
  }

  // Defer reply para evitar timeout
  await interaction.deferReply({ ephemeral: true });

  // Comando: setreaction
  if (commandName === "setreaction") {
    const msgId = interaction.options.getString("mensagem_id");
    const emoji = interaction.options.getString("emoji");

    // Aqui podes salvar no MySQL (exemplo)
    try {
      await pool.query("INSERT INTO reactions (message_id, emoji) VALUES (?, ?) ON DUPLICATE KEY UPDATE emoji = ?", [msgId, emoji, emoji]);
      await interaction.editReply({
        content: `✅ Reação configurada com sucesso!\n**Mensagem ID:** \`${msgId}\`\n**Emoji:** ${emoji}`
      });
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao salvar a reação no banco.");
    }
  }

  // Comando: setlogchannel
  else if (commandName === "setlogchannel") {
    const canal = interaction.options.getChannel("canal");
    try {
      await pool.query("INSERT INTO log_channels (guild_id, channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE channel_id = ?", [interaction.guildId, canal.id, canal.id]);
      await interaction.editReply({ content: `📝 Canal de logs definido: ${canal}` });
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
// 🔑 LOGIN FINAL
// ==========================
if (!process.env.TOKEN) {
  console.error("❌ ERRO: TOKEN não encontrado!");
  process.exit(1);
}
if (!process.env.GUILD_ID) {
  console.error("❌ ERRO: GUILD_ID não definido para testes!");
  process.exit(1);
}

client.login(process.env.TOKEN);
