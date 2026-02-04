module.exports = {
  // Telegram Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE',
    chatId: process.env.TELEGRAM_CHAT_ID || 'YOUR_CHAT_ID_HERE',
  },

  // Token Configuration
  token: {
    address: process.env.TOKEN_ADDRESS || '0xYOUR_TOKEN_ADDRESS_HERE',
    name: process.env.TOKEN_NAME || 'TokenName',
    symbol: process.env.TOKEN_SYMBOL || 'TKN',
  },

  // MegaETH Chain Configuration
  chain: {
    name: 'megaeth',
    chainId: 6342,
    rpc: 'https://rpc.megaeth.com',
    explorer: 'https://megaeth.blockscout.com',
    dexScreenerChainId: 'megaeth',
  },

  // Alert Configuration
  alert: {
    minBuyUsd: parseFloat(process.env.MIN_BUY_USD) || 10,
    emoji: process.env.ALERT_EMOJI || '🟢',
    emojiValue: parseFloat(process.env.EMOJI_VALUE) || 10, // USD per emoji
    maxEmojis: parseInt(process.env.MAX_EMOJIS) || 30,
    imageUrl: process.env.ALERT_IMAGE || '',
    imageType: process.env.IMAGE_TYPE || 'photo', // 'photo' or 'animation'
  },

  // Polling Configuration
  polling: {
    interval: parseInt(process.env.POLL_INTERVAL) || 5000, // 5 seconds default (safer for API limits)
  },

  // Buy Links
  buyLinks: {
    dexScreener: (tokenAddress) => `https://dexscreener.com/megaeth/${tokenAddress}`,
  },
};
