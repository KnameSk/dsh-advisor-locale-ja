/**
 * Host half of the plugin.
 *
 * The empty `apply` exists only so the package mounts as a Loader row through
 * `cordis.patch.yml`; every user-visible behavior lives in the browser half
 * (`dsh/client.js`), which registers the language and its dictionary with the
 * Client locale service. This mirrors how `@fang2hou/dsh-locale-ja` splits its
 * own halves.
 */
export function apply() {}
