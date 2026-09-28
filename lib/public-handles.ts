// Shared by extraction, discovery and curation so rejected URL parts cannot
// become search pivots in a later pass.
export const RESERVED_HANDLES = new Set([
  "public", "publications", "public-profile", "profile", "profiles", "people",
  "user", "users", "member", "members", "help", "support", "privacy", "legal",
  "login", "signin", "signup", "register", "groups", "group", "pages", "page",
  "reel", "reels", "stories", "story", "explore", "directory", "about",
  "business", "marketplace", "watch", "events", "settings", "search", "topics",
  "topic", "communities", "community", "tag", "tags", "hashtag", "hashtags",
  "discover", "discovery", "trending", "accounts", "p", "posts",
]);

export function validPublicHandle(value: string) {
  const handle = value.toLowerCase().replace(/^@/, "").trim();
  return /^[a-z0-9._-]{3,32}$/.test(handle) && /[a-z]/.test(handle)
    && !/\.(?:com|net|org|edu|gov|io|co|ma|fr|uk|me|tv|dev|app)$/i.test(handle)
    && !RESERVED_HANDLES.has(handle);
}

function onHost(host: string, domain: string) {
  return host === domain || host.endsWith("." + domain);
}

export function publicDiscoverySurface(url: string) {
  try {
    const root = new URL(url).pathname.split("/").filter(Boolean)[0]?.toLowerCase() || "";
    return ["tag", "tags", "hashtag", "hashtags", "search", "public", "people",
      "explore", "directory", "topics", "topic", "groups"].includes(root) && !directProfileSurface(url);
  } catch { return false; }
}

export function directProfileSurface(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split("/").filter(Boolean).map(p => p.toLowerCase());
    const root = parts[0] || "";
    const social = ["facebook.com", "linkedin.com", "instagram.com", "reddit.com",
      "tiktok.com", "threads.net", "threads.com", "youtube.com", "x.com",
      "twitter.com", "pinterest.com", "github.com", "twitch.tv", "tumblr.com",
      "tumlook.com", "deviantart.com", "snapchat.com"].some(d => onHost(host, d));
    if (!social) return true;
    if (onHost(host, "linkedin.com")) return ["in", "pub"].includes(root) && Boolean(parts[1]);
    if (onHost(host, "reddit.com")) return root === "user" && Boolean(parts[1]);
    if (onHost(host, "snapchat.com")) return root === "add" && Boolean(parts[1]);
    if (onHost(host, "facebook.com") && root === "profile.php") return Boolean(u.searchParams.get("id"));
    if (onHost(host, "tumblr.com") && host !== "tumblr.com" && host !== "www.tumblr.com") {
      return !RESERVED_HANDLES.has(root);
    }
    if (onHost(host, "youtube.com") && ["channel", "c", "user"].includes(root)) return Boolean(parts[1]);
    if (["tiktok.com", "threads.net", "threads.com", "youtube.com"].some(d => onHost(host, d))) {
      return root.startsWith("@") && root.length > 1;
    }
    return Boolean(root) && !RESERVED_HANDLES.has(root);
  } catch {
    return false;
  }
}

export function usernameFromProfileUrl(url: string) {
  if (!directProfileSurface(url)) return "";
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const parts = u.pathname.split("/").filter(Boolean);
    let handle = "";
    if (onHost(host, "reddit.com") || onHost(host, "snapchat.com")) handle = parts[1] || "";
    else if (onHost(host, "tumblr.com") && host !== "tumblr.com" && host !== "www.tumblr.com") handle = host.split(".")[0];
    else if (["facebook.com", "instagram.com", "tiktok.com", "threads.net", "threads.com",
      "youtube.com", "x.com", "twitter.com", "pinterest.com", "github.com",
      "twitch.tv", "tumlook.com", "deviantart.com"].some(d => onHost(host, d))) handle = parts[0] || "";
    handle = handle.replace(/^@/, "");
    return validPublicHandle(handle) ? handle : "";
  } catch {
    return "";
  }
}
