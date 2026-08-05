# JWT Authentication Implementation

## Security Fix

Previously, the system used header-based authentication (X-Tenant-ID and X-User-ID) which provided **zero security**. Anyone with valid UUIDs could impersonate any user.

Now with JWT tokens, the system has proper security.

## How JWT Works

### Token Flow

1. **Login/Register**: User submits credentials → Server validates → Returns JWT token
2. **Store Token**: Frontend stores token in localStorage (persisted)
3. **API Requests**: Every API call includes `Authorization: Bearer <token>` header
4. **Validation**: Server validates token signature, expiration, and extracts user info

### Token Format

JWT tokens contain (Base64 encoded):
```json
{
  "user_id": "uuid",
  "tenant_id": "uuid",
  "exp": "timestamp",
  "iat": "timestamp",
  "iss": "llm-eval-dashboard"
}
```

### Token Validation

- **Signature**: Verified against server secret key
- **Expiration**: 60 minutes (configurable)
- **Issuer**: "llm-eval-dashboard" (prevents replay attacks)

## Code Changes

### Backend

**1. New Auth Package** (`internal/auth/jwt.go`)
- `JWTManager` for token generation and validation
- `Claims` struct containing user_id, tenant_id
- Token expiration (60 minutes)

**2. Updated Handlers** (`internal/handlers/handlers.go`)
- `Login()`: Returns `{id, tenant_id, email, token}`
- `Register()`: Returns `{id, tenant_id, email, token}`
- `getAuth()`: Extracts and validates JWT from Authorization header

**3. Updated Middleware** (`internal/middleware/auth.go`)
- Validates JWT token before allowing access
- Returns 401 if token is missing/invalid/expired

**4. Updated Script** (`create-mock-test.sh`)
- Now requires `TOKEN` environment variable
- Uses `Authorization: Bearer <token>` header
- Shows token in use for debugging

### Frontend

**1. Auth Library** (`frontend/src/lib/auth.ts`)
- `useAuthToken` hook for token management
- `setToken()`, `clearToken()`, `isTokenExpired()`
- Stores in localStorage: `llm_eval.token`

**2. API Client** (`frontend/src/api/client.ts`)
- Axios interceptor adds `Authorization: Bearer <token>`
- Automatically clears token on 401 errors
- Toast notification for auth errors

**3. Auth Context** (`frontend/src/context/AuthContext.tsx`)
- Handles login/register with token storage
- Logout clears token from localStorage
- User info display

**4. Login/Register Pages**
- Displays received token
- Copy button for easy testing
- Logout functionality

## Security Benefits

### Before (Header-Based)
```bash
curl -H "X-Tenant-ID: any-uuid" \
     -H "X-User-ID: any-uuid"
# Anyone can impersonate any user!
```

### After (JWT-Based)
```bash
curl -H "Authorization: Bearer <valid-jwt-token>"
# Token must be:
# - Validly signed
# - Not expired
# - Extracted from database
```

### Protections
✅ **Signature Verification**: Token must be signed with server secret
✅ **Expiration**: Tokens expire after 60 minutes
✅ **Non-replay**: Expired tokens are rejected
✅ **Storage**: Client-side localStorage (not in URL)
✅ **Auto-clear**: Token cleared on logout or 401 error

## Testing

### Login Flow
1. Go to `/register` or `/login`
2. Enter credentials
3. Receive JWT token
4. Token is automatically stored and sent with all API calls

### Token Display
- **Login Page**: Click copy button to copy token
- **Register Page**: Click copy button to copy token
- Token stored in: `localStorage.getItem('llm_eval.token')`

### Using Script with Token
```bash
# Option 1: Set TOKEN environment variable
export TOKEN="$(cat ~/.llm_eval_token)"
./create-mock-test.sh

# Option 2: Pass directly
TOKEN="your-token-here" ./create-mock-test.sh

# Option 3: Store in file for convenience
echo "your-token-here" > ~/.llm_eval_token
./create-mock-test.sh
```

## Production Considerations

### Security Improvements Needed
1. **Secret Key**: Change `"your-secret-key-here-change-in-production"` to a strong random string
2. **Token Duration**: Consider 30 minutes for better security
3. **HTTPS**: Use HTTPS in production (prevents token sniffing)
4. **Token Storage**: Consider HttpOnly cookies instead of localStorage
5. **Rotation**: Implement token refresh mechanism
6. **Audit Log**: Log failed auth attempts

### Environment Variable
Add to `.env` file:
```
JWT_SECRET=your-very-long-random-secret-key-here
JWT_EXPIRATION=60
```

## Cleanup

**Removed for security**:
- ❌ X-Tenant-ID header (now not used)
- ❌ X-User-ID header (now not used)
- ❌ Direct UUID access (token required)

**Added for security**:
- ✅ JWT token authentication
- ✅ Token validation middleware
- ✅ Automatic token management
- ✅ Secure header injection

## Password Reset (Future)
Consider adding password reset functionality with:
- Email verification link
- Time-limited reset tokens
- Secure token delivery via email

## Rate Limiting (Future)
Add rate limiting to prevent:
- Brute force login attempts
- Token enumeration attacks
- Credential stuffing

## Audit Logging (Future)
Log for compliance:
- Successful logins with timestamp
- Failed login attempts
- Token generation/revocation events
- Resource access by user