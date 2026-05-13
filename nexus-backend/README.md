# Nexus Backend API

Full-stack backend for the Nexus Investor–Entrepreneur Collaboration Platform.

## Tech Stack
- **Runtime**: Node.js + Express
- **Database**: MongoDB (Mongoose)
- **Auth**: JWT (access + refresh tokens) + bcrypt
- **Real-time**: Socket.IO (chat + WebRTC signaling)
- **File Storage**: Cloudinary (documents, avatars, signatures)
- **Payments**: Stripe sandbox
- **Email**: Nodemailer (Mailtrap for dev)
- **Security**: helmet, express-rate-limit, express-validator

---

## Quick Start

### 1. Clone & Install
```bash
cd nexus-backend
npm install
```

### 2. Environment Variables
```bash
cp .env.example .env
# Fill in all values (see .env.example)
```

### 3. Services to Set Up (all free tiers available)

| Service | Purpose | Sign Up |
|---------|---------|---------|
| MongoDB Atlas | Database | https://cloud.mongodb.com |
| Cloudinary | File storage | https://cloudinary.com |
| Mailtrap | Dev email | https://mailtrap.io |
| Stripe | Payments | https://stripe.com → Test mode |

### 4. Start
```bash
npm run dev   # development (nodemon)
npm start     # production
```

Backend runs on: `http://localhost:5000`

---

## API Reference

### Base URL
```
http://localhost:5000/api
```

### Authentication
All protected routes require:
```
Authorization: Bearer <accessToken>
```

---

### 🔐 Auth Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | ❌ | Register new user |
| POST | `/auth/login` | ❌ | Login (returns JWT) |
| POST | `/auth/verify-otp` | ❌ | Verify 2FA OTP |
| POST | `/auth/logout` | ✅ | Logout |
| GET | `/auth/me` | ✅ | Get current user |
| POST | `/auth/forgot-password` | ❌ | Send reset email |
| PATCH | `/auth/reset-password/:token` | ❌ | Reset password |
| PATCH | `/auth/change-password` | ✅ | Change password |
| PATCH | `/auth/toggle-2fa` | ✅ | Enable/disable 2FA |
| POST | `/auth/refresh-token` | ❌ | Refresh access token |

**Register Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password123",
  "role": "entrepreneur",
  "startupName": "My Startup",
  "industry": "FinTech",
  "location": "New York"
}
```

**Login Body:**
```json
{
  "email": "john@example.com",
  "password": "Password123",
  "role": "entrepreneur"
}
```

---

### 👥 User Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users` | ✅ | List all users (with filters) |
| GET | `/users/investors` | ✅ | List investors only |
| GET | `/users/entrepreneurs` | ✅ | List entrepreneurs only |
| GET | `/users/:id` | ✅ | Get user profile |
| PATCH | `/users/me` | ✅ | Update own profile |
| POST | `/users/me/avatar` | ✅ | Upload avatar (multipart/form-data) |
| DELETE | `/users/me` | ✅ | Deactivate account |

**Query params for GET /users:**
- `role=investor|entrepreneur`
- `industry=FinTech`
- `search=john`
- `page=1&limit=12`

---

### 📅 Meeting Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/meetings` | ✅ | Create meeting |
| GET | `/meetings` | ✅ | Get my meetings |
| GET | `/meetings/:id` | ✅ | Get single meeting |
| GET | `/meetings/:id/room` | ✅ | Get video room info |
| PATCH | `/meetings/:id/respond` | ✅ | Accept/reject meeting |
| PATCH | `/meetings/:id/cancel` | ✅ | Cancel meeting |

**Create Meeting Body:**
```json
{
  "title": "Pitch Meeting",
  "description": "Discussing Q1 investment",
  "scheduledAt": "2026-05-20T10:00:00Z",
  "duration": 60,
  "participants": ["userId1"],
  "type": "video",
  "agenda": ["Intro", "Product demo", "Q&A"]
}
```

**Respond Body:**
```json
{
  "status": "accepted",
  "message": "Looking forward to it!"
}
```

---

### 📄 Document Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/documents` | ✅ | Upload document (multipart) |
| GET | `/documents` | ✅ | Get my documents |
| GET | `/documents/:id` | ✅ | Get document + file URL |
| POST | `/documents/:id/version` | ✅ | Upload new version |
| POST | `/documents/:id/sign` | ✅ | Sign document (multipart) |
| POST | `/documents/:id/share` | ✅ | Share with users |
| DELETE | `/documents/:id` | ✅ | Delete document |

**Upload Document (FormData):**
```
file: <file binary>
name: "Pitch Deck Q1 2026"
category: pitch-deck | contract | term-sheet | nda | financial | other
description: "..."
sharedWith: ["userId1", "userId2"]  (JSON string)
requiresSignature: "true"
signatureRequestedFrom: ["userId1"]  (JSON string)
```

---

### 💳 Payment Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/payments/wallet` | ✅ | Get balance + transactions |
| GET | `/payments/transactions` | ✅ | Transaction history |
| POST | `/payments/deposit` | ✅ | Deposit funds |
| PATCH | `/payments/deposit/:id/confirm` | ✅ | Confirm deposit |
| POST | `/payments/withdrawal` | ✅ | Withdraw funds |
| POST | `/payments/transfer` | ✅ | Transfer to another user |
| POST | `/payments/webhook` | ❌ | Stripe webhook |

**Deposit Body:**
```json
{ "amount": 500, "type": "deposit" }
```

**Transfer Body:**
```json
{
  "recipientId": "userId",
  "amount": 1000,
  "description": "Seed investment",
  "dealId": "deal_001"
}
```

---

### 🤝 Collaboration Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/collaborations` | ✅ (investor) | Send request |
| GET | `/collaborations` | ✅ | Get my collaborations |
| PATCH | `/collaborations/:id/respond` | ✅ (entrepreneur) | Accept/reject |

---

### 💬 Message Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/messages/conversations` | ✅ | List conversations |
| GET | `/messages/:userId` | ✅ | Get chat with a user |
| POST | `/messages` | ✅ | Send message |
| PATCH | `/messages/read/:senderId` | ✅ | Mark as read |

---

### 🔔 Notification Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | ✅ | Get notifications |
| PATCH | `/notifications/read` | ✅ | Mark as read |
| DELETE | `/notifications/:id` | ✅ | Delete notification |

---

## Socket.IO Events

### Connection
```js
const socket = io('http://localhost:5000', {
  auth: { token: 'your_jwt_token' }
});
```

### Chat Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `chat:send` | Client → Server | `{ receiverId, content, type }` |
| `chat:message` | Server → Client | Message object |
| `chat:typing` | Client → Server | `{ receiverId, isTyping }` |
| `chat:typing` | Server → Client | `{ senderId, isTyping }` |
| `chat:read` | Client → Server | `{ senderId }` |
| `chat:read` | Server → Client | `{ readBy }` |

### Video Call Events (WebRTC Signaling)

| Event | Direction | Payload |
|-------|-----------|---------|
| `video:join-room` | Client → Server | `{ roomId }` |
| `video:room-participants` | Server → Client | `{ participants: [socketId] }` |
| `video:user-joined` | Server → Client | `{ userId, userName, socketId }` |
| `video:offer` | Client → Server | `{ offer, targetSocketId }` |
| `video:offer` | Server → Client | `{ offer, fromSocketId, fromUser }` |
| `video:answer` | Client → Server | `{ answer, targetSocketId }` |
| `video:answer` | Server → Client | `{ answer, fromSocketId }` |
| `video:ice-candidate` | Client → Server | `{ candidate, targetSocketId }` |
| `video:ice-candidate` | Server → Client | `{ candidate, fromSocketId }` |
| `video:toggle-media` | Client → Server | `{ roomId, type, enabled }` |
| `video:media-toggle` | Server → Client | `{ userId, type, enabled }` |
| `video:leave-room` | Client → Server | `{ roomId }` |
| `video:user-left` | Server → Client | `{ userId, socketId }` |

### Presence Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `user:online` | Server → All | `{ userId, isOnline }` |
| `notification` | Server → Client | Notification object |

---

## Frontend Integration Guide

### 1. Update AuthContext.tsx
Replace the mock `login` and `register` functions with real API calls:

```typescript
// src/services/api.ts
import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('nexus_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
```

```typescript
// In AuthContext.tsx login():
const response = await API.post('/auth/login', { email, password, role });
const { accessToken, user } = response.data;
localStorage.setItem('nexus_token', accessToken);
setUser(user);
```

### 2. Environment Variable in Vite
Add to `Nexus-main/.env`:
```
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## Project Structure
```
nexus-backend/
├── src/
│   ├── server.js              # Entry point
│   ├── config/
│   │   └── database.js        # MongoDB connection
│   ├── models/
│   │   ├── User.model.js
│   │   ├── Meeting.model.js
│   │   ├── Document.model.js
│   │   ├── Transaction.model.js
│   │   ├── Collaboration.model.js
│   │   ├── Message.model.js
│   │   └── Notification.model.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── meeting.controller.js
│   │   ├── document.controller.js
│   │   ├── payment.controller.js
│   │   ├── collaboration.controller.js
│   │   ├── message.controller.js
│   │   └── notification.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── meeting.routes.js
│   │   ├── document.routes.js
│   │   ├── payment.routes.js
│   │   ├── collaboration.routes.js
│   │   ├── message.routes.js
│   │   └── notification.routes.js
│   ├── middleware/
│   │   ├── auth.middleware.js    # JWT protect + restrictTo
│   │   ├── validation.middleware.js
│   │   └── upload.middleware.js  # Multer
│   ├── utils/
│   │   ├── jwt.utils.js
│   │   ├── email.utils.js
│   │   ├── cloudinary.utils.js
│   │   └── notification.utils.js
│   └── socket/
│       └── socketHandler.js     # Socket.IO + WebRTC signaling
├── .env.example
├── package.json
└── README.md
```

## Deployment

### Backend (Render)
1. Push to GitHub
2. New Web Service on Render
3. Build Command: `npm install`
4. Start Command: `node src/server.js`
5. Add all env vars in Render dashboard

### Frontend (Vercel)
1. Update `VITE_API_URL` to your Render URL
2. Deploy normally to Vercel
