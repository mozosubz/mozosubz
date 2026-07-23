# Bot Deposit Polling Implementation Guide

## Overview

The bot needs to continuously poll the deposit status endpoint to check if a user's payment has been received. This guide shows how to implement this in your bot framework (WhatsApp, Telegram, Discord, etc.).

## Flow

```
1. User says "Deposit ₦100"
   ↓
2. Bot calls POST /api/v1/wallet/deposit
   ↓
3. Bot receives payment_reference (e.g., "MOZO_50f1dbfb_1784765236097_9u76")
   ↓
4. Bot displays bank details and stores payment_reference
   ↓
5. Bot starts polling loop with the payment_reference every 10 seconds
   ↓
6. Webhook receives payment from Monnify
   ↓
7. Next poll (within 10 seconds) returns status: "SUCCESS"
   ↓
8. Bot notifies user: "✅ Payment received! You received ₦50"
   ↓
9. Bot stops polling
```

## API Endpoint

**URL:** `GET /api/v1/bot/pending-notifications`

**Query Parameters:**
- `payment_reference` (required) - The payment reference from deposit initiation

**Response when payment received (SUCCESS):**
```json
{
  "success": true,
  "status": "SUCCESS",
  "deposit_amount": 100,
  "receiving_amount": 50,
  "wallet_balance": 1050,
  "message": "Payment received! You received ₦50 in your wallet."
}
```

**Response when still pending:**
```json
{
  "success": true,
  "status": "PENDING",
  "message": "Waiting for payment..."
}
```

**Response when error:**
```json
{
  "success": false,
  "error": "Payment reference not found"
}
```

## Implementation Examples

### Python (PyTelegramBotAPI)

```python
import telebot
import requests
import time
import threading

BOT_TOKEN = "your_bot_token"
API_BASE = "https://api.mozosubz.xyz"

bot = telebot.TeleBot(BOT_TOKEN)

def check_deposit_status(chat_id, payment_ref, max_attempts=180):
    """
    Poll deposit status every 10 seconds for up to 30 minutes
    """
    attempts = 0
    
    while attempts < max_attempts:
        try:
            response = requests.get(
                f"{API_BASE}/api/v1/bot/pending-notifications",
                params={"payment_reference": payment_ref},
                timeout=10
            )
            
            data = response.json()
            
            if not data.get("success"):
                print(f"Error checking status: {data.get('error')}")
                break
            
            if data.get("status") == "SUCCESS":
                # Payment received!
                bot.send_message(
                    chat_id,
                    f"✅ Payment received!\n\n"
                    f"Amount deposited: ₦{data.get('deposit_amount')}\n"
                    f"You received: ₦{data.get('receiving_amount')}\n"
                    f"New balance: ₦{data.get('wallet_balance')}\n\n"
                    f"Message: {data.get('message')}"
                )
                break
            else:
                # Still pending
                print(f"Still waiting... (attempt {attempts + 1})")
        
        except Exception as e:
            print(f"Error polling: {e}")
        
        # Wait 10 seconds before next poll
        time.sleep(10)
        attempts += 1
    
    if attempts >= max_attempts:
        bot.send_message(
            chat_id,
            "⏰ Deposit check timed out after 30 minutes. "
            "Your payment may still be processing. Please check your balance."
        )

@bot.message_handler(commands=['deposit'])
def deposit(message):
    """Handle deposit command"""
    chat_id = message.chat.id
    
    try:
        # Call deposit endpoint
        response = requests.post(
            f"{API_BASE}/api/v1/wallet/deposit",
            json={"amount": 1000},
            headers={"X-Connect-Key": "user_api_key"}  # Get this from login
        )
        
        data = response.json()
        
        if not data.get("success"):
            bot.send_message(chat_id, f"❌ Deposit failed: {data.get('error')}")
            return
        
        payment_ref = data.get("payment_reference")
        bank = data.get("bank_details", {})
        
        # Display bank details
        bot.send_message(
            chat_id,
            f"💳 Deposit Initiated\n\n"
            f"Amount to Pay: ₦{data.get('deposit_amount')}\n"
            f"You'll Receive: ₦{data.get('receiving_amount')}\n"
            f"Reference: {payment_ref}\n\n"
            f"Transfer to:\n"
            f"{bank.get('bank_name')}\n"
            f"{bank.get('account_number')}\n"
            f"({bank.get('account_name')})\n\n"
            f"Once received, your wallet updates automatically and I'll message you here."
        )
        
        # Start polling in background thread
        thread = threading.Thread(
            target=check_deposit_status,
            args=(chat_id, payment_ref)
        )
        thread.daemon = True
        thread.start()
    
    except Exception as e:
        bot.send_message(chat_id, f"Error: {e}")

bot.infinity_polling()
```

### JavaScript/Node.js (node-telegram-bot-api)

```javascript
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const BOT_TOKEN = 'your_bot_token';
const API_BASE = 'https://api.mozosubz.xyz';
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

async function checkDepositStatus(chatId, paymentRef, maxAttempts = 180) {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    try {
      const response = await axios.get(
        `${API_BASE}/api/v1/bot/pending-notifications`,
        {
          params: { payment_reference: paymentRef },
          timeout: 10000
        }
      );
      
      const data = response.data;
      
      if (!data.success) {
        console.log(`Error: ${data.error}`);
        break;
      }
      
      if (data.status === 'SUCCESS') {
        // Payment received!
        await bot.sendMessage(
          chatId,
          `✅ Payment received!\n\n` +
          `Amount deposited: ₦${data.deposit_amount}\n` +
          `You received: ₦${data.receiving_amount}\n` +
          `New balance: ₦${data.wallet_balance}\n\n` +
          `Message: ${data.message}`
        );
        break;
      } else {
        console.log(`Still waiting... (attempt ${attempts + 1})`);
      }
    } catch (error) {
      console.log(`Error polling: ${error.message}`);
    }
    
    // Wait 10 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 10000));
    attempts++;
  }
  
  if (attempts >= maxAttempts) {
    await bot.sendMessage(
      chatId,
      `⏰ Deposit check timed out after 30 minutes.\n` +
      `Your payment may still be processing. Please check your balance.`
    );
  }
}

bot.onText(/\/deposit/, async (msg) => {
  const chatId = msg.chat.id;
  
  try {
    const response = await axios.post(
      `${API_BASE}/api/v1/wallet/deposit`,
      { amount: 1000 },
      {
        headers: {
          'X-Connect-Key': 'user_api_key' // Get from login
        }
      }
    );
    
    const data = response.data;
    
    if (!data.success) {
      await bot.sendMessage(chatId, `❌ Deposit failed: ${data.error}`);
      return;
    }
    
    const bank = data.bank_details || {};
    
    // Display bank details
    await bot.sendMessage(
      chatId,
      `💳 Deposit Initiated\n\n` +
      `Amount to Pay: ₦${data.deposit_amount}\n` +
      `You'll Receive: ₦${data.receiving_amount}\n` +
      `Reference: ${data.payment_reference}\n\n` +
      `Transfer to:\n` +
      `${bank.bank_name}\n` +
      `${bank.account_number}\n` +
      `(${bank.account_name})\n\n` +
      `Once received, your wallet updates automatically and I'll message you here.`
    );
    
    // Start polling in background
    checkDepositStatus(chatId, data.payment_reference);
    
  } catch (error) {
    await bot.sendMessage(chatId, `Error: ${error.message}`);
  }
});

bot.on('polling_error', (error) => {
  console.log(error);
});
```

### Python + APScheduler (Async polling)

```python
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import aiohttp

class DepositPoller:
    def __init__(self, api_base="https://api.mozosubz.xyz"):
        self.api_base = api_base
        self.polling_tasks = {}  # Store polling tasks by payment_reference
        self.scheduler = AsyncIOScheduler()
        self.scheduler.start()
    
    async def poll_deposit_status(self, chat_id, payment_ref, callback):
        """
        Poll deposit status until SUCCESS
        callback(status, data) is called when status changes
        """
        max_attempts = 60
        attempts = 0
        
        while attempts < max_attempts:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.get(
                        f"{self.api_base}/api/v1/bot/pending-notifications",
                        params={"payment_reference": payment_ref},
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as resp:
                        data = await resp.json()
                        
                        if not data.get("success"):
                            print(f"Error: {data.get('error')}")
                            break
                        
                        if data.get("status") == "SUCCESS":
                            # Payment received!
                            await callback(chat_id, "SUCCESS", data)
                            break
                        else:
                            print(f"Still waiting... (attempt {attempts + 1})")
            
            except Exception as e:
                print(f"Error polling: {e}")
            
            # Wait 10 seconds
            await asyncio.sleep(10)
            attempts += 1
        
        if attempts >= max_attempts:
            await callback(chat_id, "TIMEOUT", {})

poller = DepositPoller()

async def on_deposit_update(chat_id, status, data):
    """Callback when deposit status updates"""
    if status == "SUCCESS":
        message = (
            f"✅ Payment received!\n\n"
            f"Amount deposited: ₦{data.get('deposit_amount')}\n"
            f"You received: ₦{data.get('receiving_amount')}\n"
            f"New balance: ₦{data.get('wallet_balance')}"
        )
    else:
        message = "⏰ Deposit check timed out"
    
    # Send message to user (implement based on your bot framework)
    print(f"Send to {chat_id}: {message}")

async def initiate_deposit(chat_id, payment_ref):
    """Start polling for this payment reference"""
    await poller.poll_deposit_status(
        chat_id,
        payment_ref,
        on_deposit_update
    )
```

## Key Points

1. **Store payment_reference** - Save it immediately when received from deposit endpoint
2. **Poll every 10 seconds** - Fast response time for better user experience
3. **Timeout after 30 minutes** - Give up if no response after 30 minutes (180 attempts x 10 seconds)
4. **Continuous loop** - Keep polling until status is "SUCCESS" or timeout
5. **Handle errors gracefully** - If API is down, keep retrying
6. **Notify user** - Send message when payment is received

## Testing

Before deploying:

```bash
# Test deposit endpoint
curl -X POST "https://api.mozosubz.xyz/api/v1/wallet/deposit" \
  -H "Content-Type: application/json" \
  -H "X-Connect-Key: YOUR_API_KEY" \
  -d '{"amount": 100}'

# Test status check (replace payment_reference)
curl -X GET "https://api.mozosubz.xyz/api/v1/bot/pending-notifications?payment_reference=MOZO_50f1dbfb_1784765236097_9u76"
```

## Production Considerations

1. **Rate Limiting** - API rate limits apply (50 requests/minute per key)
2. **Error Handling** - Don't crash if API is down, retry with exponential backoff
3. **Database** - Store payment references and polling status if needed
4. **Logging** - Log all deposit attempts and completions
5. **User Experience** - Update user every few polls ("Still checking... 2 minutes remaining")
6. **Timeout Handling** - After timeout, show user how to manually check balance
