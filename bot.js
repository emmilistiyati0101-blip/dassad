const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const config = require('./config');

const bot = new TelegramBot(config.telegram.botToken, { polling: false });
const processedTxs = new Set();

// Rate limiting for API calls
let lastApiCall = 0;
const API_COOLDOWN = 500; // 500ms between API calls

// Format helpers
function formatNumber(num, decimals = 2) {
  if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';
  return num.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

function formatPrice(price) {
  if (price < 0.00000001) return price.toFixed(12);
  if (price < 0.0000001) return price.toFixed(10);
  if (price < 0.000001) return price.toFixed(8);
  if (price < 0.0001) return price.toFixed(6);
  if (price < 0.01) return price.toFixed(4);
  return price.toFixed(2);
}

function formatUsd(amount) {
  return '$' + formatNumber(amount, 2);
}

// Dynamic emoji bar - configurable USD per emoji
function generateEmojiBar(amountUsd, emoji) {
  const emojiValue = config.alert.emojiValue || 10;
  const maxEmojis = config.alert.maxEmojis || 30;
  const count = Math.min(Math.max(1, Math.floor(amountUsd / emojiValue)), maxEmojis);
  return emoji.repeat(count);
}

// Axios instance with retry logic
const axiosRetry = axios.create({
  timeout: 10000,
});

async function fetchWithRetry(url, retries = 3, delay = 1000) {
  // Rate limiting
  const now = Date.now();
  if (now - lastApiCall < API_COOLDOWN) {
    await sleep(API_COOLDOWN - (now - lastApiCall));
  }
  lastApiCall = Date.now();

  for (let i = 0; i < retries; i++) {
    try {
      const response = await axiosRetry.get(url);
      return response;
    } catch (error) {
      const status = error.response?.status;
      if (status === 502 || status === 503 || status === 429) {
        if (i < retries - 1) {
          console.log(`⏳ API ${status}, retry ${i + 1}/${retries} in ${delay}ms...`);
          await sleep(delay * (i + 1)); // Exponential backoff
          continue;
        }
      }
      throw error;
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get token data from DexScreener
async function getTokenData() {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${config.token.address}`;
    const response = await fetchWithRetry(url);
    
    if (response.data?.pairs?.length > 0) {
      // Try to find MegaETH pair first, fallback to first pair
      return response.data.pairs.find(p => p.chainId === 'megaeth') || response.data.pairs[0];
    }
    return null;
  } catch (error) {
    console.error('❌ DexScreener error:', error.message);
    return null;
  }
}

// Create alert message
function createAlertMessage(trade, tokenData) {
  const { priceUsd, priceNative, fdv, marketCap, baseToken, quoteToken } = tokenData;

  const tokenName = config.token.name || baseToken?.name || 'Token';
  const tokenSymbol = config.token.symbol || baseToken?.symbol || 'TKN';
  const quoteSymbol = quoteToken?.symbol || 'ETH';
  
  const spentUsd = trade.amountUsd || 0;
  const spentNative = trade.amountNative || (spentUsd / parseFloat(priceNative || 1));
  const tokensReceived = trade.tokensReceived || (spentUsd / parseFloat(priceUsd || 1));
  const position = trade.position || 0;
  
  // Dynamic emoji bar based on buy amount
  const emojiBar = generateEmojiBar(spentUsd, config.alert.emoji);
  
  const buyerLink = trade.buyer 
    ? `<a href="${config.chain.explorer}/address/${trade.buyer}">Buyer</a>`
    : 'Buyer';
  
  const txLink = trade.txHash 
    ? `<a href="${config.chain.explorer}/tx/${trade.txHash}">Tx</a>`
    : 'Tx';
  
  const dexLink = `<a href="${config.buyLinks.dexScreener(config.token.address)}">Dexs</a>`;
  const buyLink = `<a href="${config.buyLinks.dexScreener(config.token.address)}">Buy ${tokenSymbol}</a>`;

  return `
<b>${tokenName} Buy!</b>
${emojiBar}
💰 Spent ${formatUsd(spentUsd)} (${formatNumber(spentNative, 4)} ${quoteSymbol})
🪙 Got ${formatNumber(tokensReceived)} ${tokenSymbol}
🎯 Position +${formatNumber(position)}%
🏷 Price $${formatPrice(parseFloat(priceUsd || 0))}
💸 Market Cap ${formatUsd(parseFloat(marketCap || fdv || 0))}

${buyerLink} | ${txLink} | ${dexLink} | ${buyLink}
`.trim();
}

// Send alert to Telegram
async function sendAlert(trade, tokenData) {
  const message = createAlertMessage(trade, tokenData);
  
  try {
    if (config.alert.imageUrl) {
      const method = config.alert.imageType === 'animation' ? 'sendAnimation' : 'sendPhoto';
      await bot[method](config.telegram.chatId, config.alert.imageUrl, {
        caption: message,
        parse_mode: 'HTML',
      });
    } else {
      await bot.sendMessage(config.telegram.chatId, message, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      });
    }
    const emojiCount = Math.min(Math.max(1, Math.floor(trade.amountUsd / (config.alert.emojiValue || 10))), config.alert.maxEmojis || 30);
    console.log(`✅ Alert sent: $${trade.amountUsd.toFixed(2)} | ${emojiCount} emojis`);
  } catch (error) {
    console.error('❌ Telegram error:', error.message);
  }
}

// Check for new buys
async function checkForNewBuys() {
  try {
    const tokenData = await getTokenData();
    if (!tokenData) {
      return;
    }

    const pairAddress = tokenData.pairAddress?.toLowerCase();
    const priceUsd = parseFloat(tokenData.priceUsd || 0);
    const priceNative = parseFloat(tokenData.priceNative || 1);
    
    if (!pairAddress) {
      console.log('⚠️ No pair address found');
      return;
    }
    
    // Get transfers from Blockscout API
    const url = `${config.chain.explorer}/api/v2/tokens/${config.token.address}/transfers?type=ERC-20`;
    const response = await fetchWithRetry(url);
    const transfers = response.data?.items || [];
    
    for (const transfer of transfers) {
      const txHash = transfer.transaction_hash || transfer.tx_hash;
      if (!txHash || processedTxs.has(txHash)) continue;
      
      processedTxs.add(txHash);
      
      // BUY = tokens FROM pair TO wallet (buyer receives tokens from DEX)
      const fromAddress = (transfer.from?.hash || '').toLowerCase();
      const toAddress = (transfer.to?.hash || '').toLowerCase();
      
      // Skip if not from the DEX pair
      if (fromAddress !== pairAddress) continue;
      // Skip if going back to DEX (not a buy)
      if (toAddress === pairAddress) continue;
      
      // Calculate amounts
      const decimals = parseInt(transfer.total?.decimals || transfer.token?.decimals || 18);
      const tokenAmount = parseFloat(transfer.total?.value || 0) / Math.pow(10, decimals);
      const amountUsd = tokenAmount * priceUsd;
      
      // Skip if below minimum
      if (amountUsd < config.alert.minBuyUsd) {
        console.log(`⭐ Skip small buy: $${amountUsd.toFixed(2)}`);
        continue;
      }
      
      console.log(`🚀 NEW BUY: $${amountUsd.toFixed(2)} | ${formatNumber(tokenAmount)} tokens`);
      
      await sendAlert({
        txHash,
        buyer: toAddress,
        amountUsd,
        amountNative: amountUsd / priceNative,
        tokensReceived: tokenAmount,
        position: 0,
      }, tokenData);
      
      // Small delay between alerts
      await sleep(500);
    }
    
    // Cleanup old transactions to prevent memory leak
    if (processedTxs.size > 1000) {
      const arr = Array.from(processedTxs);
      processedTxs.clear();
      arr.slice(-500).forEach(tx => processedTxs.add(tx));
      console.log('🧹 Cleaned up old transaction cache');
    }
    
  } catch (error) {
    const msg = error.message || '';
    // Only log non-transient errors
    if (!msg.includes('timeout') && !msg.includes('503') && !msg.includes('502') && !msg.includes('429')) {
      console.error('❌ Check error:', msg);
    }
  }
}

// Send demo alert for testing
async function sendDemoAlert() {
  console.log('📤 Sending demo alert...');
  
  const tokenData = await getTokenData();
  if (!tokenData) {
    console.log('❌ Could not fetch token data from DexScreener');
    console.log('ℹ️ Make sure the token is listed on a DEX');
    return;
  }
  
  console.log(`📊 Token found: ${tokenData.baseToken?.name || config.token.name}`);
  console.log(`💵 Price: $${tokenData.priceUsd || 'N/A'}`);
  console.log(`📈 MCap: $${formatNumber(parseFloat(tokenData.marketCap || tokenData.fdv || 0))}`);
  
  await sendAlert({
    txHash: '0xdemo' + Date.now().toString(16) + 'abcdef1234567890abcdef1234567890',
    buyer: '0xabcdef1234567890abcdef1234567890abcdef12',
    amountUsd: 150, // Will show 15 emojis at $10 each
    amountNative: 0.05,
    tokensReceived: 1000000,
    position: 500,
  }, tokenData);
  
  console.log('✅ Demo alert sent!');
}

// Pre-load existing transactions
async function preloadTransactions() {
  console.log('🔄 Loading existing transactions...');
  try {
    const url = `${config.chain.explorer}/api/v2/tokens/${config.token.address}/transfers?type=ERC-20`;
    const response = await fetchWithRetry(url, 3, 2000);
    const items = response.data?.items || [];
    items.forEach(t => {
      const hash = t.transaction_hash || t.tx_hash;
      if (hash) processedTxs.add(hash);
    });
    console.log(`📝 Loaded ${processedTxs.size} existing txs (will skip these)`);
  } catch (e) {
    console.log('⚠️ Could not pre-load transactions:', e.message);
  }
}

// Main entry point
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('🤖 MegaETH Buy Alert Bot v2.0');
  console.log('═══════════════════════════════════════');
  console.log(`📍 Token: ${config.token.address}`);
  console.log(`🏷️  Name: ${config.token.name} (${config.token.symbol})`);
  console.log(`💬 Chat: ${config.telegram.chatId}`);
  console.log(`💰 Min Buy: $${config.alert.minBuyUsd}`);
  console.log(`😀 Emoji: ${config.alert.emoji} ($${config.alert.emojiValue}/each, max ${config.alert.maxEmojis})`);
  console.log(`⏱️  Poll: ${config.polling.interval}ms`);
  console.log('═══════════════════════════════════════\n');

  // Check for demo mode
  if (process.argv.includes('--demo')) {
    await sendDemoAlert();
    process.exit(0);
  }

  // Pre-load existing transactions
  await preloadTransactions();

  console.log('✅ Bot running! Monitoring for NEW buys...\n');
  
  // Start polling
  setInterval(checkForNewBuys, config.polling.interval);
  
  // Initial check
  setTimeout(checkForNewBuys, 1000);
}

// Error handling
process.on('uncaughtException', (e) => {
  console.error('💥 Uncaught Exception:', e.message);
});

process.on('unhandledRejection', (e) => {
  console.error('💥 Unhandled Rejection:', e.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Bot stopped gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Bot stopped (SIGTERM)');
  process.exit(0);
});

// Start the bot
main();
