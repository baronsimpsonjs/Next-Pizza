import { UserRole } from '@prisma/client';
import { hashSync } from 'bcryptjs';

export const users = [
  {
    fullName: 'User TEST',
    email: 'user@gmail.com',
    password: hashSync('111111', 10),
    verified: new Date(),
    role: UserRole.USER,
  },
  {
    fullName: 'Admin TEST',
    email: 'admin@gmail.com',
    password: hashSync('111111', 10),
    verified: new Date(),
    role: UserRole.ADMIN,
  },
];
