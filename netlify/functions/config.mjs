import api from "../../api/config.js";
import { adaptVercelHandler } from "./_adapter.mjs";
export const handler = adaptVercelHandler(api);
