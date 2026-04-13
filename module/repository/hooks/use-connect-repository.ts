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
      toast.success("Repository connected successfully"),
      queryClient.invalidateQueries({queryKey:["repositories"]})
    },
    onError:(error)=>{
      const message = error instanceof Error ? error.message : "Failed to connect repository";
      const shouldUpgrade = message.toLowerCase().includes("upgrade") || message.toLowerCase().includes("limit");

      toast.error("Failed to connect repository", {
        description: message,
        action: shouldUpgrade
          ? {
              label: "Upgrade",
              onClick: () => router.push("/dashboard/subscription"),
            }
          : undefined,
      })
      console.error("Error connecting repository:", error)
    }
  })

}
