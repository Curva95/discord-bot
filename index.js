const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

if (!process.env.TOKEN) {
    console.error('ERRO: TOKEN não encontrado!');
    console.error('Por favor, configure a variável de ambiente TOKEN com o token do seu bot Discord.');
    console.error('\nNo Railway: Vá em Variables e adicione TOKEN');
    console.error('No Replit: Configure nos Replit Secrets');
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', () => {
    console.log(`Bot online como ${client.user.tag}!`);
});

client.on('messageCreate', message => {
    if (message.content === '!oi') {
        message.reply('Olá! Eu estou online 😎');
    }
});

client.on('error', error => {
    console.error('Erro no cliente Discord:', error);
});

process.on('unhandledRejection', error => {
    console.error('Erro não tratado:', error);
});

client.login(process.env.TOKEN).catch(error => {
    console.error('Erro ao fazer login no Discord:', error);
    console.error('\nVerifique se:');
    console.error('1. O TOKEN está correto');
    console.error('2. As intents estão habilitadas no Discord Developer Portal');
    console.error('   - Acesse https://discord.com/developers/applications');
    console.error('   - Vá em Bot > Privileged Gateway Intents');
    console.error('   - Habilite MESSAGE CONTENT INTENT');
    process.exit(1);
});

const app = express();

app.get('/', (req, res) => {
    res.send('Bot online!');
});

app.listen(3000, () => {
    console.log('Servidor web rodando na porta 3000');
});
