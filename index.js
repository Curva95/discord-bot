const { Client, GatewayIntentBits } = require('discord.js');
const { Pool } = require('pg');
const express = require('express');

if (!process.env.TOKEN || !process.env.DATABASE_URL) {
    console.error('❌ ERRO: TOKEN ou DATABASE_URL não encontrados!');
    process.exit(1);
}

// --- Criação do cliente Discord ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ]
});

// --- Conexão ao banco PostgreSQL ---
let pool;
(async () => {
    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        await pool.query(`
            CREATE TABLE IF NOT EXISTS reactions (
                id SERIAL PRIMARY KEY,
                message_id TEXT NOT NULL,
                emoji TEXT NOT NULL,
                role_id TEXT NOT NULL
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS log_channels (
                guild_id TEXT PRIMARY KEY,
                channel_id TEXT NOT NULL
            );
        `);

        console.log('🗄️ Banco de dados inicializado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao inicializar o banco de dados:', error);
    }
})();

// --- Evento principal de inicialização ---
client.once('clientReady', () => {
    console.log(`✅ Bot online como ${client.user.tag}!`);
});

// --- Comandos ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const isAdmin = message.member?.permissions.has('Administrator');
    if (!isAdmin) return;

    const args = message.content.split(' ');

    // --- Testar conexão ao banco ---
    if (message.content === '!dbstatus') {
        if (!pool) return message.reply('⚠️ O banco de dados ainda está a inicializar.');

        try {
            const result = await pool.query('SELECT NOW()');
            message.reply(`🟢 Banco de dados online!\nHora: ${result.rows[0].now}`);
        } catch (err) {
            console.error('❌ Erro ao conectar ao banco:', err);
            message.reply('🔴 Erro ao conectar ao banco de dados!');
        }
    }

    // --- Definir canal de logs ---
    if (args[0] === '!setlog') {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ Usa: `!setlog #canal`');

        await pool.query(
            'INSERT INTO log_channels (guild_id, channel_id) VALUES ($1, $2) ON CONFLICT (guild_id) DO UPDATE SET channel_id = $2;',
            [message.guild.id, channel.id]
        );

        message.reply(`✅ Canal de logs definido para ${channel}`);
    }

    // --- Definir reação ---
    if (args[0] === '!setreaction') {
        const messageId = args[1];
        const emoji = args[2];
        const role = message.mentions.roles.first();

        if (!messageId || !emoji || !role)
            return message.reply('❌ Usa: `!setreaction <message_id> <emoji> @cargo`');

        await pool.query(
            'INSERT INTO reactions (message_id, emoji, role_id) VALUES ($1, $2, $3)',
            [messageId, emoji, role.id]
        );

        message.reply(`✅ Reação configurada!\nMensagem: **${messageId}**\nEmoji: ${emoji}\nCargo: ${role.name}`);
    }
});

// --- Reação adicionada ---
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    const res = await pool.query(
        'SELECT * FROM reactions WHERE message_id = $1 AND emoji = $2',
        [reaction.message.id, reaction.emoji.name]
    );

    if (res.rowCount > 0) {
        const roleId = res.rows[0].role_id;
        const member = await reaction.message.guild.members.fetch(user.id);
        await member.roles.add(roleId);

        console.log(`✅ Cargo atribuído a ${user.tag}`);
    }
});

// --- Erros globais ---
client.on('error', console.error);
process.on('unhandledRejection', console.error);

// --- Express (para Railway manter ativo) ---
const app = express();
app.get('/', (_, res) => res.send('Bot online!'));
app.listen(3000, () => console.log('🌐 Servidor web rodando na porta 3000'));

client.login(process.env.TOKEN);
