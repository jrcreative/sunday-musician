export const EMAIL_EVENTS = {
  requestCreatedChurchConfirmation: {
    key: "request.created.church_confirmation",
    category: "activity",
    templateName: "request-created-church-confirmation",
    templateEnv: "RESEND_TEMPLATE_REQUEST_CREATED_CHURCH_CONFIRMATION",
  },
  requestInviteMusician: {
    key: "request.invite.musician",
    category: "activity",
    templateName: "request-invite-musician",
    templateEnv: "RESEND_TEMPLATE_REQUEST_INVITE_MUSICIAN",
  },
} as const;

export function configuredTemplateId(event: { templateEnv: string }) {
  return process.env[event.templateEnv]?.trim() || undefined;
}
