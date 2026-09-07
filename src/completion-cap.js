/** Cap for Ctrl+Space with empty / 1-char prefix (avoids dumping ~1800 APIs). */
const COMPLETION_CAP = 200;
/** Do not apply COMPLETION_CAP when the typed prefix is at least this long. */
const COMPLETION_CAP_PREFIX_MIN = 2;

/**
 * Whether to truncate the completion list to COMPLETION_CAP.
 * Short / empty prefixes would otherwise hide most of the ~1800 API names
 * when capped, or overwhelm the UI when uncapped — so: cap only for short prefixes.
 * @param {string} wordPrefix
 * @param {number} itemCount
 * @returns {boolean}
 */
function shouldCapCompletions(wordPrefix, itemCount) {
  if (itemCount <= COMPLETION_CAP) {
    return false;
  }
  return (wordPrefix || "").length < COMPLETION_CAP_PREFIX_MIN;
}

module.exports = {
  COMPLETION_CAP,
  COMPLETION_CAP_PREFIX_MIN,
  shouldCapCompletions,
};
