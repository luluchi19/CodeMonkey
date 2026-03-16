import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./db";
import { polarClient } from "@/module/payment/config/polar";
import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth";
import { updatePolarCustomerId, updateUserTier } from "@/module/payment/lib/subscription";

function getCustomerIdFromPayload(payload: any): string | null {
  return (
    payload?.data?.customerId ||
    payload?.data?.customer_id ||
    payload?.data?.customer?.id ||
    null
  );
}

function getCustomerEmailFromPayload(payload: any): string | null {
  return (
    payload?.data?.customer?.email ||
    payload?.data?.customerEmail ||
    payload?.data?.email ||
    null
  );
}

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
      provider: "postgresql", // or "mysql", "postgresql", ...etc
    }),
    socialProviders: {
      github: {
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          scope: ["repo"]
      },
    },
    trustedOrigins: [process.env.NEXT_PUBLIC_APP_BASE_URL!, "http://localhost:3000"],
    plugins: [
      polar({
        client: polarClient,
        createCustomerOnSignUp: true,
        use: [
          checkout({
            products: [
                {
                    productId: "8dd30c66-78b9-4479-8d77-cd37b44ba7d5", //"8fdac07f-2e9f-4a0d-8b0c-ed76c89117a0",
                    slug: "pro" // Custom slug for easy reference in Checkout URL, e.g. /checkout/code-monkey
                }
            ],
            successUrl: process.env.POLAR_SUCCESS_URL || "http://localhost:3000/dashboard/subscription?success=true",
            authenticatedUsersOnly: true
          }),
          portal({
            returnUrl: process.env.POLAR_SUCCESS_URL || "http://localhost:3000/dashboard" // URL to return to after the customer is done in the portal
          }),
          usage(),
          webhooks({
            secret: process.env.POLAR_WEBHOOK_SECRET!,
            onSubscriptionActive: async (payload) => {
              const customerId = getCustomerIdFromPayload(payload);
              const customerEmail = getCustomerEmailFromPayload(payload);

              let user = customerId
                ? await prisma.user.findUnique({
                    where: {
                      polarCustomerId: customerId
                    }
                  })
                : null;

              if (!user && customerEmail) {
                user = await prisma.user.findUnique({
                  where: {
                    email: customerEmail
                  }
                });

                if (user && customerId) {
                  await updatePolarCustomerId(user.id, customerId);
                }
              }

              if (user) {
                await updateUserTier(user.id, "PRO", "ACTIVE", payload.data.id)
              }
            },
            onSubscriptionCanceled: async (payload) => {
              const customerId = getCustomerIdFromPayload(payload);
              const customerEmail = getCustomerEmailFromPayload(payload);

              let user = customerId
                ? await prisma.user.findUnique({
                    where: {
                      polarCustomerId: customerId
                    }
                  })
                : null;

              if (!user && customerEmail) {
                user = await prisma.user.findUnique({
                  where: {
                    email: customerEmail
                  }
                });

                if (user && customerId) {
                  await updatePolarCustomerId(user.id, customerId);
                }
              }

              if (user) {
                await updateUserTier(user.id, user.subscriptionTier as any, "CANCELLED")
              }
            },
            onSubscriptionRevoked: async (payload) => {
              const customerId = getCustomerIdFromPayload(payload);
              const customerEmail = getCustomerEmailFromPayload(payload);

              let user = customerId
                ? await prisma.user.findUnique({
                    where: {
                      polarCustomerId: customerId
                    }
                  })
                : null;

              if (!user && customerEmail) {
                user = await prisma.user.findUnique({
                  where: {
                    email: customerEmail
                  }
                });

                if (user && customerId) {
                  await updatePolarCustomerId(user.id, customerId);
                }
              }

              if (user) {
                await updateUserTier(user.id, "FREE", "EXPIRED")
              }
            },
            onOrderPaid: async () => {},
            onCustomerCreated: async (payload) => {
              const customerId = getCustomerIdFromPayload(payload);
              const customerEmail = getCustomerEmailFromPayload(payload);

              if (!customerId || !customerEmail) {
                return;
              }

              const user = await prisma.user.findUnique({
                where: {
                  email: customerEmail
                }
              });

              if (user) {
                await updatePolarCustomerId(user.id, customerId)
              }
            },
          })
        ],
      })
    ]
});