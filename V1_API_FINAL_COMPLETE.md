# Mozosubz V1 API - FINAL IMPLEMENTATION

## Base URL
`https://mozosubz.xyz/api/mozosubz/v1`

## Architecture Flow
External Request → V1 Endpoint (Connect Key Auth) → Internal Endpoint → Provider (GSUBZ/Monnify)

## Active Endpoints

### Data Services
- **POST /data/plans** - Get available data plans
- **POST /data/purchase** - Purchase data bundle

### Cable Services  
- **POST /cable/plans** - Get available cable plans
- **POST /cable/subscribe** - Subscribe to cable

### Electricity
- **POST /electricity/purchase** - Buy electricity token

### Airtime
- **POST /airtime/purchase** - Purchase airtime

### Account
- **GET /balance** - Get wallet balance
- **POST /verify** - Verify transaction status
- **POST /pins/generate** - Generate recharge pins

### Payments
- **POST /deposit/start** - Initiate deposit with Monnify

## Authentication
All endpoints require:
- Header: `X-Connect-Key: {connect_key}`
- Rate Limit: 10,000 requests per day

## Logging Standards
- All logs use `[MOZOSUBZ-V1-{SERVICE}]` prefix
- No admin client credentials logged
- No database credentials logged
- Generic error messages only

## Connect Key System
- Keys stored in `connect_keys` table with SHA-256 hash
- Automatic rate limiting tracking
- Key expiration & revocation support
- User context passed to internal endpoints

## All V1 Endpoints Call Internal API
Every V1 endpoint makes HTTP requests to `/api/gsubz/*` or `/api/deposit/*` internally, never calling provider functions directly. This ensures:
- Consistent logging through internal APIs
- Centralized business logic
- Proper error handling
- Future provider flexibility
