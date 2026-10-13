# Bot Polling System - Deposit Notifications

## Overview

Your bot can check for completed deposits by polling the notification endpoint. When a deposit is paid in the Bachs checkout, the webhook automatically updates the transaction status, and your bot can retrieve these updates via polling.

## How It Works

1. **Bot initiates deposit** → Shows bank details to user
2. **User pays** → Bachs confirms the payment in the checkout
3. **Webhook fires** → System updates transaction to `SUCCESS` and credits wallet
4. **Bot polls** → Checks for completed deposits
5. **Bot notifies user** → Sends confirmation on WhatsApp/Telegram

## Endpoints

### 1. GET /api/v1/bot/pending-notifications

Check for completed deposits and pending wallet updates.

**Endpoint:** `GET /api/v1/bot/pending-notifications`

**Headers:**
```
X-Connect-Key: {API_KEY}
Content-Type: application/json
```

**Query Parameters:**
- `last_check_at` (optional): ISO timestamp - only return notifications after this time
  - Example: `2024-01-15T16:00:00Z`
  - Prevents retrieving old notifications multiple times
- `limit` (optional): Maximum number of notifications (1-100, default: 20)

**Response (Success):**
```json
{
  "success": true,
  "pending_notifications": [
    {
      "type": "deposit_completed",
      "deposit_amount": 500,
      "receiving_amount": 450,
      "payment_reference": "MOZO_50f1dbfb_1784763533924_oyhu",
      "completed_at": "2024-01-15T16:45:00Z",
      "bank_details": {
        "account_number": "6893099038",
        "account_name": "Bachs Checkout",
        "bank_name": "Moniepoint Microfinance Bank"
      },
      "new_wallet_balance": 1000
    }
  ],
  "wallet_balance": 1000,
  "timestamp": "2024-01-15T17:00:00Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid API key"
}
```

**Status Codes:**
- `200` - Successfully retrieved notifications
- `400` - Invalid query parameters
- `401` - Invalid or missing API key
- `500` - Server error

---

### 2. POST /api/v1/bot/acknowledge-notification

Mark a notification as acknowledged/processed (optional but recommended to track delivery).

**Endpoint:** `POST /api/v1/bot/acknowledge-notification`

**Headers:**
```
X-Connect-Key: {API_KEY}
Content-Type: application/json
```

**Request:**
```json
{
  "payment_reference": "MOZO_50f1dbfb_1784763533924_oyhu",
  "notification_type": "deposit_completed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Notification acknowledged"
}
```

---

## Implementation Examples

### Python Bot Polling

```python
import requests
import time
from datetime import datetime, timedelta

class MozosubzBotNotificationPoller:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://api.mozosubz.xyz/api/v1/bot"
        self.headers = {
            "X-Connect-Key": api_key,
            "Content-Type": "application/json"
        }
        self.last_check_at = None
    
    def check_for_deposits(self, limit=20):
        """Poll for pending deposit notifications"""
        url = f"{self.base_url}/pending-notifications"
        
        params = {"limit": limit}
        if self.last_check_at:
            params["last_check_at"] = self.last_check_at
        
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            
            data = response.json()
            
            if not data.get("success"):
                print(f"Error: {data.get('error')}")
                return []
            
            notifications = data.get("pending_notifications", [])
            
            # Update last check time for next poll
            self.last_check_at = data.get("timestamp")
            
            return notifications
            
        except requests.RequestException as e:
            print(f"Error checking notifications: {e}")
            return []
    
    def process_notification(self, notification):
        """Process a single deposit notification"""
        if notification["type"] == "deposit_completed":
            deposit = notification["deposit_amount"]
            receiving = notification["receiving_amount"]
            ref = notification["payment_reference"]
            balance = notification["new_wallet_balance"]
            
            # Build message for WhatsApp/Telegram
            message = f"""
✅ Payment Received!

Deposit Amount: ₦{deposit}
You Received: ₦{receiving}
Reference: {ref}
New Balance: ₦{balance}
            """.strip()
            
            return message
    
    def acknowledge_notification(self, payment_reference):
        """Acknowledge that bot displayed notification to user"""
        url = f"{self.base_url}/acknowledge-notification"
        
        payload = {
            "payment_reference": payment_reference,
            "notification_type": "deposit_completed"
        }
        
        try:
            response = requests.post(url, json=payload, headers=self.headers)
            response.raise_for_status()
            return response.json().get("success", False)
        except requests.RequestException as e:
            print(f"Error acknowledging notification: {e}")
            return False
    
    def start_polling(self, poll_interval=30, display_callback=None):
        """
        Start polling for deposits
        
        poll_interval: seconds between polls (recommend 30-60 seconds)
        display_callback: function(message, payment_ref) to display to user
        """
        print("Bot polling started...")
        
        while True:
            try:
                notifications = self.check_for_deposits(limit=20)
                
                for notification in notifications:
                    # Process notification
                    message = self.process_notification(notification)
                    payment_ref = notification["payment_reference"]
                    
                    # Display to user via callback
                    if display_callback:
                        display_callback(message, payment_ref)
                    
                    # Acknowledge that we displayed it
                    self.acknowledge_notification(payment_ref)
                
                if notifications:
                    print(f"Processed {len(notifications)} notifications")
                
                # Wait before next poll
                time.sleep(poll_interval)
                
            except Exception as e:
                print(f"Error in polling loop: {e}")
                time.sleep(poll_interval)


# Usage example
if __name__ == "__main__":
    api_key = "connect_your_key_here"
    poller = MozosubzBotNotificationPoller(api_key)
    
    # Define callback to send message to user
    def send_to_user(message, ref):
        # This would be your WhatsApp/Telegram sending logic
        print(f"SENDING TO USER:\n{message}")
    
    # Start polling every 30 seconds
    poller.start_polling(poll_interval=30, display_callback=send_to_user)
```

### JavaScript/Node.js Bot Polling

```javascript
const axios = require('axios');

class MozosubzBotNotificationPoller {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = "https://api.mozosubz.xyz/api/v1/bot";
        this.headers = {
            "X-Connect-Key": apiKey,
            "Content-Type": "application/json"
        };
        this.lastCheckAt = null;
    }

    async checkForDeposits(limit = 20) {
        try {
            const params = new URLSearchParams();
            params.append('limit', limit);
            
            if (this.lastCheckAt) {
                params.append('last_check_at', this.lastCheckAt);
            }

            const response = await axios.get(
                `${this.baseUrl}/pending-notifications?${params}`,
                { headers: this.headers }
            );

            const data = response.data;
            
            if (!data.success) {
                console.error(`Error: ${data.error}`);
                return [];
            }

            // Update last check time
            this.lastCheckAt = data.timestamp;
            
            return data.pending_notifications || [];
            
        } catch (error) {
            console.error('Error checking notifications:', error.message);
            return [];
        }
    }

    async processNotification(notification) {
        if (notification.type === 'deposit_completed') {
            const deposit = notification.deposit_amount;
            const receiving = notification.receiving_amount;
            const ref = notification.payment_reference;
            const balance = notification.new_wallet_balance;

            const message = `
✅ Payment Received!

Deposit Amount: ₦${deposit}
You Received: ₦${receiving}
Reference: ${ref}
New Balance: ₦${balance}
            `.trim();

            return message;
        }
    }

    async acknowledgeNotification(paymentReference) {
        try {
            const response = await axios.post(
                `${this.baseUrl}/acknowledge-notification`,
                {
                    payment_reference: paymentReference,
                    notification_type: "deposit_completed"
                },
                { headers: this.headers }
            );

            return response.data.success;
        } catch (error) {
            console.error('Error acknowledging notification:', error.message);
            return false;
        }
    }

    async startPolling(pollInterval = 30, displayCallback = null) {
        console.log('Bot polling started...');

        while (true) {
            try {
                const notifications = await this.checkForDeposits(20);

                for (const notification of notifications) {
                    // Process notification
                    const message = await this.processNotification(notification);
                    const paymentRef = notification.payment_reference;

                    // Display to user
                    if (displayCallback) {
                        displayCallback(message, paymentRef);
                    }

                    // Acknowledge
                    await this.acknowledgeNotification(paymentRef);
                }

                if (notifications.length > 0) {
                    console.log(`Processed ${notifications.length} notifications`);
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));

            } catch (error) {
                console.error('Error in polling loop:', error.message);
                await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
            }
        }
    }
}

// Usage example
const apiKey = "connect_your_key_here";
const poller = new MozosubzBotNotificationPoller(apiKey);

async function sendToUser(message, ref) {
    // This would be your WhatsApp/Telegram sending logic
    console.log(`SENDING TO USER:\n${message}`);
}

// Start polling every 30 seconds
poller.startPolling(30, sendToUser);
```

---

## Best Practices

### Polling Interval
- **Minimum:** 30 seconds (too frequent wastes resources)
- **Recommended:** 30-60 seconds (balanced response time and efficiency)
- **Maximum:** 5 minutes (users shouldn't wait too long)

### Error Handling
- Handle network errors gracefully
- Don't stop polling on a single error
- Implement exponential backoff on repeated failures
- Log all errors for debugging

### Avoiding Duplicate Notifications
- Always use `last_check_at` parameter after first poll
- Store the `timestamp` from response and use it next time
- Optional: Call `/acknowledge-notification` to mark as processed

### Performance
- Cache API key securely
- Reuse HTTP connections (use connection pooling)
- Don't poll more than once per 30 seconds per user
- Batch multiple users' polls if managing many bots

---

## Notification Fields Explained

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Always `"deposit_completed"` for now |
| `deposit_amount` | number | Amount user intended to deposit (₦) |
| `receiving_amount` | number | Amount after fees (₦) |
| `payment_reference` | string | Unique transaction ID for tracking |
| `completed_at` | ISO string | When payment was received |
| `bank_details` | object | Bank account info user sent money to |
| `new_wallet_balance` | number | User's wallet balance after credit (₦) |

---

## Complete Polling Loop Example

Here's a complete, production-ready polling implementation:

```python
import asyncio
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("BotPoller")

class ProductionBotPoller:
    def __init__(self, api_key):
        self.poller = MozosubzBotNotificationPoller(api_key)
        self.retry_count = 0
        self.max_retries = 5
        self.poll_interval = 30
    
    async def notify_user(self, user_id, message):
        """Send notification to user via WhatsApp/Telegram"""
        logger.info(f"Notifying user {user_id}: {message[:50]}...")
        # TODO: Implement your messaging logic here
        pass
    
    async def poll_once(self):
        """Single poll operation"""
        try:
            notifications = self.poller.check_for_deposits(limit=20)
            
            for notif in notifications:
                msg = self.poller.process_notification(notif)
                user_id = notif.get("user_id")  # If available
                
                # Send notification
                await self.notify_user(user_id, msg)
                
                # Acknowledge
                self.poller.acknowledge_notification(notif["payment_reference"])
            
            if notifications:
                logger.info(f"Processed {len(notifications)} deposits")
                self.retry_count = 0  # Reset retry count on success
            
            return True
            
        except Exception as e:
            self.retry_count += 1
            logger.error(f"Poll failed (retry {self.retry_count}/{self.max_retries}): {e}")
            
            if self.retry_count >= self.max_retries:
                logger.error("Max retries reached. Check logs and restart bot.")
                self.retry_count = 0
            
            return False
    
    async def start(self):
        """Start polling loop"""
        logger.info(f"Starting bot poller (interval: {self.poll_interval}s)")
        
        while True:
            try:
                await self.poll_once()
                await asyncio.sleep(self.poll_interval)
            except Exception as e:
                logger.critical(f"Unexpected error in polling loop: {e}")
                await asyncio.sleep(self.poll_interval)

# Run
if __name__ == "__main__":
    poller = ProductionBotPoller("your_api_key")
    asyncio.run(poller.start())
```

---

## Troubleshooting

### No notifications returned
- Check that deposits have actually completed (webhook may still be processing)
- Verify the payment reference is in the `monnify_transactions` table with `status = 'SUCCESS'` (table name retained for historical rows; Bachs deposits are marked `provider = 'bachs'`)
- Make sure your API key has `bot` permissions

### "Invalid API key" error
- Verify the API key format is correct (should start with `connect_`)
- Confirm the key hasn't been revoked
- Check the `X-Connect-Key` header is set correctly

### Missing notifications
- Use `last_check_at` parameter - don't omit it after first poll
- Check that bot didn't miss the polling window (webhook might have updated while bot was offline)
- Consider polling more frequently during high-traffic hours

---

## Support

For issues or questions about the polling system:
- **Documentation:** This file
- **Endpoint Status:** Check logs at `/api/logs`
- **Support:** support@mozosubz.xyz
