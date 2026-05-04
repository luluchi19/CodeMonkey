import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { updateUserTier } from "@/module/payment/lib/subscription";

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const eventType = body.type;
    const payload = body;

    // Handle member.created event - triggered when subscription becomes active
    if (eventType === "member.created") {
      const customerId = getCustomerIdFromPayload(payload);
      const customerEmail = getCustomerEmailFromPayload(payload);

      let user = customerId
        ? await prisma.user.findUnique({
            where: {
              polarCustomerId: customerId,
            },
          })
        : null;

      if (!user && customerEmail) {
        user = await prisma.user.findUnique({
          where: {
            email: customerEmail,
          },
        });

        if (user && customerId) {
          await prisma.user.update({
            where: { id: user.id },
            data: { polarCustomerId: customerId },
          });
        }
      }

      if (user) {
        // Member created = subscription is active
        await updateUserTier(user.id, "PRO", "ACTIVE", payload.data.subscriptionId);
        console.log(`✅ Updated user ${user.id} to PRO on member.created`);
      }

      return NextResponse.json({ success: true, event: eventType });
    }

    // Log other events (checkout.created, customer.created, etc. are handled by Better-Auth)
    console.log(`📝 Received Polar webhook: ${eventType}`);
    return NextResponse.json({ received: true, event: eventType });
  } catch (error) {
    console.error("❌ Polar webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}