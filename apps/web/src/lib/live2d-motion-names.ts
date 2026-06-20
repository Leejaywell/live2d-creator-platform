// Human-readable labels for the common Azur Lane / Cubism motion file names, so
// the viewer's motion list reads like the landing-demo's (which lists every
// individual motion rather than just motion-group names). Unknown names fall
// back to the cleaned file basename.
const MOTION_LABELS: Record<string, string> = {
  idle: "空闲等待",
  idle1: "随性站姿",
  home: "主界面动作",
  login: "登录迎接",
  mail: "收到邮件",
  mission: "查看任务",
  mission_complete: "任务完成",
  complete: "互动完成",
  wedding: "誓约珍藏",
  touch_head: "摸头反馈",
  touch_body: "身体触碰",
  touch_special: "特别触碰",
  touch_idle: "触碰待机",
  touch_idle1: "触碰待机",
  main_1: "对话主线 1",
  main_2: "对话主线 2",
  main_3: "对话主线 3",
  effect: "特效触发",
};

/** Map a motion3.json file path (or bare name) to a readable label. The viewer
 * loads the model through the asset proxy, so a motion's "File" may be a rewritten
 * URL like `.../proxy?key=<urlencoded path>/motions/home.motion3.json` — pull the
 * real path out of the `key` query param before taking the basename. */
export function motionLabel(fileOrName: string): string {
  let s = fileOrName;
  const keyMatch = s.match(/[?&]key=([^&]+)/);
  if (keyMatch) {
    try {
      s = decodeURIComponent(keyMatch[1]);
    } catch {
      s = keyMatch[1];
    }
  }
  const base = (s.split(/[/\\]/).pop() ?? s).replace(/\.motion3\.json$/i, "");
  return MOTION_LABELS[base] ?? base;
}
