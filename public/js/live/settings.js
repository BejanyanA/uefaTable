// The visitor's Live settings, kept on this device.
//
// Time zone: by default the device's own ("automatic"). The visitor can pick
// another one; every Live screen then shows days and kick-off times in it.
// A change is announced with the "live:timezone-changed" event on document.
//
// No DOM drawing here, so a mobile app can follow the same rules.

const TZ_KEY = "live_tz_v1";
export const TIMEZONE_EVENT = "live:timezone-changed";

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// The zone the visitor picked, or null for automatic.
export function chosenTimeZone() {
  const value = storage()?.getItem(TZ_KEY) || null;
  return value && isValidTimeZone(value) ? value : null;
}

// The zone Live screens use now.
export function activeTimeZone() {
  return chosenTimeZone() || deviceTimeZone();
}

// Pick a zone, or null to go back to automatic.
export function setTimeZone(tz) {
  const store = storage();
  try {
    if (tz && isValidTimeZone(tz)) store?.setItem(TZ_KEY, tz);
    else store?.removeItem(TZ_KEY);
  } catch {
    // Storage blocked: the choice lasts until the page is reloaded.
  }
  document.dispatchEvent(new CustomEvent(TIMEZONE_EVENT, { detail: { timeZone: activeTimeZone() } }));
}

// Every zone the browser knows, for the picker.
export function allTimeZones() {
  let zones = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [
      "Pacific/Honolulu", "America/Los_Angeles", "America/Denver", "America/Chicago",
      "America/New_York", "America/Sao_Paulo", "Europe/London", "Europe/Paris",
      "Europe/Moscow", "Asia/Yerevan", "Asia/Dubai", "Asia/Kolkata", "Asia/Shanghai",
      "Asia/Tokyo", "Australia/Sydney",
    ];
  }
  if (!zones.includes("UTC")) zones = ["UTC", ...zones];
  return zones;
}

// "Europe/Paris" -> { city: "Paris", region: "Europe", offset: "GMT+1" }.
export function describeTimeZone(tz, now = Date.now()) {
  const parts = tz.split("/");
  const city = (parts[parts.length - 1] || tz).replace(/_/g, " ");
  const region = parts.length > 1 ? parts.slice(0, -1).join(" / ").replace(/_/g, " ") : "";
  let offset = "";
  try {
    offset = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(new Date(now))
      .find((p) => p.type === "timeZoneName")?.value || "";
  } catch {
    offset = "";
  }
  return { city, region, offset };
}
