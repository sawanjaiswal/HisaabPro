// ─── HisaabPro — English Ext 27 (Marketing Comms — Phase 5 Epic A) ───────────

export const enExt27 = {
  // ── Nav ──────────────────────────────────────────────────────────────
  navMarketing:                     'Marketing',
  navMarketingCampaigns:            'Campaigns',
  navMarketingTemplates:            'Templates',
  navMarketingReminders:            'Reminders',
  navMarketingOptOuts:              'Opt-Outs',

  // ── Hub ───────────────────────────────────────────────────────────────
  marketingHubTitle:                'Marketing',
  marketingHubSubtitle:             'Campaigns, templates & reminders',

  // ── Campaign list ────────────────────────────────────────────────────
  campaignListTitle:                'Campaigns',
  campaignListEmpty:                'No campaigns yet',
  campaignListEmptyBody:            'Create your first campaign to reach your customers',
  campaignListEmptyCta:             'Create your first campaign',
  campaignListError:                'Could not load campaigns. Tap to retry.',
  campaignNewBtn:                   'New Campaign',

  // ── Campaign status labels ────────────────────────────────────────────
  campaignStatusDraft:              'Draft',
  campaignStatusScheduled:          'Scheduled',
  campaignStatusRunning:            'Running',
  campaignStatusCompleted:          'Completed',
  campaignStatusFailed:             'Failed',
  campaignStatusCancelled:          'Cancelled',

  // ── Campaign detail ──────────────────────────────────────────────────
  campaignDetailSentLabel:          'Sent',
  campaignDetailDeliveredLabel:     'Delivered',
  campaignDetailFailedLabel:        'Failed',
  campaignDetailRecipientsLabel:    'Recipients',
  campaignDetailCostLabel:          'Cost',
  campaignDetailScheduleLabel:      'Schedule',
  campaignDetailCancelBtn:          'Cancel Campaign',
  campaignDetailNoRecipients:       'Campaign has no recipients yet.',
  campaignDetailError:              'Could not load campaign details.',

  // ── Campaign cancel dialog ────────────────────────────────────────────
  campaignCancelTitle:              'Cancel this campaign?',
  campaignCancelBody:               'Messages already sent will not be recalled.',
  campaignCancelConfirm:            'Yes, Cancel',
  campaignCancelKeep:               'Keep Running',
  campaignCancelSuccess:            'Campaign cancelled.',

  // ── Wizard ───────────────────────────────────────────────────────────
  wizardTitle:                      'New Campaign',
  wizardStep1Label:                 'Name & Channel',
  wizardStep2Label:                 'Template',
  wizardStep3Label:                 'Audience',
  wizardStep4Label:                 'Schedule',
  wizardStep5Label:                 'Preview',
  wizardNextBtn:                    'Next',
  wizardLaunchBtn:                  'Launch Campaign',
  wizardLaunchingBtn:               'Launching...',
  wizardLaunchSuccess:              'Campaign launched! Sending to {count} customers.',
  wizardOfflineLaunch:              'Campaign launch requires an internet connection.',

  // ── Template list ────────────────────────────────────────────────────
  templateListTitle:                'Templates',
  templateListEmpty:                'No templates yet',
  templateNewBtn:                   'New Template',
  templateDeleteTitle:              'Delete this template?',
  templateDeleteBody:               'Campaigns using it cannot be re-launched.',

  // ── Template form ────────────────────────────────────────────────────
  templateFormNewTitle:             'New Template',
  templateFormEditTitle:            'Edit Template',
  templateFormChannelLabel:         'Send via',
  templateFormNameLabel:            'Template Name',
  templateFormBodyLabel:            'Message Body',
  templateFormVarsLabel:            'Variable Names (comma separated)',
  templateFormDltIdLabel:           'DLT Template ID',
  templateFormDltRegisteredLabel:   'DLT Registration confirmed with TRAI',
  templateFormWaNameLabel:          'WhatsApp Template Name (from Meta)',
  templateFormSaveBtn:              'Save Template',
  templateFormSavingBtn:            'Saving...',
  templateFormSuccess:              'Template saved.',

  // ── DLT warning ──────────────────────────────────────────────────────
  dltWarningNoId:                   'DLT Template ID required before this template can be used in an SMS campaign. Add it below and register with TRAI via MSG91 portal.',
  dltWarningNotRegistered:          'DLT Template ID is saved but not yet confirmed as registered. Set "DLT Registered" when your TRAI registration is complete.',

  // ── Reminder rules ───────────────────────────────────────────────────
  reminderListTitle:                'Reminder Rules',
  reminderListEmpty:                'No reminder rules',
  reminderListEmptyBody:            'Set up automatic follow-ups for birthdays, payments and more',
  reminderListError:                'Could not load rules.',
  reminderNewBtn:                   'New Reminder Rule',
  reminderFormNewTitle:             'New Reminder Rule',
  reminderFormEditTitle:            'Edit Rule',
  reminderFormSaveBtn:              'Save Rule',
  reminderFormSuccess:              'Reminder rule saved.',
  reminderDeleteTitle:              'Delete this reminder rule?',
  reminderDeleteBody:               'Scheduled reminders will be cancelled.',
  reminderTogglePause:              'Pause Rule',
  reminderToggleEnable:             'Enable Rule',

  // ── Opt-out ──────────────────────────────────────────────────────────
  optOutListTitle:                  'Opt-Outs',
  optOutListSubtitle:               'Contacts who won\'t receive marketing messages',
  optOutListEmpty:                  'No opt-outs',
  optOutListEmptyBody:              'All contacts are eligible to receive marketing messages',
  optOutConfirmTitle:               'Allow marketing messages for {name}?',
  optOutConfirmBody:                'This contact will start receiving marketing campaigns and reminders.',
  optOutAllowBtn:                   'Allow Messages',
  optOutActionStop:                 'Stop Marketing Messages',
  optOutActionAllow:                'Allow Marketing Messages',
  optOutSuccessStop:                '{name} will no longer receive marketing messages.',
  optOutSuccessAllow:               'Marketing messages re-enabled for {name}.',

  // ── Segment errors ───────────────────────────────────────────────────
  segmentEmpty:                     'No customers match these filters.',
  segmentTooLarge:                  'Audience too large (max 10,000). Add more filters.',
  segmentCountLoading:              'Counting recipients...',

  // ── Error messages ────────────────────────────────────────────────────
  errorNetworkFail:                 'Could not send request. Check your connection.',
  errorTemplateDltMissing:          'Add DLT Template ID to this template before launching an SMS campaign.',
  errorTemplateWaNameMissing:       'Add WhatsApp template name before launching.',
  errorTemplateWaNotApproved:       'WhatsApp template must be approved by Meta before launching.',
  errorCostCapExceeded:             'Estimated campaign cost exceeds your monthly budget cap.',

  // ── Quiet hours ───────────────────────────────────────────────────────
  quietHoursNotice:                 'Quiet hours enforced: Messages scheduled between {end} and {start} will be delivered after {end} IST as required by TRAI regulations.',
}
