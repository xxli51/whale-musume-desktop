(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root && root.localStorage) {
    root.WhaleStorage = api.createStore(root.localStorage, function (key, value) {
      root.dispatchEvent(new CustomEvent("whale-moe-prefs-change", { detail: { key: key, value: value } }));
    });
  }
})(typeof window === "undefined" ? null : window, function () {
  "use strict";

  var PREFIX = "whale-moe:";
  var SAVE_FORMAT = "whale-musume-save";
  var SAVE_VERSION = 2;
  var SECRET_KEYS = Object.freeze(["weatherKey"]);

  var BOOLEAN_KEYS = Object.freeze([
    "pet",
    "chat",
    "particles",
    "game",
    "idle-nudge",
    "auto-walk",
    "mouse-physics",
    "window-perch",
    "night",
    "weatherFx",
    "zones",
    "computer-link",
    "positionLocked",
    "reminders",
    "offwork-enabled",
    "quiet-mode",
    "quiet-schedule",
    "quiet-active"
  ]);
  var NUMBER_RULES = Object.freeze({
    mood: [0, 100],
    affinity: [0, 10000],
    satiety: [0, 100],
    signinStreak: [0, 100000],
    level: [1, 1000],
    companionSince: [0, 9999999999999],
    lastWaterAt: [0, 9999999999999],
    "float-reset": [0, 9999999999999],
    "growth-reset": [0, 9999999999999],
    floatX: [-100000, 100000],
    floatY: [-100000, 100000],
    desktopSettingsX: [-100000, 100000],
    desktopSettingsY: [-100000, 100000],
    weatherLat: [-90, 90],
    weatherLon: [-180, 180],
    displayScale: [60, 160],
    displayOpacity: [30, 100],
    pomodoroWork: [1, 180],
    pomodoroBreak: [1, 180],
    postureMinutes: [10, 240],
    waterMinutes: [15, 480]
  });
  var JSON_KEYS = Object.freeze(["quests", "weekSignin", "gameStats", "pomodoroState", "pendingReminder"]);
  var STRING_RULES = Object.freeze({
    mode: 32,
    lastSignin: 32,
    achievements: 10000,
    badge: 128,
    title: 32,
    petName: 32,
    festivalShown: 32,
    "offwork-last": 32,
    "offwork-time": 8,
    "quiet-start": 8,
    "quiet-end": 8,
    weatherCity: 128,
    weatherKey: 256
  });

  function keyName(fullOrShort) {
    var key = String(fullOrShort || "");
    return key.indexOf(PREFIX) === 0 ? key.slice(PREFIX.length) : key;
  }

  function isKnownKey(key) {
    var name = keyName(key);
    return (
      BOOLEAN_KEYS.indexOf(name) !== -1 ||
      Object.prototype.hasOwnProperty.call(NUMBER_RULES, name) ||
      JSON_KEYS.indexOf(name) !== -1 ||
      Object.prototype.hasOwnProperty.call(STRING_RULES, name)
    );
  }

  function validateValue(key, value) {
    var name = keyName(key);
    if (!isKnownKey(name) || typeof value !== "string") return false;
    if (BOOLEAN_KEYS.indexOf(name) !== -1) return value === "0" || value === "1";
    if (Object.prototype.hasOwnProperty.call(NUMBER_RULES, name)) {
      var number = Number(value);
      var range = NUMBER_RULES[name];
      return Number.isFinite(number) && number >= range[0] && number <= range[1];
    }
    if (JSON_KEYS.indexOf(name) !== -1) {
      if (value.length > 100000) return false;
      try {
        var parsed = JSON.parse(value);
        return parsed !== null && typeof parsed === "object";
      } catch (_error) {
        return false;
      }
    }
    if (value.length > STRING_RULES[name]) return false;
    if (name === "offwork-time" || name === "quiet-start" || name === "quiet-end") {
      return /^([01]?\d|2[0-3]):[0-5]\d$/.test(value);
    }
    return true;
  }

  function preparePayload(payload) {
    if (!payload || payload.format !== SAVE_FORMAT || (payload.version !== 1 && payload.version !== SAVE_VERSION)) {
      throw new Error("不是有效的鲸鱼娘存档");
    }
    if (!payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
      throw new Error("存档数据结构无效");
    }
    var keys = Object.keys(payload.data);
    if (keys.length > 200) throw new Error("存档字段过多");
    var prepared = {};
    keys.forEach(function (fullKey) {
      var name = keyName(fullKey);
      var value = payload.data[fullKey];
      if (fullKey !== PREFIX + name || SECRET_KEYS.indexOf(name) !== -1 || !validateValue(name, value)) {
        throw new Error("存档字段无效：" + fullKey);
      }
      prepared[PREFIX + name] = value;
    });
    return prepared;
  }

  function createStore(storage, onChange) {
    if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") {
      throw new TypeError("storage adapter is required");
    }
    function notify(name, value) {
      if (typeof onChange === "function") onChange(name, value);
    }
    function get(name, fallback) {
      var fullKey = PREFIX + keyName(name);
      var value = storage.getItem(fullKey);
      if (value === null) return fallback;
      if (validateValue(name, value)) return value;
      storage.removeItem(fullKey);
      notify(keyName(name), null);
      return fallback;
    }
    function set(name, value) {
      var shortName = keyName(name);
      var text = String(value);
      if (!validateValue(shortName, text)) throw new TypeError("无效的存储字段：" + shortName);
      storage.setItem(PREFIX + shortName, text);
      notify(shortName, text);
      return text;
    }
    function remove(name) {
      var shortName = keyName(name);
      storage.removeItem(PREFIX + shortName);
      notify(shortName, null);
    }
    function exportPayload(now) {
      var data = {};
      for (var i = 0; i < storage.length; i += 1) {
        var fullKey = storage.key(i);
        var name = keyName(fullKey);
        var value = fullKey && fullKey.indexOf(PREFIX) === 0 ? storage.getItem(fullKey) : null;
        if (SECRET_KEYS.indexOf(name) === -1 && validateValue(name, value)) data[PREFIX + name] = value;
      }
      return {
        format: SAVE_FORMAT,
        version: SAVE_VERSION,
        exportedAt: new Date(now || Date.now()).toISOString(),
        data: data
      };
    }
    function importPayload(payload) {
      var prepared = preparePayload(payload);
      var keys = Object.keys(prepared);
      var snapshot = {};
      keys.forEach(function (fullKey) {
        snapshot[fullKey] = storage.getItem(fullKey);
      });
      try {
        keys.forEach(function (fullKey) {
          storage.setItem(fullKey, prepared[fullKey]);
        });
      } catch (error) {
        keys.forEach(function (fullKey) {
          try {
            if (snapshot[fullKey] === null) storage.removeItem(fullKey);
            else storage.setItem(fullKey, snapshot[fullKey]);
          } catch (_rollbackError) {
            /* best effort rollback */
          }
        });
        throw error;
      }
      keys.forEach(function (fullKey) {
        notify(keyName(fullKey), prepared[fullKey]);
      });
      return keys.length;
    }
    return Object.freeze({
      prefix: PREFIX,
      version: SAVE_VERSION,
      get: get,
      set: set,
      remove: remove,
      removeMany: function (names) {
        names.forEach(remove);
      },
      exportPayload: exportPayload,
      importPayload: importPayload
    });
  }

  return Object.freeze({
    PREFIX: PREFIX,
    SAVE_FORMAT: SAVE_FORMAT,
    SAVE_VERSION: SAVE_VERSION,
    isKnownKey: isKnownKey,
    validateValue: validateValue,
    preparePayload: preparePayload,
    createStore: createStore
  });
});
