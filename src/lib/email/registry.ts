export const EMAIL_EVENTS = {
  requestCreatedChurchConfirmation: {
    key: "request.created.church_confirmation",
    label: "Request posted confirmation",
    description: "Sent to a church after they create a service request.",
    subject: "Request posted: {{REQUEST_TITLE}}",
    category: "activity",
    suggestedTemplateName: "request-created-church-confirmation",
    templateEnv: "RESEND_TEMPLATE_REQUEST_CREATED_CHURCH_CONFIRMATION",
    tags: [
      { name: "CHURCH_NAME", description: "The church profile name." },
      { name: "REQUEST_TITLE", description: "The title of the new request." },
      { name: "SERVICE_DATE", description: "The request service date as YYYY-MM-DD." },
      { name: "REQUEST_URL", description: "Absolute link to the request detail page." },
    ],
  },
  requestInviteMusician: {
    key: "request.invite.musician",
    label: "Musician invitation",
    description: "Sent to a musician when a church invites them to an open request.",
    subject: "{{CHURCH_NAME}} invited you to {{REQUEST_TITLE}}",
    category: "activity",
    suggestedTemplateName: "request-invite-musician",
    templateEnv: "RESEND_TEMPLATE_REQUEST_INVITE_MUSICIAN",
    tags: [
      { name: "MUSICIAN_NAME", description: "The musician display name." },
      { name: "CHURCH_NAME", description: "The inviting church name." },
      { name: "REQUEST_TITLE", description: "The request title." },
      { name: "SERVICE_DATE", description: "The request service date as YYYY-MM-DD." },
      { name: "FEE_LABEL", description: "Formatted fee text, such as $250 Per service or Fee TBD." },
      { name: "THREAD_URL", description: "Absolute link to the invitation message thread." },
    ],
  },
} as const;

export function configuredTemplateId(event: { templateEnv: string }) {
  return process.env[event.templateEnv]?.trim() || undefined;
}
