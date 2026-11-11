import api from "../../api/payments.js";
import { adaptVercelHandler } from "./_adapter.mjs";
export const handler = adaptVercelHandler(api);
