const { Client, GatewayIntentBits, Partials } = require('discord.js');
const express = require('express');
const { Pool } = require('pg');

// --- Verificação inicial ---
if (!process.env.TOKEN || !process.env.DATABASE_URL) {
    console.error('❌ ERRO: TOKEN ou DATABASE_URL não encontrados!');
    process.exit(1);
}

// --- Inicialização do bot ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// --- Express (mantém o Railway ativo) ---
const app = express();
app.get('/', (req, res) => res.send('Bot online!'));
app.listen(3000, () => console.log('🌐 Servidor web ativo na porta 3000'));

// --- Conexão ao PostgreSQL ---
let pool;
(async () => {
    try {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        // Tabelas necessárias
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reactions (
                id SERIAL PRIMARY KEY,
                message_id TEXT NOT NULL,
                emoji TEXT NOT NULL,
                role_id TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                log_channel_id TEXT
            );
        `);

        console.log('🗄️ Banco de dados inicializado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao inicializar o banco de dados:', error);
    }
})();

// --- Evento quando o bot estiver online ---
client.once('clientReady', () => {
    console.log(`✅ Bot online como ${client.user.tag}!`);
});

// --- Comandos ---
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    const isAdmin = message.member?.permissions.has('Administrator');
    if (!isAdmin) return;

    const args = message.content.split(' ');

    // ✅ Testa conexão ao banco
    if (message.content === '!dbstatus') {
        try {
            const result = await pool.query('SELECT NOW()');
            message.reply(`🟢 Banco de dados online!\nHora: ${result.rows[0].now}`);
        } catch (err) {
            console.error('Erro ao conectar ao banco:', err);
            message.reply('🔴 Erro ao conectar ao banco de dados!');
        }
    }

    // ✅ Define canal de logs
    else if (message.content.startsWith('!setlog')) {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('⚠️ Usa: `!setlog #canal`');

        await pool.query('DELETE FROM settings');
        await pool.query('INSERT INTO settings (log_channel_id) VALUES ($1)', [channel.id]);

        message.reply(`✅ Canal de logs definido para ${channel}`);
    }

    // ✅ Adiciona reação que dá cargo
    else if (message.content.startsWith('!setreaction')) {
        const [cmd, messageId, emoji, roleId] = args;
        if (!messageId || !emoji || !roleId) {
            return message.reply('⚠️ Usa: `!setreaction <ID da mensagem> <emoji> <ID do cargo>`');
        }

        await pool.query(
            'INSERT INTO reactions (message_id, emoji, role_id) VALUES ($1, $2, $3)',
            [messageId, emoji, roleId]
        );

        message.reply(`✅ Reação configurada!\nMensagem: ${messageId}\nEmoji: ${emoji}\nCargo: ${roleId}`);
    }
});

// --- Evento: usuário reage a uma mensagem ---
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    try {
        const result = await pool.query(
            'SELECT * FROM reactions WHERE message_id = $1 AND emoji = $2',
            [reaction.message.id, reaction.emoji.name]
        );
        if (result.rowCount === 0) return;

        const { role_id } = result.rows[0];
        const member = await reaction.message.guild.members.fetch(user.id);
        await member.roles.add(role_id);

        // Log opcional
        const settings = await pool.query('SELECT * FROM settings LIMIT 1');
        if (settings.rowCount > 0 && settings.rows[0].log_channel_id) {
            const logChannel = reaction.message.guild.channels.cache.get(settings.rows[0].log_channel_id);
            if (logChannel) logChannel.send(`✅ ${user.tag} recebeu o cargo <@&${role_id}> por reagir com ${reaction.emoji.name}`);
        }
    } catch (err) {
        console.error('Erro ao atribuir cargo:', err);
    }
});

// --- Erros globais ---
client.on('error', err => console.error('Erro no cliente Discord:', err));
process.on('unhandledRejection', err => console.error('Erro não tratado:', err));

// --- Login ---
client.login(process.env.TOKEN);
