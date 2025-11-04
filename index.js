const { Client, GatewayIntentBits } = require('discord.js');
const mysql = require('mysql2/promise');
const express = require('express');

// --- Verificação das variáveis de ambiente ---
if (
    !process.env.TOKEN ||
    !process.env.MYSQL_HOST ||
    !process.env.MYSQL_USER ||
    !process.env.MYSQL_PASSWORD ||
    !process.env.MYSQL_DATABASE
) {
    console.error('❌ ERRO: TOKEN ou variáveis MySQL em falta!');
    console.error('Necessário: MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE');
    process.exit(1);
}

// --- Cliente Discord ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ]
});

// --- Conexão MySQL ---
let pool;
(async () => {
    try {
        pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: process.env.MYSQL_PORT || 3306,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });

        // Cria tabelas se não existirem
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reactions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                message_id VARCHAR(50) NOT NULL,
                emoji VARCHAR(50) NOT NULL,
                role_id VARCHAR(50) NOT NULL
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS log_channels (
                guild_id VARCHAR(50) PRIMARY KEY,
                channel_id VARCHAR(50) NOT NULL
            )
        `);

        console.log('🗄️ Conectado ao MySQL com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao conectar ao MySQL:', error);
    }
})();

// --- Evento Ready ---
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
            const [rows] = await pool.query('SELECT NOW() AS now');
            message.reply(`🟢 Banco de dados MySQL online!\nHora: ${rows[0].now}`);
        } catch (err) {
            console.error('❌ Erro ao conectar ao MySQL:', err);
            message.reply('🔴 Erro ao conectar ao banco de dados!');
        }
    }

    // --- Definir canal de logs ---
    if (args[0] === '!setlog') {
        const channel = message.mentions.channels.first();
        if (!channel) return message.reply('❌ Usa: `!setlog #canal`');

        await pool.query(
            'INSERT INTO log_channels (guild_id, channel_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE channel_id = VALUES(channel_id);',
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
            'INSERT INTO reactions (message_id, emoji, role_id) VALUES (?, ?, ?)',
            [messageId, emoji, role.id]
        );

        message.reply(`✅ Reação configurada!\nMensagem: **${messageId}**\nEmoji: ${emoji}\nCargo: ${role.name}`);
    }
});

// --- Quando alguém reage ---
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();

    try {
        const [rows] = await pool.query(
            'SELECT * FROM reactions WHERE message_id = ? AND emoji = ?',
            [reaction.message.id, reaction.emoji.name]
        );

        if (rows.length > 0) {
            const roleId = rows[0].role_id;
            const member = await reaction.message.guild.members.fetch(user.id);
            await member.roles.add(roleId);

            console.log(`✅ Cargo atribuído a ${user.tag}`);
        }
    } catch (error) {
        console.error('❌ Erro ao atribuir cargo:', error);
    }
});

// --- Erros globais ---
client.on('error', console.error);
process.on('unhandledRejection', console.error);

// --- Express (Railway "keep alive") ---
const app = express();
app.get('/', (_, res) => res.send('Bot online!'));
app.listen(3000, () => console.log('🌐 Servidor web rodando na porta 3000'));

client.login(process.env.TOKEN);
