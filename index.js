const { Client, GatewayIntentBits, Partials, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');
const express = require('express');

if (!process.env.TOKEN || !process.env.DATABASE_URL) {
    console.error('❌ ERRO: TOKEN ou DATABASE_URL não encontrados!');
    process.exit(1);
}

// Conexão PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Criação das tabelas (caso não existam)
(async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS reactions (
            id SERIAL PRIMARY KEY,
            message_id TEXT NOT NULL,
            emoji TEXT NOT NULL,
            role_id TEXT NOT NULL
        );
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    `);
    console.log('🗄️ Banco de dados inicializado.');
})();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Função para enviar logs como embed
async function sendLog(guild, embed) {
    try {
        const res = await pool.query('SELECT value FROM settings WHERE key = $1', ['logChannelId']);
        if (res.rowCount === 0) return;
        const logChannelId = res.rows[0].value;
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) await logChannel.send({ embeds: [embed] });
    } catch (err) {
        console.error('Erro ao enviar log:', err);
    }
}

client.once('ready', () => {
    console.log(`✅ Bot online como ${client.user.tag}!`);
});

// =========================
// COMANDOS DE ADMIN
// =========================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Ping simples
    if (message.content === '!oi') return message.reply('Olá! Eu estou online 😎');

    // Apenas admins
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    const args = message.content.split(' ');

    // SETREACTION
    if (message.content.startsWith('!setreaction')) {
        if (args.length < 4)
            return message.reply('⚠️ Uso correto: `!setreaction <id_da_mensagem> <emoji> <id_do_cargo>`');

        const [, messageId, emoji, roleId] = args;

        try {
            await pool.query(
                'INSERT INTO reactions (message_id, emoji, role_id) VALUES ($1, $2, $3)',
                [messageId, emoji, roleId]
            );

            const msg = await message.channel.messages.fetch(messageId);
            await msg.react(emoji);

            message.reply(`✅ Reação configurada!\n📩 Mensagem: ${messageId}\n😀 Emoji: ${emoji}\n🎭 Cargo: <@&${roleId}>`);
        } catch (err) {
            console.error(err);
            message.reply('❌ Erro ao configurar reação.');
        }
    }

    // VERREACTION
    if (message.content === '!verreaction') {
        const res = await pool.query('SELECT * FROM reactions');
        if (res.rowCount === 0) return message.reply('⚠️ Nenhuma reação configurada.');
        let text = '📋 **Reações configuradas:**\n';
        for (const r of res.rows) {
            text += `📩 ${r.message_id} | 😀 ${r.emoji} | 🎭 <@&${r.role_id}>\n`;
        }
        message.reply(text);
    }

    // REMOVEREACTION
    if (message.content.startsWith('!removereaction')) {
        if (args.length < 3)
            return message.reply('⚠️ Uso correto: `!removereaction <id_da_mensagem> <emoji>`');

        const [, messageId, emoji] = args;
        const res = await pool.query(
            'DELETE FROM reactions WHERE message_id = $1 AND emoji = $2 RETURNING *',
            [messageId, emoji]
        );

        if (res.rowCount === 0) return message.reply('⚠️ Nenhuma configuração encontrada.');
        message.reply(`🗑️ Reação ${emoji} da mensagem ${messageId} foi removida.`);
    }

    // SETLOG
    if (message.content.startsWith('!setlog')) {
        const channel = message.mentions.channels.first() || message.guild.channels.cache.get(args[1]);
        if (!channel) return message.reply('❌ Canal inválido.');

        await pool.query(
            `INSERT INTO settings (key, value)
             VALUES ('logChannelId', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [channel.id]
        );
        message.reply(`✅ Canal de logs definido para ${channel}.`);
    }

    // VERLOG
    if (message.content === '!verlog') {
        const res = await pool.query('SELECT value FROM settings WHERE key = $1', ['logChannelId']);
        if (res.rowCount === 0) return message.reply('⚠️ Nenhum canal de logs configurado.');
        message.reply(`📜 Canal de logs atual: <#${res.rows[0].value}>`);
    }
});

// =========================
// EVENTOS DE REAÇÃO
// =========================
client.on('messageReactionAdd', async (reaction, user) => {
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return;

    const res = await pool.query(
        'SELECT * FROM reactions WHERE message_id = $1 AND emoji = $2',
        [reaction.message.id, reaction.emoji.name]
    );
    if (res.rowCount === 0) return;

    const { role_id } = res.rows[0];
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);

    try {
        await member.roles.add(role_id);

        const embed = new EmbedBuilder()
            .setColor('Green')
            .setTitle('✅ Cargo Adicionado')
            .setDescription(`<@${user.id}> recebeu o cargo <@&${role_id}> ao reagir com ${reaction.emoji.name}`)
            .setTimestamp();

        await sendLog(guild, embed);
        console.log(`✅ Cargo adicionado a ${user.tag}`);
    } catch (err) {
        console.error('Erro ao adicionar cargo:', err);
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (reaction.partial) await reaction.fetch();
    if (user.bot) return;

    const res = await pool.query(
        'SELECT * FROM reactions WHERE message_id = $1 AND emoji = $2',
        [reaction.message.id, reaction.emoji.name]
    );
    if (res.rowCount === 0) return;

    const { role_id } = res.rows[0];
    const guild = reaction.message.guild;
    const member = await guild.members.fetch(user.id);

    try {
        await member.roles.remove(role_id);

        const embed = new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Cargo Removido')
            .setDescription(`<@${user.id}> perdeu o cargo <@&${role_id}> ao remover a reação ${reaction.emoji.name}`)
            .setTimestamp();

        await sendLog(guild, embed);
        console.log(`❌ Cargo removido de ${user.tag}`);
    } catch (err) {
        console.error('Erro ao remover cargo:', err);
    }
});

client.login(process.env.TOKEN);

// Web server para o Railway
const app = express();
app.get('/', (req, res) => res.send('Bot online com PostgreSQL!'));
app.listen(3000, () => console.log('Servidor web rodando na porta 3000'));
