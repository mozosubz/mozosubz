# Mozosubz V1 API Documentation

## Base URL
```
https://mozosubz.xyz/api/mozosubz/v1
```

## Authentication
All endpoints require the `X-Connect-Key` header:
```
X-Connect-Key: your_connect_key_here
```

## Endpoints

### Data Services

#### GET Data Plans
```
POST /data/plans
Content-Type: application/json
X-Connect-Key: your_connect_key_here

{
  "serviceID": "mtn_sme" | "mtn_datashare" | "mtn_gifting" | "mtn_awoof" | "glo_data" | "glo_sme" | "airtel_sme" | "etisalat_data"
}
```

#### Purchase Data
```
POST /data/purchase
Content-Type: application/json
X-Connect-Key: your_connect_key_here

{
  "serviceID": "mtn_sme",
  "plan": "plan_value",
  "phone": "08012345678",
  "requestID": "optional_unique_id"
}
```

### Cable Services

#### Get Cable Plans
```
POST /cable/plans
Content-Type: application/json
X-Connect-Key: your_connect_key_here

{
  "service": "dstv" | "gotv" | "startimes"
}
```

#### Subscribe Cable
```
POST /cable/subscribe
Content-Type: application/json
X-Connect-Key: your_connect_key_here

{
  "serviceID": "dstv",
  "plan": "plan_value",
  "phone": "08012345678",
  "customerID": "customer_smart_card",
  "requestID": "optional_unique_id"
}
```

### Electricity Services

#### Purchase Electricity
```
POST /electricity/purchase
Content-Type: application/json
X-Connect-Key: your_connect_key_here

{
  "serviceID": "eko_electric",
  "phone": "08012345678",
  "customerID": "meter_number",
  "amount": "5000",
  "variation_code": "01" | "02",
  "requestID": "optional_unique_id"
}
```

### Airtime Services

#### Purchase Airtime
```
POST /airtime/purchase
Content-Type: application/json
X-Connect-Key: your_connect_key_here

{
  "serviceID": "mtn_airtime" | "glo_airtime" | "airtel_airtime" | "etisalat_airtime",
  "amount": "100",
  "phone": "08012345678",
  "requestID": "optional_unique_id"
}
```

### Account Services

#### Get Wallet Balance
```
GET /balance
X-Connect-Key: your_connect_key_here
```

#### Verify Transaction
```
POST /verify
Content-Type: application/json
X-Connect-Key: your_connect_key_here

{
  "requestID": "transaction_request_id"
}
```

#### Generate Recharge Pins
```
POST /pins/generate
Content-Type: application/json
X-Connect-Key: your_connect_key_here

{
  "network": "mtn" | "glo" | "airtel" | "etisalat",
  "value": "100" | "200" | "500" | "1000",
  "number": "3"
}
```

### Deposit Services

#### Initiate Deposit
```
POST /deposit/start
Content-Type: application/json
X-Connect-Key: your_connect_key_here

{
  "amount": "5000",
  "description": "Wallet deposit"
}
```

Response:
```json
{
  "success": true,
  "paymentReference": "unique_reference",
  "transactionId": "transaction_id",
  "checkoutUrl": "/checkout/payment_reference"
}
```

## Response Format
All successful responses:
```json
{
  "success": true,
  "data": { }
}
```

All error responses:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Rate Limiting
- 10,000 requests per day per Connect Key
- Rate resets every 24 hours

## Logging
All API calls are logged with `[MOZOSUBZ-V1]` prefix in console for debugging.
