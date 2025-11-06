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
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
});

// ==========================
// 🔧 CONFIGURAÇÃO MODERAÇÃO (SEMPRE ATIVA)
// ==========================
const blockedDomains = [
  'discord.gg', 'discord.com/invite', 'discordapp.com/invite',
  'youtube.com', 'youtu.be', 'twitch.tv', 'twitter.com',
  'instagram.com', 'facebook.com', 'tiktok.com',
  'bit.ly', 'tinyurl.com', 'goo.gl' // Encurtadores
];

// Canais onde os links são permitidos (opcional)
const allowedChannels = [];

// ==========================
// 🧩 COMANDOS
// ==========================
const commands = [
  new SlashCommandBuilder()
    .setName("criarreaction")
    .setDescription("🎯 Cria mensagem embed com reaction role (sistema por passos)")
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
    .setName("removerreaction")
    .setDescription("🗑️ Remove uma mensagem de reaction role")
    .addStringOption(option =>
      option.setName("mensagem_id")
        .setDescription("ID da mensagem para remover")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("listarreactions")
    .setDescription("📋 Lista todas as reactions configuradas")
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

  new SlashCommandBuilder()
    .setName("sync")
    .setDescription("🔄 Sincroniza comandos no servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("enviarmensagem")
    .setDescription("📨 Envia uma mensagem embed personalizada")
    .addChannelOption(option =>
      option.setName("canal")
        .setDescription("Canal onde enviar a mensagem")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("titulo")
        .setDescription("Título do embed")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("descricao")
        .setDescription("Descrição do embed")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("cor")
        .setDescription("Cor do embed (ex: #FF0000 ou vermelho)")
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName("thumbnail")
        .setDescription("URL da thumbnail")
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName("imagem")
        .setDescription("URL da imagem principal")
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName("footer")
        .setDescription("Texto do footer")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("anti-link")
    .setDescription("🛡️ Configurar sistema anti-links")
    .addBooleanOption(option =>
      option.setName("ativo")
        .setDescription("Ativar/desativar sistema anti-links")
        .setRequired(false)
    )
    .addChannelOption(option =>
      option.setName("canal_logs")
        .setDescription("Canal para logs de moderação")
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName("canais_permitidos")
        .setDescription("IDs de canais onde links são permitidos (separados por vírgula)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("add-domain")
    .setDescription("🔗 Adicionar domínio à lista de bloqueio")
    .addStringOption(option =>
      option.setName("dominio")
        .setDescription("Domínio para bloquear (ex: youtube.com)")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("remove-domain")
    .setDescription("🔓 Remover domínio da lista de bloqueio")
    .addStringOption(option =>
      option.setName("dominio")
        .setDescription("Domínio para remover")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("list-domains")
    .setDescription("📋 Listar domínios bloqueados")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

].map(cmd => cmd.toJSON());

// ==========================
// CLIENT READY
// ==========================
client.once("ready", async () => {
  console.log(`✅ Bot online como ${client.user.tag}!`);
  console.log(`🛡️ Sistema Anti-Links ATIVADO por padrão!`);
  await initDB();

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("🔄 Registrando comandos por servidor...");
    
    // Registrar comandos em CADA SERVIDOR (mais rápido)
    for (const guild of client.guilds.cache.values()) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(client.user.id, guild.id),
          { body: commands }
        );
        console.log(`✅ Comandos registrados em: ${guild.name}`);
      } catch (error) {
        console.error(`❌ Erro em ${guild.name}:`, error);
      }
    }
    
  } catch (err) {
    console.error("❌ Erro ao registrar comandos:", err);
  }
});

// ==========================
// 🛡️ SISTEMA ANTI-LINKS (SEMPRE ATIVO)
// ==========================
client.on("messageCreate", async (message) => {
  // Ignorar bots e mensagens sem conteúdo
  if (message.author.bot || !message.content) return;
  
  // Verificar se o usuário é administrador
  if (message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
  
  // Verificar se o canal está na lista de permitidos
  if (allowedChannels.includes(message.channel.id)) return;

  // Expressão regular para detectar URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const hasLink = urlRegex.test(message.content);
  
  // Verificar domínios específicos mesmo sem http
  const domainRegex = new RegExp(
    `\\b(${blockedDomains.map(domain => domain.replace('.', '\\.')).join('|')})\\b`,
    'i'
  );
  const hasBlockedDomain = domainRegex.test(message.content.toLowerCase());

  if (hasLink || hasBlockedDomain) {
    try {
      // Deletar a mensagem
      await message.delete();
      
      // Enviar aviso ao usuário
      const warningMsg = await message.channel.send({
        content: `${message.author} ❌ **Links não são permitidos neste servidor!**`,
        ephemeral: false
      });

      // Deletar o aviso após 5 segundos
      setTimeout(async () => {
        try {
          await warningMsg.delete();
        } catch (error) {
          console.log("Não foi possível deletar mensagem de aviso:", error);
        }
      }, 5000);

      // Log da ação
      console.log(`🛡️ Mensagem com link deletada de ${message.author.tag}: ${message.content}`);

      // Enviar para canal de logs se configurado
      const [logRows] = await pool.query("SELECT channel_id FROM log_channels WHERE guild_id = ?", [message.guild.id]);
      if (logRows.length > 0) {
        const logChannel = message.guild.channels.cache.get(logRows[0].channel_id);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setTitle("🛡️ Link Bloqueado")
            .setColor(0xFFA500)
            .setDescription(`**Usuário:** ${message.author} (${message.author.tag})\n**Canal:** ${message.channel}\n**Mensagem:** \`${message.content.substring(0, 100)}...\``)
            .setTimestamp();

          await logChannel.send({ embeds: [embed] });
        }
      }

    } catch (error) {
      console.error("❌ Erro ao processar mensagem com link:", error);
    }
  }
});

// ==========================
// INTERAÇÕES
// ==========================
client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: "❌ Only Admins!", ephemeral: true });
  }

  // Comando: CRIARREACTION (SISTEMA POR PASSOS)
  if (commandName === "criarreaction") {
    try {
      // Criar modal para input passo a passo
      const modal = new ModalBuilder()
        .setCustomId('criarreaction_modal')
        .setTitle('🎯 Criar Reaction Role');

      // Canal
      const canalInput = new TextInputBuilder()
        .setCustomId('canal_input')
        .setLabel("ID do Canal")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 123456789012345678")
        .setRequired(true);

      // Título
      const tituloInput = new TextInputBuilder()
        .setCustomId('titulo_input')
        .setLabel("Título do Embed")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: Sistema de Verificação")
        .setRequired(true);

      // Mensagem
      const mensagemInput = new TextInputBuilder()
        .setCustomId('mensagem_input')
        .setLabel("Mensagem/Descrição")
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Descreva a mensagem do embed...")
        .setRequired(true);

      // Emoji
      const emojiInput = new TextInputBuilder()
        .setCustomId('emoji_input')
        .setLabel("Emoji para Reação")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: ✅ ou :white_check_mark:")
        .setRequired(true);

      // Cargo
      const cargoInput = new TextInputBuilder()
        .setCustomId('cargo_input')
        .setLabel("ID do Cargo")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Ex: 123456789012345678")
        .setRequired(true);

      // Adicionar componentes ao modal
      const firstActionRow = new ActionRowBuilder().addComponents(canalInput);
      const secondActionRow = new ActionRowBuilder().addComponents(tituloInput);
      const thirdActionRow = new ActionRowBuilder().addComponents(mensagemInput);
      const fourthActionRow = new ActionRowBuilder().addComponents(emojiInput);
      const fifthActionRow = new ActionRowBuilder().addComponents(cargoInput);

      modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow, fifthActionRow);

      await interaction.showModal(modal);

    } catch (err) {
      console.error("Erro ao criar modal:", err);
      await interaction.reply({ content: "❌ Erro ao iniciar o criador de reaction role!", ephemeral: true });
    }
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // Comando: SETREACTION
  if (commandName === "setreaction") {
    const msgId = interaction.options.getString("mensagem_id");
    const emoji = interaction.options.getString("emoji");
    const role = interaction.options.getRole("cargo");

    try {
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

  // Comando: REMOVERREACTION
  else if (commandName === "removerreaction") {
    const msgId = interaction.options.getString("mensagem_id");

    try {
      // Verificar se a mensagem existe no banco
      const [rows] = await pool.query(
        "SELECT * FROM reactions WHERE guild_id = ? AND message_id = ?",
        [interaction.guildId, msgId]
      );

      if (rows.length === 0) {
        return interaction.editReply("❌ Mensagem não encontrada no banco de dados!");
      }

      // Tentar apagar a mensagem do Discord
      try {
        const canal = interaction.channel;
        const mensagem = await canal.messages.fetch(msgId);
        await mensagem.delete();
      } catch (discordError) {
        console.log("⚠️ Não foi possível apagar a mensagem do Discord, mas será removida do banco");
      }

      // Remover do banco de dados
      await pool.query(
        "DELETE FROM reactions WHERE guild_id = ? AND message_id = ?",
        [interaction.guildId, msgId]
      );

      await interaction.editReply(`✅ Reaction role removida!\n**Mensagem ID:** \`${msgId}\`\n**Foi removida do banco de dados.**`);

    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao remover a reaction role!");
    }
  }

  // Comando: LISTARREACTIONS
  else if (commandName === "listarreactions") {
    try {
      const [rows] = await pool.query(
        "SELECT message_id, emoji, role_id FROM reactions WHERE guild_id = ?",
        [interaction.guildId]
      );

      if (rows.length === 0) {
        return interaction.editReply("📭 Nenhuma reaction role configurada neste servidor.");
      }

      let lista = "**📋 Reaction Roles Configuradas:**\n\n";
      
      for (const row of rows) {
        lista += `**Mensagem ID:** \`${row.message_id}\`\n`;
        lista += `**Emoji:** ${row.emoji}\n`;
        lista += `**Cargo:** <@&${row.role_id}>\n`;
        lista += "━━━━━━━━━━━━━━━━━━━━\n";
      }

      await interaction.editReply(lista);

    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao listar reactions!");
    }
  }

  // Comando: SETLOGCHANNEL
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

  // Comando: DBSTATUS
  else if (commandName === "dbstatus") {
    try {
      const [rows] = await pool.query("SELECT NOW() AS now");
      await interaction.editReply(`✅ Conectado à DB! Hora atual: ${rows[0].now}`);
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro na base de dados.");
    }
  }

  // Comando: SYNC
  else if (commandName === "sync") {
    try {
      const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, interaction.guildId),
        { body: commands }
      );
      await interaction.editReply("✅ Comandos sincronizados neste servidor!");
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao sincronizar comandos.");
    }
  }

  // Comando: ENVIARMENSAGEM
  else if (commandName === "enviarmensagem") {
    const canal = interaction.options.getChannel("canal");
    const titulo = interaction.options.getString("titulo");
    const descricao = interaction.options.getString("descricao");
    const corInput = interaction.options.getString("cor") || "#5865F2";
    const thumbnail = interaction.options.getString("thumbnail");
    const imagem = interaction.options.getString("imagem");
    const footer = interaction.options.getString("footer");

    if (!canal.isTextBased()) {
      return interaction.editReply("❌ O canal precisa ser um canal de texto!");
    }

    try {
      // Converter cor HEX para número
      let corNumero;
      if (corInput.startsWith('#')) {
        corNumero = parseInt(corInput.replace('#', ''), 16);
      } else {
        // Cores nomeadas
        const cores = {
          'vermelho': 0xFF0000,
          'azul': 0x0000FF,
          'verde': 0x00FF00,
          'amarelo': 0xFFFF00,
          'roxo': 0x800080,
          'laranja': 0xFFA500,
          'rosa': 0xFFC0CB,
          'cinza': 0x808080
        };
        corNumero = cores[corInput.toLowerCase()] || 0x5865F2;
      }

      // Criar embed
      const embed = new EmbedBuilder()
        .setTitle(titulo)
        .setDescription(descricao)
        .setColor(corNumero)
        .setTimestamp();

      // Adicionar thumbnail se fornecida
      if (thumbnail) {
        embed.setThumbnail(thumbnail);
      }

      // Adicionar imagem se fornecida
      if (imagem) {
        embed.setImage(imagem);
      }

      // Adicionar footer se fornecido
      if (footer) {
        embed.setFooter({ 
          text: footer,
          iconURL: interaction.guild.iconURL()
        });
      } else {
        embed.setFooter({ 
          text: interaction.guild.name,
          iconURL: interaction.guild.iconURL()
        });
      }

      // Enviar mensagem
      await canal.send({ embeds: [embed] });

      await interaction.editReply(
        `✅ **Mensagem enviada com sucesso!**\n` +
        `📝 **Canal:** ${canal}\n` +
        `🎨 **Cor:** ${corInput}\n` +
        `📊 **Preview:** "${titulo}"`
      );

    } catch (err) {
      console.error("Erro no enviarmensagem:", err);
      await interaction.editReply("❌ Erro ao enviar a mensagem. Verifique as URLs fornecidas!");
    }
  }

  // Comando: ANTI-LINK
  else if (commandName === "anti-link") {
    const ativo = interaction.options.getBoolean("ativo");
    const canalLogs = interaction.options.getChannel("canal_logs");
    const canaisPermitidos = interaction.options.getString("canais_permitidos");

    try {
      if (canalLogs) {
        await pool.query(
          `INSERT INTO log_channels (guild_id, channel_id) 
           VALUES (?, ?) 
           ON DUPLICATE KEY UPDATE channel_id = ?`,
          [interaction.guildId, canalLogs.id, canalLogs.id]
        );
      }

      // Atualizar canais permitidos
      if (canaisPermitidos) {
        const canaisArray = canaisPermitidos.split(',').map(id => id.trim());
        allowedChannels.length = 0; // Limpar array
        allowedChannels.push(...canaisArray);
      }

      const status = "🛡️ **SISTEMA ANTI-LINKS SEMPRE ATIVO**";
      
      await interaction.editReply(
        `${status}\n` +
        (canalLogs ? `📝 **Canal de logs:** ${canalLogs}\n` : '') +
        (canaisPermitidos ? `🔓 **Canais permitidos:** ${canaisPermitidos}\n` : '') +
        `\n**Domínios bloqueados:** ${blockedDomains.length}\n` +
        `**Usuários administradores podem enviar links.**`
      );

    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao configurar sistema anti-links!");
    }
  }

  // Comando: ADD-DOMAIN
  else if (commandName === "add-domain") {
    const dominio = interaction.options.getString("dominio").toLowerCase();

    try {
      if (!blockedDomains.includes(dominio)) {
        blockedDomains.push(dominio);
        await interaction.editReply(`✅ Domínio \`${dominio}\` adicionado à lista de bloqueio!`);
      } else {
        await interaction.editReply(`ℹ️ Domínio \`${dominio}\` já está na lista de bloqueio.`);
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao adicionar domínio!");
    }
  }

  // Comando: REMOVE-DOMAIN
  else if (commandName === "remove-domain") {
    const dominio = interaction.options.getString("dominio").toLowerCase();

    try {
      const index = blockedDomains.indexOf(dominio);
      if (index > -1) {
        blockedDomains.splice(index, 1);
        await interaction.editReply(`✅ Domínio \`${dominio}\` removido da lista de bloqueio!`);
      } else {
        await interaction.editReply(`❌ Domínio \`${dominio}\` não encontrado na lista de bloqueio.`);
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao remover domínio!");
    }
  }

  // Comando: LIST-DOMAINS
  else if (commandName === "list-domains") {
    try {
      if (blockedDomains.length === 0) {
        return interaction.editReply("📭 Nenhum domínio bloqueado.");
      }

      const lista = blockedDomains.map(domain => `• \`${domain}\``).join('\n');
      await interaction.editReply(`**📋 Domínios Bloqueados:**\n${lista}`);

    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ Erro ao listar domínios!");
    }
  }
});

// ==========================
// 📝 MODAL SUBMIT (PARA O CRIARREACTION) - VERSÃO CORRIGIDA
// ==========================
client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === 'criarreaction_modal') {
    await interaction.deferReply({ ephemeral: true });

    try {
      const canalId = interaction.fields.getTextInputValue('canal_input');
      const titulo = interaction.fields.getTextInputValue('titulo_input');
      const mensagem = interaction.fields.getTextInputValue('mensagem_input');
      let emojiInput = interaction.fields.getTextInputValue('emoji_input');
      const cargoId = interaction.fields.getTextInputValue('cargo_input');

      // Obter canal e cargo
      const canal = await interaction.guild.channels.fetch(canalId);
      const cargo = await interaction.guild.roles.fetch(cargoId);

      if (!canal || !canal.isTextBased()) {
        return interaction.editReply("❌ Canal não encontrado ou não é um canal de texto!");
      }

      if (!cargo) {
        return interaction.editReply("❌ Cargo não encontrado!");
      }

      // CORRIGIR O EMOJI - CONVERTER :white_check_mark: PARA ✅
      console.log(`🎯 Emoji recebido: "${emojiInput}"`);
      
      let emojiParaUsar = emojiInput;
      
      // Se for um nome de emoji (como :white_check_mark:), converter para o emoji real
      if (emojiInput.startsWith(':') && emojiInput.endsWith(':')) {
        const emojiName = emojiInput.slice(1, -1); // Remove os :
        console.log(`🔄 Convertendo nome de emoji: ${emojiName}`);
        
        // Mapear nomes comuns para emojis
        const emojiMap = {
          'white_check_mark': '✅',
          'green_circle': '🟢',
          'red_circle': '🔴',
          'blue_circle': '🔵',
          'star': '⭐',
          'fire': '🔥',
          'heart': '❤️',
          'thumbsup': '👍',
          'thumbsdown': '👎',
          'warning': '⚠️',
          'information_source': 'ℹ️',
          'x': '❌',
          'o': '⭕',
          'arrow_up': '⬆️',
          'arrow_down': '⬇️',
          'arrow_left': '⬅️',
          'arrow_right': '➡️',
          'play_pause': '⏯️',
          'stop_button': '⏹️',
          'record_button': '⏺️',
          'previous_track': '⏮️',
          'next_track': '⏭️',
          'pause_button': '⏸️',
          'play_button': '▶️',
          'gear': '⚙️',
          'hammer_and_wrench': '🛠️',
          'key': '🔑',
          'lock': '🔒',
          'unlock': '🔓',
          'bell': '🔔',
          'mega': '📣',
          'loud_sound': '🔊',
          'sound': '🔉',
          'mute': '🔇',
          'bookmark': '🔖',
          'link': '🔗',
          'radio_button': '🔘',
          'back': '🔙',
          'end': '🔚',
          'on': '🔛',
          'soon': '🔜',
          'top': '🔝',
          'eyes': '👀',
          'brain': '🧠',
          'muscle': '💪',
          'punch': '👊',
          'wave': '👋',
          'clap': '👏',
          'pray': '🙏',
          'writing_hand': '✍️',
          'nail_care': '💅',
          'ear': '👂',
          'nose': '👃',
          'footprints': '👣',
          'eyes': '👀',
          'brain': '🧠',
          'bone': '🦴',
          'tooth': '🦷',
          'horn': '🪈'
        };
        
        if (emojiMap[emojiName]) {
          emojiParaUsar = emojiMap[emojiName];
          console.log(`✅ Convertido para: ${emojiParaUsar}`);
        } else {
          // Se não encontrar no mapa, tentar usar o emoji padrão
          emojiParaUsar = '✅';
          console.log(`⚠️ Nome não encontrado, usando fallback: ${emojiParaUsar}`);
        }
      }
      
      // Verificar se é um emoji custom (formato: <:name:id>)
      const customEmojiMatch = emojiInput.match(/<a?:(\w+):(\d+)>/);
      if (customEmojiMatch) {
        console.log(`🎯 É um emoji custom: ${emojiInput}`);
        emojiParaUsar = emojiInput; // Manter o formato original para custom emojis
      }

      // Criar embed
      const embed = new EmbedBuilder()
        .setTitle(`📜 ${titulo}`)
        .setDescription(mensagem)
        .setColor(0x5865F2)
        .addFields(
          {
            name: '🎯 **Get Your Role**',
            value: `React with ${emojiParaUsar} below to receive the **${cargo.name}** role and get access to the server!`,
            inline: false
          }
        )
        .setFooter({ 
          text: `${interaction.guild.name} • Verification System`,
          iconURL: interaction.guild.iconURL()
        })
        .setThumbnail(interaction.guild.iconURL())
        .setTimestamp();

      // Enviar mensagem
      const mensagemEmbed = await canal.send({ embeds: [embed] });
      
      // ADICIONAR REAÇÃO - VERSÃO CORRIGIDA
      try {
        console.log(`🎯 Tentando adicionar reação: "${emojiParaUsar}"`);
        
        // Se for emoji custom, usar o formato completo
        if (customEmojiMatch) {
          await mensagemEmbed.react(customEmojiMatch[2]); // Usar o ID do emoji
        } else {
          // Para emojis padrão, usar diretamente
          await mensagemEmbed.react(emojiParaUsar);
        }
        
        console.log(`✅ Reação adicionada com sucesso!`);
        
      } catch (reactError) {
        console.error("❌ Erro ao adicionar reação:", reactError);
        
        // Fallback: sempre usar ✅ se der erro
        try {
          console.log(`🔄 Tentando fallback com ✅`);
          await mensagemEmbed.react('✅');
          emojiParaUsar = '✅';
          console.log(`✅ Fallback adicionado com sucesso!`);
        } catch (errorFallback) {
          console.error("❌ Erro crítico no fallback:", errorFallback);
          await interaction.editReply(
            "⚠️ **Mensagem criada, mas não foi possível adicionar reação automática.**\n" +
            "Por favor, adicione manualmente a reação ✅ na mensagem."
          );
        }
      }

      // Salvar no banco de dados
      await pool.query(
        `INSERT INTO reactions (guild_id, message_id, emoji, role_id) 
         VALUES (?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE emoji = ?, role_id = ?`,
        [interaction.guild.id, mensagemEmbed.id, emojiParaUsar, cargo.id, emojiParaUsar, cargo.id]
      );

      await interaction.editReply(
        `✅ **Sistema de Reaction Role criado com sucesso!**\n` +
        `📝 **Canal:** ${canal}\n` +
        `🎯 **Emoji:** ${emojiParaUsar}\n` +
        `👑 **Cargo:** ${cargo.name}\n` +
        `🆔 **ID da Mensagem:** \`${mensagemEmbed.id}\``
      );

    } catch (err) {
      console.error("Erro no modal criarreaction:", err);
      await interaction.editReply("❌ Erro ao criar o sistema de reaction role! Verifique os IDs fornecidos.");
    }
  }
});

// ==========================
// 🎯 EVENTO REACTION ROLE
// ==========================
client.on("messageReactionAdd", async (reaction, user) => {
  if (user.bot) return;

  try {
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const { guild, id } = reaction.message;
    if (!guild) return;

    const emojiIdentifier = reaction.emoji.id ? `${reaction.emoji.name}:${reaction.emoji.id}` : reaction.emoji.name;
    
    console.log(`🔍 Procurando reação: Guild=${guild.id}, Message=${id}, Emoji=${emojiIdentifier}`);

    const [rows] = await pool.query(
      "SELECT role_id FROM reactions WHERE guild_id = ? AND message_id = ? AND emoji = ?",
      [guild.id, id, emojiIdentifier]
    );

    if (rows.length === 0) {
      console.log("❌ Reação não encontrada no banco de dados");
      return;
    }

    const roleId = rows[0].role_id;
    console.log(`✅ Reação encontrada! Cargo: ${roleId}`);

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

  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

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
