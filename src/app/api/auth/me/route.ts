export const dynamic = 'force-dynamic';
import { prisma } from '@/prisma/prisma-client';
import { getUserSession } from '@/src/lib';
import { NextResponse } from 'next/server';

export const GET = async () => {
  try {
    const user = await getUserSession();
    if (!user) {
      return NextResponse.json(
        { message: 'Вы не авторизованы' },
        { status: 401 },
      );
    }
    const data = await prisma.user.findUnique({
      where: {
        id: Number(user.id),
      },
      select: {
        email: true,
        fullName: true,
        password: false,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'ME_GET Server error' },
      { status: 500 },
    );
  }
};
