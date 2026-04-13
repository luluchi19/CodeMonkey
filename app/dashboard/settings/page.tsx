"use client";

import { ProfileForm } from '@/module/settings/components/profile-form';
import { RepositoryList } from '@/module/settings/components/repository-list';
import { ReviewLanguageForm } from '@/module/settings/components/review-language-form';
import { ReviewSectionsForm } from '@/module/settings/components/review-sections-form';
import { ReviewAuditToggle } from '@/module/settings/components/review-audit-toggle';
import React from 'react'

const SettingPage = () => {
  return (
    <div className='space-y-6'>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and connected repositories</p>
      </div>
      <ProfileForm />
      <ReviewLanguageForm />
      <ReviewAuditToggle />
      <ReviewSectionsForm />
      <RepositoryList />
    </div>
  )
}

export default SettingPage
