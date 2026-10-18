/**
 * Browser half of the Japanese add-on for the Advisor Settings page.
 *
 * The module registers exactly two things with the Client locale service: the
 * Japanese Advisor dictionary and, only when no other language pack provides it,
 * the Japanese language definition. It never touches Advisor configuration,
 * remotes, or slots, so the Advisor works identically with or without it.
 */
import { installAdvisorJapanese } from "./japanese.js";

/** Required Client service. */
export const inject = ["locale"];

/**
 * Contribute the Japanese Advisor copy to the shared locale service.
 *
 * @param ctx - the Client cordis context.
 */
export function apply(ctx) {
  // The locale service is an injected service, but a plain host may mount this
  // bundle without it. Staying inert is safer than throwing and taking every
  // later row down with the failure.
  if (ctx.locale === undefined) return;
  installAdvisorJapanese(ctx);
}
