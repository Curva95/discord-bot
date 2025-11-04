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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// ==========================
// 🧩 DEFINIÇÃO DOS COMANDOS
// ==========================
const commands = [
  new SlashCommandBuilder()
    .setName("setreaction")
    .setDescription("📌 Define uma mensagem e emoji para reações automáticas.")
    .addStringOption((option) =>
      option.setName("mensagem_id").setDescription("ID da mensagem para adicionar reações").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("emoji").setDescription("Emoji que será usado na reação").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setlogchannel")
    .setDescription("📝 Define o canal onde as logs serão enviadas.")
    .addChannelOption((option) =>
      option.setName("canal").setDescription("Canal onde serão enviadas as logs").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("dbstatus")
    .setDescription("🧠 Mostra o estado da base de dados.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
].map((cmd) => cmd.toJSON());

// ==========================
// 🚀 LOGIN E REGISTO AUTOMÁTICO
// ==========================
client.once("ready", async () => {
  console.log(`✅ Bot online como ${client.user.tag}!`);
  await initDB();

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
  try {
    console.log("⏳ Registrando comandos globais automaticamente...");
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log("✅ Comandos globais registrados com sucesso!");
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

  // Somente admins
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ Apenas administradores podem usar este comando!", ephemeral: true });
  }

  // Comando: setreaction
  if (commandName === "setreaction") {
    const msgId = interaction.options.getString("mensagem_id");
    const emoji = interaction.options.getString("emoji");

    await interaction.reply({
      embeds: [
        {
          title: "📌 Comando `/setreaction`",
          description: `✅ Reação configurada com sucesso!\n\n**Mensagem ID:** \`${msgId}\`\n**Emoji:** ${emoji}`,
          color: 0x00ff99,
        },
      ],
    });
  }

  // Comando: setlogchannel
  else if (commandName === "setlogchannel") {
    const canal = interaction.options.getChannel("canal");
    await interaction.reply({
      embeds: [
        {
          title: "📝 Canal de logs definido!",
          description: `As logs serão enviadas em: ${canal}`,
          color: 0x0099ff,
        },
      ],
    });
  }

  // Comando: dbstatus
  else if (commandName === "dbstatus") {
    try {
      const [rows] = await pool.query("SELECT NOW() AS now");
      await interaction.reply({
        embeds: [
          {
            title: "🧠 Estado da Base de Dados",
            description: `✅ Conectado!\n🕒 Hora atual: ${rows[0].now}`,
            color: 0x00ff00,
          },
        ],
      });
    } catch (err) {
      await interaction.reply({
        embeds: [
          {
            title: "❌ Erro na Base de Dados",
            description: "Não foi possível conectar à base de dados.",
            color: 0xff0000,
          },
        ],
      });
      console.error(err);
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
client.login(process.env.TOKEN);
