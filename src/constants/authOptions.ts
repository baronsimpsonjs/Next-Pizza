import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { type NextAuthOptions } from 'next-auth';
import { prisma } from '@/prisma/prisma-client';
import { compare, hashSync } from 'bcryptjs';
import { UserRole } from '@prisma/client';

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID ?? '',
      clientSecret: process.env.GITHUB_SECRET ?? '',
      profile(profile) {
        return {
          id: profile.id,
          email: profile.email,
          name: profile.name || profile.login,
          image: profile.avatar_url,
          role: 'USER' as UserRole,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        const isPasswordValid = await compare(
          credentials.password,
          user.password,
        );
        if (!isPasswordValid || !user.verified) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
        };
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account }) {
      try {
        if (account?.provider === 'credentials') {
          return true;
        }

        if (!user.email) return false;

        const findUser = await prisma.user.findFirst({
          where: {
            OR: [
              {
                provider: account?.provider,
                providerId: account?.providerAccountId,
              },
              { email: user.email },
            ],
          },
        });

        if (findUser) {
          await prisma.user.update({
            where: {
              id: findUser.id,
            },
            data: {
              provider: account?.provider,
              providerId: account?.providerAccountId,
            },
          });
          return true;
        }
        if (!findUser) {
          await prisma.user.create({
            data: {
              email: user.email,
              fullName: user.name || 'User #' + user.id,
              password: hashSync(String(user.id), 10),
              verified: new Date(),
              provider: account?.provider,
              providerId: account?.providerAccountId,
            },
          });
        }
        return true;
      } catch (error) {
        console.error('Error [SIGNIN]', error);
        return false;
      }
    },
    async jwt({ token }) {
      if (!token?.email) return token;

      const user = await prisma.user.findUnique({
        where: { email: token.email },
      });

      if (user) {
        token.id = String(user.id);
        token.email = user.email;
        token.name = user.fullName;
        token.role = user.role;
      }

      return token;
    },
    session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
