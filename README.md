# MegaETH Buy Alert Bot 🚀

Telegram bot for automatic buy alerts on MegaETH chain tokens. Uses DexScreener API for price data and Blockscout for transaction monitoring.

## Features

- ✅ Real-time buy alerts for any MegaETH token
- ✅ Live price & market cap from DexScreener
- ✅ Dynamic emoji bar (scales with buy amount)
- ✅ Configurable minimum buy threshold
- ✅ Support for image/GIF in alerts
- ✅ Retry logic for API reliability
- ✅ Easy Railway deployment

## Alert Example

```
cumbaya Buy!
🍪🍪🍪🍪🍪🍪🍪🍪🍪🍪🍪🍪🍪🍪🍪
💰 Spent $150.00 (0.0500 ETH)
🪙 Got 1M CUM
🎯 Position +500%
🏷 Price $0.00015000
💸 Market Cap $150K

Buyer | Tx | Dexs | Buy CUM
```

## Deploy to Railway (Recommended)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/megaeth-buy-bot.git
git push -u origin main
```

### 2. Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect and deploy

### 3. Add Environment Variables

In Railway dashboard, go to your service → Variables → Add these:

| Variable | Value |
|----------|-------|
| `TELEGRAM_BOT_TOKEN` | Your bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Your group chat ID (e.g., -1001234567890) |
| `TOKEN_ADDRESS` | Token contract address |
| `TOKEN_NAME` | Token name for display |
| `TOKEN_SYMBOL` | Token symbol |
| `MIN_BUY_USD` | Minimum buy in USD to alert (e.g., 1) |
| `ALERT_EMOJI` | Emoji for the bar (e.g., 🍪) |
| `EMOJI_VALUE` | USD per emoji (e.g., 10) |
| `MAX_EMOJIS` | Maximum emojis to show (e.g., 30) |
| `ALERT_IMAGE` | Image/GIF URL (optional) |
| `IMAGE_TYPE` | `photo` or `animation` |
| `POLL_INTERVAL` | Check interval in ms (e.g., 3000) |

### 4. Done!

Railway will automatically restart with your environment variables.

## Local Development

### Install

```bash
npm install
```

### Configure

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

### Run

```bash
# Normal mode
npm start

# Test with demo alert
npm run demo
```

## Configuration Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather | required |
| `TELEGRAM_CHAT_ID` | Group chat ID | required |
| `TOKEN_ADDRESS` | Token contract address | required |
| `TOKEN_NAME` | Display name | TokenName |
| `TOKEN_SYMBOL` | Token symbol | TKN |
| `MIN_BUY_USD` | Min buy to trigger alert | 10 |
| `ALERT_EMOJI` | Emoji for buy bar | 🟢 |
| `EMOJI_VALUE` | USD value per emoji | 10 |
| `MAX_EMOJIS` | Max emojis in bar | 30 |
| `ALERT_IMAGE` | Image/GIF URL | (none) |
| `IMAGE_TYPE` | `photo` or `animation` | photo |
| `POLL_INTERVAL` | Poll interval (ms) | 5000 |

## Getting Telegram Credentials

### Bot Token
1. Message [@BotFather](https://t.me/BotFather)
2. Send `/newbot`
3. Follow prompts, copy the token

### Chat ID
1. Add bot to your group
2. Send a message in the group
3. Visit: `https://api.telegram.org/bot<TOKEN>/getUpdates`
4. Find `"chat":{"id":-100xxxxxxxxxx}`

## Troubleshooting

**Bot not sending alerts?**
- Ensure bot is added to the group with message permissions
- Check token address is correct
- Verify chat ID format (groups start with `-100`)

**502/503 errors in logs?**
- This is normal - Blockscout API can be slow
- Bot has retry logic built in
- Consider increasing `POLL_INTERVAL` to 5000+

**Token not found?**
- Ensure token is traded on a DEX
- Check DexScreener lists the token

## License

MIT
