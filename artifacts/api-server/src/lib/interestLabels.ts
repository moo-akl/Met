/**
 * Re-exports interest translations from the shared `@workspace/interests` package.
 *
 * The canonical source of truth is `lib/interests/src/index.ts`. Both the mobile
 * client and this server consume it, so adding a new language or updating a label
 * only requires editing that one file.
 */
export { localiseInterest, interestLocales, type InterestKey, type InterestLabels } from "@workspace/interests";
