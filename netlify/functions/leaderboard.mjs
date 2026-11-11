import api from "../../api/leaderboard.js";
import { adaptVercelHandler } from "./_adapter.mjs";
export const handler = adaptVercelHandler(api);
