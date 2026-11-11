import api from "../../api/payment-webhook.js";
import { adaptVercelHandler } from "./_adapter.mjs";
export const handler = adaptVercelHandler(api);
