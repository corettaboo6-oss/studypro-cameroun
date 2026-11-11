// Contrôle centralisé des droits d'accès aux contenus STUDYPRO.
const PLAN_RANK = Object.freeze({ free: 0, premium: 1, premium_plus: 2 });
export function hasActivePaidSubscription(subscription, now = Date.now()) {
  if (!subscription || subscription.status !== "active") return false;
  if (!Object.hasOwn(PLAN_RANK, subscription.plan) || PLAN_RANK[subscription.plan] < 1) return false;
  const expiry = Date.parse(subscription.current_period_end || "");
  return Number.isFinite(expiry) && expiry > now;
}
export function canAccessContent(subscription, item, now = Date.now()) {
  if (!hasActivePaidSubscription(subscription, now) || !item || typeof item !== "object") return false;
  if (!Object.hasOwn(PLAN_RANK, item.required_plan) || PLAN_RANK[item.required_plan] < 1) return false;
  return PLAN_RANK[subscription.plan] >= PLAN_RANK[item.required_plan];
}
