import { pool } from './db.js';
import { hashPassword } from './auth.js';
import dotenv from 'dotenv';

dotenv.config();

async function createAdmin() {
  try {
    const email = 'amour@admin.com';
    const password = 'amour@2456';
    const fullName = 'Admin User';
    const role = 'admin';
    const balance = 0.00; // Admins don't have balance

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, balance, is_active) 
       VALUES ($1, $2, $3, $4, $5, true) 
       ON CONFLICT (email) 
       DO UPDATE SET 
         password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         full_name = EXCLUDED.full_name,
         balance = EXCLUDED.balance
       RETURNING id, email, full_name, role, balance, is_active`,
      [email, passwordHash, fullName, role, balance]
    );

    console.log('✅ Admin user created successfully!');
    console.log('-----------------------------------');
    console.log('Email:', result.rows[0].email);
    console.log('Role:', result.rows[0].role);
    console.log('Balance:', result.rows[0].balance);
    console.log('Status:', result.rows[0].is_active ? 'Active' : 'Inactive');
    console.log('-----------------------------------');
    console.log('You can now login with:');
    console.log('Email: amour@admin.com');
    console.log('Password: amour@2456');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

// Initialize database first, then create admin
import('./db.js').then(({ initDatabase }) => {
  initDatabase().then(() => {
    createAdmin();
  });
});
