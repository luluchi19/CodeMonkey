"use client";
import React from 'react'
import { signOut } from '@/lib/auth-client'
import { useRouter } from 'next/navigation';

const Logout = ({
    children,
    className
}:{
    children: React.ReactNode,
    className?:string
}) => {
    const router = useRouter();
    
    const handleLogout = async () => {
        await signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/login");
                }
            }
        });
    };

  return (
    <button 
        type="button"
        className={className} 
        onClick={handleLogout}
    >
        {children}
    </button>
  )
}

export default Logout