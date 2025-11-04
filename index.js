// ==========================
// 🤖 BOT DISCORD + MYSQL (CommonJS)
// ==========================
require('dotenv').config();

const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  PermissionFlagsBits,
  EmbedBuilder
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
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent
  ],
});

// ==========================
// 🧩 COMANDOS
// ==========================
const commands = [
  new SlashCommandBuilder()
    .setName("criarreaction")
    .setDescription("🎯 Cria mensagem embed com reaction role automática")
    .addChannelOption(option =>
      option.setName("canal")
        .setDescription("Canal onde enviar a mensagem")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("titulo")
        .setDescription("Título da mensagem")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("mensagem")
        .setDescription("Conteúdo da mensagem (suporta Markdown)")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("emoji")
        .setDescription("Emoji para reação")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName("cargo")
        .setDescription("Cargo a ser dado")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("cor")
        .setDescription("Cor do embed (ex: #FF0000)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setreaction")
    .setDescription("📌 Configura reação em uma mensagem existente")
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
// CLIENT READY
// ==========================
client.once("ready", async () => {
  console.log(`✅ Bot online como ${client.user.tag}!`);
  await initDB();

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("🔄 Atualizando comandos globais...");
    
    // Forçar atualização completa dos comandos
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    
    console.log("✅ Comandos globais atualizados com sucesso!");
    console.log("📋 Comandos registrados:", commands.map(cmd => cmd.name));
  } catch (err) {
    console.error("❌ Erro ao registrar comandos globais:", err);
  }
});

// ==========================
// INTERAÇÕES
// ==========================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ Apenas administradores podem usar este comando!", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  // Comando: CRIARREACTION
  if (commandName === "criarreaction") {
    const canal = interaction.options.getChannel("canal");
    const titulo = interaction.options.getString("titulo");
    const mensagem = interaction.options.getString("mensagem");
    const emojiInput = interaction.options.getString("emoji");
    const cargo = interaction.options.getRole("cargo");
    const corInput = interaction.options.getString("cor") || "#5865F2";

    // Verificar se o canal é de texto
    if (!canal.isTextBased()) {
      return interaction.editReply("❌ O canal precisa ser um canal de texto!");
    }

    try {
      // Converter cor HEX para número
      let corNumero;
      if (corInput.startsWith('#')) {
        corNumero = parseInt(corInput.replace('#', ''), 16);
      } else {
        corNumero = 0x5865F2; // Cor padrão azul do Discord
      }

      // Criar embed BONITO E ORGANIZADO
      const embed = new EmbedBuilder()
        .setTitle(`📜 ${titulo}`)
        .setDescription(mensagem)
        .setColor(corNumero)
        .addFields(
          {
            name: '🎯 **Como Verificar-se**',
            value: `Reaja com ${emojiInput} abaixo para receber o cargo **${cargo.name}** e ter acesso ao servidor!`,
            inline: false
          }
        )
        .setFooter({ 
          text: `${interaction.guild.name} • Sistema de Verificação`,
          iconURL: interaction.guild.iconURL()
        })
        .setThumbnail(interaction.guild.iconURL())
        .setTimestamp();

      // Enviar mensagem
      const mensagemEmbed = await canal.send({ embeds: [embed] });
      
      // Adicionar reação
      try {
        await mensagemEmbed.react(emojiInput);
      } catch (reactError) {
        console.error("Erro na reação:", reactError);
        await interaction.editReply("❌ Erro ao adicionar a reação. Verifique se o emoji é válido!");
        return;
      }

      // Salvar no banco de dados
      await pool.query(
        `INSERT INTO reactions (guild_id, message_id, emoji, role_id) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE emoji = ?, role_id = ?`,
        [interaction.guildId, mensagemEmbed.id, emojiInput, cargo.id, emojiInput, cargo.id]
      );

      await interaction.editReply(
        `✅ **Sistema de Reaction Role criado com sucesso!**\n` +
        `📝 **Canal:** ${canal}\n` +
        `🎯 **Emoji:** ${emojiInput}\n` +
        `👑 **Cargo:** ${cargo.name}\n` +
        `🆔 **ID da Mensagem:** \`${mensagemEmbed.id}\``
      );

    } catch (err) {
      console.error("Erro no criarreaction:", err);
      await interaction.editReply("❌ Erro ao criar o sistema de reaction role!");
    }
  }

  // Comando: SETREACTION (existente)
  else if (commandName === "setreaction") {
    const msgId = interaction.options.getString("mensagem_id");
    const emoji = interaction.options.getString("emoji");
    const role = interaction.options.getRole("cargo");

    try {
      // Tentar adicionar a reação na mensagem
      const canal = interaction.channel;
      const mensagem = await canal.messages.fetch(msgId);
      await mensagem.react(emoji);

      await pool.query(
        `INSERT INTO reactions (guild_id, message_id, emoji, role_id) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE emoji = ?, role_id = ?`,
        [interaction.guildId, msgId, emoji, role.id, emoji, role.id]
      );

      await interaction.editReply(`✅ Reação configurada!\n**Mensagem ID:** \`${msgId}\`\n**Emoji:** ${emoji}\n**Cargo:** ${role.name}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao configurar a reação. Verifique o ID da mensagem e se o emoji é válido!");
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

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('Erro ao buscar reação:', err);
      return;
    }
  }

  const guild = reaction.message.guild;
  if (!guild) return;

  try {
    const emojiIdentifier = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
    
    const [rows] = await pool.query(
      "SELECT role_id FROM reactions WHERE guild_id = ? AND message_id = ? AND emoji = ?",
      [guild.id, reaction.message.id, emojiIdentifier]
    );

    if (rows.length === 0) return;

    const roleId = rows[0].role_id;
    const member = await guild.members.fetch(user.id);
    
    if (member && roleId) {
      await member.roles.add(roleId);
      console.log(`✅ Cargo ${roleId} adicionado a ${user.tag}`);

      // Log no canal de logs
      const [logRows] = await pool.query("SELECT channel_id FROM log_channels WHERE guild_id = ?", [guild.id]);
      if (logRows.length > 0) {
        const logChannel = guild.channels.cache.get(logRows[0].channel_id);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setTitle("🎯 Reaction Role Ativado")
            .setColor(0x00FF00)
            .setDescription(`**Usuário:** ${user} (${user.tag})\n**Cargo:** <@&${roleId}>\n**Reação:** ${reaction.emoji}`)
            .setTimestamp();

          await logChannel.send({ embeds: [embed] });
        }
      }
    }
  } catch (err) {
    console.error("❌ Erro no reaction role:", err);
  }
});

// ==========================
// 🗑️ REMOVER CARGO AO RETIRAR REAÇÃO
// ==========================
client.on("messageReactionRemove", async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('Erro ao buscar reação:', err);
      return;
    }
  }

  const guild = reaction.message.guild;
  if (!guild) return;

  try {
    const emojiIdentifier = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
    
    const [rows] = await pool.query(
      "SELECT role_id FROM reactions WHERE guild_id = ? AND message_id = ? AND emoji = ?",
      [guild.id, reaction.message.id, emojiIdentifier]
    );

    if (rows.length === 0) return;

    const roleId = rows[0].role_id;
    const member = await guild.members.fetch(user.id);
    
    if (member && roleId) {
      await member.roles.remove(roleId);
      console.log(`❌ Cargo ${roleId} removido de ${user.tag}`);

      // Log no canal de logs
      const [logRows] = await pool.query("SELECT channel_id FROM log_channels WHERE guild_id = ?", [guild.id]);
      if (logRows.length > 0) {
        const logChannel = guild.channels.cache.get(logRows[0].channel_id);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setTitle("🗑️ Reaction Role Removido")
            .setColor(0xFF0000)
            .setDescription(`**Usuário:** ${user} (${user.tag})\n**Cargo:** <@&${roleId}>\n**Reação:** ${reaction.emoji}`)
            .setTimestamp();

          await logChannel.send({ embeds: [embed] });
        }
      }
    }
  } catch (err) {
    console.error("❌ Erro ao remover cargo:", err);
  }
});

// ==========================
// LOGIN
// ==========================
if (!process.env.TOKEN) {
  console.error("❌ ERRO: TOKEN não encontrado!");
  process.exit(1);
}

client.login(process.env.TOKEN);
