import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { rateLimit, resetRateLimit, clientIp } from "./rate-limit";
import { Role } from "@prisma/client";

/**
 * A dummy hash to compare against when no user matches, so a wrong email and a
 * wrong password take the same amount of time. Without it, response timing
 * reveals which email addresses exist.
 */
const DUMMY_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.4pO0hE0Q8bZ7pHkxYHtLZ0OJyzVv4Zi";

const MAX_ATTEMPTS_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 20;
const WINDOW_MS = 15 * 60_000;

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        // Emails are stored lowercase; normalise here so a differently-cased
        // address still resolves to the same account.
        const email = credentials.email.trim().toLowerCase();

        // Credential stuffing had no ceiling of any kind before this.
        const ip = clientIp(new Headers(req?.headers as HeadersInit));
        const byEmail = rateLimit(
          `login:email:${email}`,
          MAX_ATTEMPTS_PER_EMAIL,
          WINDOW_MS
        );
        const byIp = rateLimit(`login:ip:${ip}`, MAX_ATTEMPTS_PER_IP, WINDOW_MS);

        if (!byEmail.allowed || !byIp.allowed) {
          throw new Error(
            "Too many sign-in attempts. Please wait a few minutes and try again."
          );
        }

        const user = await prisma.user.findUnique({ where: { email } });

        const isValid = await bcrypt.compare(
          credentials.password,
          user?.hashedPassword ?? DUMMY_HASH
        );

        if (!user || !isValid || !user.isActive) return null;

        resetRateLimit(`login:email:${email}`);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
      }

      // Re-read the role on session refresh so a deactivation or role change
      // takes effect without waiting for the 12-hour token to expire.
      if (trigger === "update" && token.id) {
        const current = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, isActive: true, name: true },
        });
        if (current?.isActive) {
          token.role = current.role;
          token.name = current.name;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id: string }).id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
};
