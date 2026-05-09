"use client";

import { useMutation , useQueryClient } from "@tanstack/react-query";
import { connectRepository } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export const useConnectRepository = () => {

  const queryClient = useQueryClient()
  const router = useRouter()

  return useMutation({
    mutationFn: async({owner , repo , githubId}:{owner:string , repo:string , githubId:number})=>{
      return await connectRepository(owner , repo , githubId)
    },
    onSuccess:()=>{
      toast.success("✅ Repository connected successfully! Indexing in progress...");
      queryClient.invalidateQueries({queryKey:["repositories"]})
    },
    onError:(error)=>{
      const message = error instanceof Error ? error.message : "Failed to connect repository";
      const shouldUpgrade = message.toLowerCase().includes("upgrade") || message.toLowerCase().includes("limit");
      const isConfigError = message.toLowerCase().includes("config") || message.toLowerCase().includes("key");
      const isServiceError = message.toLowerCase().includes("500") || message.toLowerCase().includes("modal") || message.toLowerCase().includes("service");

      // Provide context-specific error messages
      let description = message;
      if (shouldUpgrade) {
        description = "You've reached your connection limit. Upgrade to PRO to add more repositories.";
      } else if (isConfigError) {
        description = "Configuration issue detected. Check your API keys and try again.";
      } else if (isServiceError) {
        description = "AI indexing service is temporarily unavailable. Please try clicking 'Connect' again in 1 minute.";
      }

      toast.error("⚠️ Connection failed", {
        description,
        action: shouldUpgrade
          ? {
              label: "Upgrade",
              onClick: () => router.push("/dashboard/subscription"),
            }
          : undefined,
      })
      console.error("Error connecting repository:", { error, message, context: { shouldUpgrade, isConfigError, isServiceError } })
    }
  })

}
