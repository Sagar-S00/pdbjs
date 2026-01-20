import { logger } from '../utils/logger.js';
import * as truthDare from '../utils/truthDare.js';

/**
 * Register game/entertainment commands
 * @param {Client} client - The client instance
 */
export function registerGameCommands(client) {
  /**
   * Truth command - Get a truth question
   * Usage: !truth [rating]
   * Ratings: PG (default), PG13, R
   */
  client.command("truth", async (ctx) => {
    try {
      // Get rating from arguments, default to PG
      const rating = ctx.args[0]?.toUpperCase() || "PG";

      // Validate rating
      const validRatings = ["PG", "PG13", "R"];
      if (!validRatings.includes(rating)) {
        await ctx.reply(`❌ Invalid rating. Use: PG, PG13, or R`);
        return;
      }

      logger.debug(`Fetching truth question with rating: ${rating}`);

      // Fetch truth question
      const truthQuestion = await truthDare.getTruth(rating);

      await ctx.reply(`🤔 **Truth (${rating}):** ${truthQuestion}`);
      logger.success(`Truth question sent with rating: ${rating}`);
    } catch (error) {
      logger.error('Failed to get truth question:', error.message);
      await ctx.reply(`❌ Failed to get truth question: ${error.message}`);
    }
  });

  /**
   * Dare command - Get a dare challenge
   * Usage: !dare [rating]
   * Ratings: PG (default), PG13, R
   */
  client.command("dare", async (ctx) => {
    try {
      // Get rating from arguments, default to PG
      const rating = ctx.args[0]?.toUpperCase() || "PG";

      // Validate rating
      const validRatings = ["PG", "PG13", "R"];
      if (!validRatings.includes(rating)) {
        await ctx.reply(`❌ Invalid rating. Use: PG, PG13, or R`);
        return;
      }

      logger.debug(`Fetching dare with rating: ${rating}`);

      // Fetch dare challenge
      const dareChallenge = await truthDare.getDare(rating);

      await ctx.reply(`😈 **Dare (${rating}):** ${dareChallenge}`);
      logger.success(`Dare sent with rating: ${rating}`);
    } catch (error) {
      logger.error('Failed to get dare:', error.message);
      await ctx.reply(`❌ Failed to get dare: ${error.message}`);
    }
  });
}
