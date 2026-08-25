(function (root, factory) {
  "use strict";
  var data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  if (root) root.WhaleSettingsData = data;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";
  var toggles = [
    ["pet", "鲸鱼娘", true],
    ["chat", "台词气泡", true],
    ["particles", "粒子效果", true],
    ["game", "小游戏", true],
    ["idle-nudge", "摸鱼提醒", true],
    ["auto-walk", "随机自动走动", true],
    ["night", "深夜模式", true],
    ["weatherFx", "天气特效", true]
  ];
  var poseGroups = [
    {
      title: "🧭 状态机基础",
      note: "核心状态机自动切换：待机/等待/思考/工作/成功/出错/好奇/发呆",
      poses: ["idle-cute", "waiting", "thinking", "running", "success", "failure", "curious", "afk"]
    },
    {
      title: "🤝 互动反馈",
      note: "摸头/戳肚子/摸尾巴/夸夸/投喂/三连击等互动即时反应；wink 在 Lv3 解锁后进入待机池",
      poses: [
        "react-head",
        "react-belly",
        "react-tail",
        "blush",
        "angry",
        "eat",
        "star",
        "tail-swing",
        "teasing",
        "achievement",
        "levelup",
        "pick-up",
        "daily-done",
        "wink"
      ]
    },
    {
      title: "🎮 小游戏",
      note: "戳泡泡 / 接点心游戏中的表情",
      poses: ["game-think", "game-cheat", "game-happy", "game-win", "game-lose"]
    },
    { title: "🌙 系统事件", note: "锁屏/挂起/解锁/深夜时段自动触发", poses: ["sleep", "greet", "night"] },
    {
      title: "🖥️ 电脑状态联动",
      note: "前台应用分类、CPU/内存、电量、网络变化时触发（设置里开启「电脑状态联动」）",
      poses: [
        "work-debug",
        "work-review",
        "work-meeting",
        "daily-painting",
        "daily-gaming",
        "work-ram",
        "work-sleep",
        "work-pat",
        "work-slack",
        "work-slack-phone",
        "celebrate"
      ]
    },
    {
      title: "🌦️ 天气特效",
      note: "配置城市后按实时天气触发（雨/雪/冷/雷/热）",
      poses: ["weather-rain-happy", "weather-umbrella", "weather-snow", "weather-cold", "weather-thunder", "daily-melt"]
    },
    {
      title: "🎉 节日限定",
      note: "春节/中秋/万圣/圣诞/情人节当天自动触发",
      poses: ["festival-spring", "festival-mid-autumn", "festival-halloween", "festival-christmas", "valentine"]
    },
    {
      title: "🕐 待机随机 · 时段",
      note: "35-60 秒一次的待机小动作，按时段加权（17:30 后进入居家模式；周五下午有野餐/钓鱼/游戏加成）",
      poses: [
        "daily-coffee",
        "daily-stretch",
        "daily-eat",
        "daily-cooking",
        "daily-fishing",
        "daily-picnic",
        "daily-shower",
        "daily-pajama"
      ]
    },
    {
      title: "😊 待机随机 · 心情",
      note: "按心情值分档：高心情偏开心梗，低心情偏委屈梗",
      poses: [
        "meme-smug",
        "meme-wakuwaku",
        "meme-heart",
        "meme-kyun",
        "bold",
        "meme-cry",
        "meme-smile-pain",
        "meme-broke",
        "abstract",
        "meme-doge",
        "meme-ojisan",
        "meme-peace"
      ]
    },
    {
      title: "🎲 待机随机 · 通用",
      note: "随机池兜底，工作梗/玩梗混排",
      poses: [
        "work-boss",
        "work-celebrate",
        "work-deadline",
        "work-deploy",
        "work-idea",
        "sweep",
        "meme-doubt",
        "meme-no",
        "meme-omg",
        "meme-shock",
        "meme-sike",
        "meme-worship",
        "meme-yes",
        "cool-shades",
        "meme-music",
        "tool"
      ]
    },
    { title: "🍽️ 养成状态", note: "饱食度较低时自动触发，投喂后恢复", poses: ["balance-low"] }
  ];
  var achievements = [
    ["first-pat", "🫳", "初次摸头"],
    ["ten-pats", "🖐️", "摸头十连"],
    ["hundred-pats", "💯", "摸头百连"],
    ["first-feed", "🍰", "投喂成功"],
    ["first-triple", "🎉", "三连击"],
    ["thanks", "💬", "嘴甜"],
    ["lv5", "⭐", "五级"],
    ["lv10", "👑", "十级"],
    ["signin3", "📅", "常客"],
    ["signin7", "🗓️", "一周之约"],
    ["night-owl", "🌙", "深夜陪伴"],
    ["comeback", "👋", "欢迎回来"],
    ["day1", "💞", "一日之缘"],
    ["day7", "💎", "一周相伴"],
    ["day30", "🏛️", "三十日契约"],
    ["game-first", "🫧", "初次开玩"],
    ["game-win", "👑", "泡泡之王"],
    ["game-combo10", "🔥", "连击达人"],
    ["game-highscore", "🏆", "纪录刷新"],
    ["quest-first", "🎯", "任务初体验"],
    ["quest-all", "🎟️", "一日全勤"],
    ["week-signin7", "🏆", "周常满勤"],
    ["bond-action", "🌟", "新动作解锁"],
    ["bond-badge", "🎖️", "称号首解锁"]
  ];
  return Object.freeze({
    TOGGLES: Object.freeze(toggles),
    POSE_GROUPS: Object.freeze(poseGroups),
    ACHIEVEMENTS: Object.freeze(achievements)
  });
});
