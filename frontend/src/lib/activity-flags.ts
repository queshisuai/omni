export function getRealNameRequirementLabel(required: boolean | null | undefined) {
  return required ? '实名制' : '非实名制'
}

export function getTicketTransferAllowedLabel(allowed: boolean | null | undefined) {
  return allowed === false ? '不可转赠' : '可转赠'
}
