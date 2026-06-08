'use server';

import { prisma } from '@/prisma/prisma-client';
import {
  getCartDetails,
  getMailDetails,
  getUserSession,
  parseSafe,
} from '@/src/lib';
import { OrderStatus } from '@prisma/client';
import { cookies } from 'next/headers';
import {
  CheckoutFormData,
  checkoutFormSchema,
} from '@/src/constants/schemas/checkout-form-schema';
import { generateLiqPayData, generateLiqPaySignature } from '@/src/lib/liqpay';
import { sendEmail } from '@/src/lib/mails/send-email';
import { randomBytes } from 'crypto';
import { hashSync } from 'bcryptjs';
import {
  RegisterFormData,
  registerFormSchema,
  UpdateUserData,
  updateUserSchema,
} from '@/src/constants/schemas/login-form-schema';

export async function createOrder(data: unknown): Promise<string | undefined> {
  const safeData = parseSafe<CheckoutFormData>(
    checkoutFormSchema,
    data,
    'createOrder',
  );
  try {
    const cookiesStore = cookies();
    const cartToken = cookiesStore.get('cartToken')?.value;

    if (!cartToken) {
      throw new Error('Cart token not found!');
    }

    const userCart = await prisma.cart.findFirst({
      where: { token: cartToken },
      include: {
        cartItems: {
          orderBy: { createdAt: 'desc' },
          include: {
            productItem: {
              include: {
                product: true,
              },
            },
            cartItemExcludedIngredients: {
              include: {
                ingredient: { select: { name: true } },
              },
            },
            cartItemExtraIngredients: {
              include: {
                ingredient: { select: { name: true, price: true } },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!userCart) {
      throw new Error('Cart not found!');
    }

    if (userCart?.totalAmount === 0) {
      throw new Error('Cart is empty!');
    }

    const cartData = getCartDetails(userCart);
    const orderToken = randomBytes(16).toString('hex');
    const [order] = await prisma.$transaction([
      prisma.order.create({
        data: {
          token: orderToken,
          fullName: `${safeData.firstName} ${safeData.lastName}`,
          email: safeData.email,
          phone: safeData.phone,
          address: `${safeData.city}, ${safeData.street}, ${safeData.house}`,
          comment: safeData.comment,
          totalAmount: cartData.totalAmount,
          status: OrderStatus.PENDING,
          items: JSON.stringify(cartData),
          ...(userCart.user?.id ? { userId: userCart.user.id } : {}),
        },
      }),

      prisma.cartItem.deleteMany({
        where: { cartId: userCart.id },
      }),

      prisma.cart.update({
        where: { id: userCart.id },
        data: { totalAmount: 0 },
      }),
    ]);

    const liqpayParams = {
      public_key: process.env.LIQPAY_PUBLIC_KEY!,
      action: 'pay',
      amount: cartData.totalAmount.toFixed(2),
      currency: 'UAH',
      description: `Оплата заказа №${order.id}`,
      order_id: orderToken,
      version: '3',
      sandbox: '1',
      email: safeData.email,
      phone: safeData.phone,
      result_url: `${process.env.FRONTEND_URL}/checkout/paid?token=${orderToken}`,
      server_url: `${process.env.FRONTEND_URL}/api/payment/liqpay-callback`,
    };

    const data = generateLiqPayData(liqpayParams);
    const signature = generateLiqPaySignature(
      data,
      process.env.LIQPAY_PRIVATE_KEY!,
    );

    const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const url = `${baseUrl}/checkout/liqpay-redirect?data=${encodeURIComponent(data)}&signature=${encodeURIComponent(signature)}`;

    const mailItems = getMailDetails(cartData.items);
    await sendEmail({
      type: 'order-confirmation',
      to: safeData.email,
      props: {
        fullName: `${safeData.firstName} ${safeData.lastName}`,
        address: `${safeData.city}, ${safeData.street}, ${safeData.house}`,
        items: mailItems,
        paymentUrl: url,
        totalAmount: cartData.totalAmount,
      },
    });

    return url;
  } catch (e) {
    console.log(e);
    return undefined;
  }
}

export const updateUserInfo = async (data: unknown) => {
  const safeData = parseSafe<UpdateUserData>(
    updateUserSchema,
    data,
    'updateUser',
  );
  try {
    const currentUser = await getUserSession();
    if (!currentUser) {
      throw new Error('Пользователь не найден');
    }
    await prisma.user.update({
      where: {
        id: Number(currentUser.id),
      },
      data: {
        email: safeData.email,
        fullName: safeData.fullName,
        password: hashSync(safeData.password, 10),
      },
    });
  } catch (error) {
    console.error('Error [UPDATE USER]', error);
    throw error;
  }
};

export const registerUser = async (data: unknown) => {
  const safeData = parseSafe<RegisterFormData>(
    registerFormSchema,
    data,
    'registerUser',
  );
  try {
    const user = await prisma.user.findUnique({
      where: {
        email: safeData.email,
      },
    });
    if (user) {
      if (!user.verified) {
        throw new Error('Почта не подтверждена!');
      }
      throw new Error('Пользователь уже существует!');
    }
    const createdUser = await prisma.user.create({
      data: {
        email: safeData.email,
        fullName: safeData.fullName,
        password: hashSync(safeData.password, 10),
      },
    });
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.verificationCode.create({
      data: {
        code,
        userId: createdUser.id,
      },
    });
    await sendEmail({
      type: 'verification-code',
      to: createdUser.email,
      props: {
        fullName: createdUser.fullName,
        code,
      },
    });
  } catch (error) {
    console.error('Error [REGISTER USER]', error);
    throw error;
  }
};
