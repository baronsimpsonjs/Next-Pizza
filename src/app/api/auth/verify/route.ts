export const dynamic = 'force-dynamic';
import { prisma } from '@/prisma/prisma-client';
import { NextRequest, NextResponse } from 'next/server';

export const GET = async (req: NextRequest) => {
  try {
    const code = req.nextUrl.searchParams.get('code');
    if (!code) {
      return NextResponse.json({ error: 'Неверный код' }, { status: 400 });
    }
    const verificationCode = await prisma.verificationCode.findFirst({
      where: {
        code,
      },
    });
    if (!verificationCode) {
      return NextResponse.json({ error: 'Неверный код' }, { status: 400 });
    }

    await prisma.user.update({
      where: {
        id: verificationCode.userId,
      },
      data: {
        verified: new Date(),
      },
    });

    await prisma.verificationCode.delete({
      where: {
        id: verificationCode.id,
      },
    });

    const response = NextResponse.redirect(`${process.env.FRONTEND_URL}`);
    response.cookies.set('toast', 'verified_success', {
      path: '/',
      httpOnly: false,
      maxAge: 30,
    });
    return response;
  } catch (error) {
    console.error('Error [VERIFY_GET]', error);
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 },
    );
  }
};
