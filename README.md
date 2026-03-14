# Professional Lottery Draw System

A complete lottery draw system with user authentication, balance management, and admin panel.

## Features

- User Authentication (Login/Signup)
- Prepayment Balance System ($1.00 per draw)
- Interactive number selection (1-20)
- Random winner drawing with animations
- Admin Panel:
  - Create users
  - Add/deduct balance
  - Activate/deactivate users
  - View all users and transactions
- PostgreSQL database
- JWT authentication
- Professional UI with Tailwind CSS

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React Icons

### Backend
- Node.js + Express
- PostgreSQL (Aiven Cloud)
- JWT Authentication
- bcryptjs for password hashing

## Setup Instructions

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### 2. Environment Variables

The `.env` file is already configured with your PostgreSQL database:

```

JWT_SECRET=your-secret-key-change-this-in-production-please
VITE_API_URL=http://localhost:3001
```

### 3. Start the Application

Open two terminal windows:

**Terminal 1 - Backend Server:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`
The backend API will run on `http://localhost:3001`

### 4. Create Admin User

After starting the server, the database tables will be created automatically. To create an admin user:

1. Sign up through the UI with any email/password
2. Connect to your PostgreSQL database and run:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

Or use a PostgreSQL client to update the user's role to 'admin'.

## Usage

### For Users:
1. Sign up or login
2. Add balance (admin must add balance initially)
3. Select numbers from the grid
4. Click "Draw Winner" (costs $1.00 per draw)
5. Balance is automatically deducted

### For Admins:
1. Login with admin account
2. Click "Admin" button in top right
3. Create new users
4. Add balance to user accounts
5. Activate/deactivate users
6. View all users and their balances

## Database Schema

- `users` - User accounts with email, password, role, balance, status
- `transactions` - All balance changes (credits/debits)
- `packages` - Predefined balance packages (for future payment integration)

## Security Features

- Password hashing with bcryptjs
- JWT token authentication
- Role-based access control (user/admin)
- Account activation/deactivation
- Transaction logging
- SSL database connection

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login

### User
- `GET /api/user/profile` - Get user profile
- `GET /api/user/transactions` - Get transaction history
- `POST /api/draw` - Perform lottery draw (deducts $1.00)

### Admin (requires admin role)
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create new user
- `PATCH /api/admin/users/:id/balance` - Add/deduct balance
- `PATCH /api/admin/users/:id/status` - Activate/deactivate user

### Packages
- `GET /api/packages` - List available packages

---

© 2026 Professional Lottery System
