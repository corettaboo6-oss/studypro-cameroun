import api from "../../api/chat.js";
import { adaptVercelHandler } from "./_adapter.mjs";
export const handler = adaptVercelHandler(api);
