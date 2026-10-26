import * as THREE from 'three';
import { box, cone, cyl, ellip, fbm, lathe, mat, paintFaces, shade, sweep, tube, add, g, type Paint, type Station, type V3 } from './prims.ts';
import { armFK, ik2, lerp3, type ArmPose } from './rig.ts';
import { part } from './human.ts';

export type { ArmPose } from './rig.ts';

/** Lightens (d > 0) or darkens (d < 0) a colour by a relative amount. */
const tone = (c: string, d: number) => shade(c, 1 + d);

/**
 * Shared figure for the famous-people packs: a naturally proportioned standing person (about 7 heads tall) built from
 * smooth lathes and tubes, with period dress and quiet facial features. Builders add their own props, scenery and base;
 * the returned anchors (hands, head) let them attach books, telescopes, brushes, flags...
 */
/**
 * Chinese period dress: `roundrobe` 圆领袍 (Tang–Ming officials), `changshan` 长衫/长袍 with a stand collar, `magua`
 * a Qing robe under a short dark jacket (马褂), `zhongshan` 中山装, `deel` the Mongol robe closing on the right.
 */
export type Outfit = 'robe' | 'dress' | 'coat' | 'suit' | 'tunic' | 'roundrobe' | 'changshan' | 'magua' | 'zhongshan' | 'deel';
export type GarmentPattern =
  | 'mianfu' | 'weijin' | 'tangrobe' | 'tangdress' | 'songrobe' | 'songdress'
  | 'yuan' | 'mingrobe' | 'mamian' | 'qingdragon' | 'qingmagua' | 'qizhuang' | 'zhongshan';
export type ArmorStyle = 'bronze' | 'qinhan' | 'mingguang' | 'song' | 'yuan' | 'ming' | 'brigandine';
export type HairStyle = 'short' | 'long' | 'bun' | 'topknot' | 'bald' | 'curly' | 'wig' | 'bob' | 'braid' | 'wild' | 'queue' | 'highbun';
export type Beard = 'none' | 'short' | 'long' | 'goatee' | 'moustache' | 'full';
/**
 * Chinese headwear by period: 冕冠 `mianguan` (emperors, tasselled board), 通天冠 `tongtian` (Wei-Jin/Six Dynasties),
 * 进贤冠 `jinxian` (Han officials), 软脚幞头 `ruanjiao` (Tang), 展脚幞头 `zhanjiao` (Song, long straight wings),
 * 乌纱帽 `wusha` and 翼善冠 `yishan` (Ming), 四方平定巾 `fangjin` (Ming scholars), 钹笠 `boli` and 罟罟冠 `gugu` (Yuan),
 * 清朝官帽 `qingguan` with tassel and finial, 瓜皮帽 `guapi`, 两把头 `liangba` (Qing women), helmets (`qinhan_helm`,
 * `plume` Tang/Song, `doumou` Ming/Qing) and the modern peaked cap.
 */
export type Hat = 'none' | 'scholar' | 'futou' | 'tophat' | 'beret' | 'cap' | 'crown' | 'turban' | 'helmet' | 'bicorne' | 'wreath'
  | 'mianguan' | 'tongtian' | 'jinxian' | 'ruanjiao' | 'zhanjiao' | 'wusha' | 'yishan' | 'fangjin' | 'boli' | 'gugu'
  | 'qingguan' | 'guapi' | 'liangba' | 'qinhan_helm' | 'plume' | 'doumou' | 'peaked'
  | 'douli' | 'guanjin' | 'dongpo' | 'fujin' | 'pheasant' | 'straw' | 'khitan' | 'taiping';

/** Leg stances: feet targets solved with IK so knees always bend forward and bones keep their length. */
export type Stance = 'stand' | 'relax' | 'walk' | 'run' | 'kick' | 'kneel' | 'wide';

export interface FigureOpts {
  /** total height incl. hair/hat, default 0.62 */
  h?: number;
  /** torso/waist width multiplier (1 = standard, >1 = broad/rotund build) */
  w?: number;
  x?: number; y?: number; z?: number;
  /** facing (radians about Y), default 0 = +z */
  ry?: number;
  skin?: string;
  hair?: string;
  hairStyle?: HairStyle;
  beard?: Beard;
  beardColor?: string;
  outfit?: Outfit;
  /** procedural surface pattern for period brocade, dragon robes, 12 symbols, mamianqun, etc. */
  pattern?: GarmentPattern;
  /** main garment colour (robe / coat / jacket / dress) */
  top: string;
  /** trousers / under-skirt colour */
  bottom?: string;
  /** belt, sash, collar trim */
  accent?: string;
  /** shirt / inner collar colour (suit, coat) */
  shirt?: string;
  shoes?: string;
  /** wide hanging sleeves (Chinese / Japanese robes, academic gowns) */
  wideSleeves?: boolean;
  /** cape over the shoulders */
  cape?: string;
  hat?: Hat;
  hatColor?: string;
  glasses?: boolean;
  armL?: ArmPose;
  armR?: ArmPose;
  /** slight body lean forward (radians); the upper body pivots at the hips */
  lean?: number;
  /** leg stance (ignored under floor-length robes/dresses), default 'relax' */
  stance?: Stance;
  /** explicit ankle targets [left, right] in figure units (u), overriding the stance */
  feet?: [V3, V3];
  /** sleeve length: 1 long (default), ~0.45 short, 0 bare arms (vest) */
  sleeve?: number;
  /** bare legs below the shorts' hem */
  shorts?: boolean;
  socks?: string;
  /** rank badge on the chest (补子 square, or a round dragon roundel for emperors) */
  badge?: string;
  badgeRound?: boolean;
  /** short jacket over a long robe (马褂) */
  jacket?: string;
  /** armour over the garment: lamellar body, shoulder guards and a plated skirt */
  armor?: string;
  /** period armour texture style */
  armorStyle?: ArmorStyle;
  /** two round breastplates (明光铠) */
  discs?: boolean;
  /** cap badge / hat finial colour (red star, 顶珠) */
  hatBadge?: string;
  /** Pre-Qin / Qin-Han ceremonial front knee apron (蔽膝) colour */
  bixi?: string;
  /** Qing crescent shoulder collar (披领) colour */
  piling?: string;
  /** Qing court necklace (朝珠) */
  chaozhu?: boolean;
  /** Tang court lady's floating silk ribbon (披帛) colour */
  pibo?: string;
  /** Peacock feather plume (花翎) on Qing hats */
  feathers?: boolean;
  /** Silver crescent moon on the forehead (包拯额上月牙) */
  crescent?: boolean;
  /** Gently closed eyelids (鉴真双目失明) */
  blind?: boolean;
}

export interface FigureAnchors {
  group: THREE.Group;
  /** wrist/hand centres in the builder's space (already offset by x/y/z and rotated by ry) */
  handL: V3;
  handR: V3;
  head: V3;
  headR: number;
  /** top of head (before hat) */
  top: V3;
  /** figure-local scale unit (= h) */
  u: number;
}

const SKIN = '#d9a882';

/**
 * Natural proportions (about 7 heads): the upper body is authored on the old 5-head grid and stretched above the
 * waist so the shoulders sit at 0.79 and the neck base at 0.835 of the height.
 */
const Y = (y: number) => (y <= 0.5 ? y : y <= 0.735 ? 0.5 + (y - 0.5) * 1.234 : 0.79 + (y - 0.735) * 0.9);

/** Shoulder, elbow and wrist of a figure's arm in body space (same maths the figure uses, for overlays). */
export function armJoints(o: Pick<FigureOpts, 'h' | 'w' | 'armL' | 'armR'>, sgn: -1 | 1): { sh: V3; el: V3; wr: V3; dir: V3 } {
  const u = o.h ?? 0.62, bw = o.w ?? 1, sh: V3 = [sgn * 0.13 * u * bw, Y(0.735) * u, 0];
  const { elbow, wrist, dir } = armFK(sgn, (sgn < 0 ? o.armL : o.armR) ?? {}, sh, 0.17 * u, 0.155 * u);
  return { sh, el: elbow, wr: wrist, dir };
}

const ANK = 0.036, HIP_Y = 0.455, THIGH = 0.216, SHIN = 0.212;
function stanceFeet(s: Stance): { hipY: number; feet: [V3, V3]; poles?: [V3, V3] } {
  switch (s) {
    case 'stand': return { hipY: HIP_Y, feet: [[-0.06, ANK, 0.01], [0.06, ANK, 0.0]] };
    case 'wide': return { hipY: HIP_Y - 0.004, feet: [[-0.1, ANK, 0.01], [0.1, ANK, 0.0]] };
    case 'walk': return { hipY: HIP_Y - 0.008, feet: [[-0.056, ANK, 0.11], [0.056, ANK + 0.012, -0.1]] };
    case 'run': return { hipY: 0.44, feet: [[-0.054, 0.17, 0.07], [0.058, 0.05, -0.19]] };
    case 'kick': return { hipY: 0.445, feet: [[-0.07, ANK, -0.03], [0.072, 0.13, 0.25]] };
    case 'kneel': return { hipY: 0.27, feet: [[-0.065, ANK, 0.16], [0.065, ANK, -0.21]], poles: [[0, 0.4, 1], [0, 0, 1]] };
    default: // relaxed contrapposto: weight on the right leg, left knee eased forward and out
      return { hipY: HIP_Y - 0.003, feet: [[-0.078, ANK, 0.045], [0.052, ANK, -0.005]] };
  }
}

/** Subdivides a lathe profile vertically and paints per-face period silk, brocade, pleats, or armour patterns. */
function paintLathe(p: THREE.Object3D, pts: [number, number][], c: string, seg: number, zScale: number, paint?: Paint): THREE.Mesh {
  const sub: [number, number][] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [r0, y0] = pts[i], [r1, y1] = pts[i + 1];
    const dy = Math.abs(y1 - y0);
    const n = dy > 0.008 ? Math.min(8, Math.max(2, Math.ceil(dy / 0.013))) : 1;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      sub.push([r0 + (r1 - r0) * t, y0 + (y1 - y0) * t]);
    }
  }
  const lg = new THREE.LatheGeometry(sub.map(([r, py]) => new THREE.Vector2(r, py)), seg);
  lg.computeVertexNormals();
  const pg = paintFaces(lg, c, paint);
  const m = add(p, pg, mat('#ffffff', { vc: true, flat: false }), 0, 0, 0, 1, 1, zScale);
  return m;
}

/** Procedural painter for period skirts and lower robes (yn in [0.012, 0.5]). */
function skirtPaint(o: FigureOpts, u: number, base: string, accent: string): Paint {
  const pat = o.pattern;
  return (x, y, z) => {
    const yn = y / u;
    if (yn < 0.015 || yn > 0.495) return base;
    const th = Math.atan2(x, z), absT = Math.abs(th);
    const grain = (fbm(x * 32 / u, y * 32 / u, z * 32 / u, 2) - 0.5) * 0.06;
    const pleat = Math.sin(th * (pat === 'mamian' || pat === 'tangdress' || pat === 'songdress' ? 28 : 16)) * 0.055;
    if (pat === 'mianfu') {
      // 玄衣纁裳 lower skirt: black cloud-scroll hem, crimson pleats, Jade pendants (玉佩) at hips
      if (yn < 0.052) {
        return Math.abs(yn - 0.032) < 0.008 && Math.sin(th * 20) > 0.1 ? '#d8a840' : '#1b181f';
      }
      if (Math.abs(absT - 0.92) < 0.11 && yn > 0.12 && yn < 0.47) {
        return Math.sin(yn * 95) > 0.15 ? '#e4ece0' : '#d8a840';
      }
      return shade(base, 1 + pleat + grain);
    }
    if (pat === 'weijin') {
      // 褒衣博带: wide contrasting hem border and twin hanging silk sash ribbons
      if (yn < 0.06) return shade(accent, 0.96 + grain);
      if (Math.abs(absT - 0.16) < 0.075 && yn > 0.1 && yn < 0.49) return shade(accent, 1.04 + grain);
      return shade(base, 1 + pleat * 1.1 + grain);
    }
    if (pat === 'tangdress') {
      // 唐代齐胸破裙: alternating two-tone vertical pleats (间色裙) + gold floral hem
      if (yn < 0.048) return Math.sin(th * 24) > 0 ? '#e8c24a' : '#8c1d28';
      const stripe = Math.sin(th * 12) > 0;
      const col = stripe ? o.top : base;
      return shade(col, 1 + Math.sin(th * 24) * 0.05 + grain);
    }
    if (pat === 'songdress') {
      // 宋代褙子 + 百迭裙: open-front coat showing ivory pleated skirt in front with brocade trim along the edges
      if (absT < 0.25) return shade(base, 1 + Math.sin(th * 36) * 0.06 + grain);
      if (Math.abs(absT - 0.28) < 0.065 || yn < 0.045) return shade(accent, 0.95 + Math.sin(yn * 80) * 0.08);
      return shade(o.top, 1 + pleat * 0.6 + grain);
    }
    if (pat === 'songrobe') {
      // 宋代盘领袍: horizontal knee/hem band (襕衫) and geometric Song damask
      if (yn < 0.075 && yn > 0.045) return shade(accent, 0.92);
      const dm = Math.sin((th * 18) + yn * 40) * Math.sin((th * 18) - yn * 40) * 0.035;
      return shade(base, 1 + pleat * 0.5 + dm + grain);
    }
    if (pat === 'yuan') {
      // 元代质孙服/辫线袄: wide gold-brocade hem band + braided horizontal waist pleats (辫线)
      if (yn < 0.07) return Math.sin(th * 22 + yn * 60) > 0 ? '#d8a638' : '#7c241c';
      if (yn > 0.38) return Math.floor(yn * 95) % 2 === 0 ? '#d8a638' : shade(base, 0.9);
      return shade(base, 1 + pleat * 0.9 + grain);
    }
    if (pat === 'mingrobe' || pat === 'tangrobe') {
      // 团龙袍 / 绯袍: 海水江牙 wave hem on Ming robes + knee roundels
      if (pat === 'mingrobe' && yn < 0.12) {
        const wave = Math.sin(th * 16 + yn * 55);
        if (yn < 0.065) return wave > 0.2 ? '#d8a638' : wave < -0.2 ? '#1e3a8a' : '#991b1b';
        return wave > 0.15 ? '#f1ece0' : '#1d4ed8';
      }
      if (o.badgeRound && (absT < 0.36 || absT > 2.78) && Math.abs(yn - 0.26) < 0.065) {
        return Math.sin(th * 20 + yn * 70) > -0.1 ? '#e2b646' : '#991b1b';
      }
      return shade(base, 1 + pleat * 0.6 + grain);
    }
    if (pat === 'mamian') {
      // 明制马面裙: flat front馬面 panel, gold dragon-and-phoenix 膝襕 band, deep side pleats
      if (yn > 0.08 && yn < 0.185) {
        const fret = Math.sin(th * 22 + yn * 70);
        return fret > 0.05 ? '#e5b842' : fret < -0.35 ? '#1e3a8a' : shade(base, 0.85);
      }
      if (absT < 0.3 || absT > 2.84) return shade(base, 1.04 + grain);
      return shade(base, 0.94 + Math.sin(th * 32) * 0.09 + grain);
    }
    if (pat === 'qingdragon') {
      // 清代朝袍/龙袍下摆: 立水 diagonal five-colour stripes + 江牙 crashing waves + golden dragons
      if (yn < 0.115) {
        const k = Math.floor(((th * 9 + yn * 22) % 5 + 5) % 5);
        return ['#1e3a8a', '#eab308', '#b91c1c', '#15803d', '#f1ece0'][k];
      }
      if (yn < 0.205) {
        const w = Math.sin(th * 14) * 0.025 + yn;
        return w < 0.155 ? '#1e3a8a' : w < 0.18 ? '#38bdf8' : '#fef08a';
      }
      if (yn > 0.44) return '#172554'; // 腰帷 navy waistband
      if ((absT < 0.42 || absT > 2.72 || Math.abs(absT - 1.57) < 0.38) && Math.abs(yn - 0.32) < 0.065) {
        return Math.sin(th * 24 + yn * 80) > 0 ? '#b45309' : '#fef08a';
      }
      return shade(base, 1 + pleat * 0.7 + grain);
    }
    if (pat === 'qingmagua') {
      if (yn < 0.08) {
        const k = Math.floor(((th * 10 + yn * 20) % 4 + 4) % 4);
        return ['#1e3a8a', '#d8a638', '#991b1b', '#e2e8f0'][k];
      }
      return shade(o.top, 1 + pleat * 0.5 + grain);
    }
    if (pat === 'qizhuang') {
      // 清代旗装: embroidered floral/gold border along hem and right slit
      if (yn < 0.065 || Math.abs(th - 1.35) < 0.12) {
        return Math.sin(th * 28 + yn * 70) > 0 ? '#f472b6' : '#eab308';
      }
      const fl = Math.sin(th * 14 + yn * 36) * Math.cos(th * 14 - yn * 36);
      if (fl > 0.72) return '#facc15';
      return shade(base, 1 + pleat * 0.4 + grain);
    }
    return shade(base, 1 + pleat * 0.5 + grain);
  };
}

/** Procedural painter for upper torso garments (yn in [0.48, 0.84]). */
function torsoPaint(o: FigureOpts, u: number, base: string, accent: string): Paint {
  const pat = o.pattern;
  return (x, y, z) => {
    const yn = y / u;
    const th = Math.atan2(x, z), absT = Math.abs(th);
    const grain = (fbm(x * 34 / u, y * 34 / u, z * 34 / u, 2) - 0.5) * 0.06;
    if (pat === 'mianfu') {
      // 十二章纹: Sun (left shoulder), Moon (right shoulder), Dragon & Mountain emblems on chest/back
      if (Math.abs(absT - 1.52) < 0.38 && yn > 0.69 && yn < 0.79) {
        return th < 0 ? '#ef4444' : '#fde047';
      }
      if ((absT < 0.42 || absT > 2.72) && yn > 0.58 && yn < 0.73) {
        const ring = Math.sin(absT * 28 + yn * 65);
        if (ring > 0.25) return '#e5b842';
        if (ring < -0.45) return '#b91c1c';
      }
      return shade(base, 1 + grain);
    }
    if (pat === 'tangdress') {
      // 齐胸襦裙 chest band (裙头) in gold & crimson, pale silk upper bodice
      if (yn < 0.62) return yn > 0.57 ? '#e8c24a' : shade(o.top, 0.92 + grain);
      return shade('#f3e5ce', 1 + grain);
    }
    if (pat === 'songdress') {
      // 宋代褙子 over white/red 抹胸
      if (absT < 0.25) return yn > 0.68 ? '#f5efe2' : yn > 0.64 ? '#c83e3e' : '#ece5d5';
      if (Math.abs(absT - 0.28) < 0.07) return shade(accent, 0.92);
      return shade(base, 1 + grain);
    }
    if (pat === 'yuan') {
      // 元代质孙服胸背云肩/纳石失金锦
      if ((absT < 0.52 || absT > 2.62 || yn > 0.72) && yn > 0.59 && yn < 0.79) {
        return Math.sin(th * 26 + yn * 75) > -0.15 ? '#e0b038' : shade(base, 0.85);
      }
      return shade(base, 1 + grain);
    }
    if (pat === 'mingrobe' || pat === 'tangrobe') {
      // 团龙纹 on shoulders and chest/back
      if (o.badgeRound && Math.abs(absT - 1.55) < 0.42 && yn > 0.68 && yn < 0.79) {
        return Math.sin(th * 24 + yn * 70) > -0.1 ? '#ecc94b' : '#991b1b';
      }
      return shade(base, 1 + grain);
    }
    if (pat === 'mamian') {
      // 明制立领对襟长袄: gold buttons & trim down center front
      if (absT < 0.065) return Math.sin(yn * 90) > 0.2 ? '#eab308' : shade(base, 0.88);
      return shade(base, 1 + grain);
    }
    if (pat === 'qingdragon') {
      // 清代九龙袍: golden dragons on chest, back, and shoulders, plus diagonal 琵琶襟 trim
      if (Math.abs(th - (yn - 0.55) * 2.2) < 0.07 && yn > 0.54 && yn < 0.77) return '#1e3a8a';
      if ((absT < 0.46 || absT > 2.68 || Math.abs(absT - 1.55) < 0.42) && yn > 0.6 && yn < 0.76) {
        const coil = Math.sin(th * 24 + yn * 75);
        if (coil > 0.2) return '#fef08a';
        if (coil < -0.35) return '#1e3a8a';
      }
      return shade(base, 1 + grain);
    }
    if (pat === 'qizhuang') {
      // 清代旗装琵琶襟宽花边
      if (Math.abs(th - (0.76 - yn) * 3.2) < 0.13 && yn > 0.52 && yn < 0.78) {
        return Math.sin(yn * 85) > 0 ? '#f472b6' : '#facc15';
      }
      return shade(base, 1 + grain);
    }
    return shade(base, 1 + grain);
  };
}

/** Procedural painter for lamellar scale armour (札甲/鱼鳞甲/山文甲) and Qing brigandine (八旗棉甲). */
function armorPaint(style: ArmorStyle | undefined, base: string, u: number): Paint {
  const dk = tone(base, -0.35), hi = tone(base, 0.22);
  return (x, y, z) => {
    const yn = y / u, th = Math.atan2(x, z);
    if (style === 'brigandine') {
      // 清代八旗棉甲: satin fabric studded with rows of gilt brass rivets + dark blue border
      const row = (yn * 36) % 1, col = ((th * 9) % 1 + 1) % 1;
      if (Math.hypot(col - 0.5, row - 0.5) < 0.22) return '#facc15';
      if (yn < 0.34 || (yn > 0.46 && yn < 0.49)) return '#1e3a8a';
      return shade(base, 0.94 + Math.sin(th * 18) * 0.06);
    }
    // Lamellar plates (札甲 / 鱼鳞甲) with horizontal cord lacings
    const r = Math.floor(yn * 42);
    const vy = (yn * 42) - r;
    const vx = ((th * 14 + (r % 2) * 0.5) % 1 + 1) % 1;
    if (vy < 0.18) return style === 'qinhan' || style === 'mingguang' ? '#991b1b' : dk;
    if (vx < 0.14) return dk;
    return vy > 0.65 ? hi : base;
  };
}
export function figure(p: THREE.Object3D, o: FigureOpts): FigureAnchors {
  const H = o.h ?? 0.62, u = H / 1.0;
  const fig = new THREE.Group();
  fig.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  fig.rotation.y = o.ry ?? 0;
  p.add(fig);
  const body = new THREE.Group();
  const lean = o.lean ?? 0;
  body.rotation.x = lean;
  // pivot the upper body at the hips, not at the feet
  body.position.set(0, 0.47 * u * (1 - Math.cos(lean)), -0.47 * u * Math.sin(lean));
  fig.add(body);

  const skin = o.skin ?? SKIN, hair = o.hair ?? '#3b2a20', outfit = o.outfit ?? 'tunic';
  const top = o.top, bottom = o.bottom ?? tone(top, -0.25), accent = o.accent ?? tone(top, 0.25);
  const shoes = o.shoes ?? '#2b211b', shirt = o.shirt ?? '#f1ece0', bw = o.w ?? 1;
  const S = (pts: [number, number][]) => pts.map(([r, y]) => [r * u * bw, Y(y) * u] as [number, number]);
  const flat = (m: THREE.Mesh, k = 0.74) => { m.scale.z = k; return m; };
  const U = (v: V3): V3 => [v[0] * u, v[1] * u, v[2] * u];

  // ---- lower body
  const long = outfit === 'robe' || outfit === 'dress' || outfit === 'roundrobe' || outfit === 'changshan' || outfit === 'magua' || outfit === 'deel';
  if (long) {
    // floor-length garment with a gentle flare and hem; uses bottom colour when explicitly set on robe/dress (e.g. 玄衣纁裳, 襦裙, 马面裙)
    const skirtC = (outfit === 'robe' || outfit === 'dress') && o.bottom ? o.bottom : top;
    paintLathe(body, S([[0, 0.012], [0.165, 0.012], [0.17, 0.03], [0.155, 0.14], [0.138, 0.3], [0.122, 0.44], [0.12, 0.5], [0, 0.5]]), skirtC, 24, 0.8, skirtPaint(o, u, skirtC, accent));
    flat(lathe(body, S([[0.166, 0.012], [0.174, 0.012], [0.174, 0.036], [0.166, 0.036]]), accent, 0, 0, 0, 20), 0.8);
    if (o.bixi) {
      // 蔽膝: ceremonial trapezoidal knee-apron hanging in front of 冕服 / 深衣, with gold trim and jade pendant drops
      box(body, '#d6b25e', 0, Y(0.28) * u - 0.1 * u, 0.132 * u, 0.095 * u, 0.24 * u, 0.008 * u, 0, -0.09, 0);
      box(body, o.bixi, 0, Y(0.285) * u - 0.095 * u, 0.135 * u, 0.082 * u, 0.225 * u, 0.008 * u, 0, -0.09, 0);
      for (const yy of [0.22, 0.32, 0.41]) box(body, '#eab308', 0, Y(yy) * u, 0.136 * u - (yy - 0.28) * 0.02 * u, 0.056 * u, 0.014 * u, 0.009 * u);
    }
    // 组玉佩 / 腰佩: hanging lateral jade pendant assemblies (珩, 琚, 璜, 冲牙 & silk tassels) on both hips of long robes
    for (const sx of [-1, 1]) {
      const px = sx * 0.112 * u, pz = 0.068 * u;
      box(body, '#eab308', px, Y(0.415) * u, pz, 0.007 * u, 0.014 * u, 0.022 * u);
      ellip(body, '#e2ece0', px, Y(0.39) * u, pz, 0.018 * u, 0.009 * u, 0.006 * u); // 玉珩 top bridge
      for (const dx of [-0.007, 0.007]) {
        box(body, '#b91c1c', px + dx * u, Y(0.305) * u, pz, 0.003 * u, 0.115 * u, 0.003 * u); // 组绶 silk cords
      }
      cyl(body, '#d8e6d6', px, Y(0.335) * u, pz, 0.014 * u, 0.005 * u, 12).rotation.x = Math.PI / 2; // 玉璧 central disc
      ellip(body, '#e2ece0', px, Y(0.28) * u, pz, 0.02 * u, 0.01 * u, 0.006 * u); // 玉璜 lower arc
      cone(body, '#991b1b', px, Y(0.205) * u, pz, 0.009 * u, 0.055 * u, 8); // 丝绦流苏 silk tassel
    }
    // toes peeking out, one foot slightly forward
    for (const sx of [-1, 1]) ellip(body, shoes, sx * 0.05 * u, 0.018 * u, (sx < 0 ? 0.118 : 0.105) * u, 0.03 * u, 0.018 * u, 0.046 * u, sx * 0.12);
  } else {
    const st = stanceFeet(o.stance ?? 'relax'), feet = o.feet ?? st.feet;
    const legs = new THREE.Group();
    fig.add(legs);
    for (const [i, sx] of [[0, -1], [1, 1]] as const) {
      const hip: V3 = U([sx * 0.056, st.hipY, 0]);
      const { mid: knee, end: ank } = ik2(hip, U(feet[i]), THIGH * u, SHIN * u, st.poles?.[i] ?? [sx * 0.12, 0, 1]);
      const leg: Station[] = [
        { p: [hip[0], hip[1] + 0.03 * u, hip[2]], w: 0.056 * u },
        { p: lerp3(hip, knee, 0.5), w: 0.05 * u },
        { p: knee, w: 0.04 * u },
        { p: lerp3(knee, ank, 0.32), w: 0.042 * u },
        { p: ank, w: 0.029 * u },
      ];
      sweep(legs, leg, o.shorts ? skin : bottom, { radial: 12, sub: 4 });
      if (o.shorts) sweep(legs, part(leg, 0, 0.4, 0.007 * u), bottom, { radial: 12, sub: 3 });
      else sweep(legs, part(leg, 0.9, 1, 0.006 * u), bottom, { radial: 12, sub: 1 }); // trouser hem
      if (o.socks) sweep(legs, part(leg, 0.74, 1, 0.004 * u), o.socks, { radial: 12, sub: 2 });
      // shoe: heel → instep → toe along the foot direction (toe out ~7°); a raised foot points its toes
      const raised = ank[1] > (ANK + 0.03) * u;
      const yaw = sx * 0.12, pitch = raised ? (ank[2] < 0 ? 0.9 : -0.25) : 0;
      const fwd = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
      const P = (k: number, dy: number): V3 => [ank[0] + fwd.x * k * u, ank[1] + (fwd.y * k + dy) * u, ank[2] + fwd.z * k * u];
      sweep(legs, [
        { p: P(-0.036, -0.016), w: 0.026 * u, h: 0.022 * u },
        { p: P(0.0, -0.012), w: 0.032 * u, h: 0.026 * u },
        { p: P(0.05, -0.018), w: 0.036 * u, h: 0.019 * u },
        { p: P(0.086, -0.021), w: 0.027 * u, h: 0.013 * u },
      ], shoes, { radial: 12, sub: 3, squash: 0.45, up: [0, 1, 0] });
    }
    if (o.shorts) { /* no skirt over the shorts */ } else if (outfit === 'coat') {
      // knee-length coat skirt
      paintLathe(body, S([[0.145, 0.24], [0.152, 0.24], [0.136, 0.36], [0.12, 0.5], [0, 0.5]]), top, 20, 0.78, skirtPaint(o, u, top, accent));
    } else if (outfit === 'tunic') {
      paintLathe(body, S([[0.132, 0.36], [0.14, 0.36], [0.126, 0.42], [0.118, 0.5], [0, 0.5]]), top, 20, 0.78, skirtPaint(o, u, top, accent));
    } else {
      // suit: hips
      flat(lathe(body, S([[0, 0.43], [0.112, 0.43], [0.118, 0.5], [0, 0.5]]), bottom, 0, 0, 0, 16), 0.74);
    }
    if (o.shorts) flat(lathe(body, S([[0, 0.38], [0.122, 0.38], [0.124, 0.46], [0.118, 0.52], [0, 0.52]]), bottom, 0, 0, 0, 18), 0.76);
  }

  // ---- torso
  const torsoC = top;
  paintLathe(body, S([[0, 0.48], [0.118, 0.48], [0.112, 0.56], [0.118, 0.64], [0.134, 0.71], [0.128, 0.75], [0.08, 0.78], [0, 0.785]]), torsoC, 22, 0.7, torsoPaint(o, u, torsoC, accent));
  // belt / sash with jade or gold plaques on court robes
  flat(lathe(body, S([[0.117, 0.505], [0.121, 0.505], [0.121, 0.54], [0.117, 0.54]]), accent, 0, 0, 0, 18), 0.72);
  if (outfit === 'roundrobe' || o.pattern === 'mianfu') {
    for (let i = -2; i <= 2; i++) {
      const a = i * 0.32;
      box(body, '#e8ece2', Math.sin(a) * 0.121 * u, Y(0.515) * u, Math.cos(a) * 0.088 * u, 0.018 * u, 0.022 * u, 0.008 * u, a);
    }
  }
  // collar details
  const fz = 0.094 * u;
  if (outfit === 'suit' || outfit === 'coat') {
    box(body, shirt, 0, Y(0.74) * u, fz, 0.06 * u, 0.07 * u, 0.006 * u);
    if (outfit === 'suit') box(body, accent, 0, Y(0.69) * u, fz + 0.003 * u, 0.018 * u, 0.09 * u, 0.006 * u);
    for (const sx of [-1, 1]) box(body, tone(top, -0.18), sx * 0.034 * u, Y(0.715) * u, fz + 0.002 * u, 0.026 * u, 0.11 * u, 0.006 * u, 0, 0, sx * 0.32);
    if (outfit === 'coat') for (let i = 0; i < 4; i++) ellip(body, '#d6b25e', 0.022 * u, Y(0.6 - i * 0.05) * u, fz + 0.006 * u, 0.007 * u);
  } else if (outfit === 'robe') {
    // crossed collar (交领) with inner white silk collar layer and wide outer trim
    box(body, '#f1ece0', -0.012 * u, Y(0.73) * u, fz + 0.001 * u, 0.014 * u, 0.11 * u, 0.008 * u, 0, 0, 0.42);
    box(body, accent, -0.02 * u, Y(0.712) * u, fz, 0.022 * u, 0.14 * u, 0.009 * u, 0, 0, 0.42);
    box(body, accent, 0.024 * u, Y(0.735) * u, fz - 0.002 * u, 0.02 * u, 0.095 * u, 0.009 * u, 0, 0, -0.42);
  } else if (outfit === 'roundrobe') {
    // round collar (圆领) hugging the neck with white inner rim
    add(body, g('fig-collar', () => new THREE.TorusGeometry(1, 0.22, 6, 18)), mat(accent), 0, Y(0.772) * u, 0, 0.064 * u, 0.064 * u * 0.72, 0.064 * u, 0, Math.PI / 2, 0);
  } else if (outfit === 'deel') {
    // the Mongol robe closes diagonally to the right armpit with gold brocade trim
    box(body, accent, 0.04 * u, Y(0.715) * u, fz - 0.004 * u, 0.024 * u, 0.135 * u, 0.009 * u, 0, 0, 0.75);
    flat(lathe(body, S([[0.121, 0.49], [0.127, 0.49], [0.127, 0.56], [0.121, 0.56]]), accent, 0, 0, 0, 18), 0.72);
  } else if (outfit === 'changshan' || outfit === 'magua' || outfit === 'zhongshan') {
    // stand collar; the 长衫 opens with a curved flap (大襟) to the right, the 中山装 has a row of buttons and four pockets
    cyl(body, outfit === 'magua' ? o.jacket ?? tone(top, -0.4) : top, 0, Y(0.785) * u, 0, 0.046 * u, 0.03 * u, 12);
    if (outfit === 'zhongshan') {
      for (let i = 0; i < 5; i++) ellip(body, '#d6b25e', 0, Y(0.75 - i * 0.05) * u, fz + 0.004 * u, 0.007 * u);
      for (const sx of [-1, 1]) for (const yy of [0.69, 0.55]) box(body, tone(top, -0.14), sx * 0.052 * u, Y(yy) * u, fz - (yy > 0.6 ? 0.004 : 0.0) * u, 0.044 * u, 0.04 * u, 0.006 * u);
    } else if (outfit === 'changshan') {
      box(body, accent, 0.04 * u, Y(0.735) * u, fz - 0.002 * u, 0.015 * u, 0.11 * u, 0.007 * u, 0, 0, 1.1);
      for (let i = 0; i < 3; i++) ellip(body, '#eab308', (0.018 + i * 0.032) * u, Y(0.76 - i * 0.025) * u, fz + 0.003 * u, 0.006 * u);
    }
  } else {
    box(body, accent, 0, Y(0.775) * u, fz - 0.01 * u, 0.07 * u, 0.012 * u, 0.012 * u);
  }
  if (outfit === 'magua') {
    // short dark jacket (石青补褂) over the robe, buttoned down the middle with gold frogs
    const jk = o.jacket ?? tone(top, -0.4);
    flat(lathe(body, S([[0.15, 0.4], [0.156, 0.4], [0.138, 0.5], [0.126, 0.6], [0.14, 0.71], [0.134, 0.755], [0.085, 0.785], [0, 0.79]]), jk, 0, 0, 0, 18), 0.72);
    box(body, '#0f172a', 0, Y(0.42) * u, fz + 0.003 * u, 0.006 * u, 0.34 * u, 0.006 * u);
    for (let i = 0; i < 5; i++) ellip(body, '#eab308', 0, Y(0.74 - i * 0.075) * u, 0.104 * u, 0.008 * u);
  }
  if (o.piling) {
    // 披领: Qing crescent-shaped court shoulder collar in dark navy with gold dragon border
    flat(lathe(body, S([[0.145, 0.7], [0.158, 0.71], [0.135, 0.755], [0.082, 0.785], [0, 0.79]]), '#eab308', 0, 0.002 * u, 0, 20), 0.74);
    flat(lathe(body, S([[0.142, 0.71], [0.154, 0.718], [0.132, 0.758], [0.08, 0.786], [0, 0.791]]), o.piling, 0, 0.004 * u, 0, 20), 0.74);
  }
  if (o.badge) {
    // 补子: square rank badge with gold border & crane/cloud motif (officials) or round dragon roundel (emperors)
    for (const sz of [1, -1]) {
      const bz = sz * (fz - 0.002 * u);
      if (o.badgeRound) {
        ellip(body, '#eab308', 0, Y(0.64) * u, bz, 0.056 * u, 0.056 * u, 0.012 * u);
        ellip(body, o.badge, 0, Y(0.64) * u, bz + sz * 0.002 * u, 0.048 * u, 0.048 * u, 0.012 * u);
        ellip(body, '#b91c1c', 0, Y(0.64) * u, bz + sz * 0.005 * u, 0.026 * u, 0.022 * u, 0.008 * u);
        ellip(body, '#fef08a', 0, Y(0.645) * u, bz + sz * 0.007 * u, 0.014 * u, 0.018 * u, 0.006 * u);
      } else {
        box(body, '#d6b25e', 0, Y(0.605) * u, bz, 0.094 * u, 0.094 * u, 0.01 * u);
        box(body, o.badge, 0, Y(0.61) * u, bz + sz * 0.001 * u, 0.082 * u, 0.082 * u, 0.011 * u);
        // crane / cloud / wave motif inside the mandarin square
        box(body, '#eab308', 0, Y(0.612) * u, bz + sz * 0.004 * u, 0.076 * u, 0.016 * u, 0.008 * u);
        ellip(body, '#f8fafc', 0, Y(0.66) * u, bz + sz * 0.006 * u, 0.024 * u, 0.018 * u, 0.006 * u);
        ellip(body, '#ef4444', 0.012 * u, Y(0.675) * u, bz + sz * 0.007 * u, 0.008 * u, 0.008 * u, 0.005 * u);
      }
    }
  }
  if (o.chaozhu) {
    // 朝珠: Qing court necklace of 108 beads hanging down the chest with four coral divider beads (佛头)
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const rx = Math.sin(a) * 0.056 * u;
      const cz = Math.cos(a) * 0.068 * u + 0.032 * u;
      const cy = Y(0.75) * u - Math.max(0, Math.cos(a)) * 0.14 * u;
      const isFoutou = i === 0 || i === 4 || i === 9 || i === 14;
      ellip(body, isFoutou ? '#dc2626' : '#f59e0b', rx, cy, cz, (isFoutou ? 0.01 : 0.0065) * u);
    }
    // central turquoise/coral drop (纪念 / 背云) on the chest
    ellip(body, '#2dd4bf', 0, Y(0.57) * u, 0.102 * u, 0.01 * u, 0.015 * u, 0.006 * u);
  }
  if (o.pibo) {
    // 披帛: Tang court lady's floating silk scarf looping behind the shoulders and trailing down the sides
    for (const sx of [-1, 1]) {
      tube(body, [
        [0, Y(0.74) * u, -0.075 * u],
        [sx * 0.145 * u, Y(0.71) * u, 0.02 * u],
        [sx * 0.165 * u, Y(0.54) * u, 0.075 * u],
        [sx * 0.175 * u, Y(0.28) * u, 0.03 * u],
        [sx * 0.185 * u, Y(0.08) * u, -0.02 * u],
      ], 0.016 * u, 0.012 * u, o.pibo, { radial: 6, sub: 3 });
    }
  }
  if (o.armor) {
    // lamellar armour or Qing brigandine: vertex-painted scale plates / gilt studs, shoulder guards, plated skirt, optional Mingguang discs
    const ar = o.armor, dk = tone(ar, -0.35), ap = armorPaint(o.armorStyle, ar, u);
    paintLathe(body, S([[0.128, 0.47], [0.131, 0.47], [0.124, 0.56], [0.13, 0.64], [0.146, 0.71], [0.12, 0.765], [0, 0.77]]), ar, 22, 0.72, ap);
    for (const yy of [0.53, 0.6, 0.67]) flat(lathe(body, S([[0.128, yy], [0.134, yy], [0.134, yy + 0.008], [0.128, yy + 0.008]]), dk, 0, 0, 0, 18), 0.72);
    paintLathe(body, S([[0.16, 0.3], [0.168, 0.3], [0.15, 0.4], [0.131, 0.48], [0, 0.48]]), ar, 22, 0.78, ap);
    flat(lathe(body, S([[0.164, 0.3], [0.17, 0.3], [0.17, 0.315], [0.164, 0.315]]), dk, 0, 0, 0, 18), 0.78);
    for (const sx of [-1, 1]) {
      ellip(body, ar, sx * 0.15 * u, Y(0.72) * u, 0, 0.072 * u, 0.042 * u, 0.062 * u, 0, 0, sx * -0.5);
      ellip(body, dk, sx * 0.168 * u, Y(0.69) * u, 0, 0.052 * u, 0.026 * u, 0.055 * u, 0, 0, sx * -0.7);
      if (o.armorStyle === 'mingguang' || o.armorStyle === 'ming') {
        // 虎头护肩 gold monster-head pauldron boss
        ellip(body, '#eab308', sx * 0.158 * u, Y(0.725) * u, 0.015 * u, 0.024 * u, 0.02 * u, 0.024 * u);
      }
    }
    if (o.discs) {
      // 明光铠: twin polished bronze/gold chest mirrors + red silk X-cords (朱红甲绊) + tiger/beast waist clasp (兽面吞腹)
      for (const sx of [-1, 1]) {
        ellip(body, '#facc15', sx * 0.05 * u, Y(0.665) * u, 0.1 * u, 0.036 * u, 0.036 * u, 0.009 * u);
        box(body, '#b91c1c', sx * 0.025 * u, Y(0.66) * u, 0.102 * u, 0.01 * u, 0.11 * u, 0.006 * u, 0, 0, sx * 0.55);
      }
      ellip(body, '#eab308', 0, Y(0.52) * u, 0.102 * u, 0.032 * u, 0.028 * u, 0.012 * u);
    }
    flat(lathe(body, S([[0.13, 0.5], [0.136, 0.5], [0.136, 0.53], [0.13, 0.53]]), '#3a2a1c', 0, 0, 0, 18), 0.74);
  }
  if (o.cape) {
    flat(lathe(body, S([[0.16, 0.2], [0.17, 0.2], [0.15, 0.45], [0.13, 0.7], [0.105, 0.79], [0, 0.8]]), o.cape, 0, -0.012 * u, -0.022 * u, 16), 0.7).scale.z = 0.62;
  }

  // ---- arms: shoulder → biceps → elbow → forearm → wrist, sleeve as a cloth layer, mitten hand with a thumb
  const anchors: Partial<FigureAnchors> = {};
  const sleeve = o.sleeve ?? 1;
  for (const sgn of [-1, 1] as const) {
    const { sh, el: elbow, wr: wrist, dir: fd } = armJoints(o, sgn);
    const arm: Station[] = [
      { p: sh, w: 0.044 * u },
      { p: lerp3(sh, elbow, 0.45), w: 0.038 * u },
      { p: elbow, w: 0.032 * u },
      { p: lerp3(elbow, wrist, 0.35), w: 0.033 * u },
      { p: wrist, w: 0.025 * u },
    ];
    ellip(body, sleeve > 0 ? top : skin, sh[0] * 0.92, sh[1] - 0.008 * u, sh[2], 0.044 * u, 0.036 * u, 0.042 * u);
    if (o.wideSleeves) {
      sweep(body, part(arm, 0, 0.53, 0.004 * u), top, { radial: 12, sub: 3 });
      // hanging sleeve: forearm that flares toward the cuff plus a drooping fold
      tube(body, [elbow, wrist], 0.044 * u, 0.066 * u, top, { radial: 10, sub: 3 });
      ellip(body, accent, wrist[0], wrist[1], wrist[2], 0.058 * u, 0.058 * u, 0.04 * u);
      ellip(body, top, wrist[0], wrist[1] - 0.05 * u, wrist[2] - 0.01 * u, 0.04 * u, 0.06 * u, 0.03 * u);
    } else {
      sweep(body, arm, sleeve >= 1 ? top : skin, { radial: 12, sub: 4 });
      if (sleeve > 0 && sleeve < 1) sweep(body, part(arm, 0, sleeve * 0.53, 0.006 * u), top, { radial: 12, sub: 2 });
      if (sleeve >= 1) {
        const isQingSleeve = outfit === 'magua' || outfit === 'changshan' || o.pattern === 'qingdragon' || o.pattern === 'qizhuang';
        const cuff = outfit === 'suit' || outfit === 'coat' ? shirt : isQingSleeve ? '#1e3a8a' : tone(top, -0.12);
        sweep(body, part(arm, isQingSleeve ? 0.78 : 0.9, 1, 0.005 * u), cuff, { radial: 12, sub: 2 });
        if (isQingSleeve) {
          // 清代马蹄袖 (horse-hoof cuff) with gold trim ring
          sweep(body, part(arm, 0.76, 0.8, 0.006 * u), '#eab308', { radial: 12, sub: 1 });
        }
      }
    }
    // hand slightly past the wrist along the forearm: palm, finger block and thumb
    const d = new THREE.Vector3(...fd);
    const hand: V3 = [wrist[0] + d.x * 0.03 * u, wrist[1] + d.y * 0.03 * u, wrist[2] + d.z * 0.03 * u];
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
    const palm = ellip(body, skin, hand[0], hand[1], hand[2], 0.03 * u, 0.036 * u, 0.019 * u);
    palm.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), sgn * 1.45));
    const tip = new THREE.Vector3(0, -0.03 * u, 0.004 * u).applyQuaternion(palm.quaternion);
    const fing = ellip(body, skin, hand[0] + tip.x, hand[1] + tip.y, hand[2] + tip.z, 0.027 * u, 0.022 * u, 0.017 * u);
    fing.quaternion.copy(palm.quaternion);
    const th = new THREE.Vector3(-0.024 * u, -0.006 * u, 0.012 * u).applyQuaternion(palm.quaternion);
    const thumb = ellip(body, skin, hand[0] + th.x, hand[1] + th.y, hand[2] + th.z, 0.011 * u, 0.02 * u, 0.011 * u);
    thumb.quaternion.copy(palm.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.5));
    if (sgn < 0) anchors.handL = hand; else anchors.handR = hand;
  }

  // ---- neck & head: a natural head (1/7 of the height) with sculpted ears, layered eyes, nose & lips
  cyl(body, skin, 0, 0.8 * u, 0, 0.03 * u, 0.08 * u, 10);
  const hy = 0.93 * u, hr = 0.059 * u;
  ellip(body, skin, 0, hy, 0.002 * u, hr, hr * 1.2, hr * 1.06);
  ellip(body, skin, 0, hy - hr * 0.6, hr * 0.22, hr * 0.66, hr * 0.48, hr * 0.7); // jaw and chin
  for (const sx of [-1, 1]) {
    ellip(body, tone(skin, -0.08), sx * hr * 0.98, hy - hr * 0.02, -hr * 0.04, hr * 0.14, hr * 0.26, hr * 0.12); // ears
    ellip(body, tone(skin, -0.11), sx * hr * 0.96, hy - hr * 0.21, -hr * 0.02, hr * 0.09, hr * 0.11, hr * 0.1); // earlobes
    if (o.blind) {
      box(body, '#6b4c3b', sx * hr * 0.34, hy + hr * 0.05, hr * 0.94, hr * 0.24, hr * 0.03, hr * 0.04); // closed peaceful eyelids
    } else {
      ellip(body, '#f8f5ee', sx * hr * 0.34, hy + hr * 0.06, hr * 0.92, hr * 0.14, hr * 0.06, hr * 0.045); // sclera
      ellip(body, '#2a201b', sx * hr * 0.34, hy + hr * 0.06, hr * 0.95, hr * 0.085, hr * 0.052, hr * 0.04); // iris/pupil
    }
    box(body, tone(hair, -0.15), sx * hr * 0.36, hy + hr * 0.25, hr * 0.92, hr * 0.32, hr * 0.05, hr * 0.06, 0, 0, sx * -0.08); // brows
    if ((o.hairStyle ?? 'short') !== 'bald') {
      ellip(body, hair, sx * hr * 0.88, hy + hr * 0.06, hr * 0.28, hr * 0.1, hr * 0.32, hr * 0.16); // temple hair locks (鬓发)
    }
  }
  if (o.crescent) {
    // 包拯额上银色月牙
    ellip(body, '#f8fafc', 0, hy + hr * 0.4, hr * 1.02, hr * 0.19, hr * 0.16, hr * 0.05);
    ellip(body, skin, hr * 0.09, hy + hr * 0.47, hr * 1.05, hr * 0.14, hr * 0.13, hr * 0.05);
  }
  ellip(body, tone(skin, -0.05), 0, hy - hr * 0.12, hr * 1.0, hr * 0.1, hr * 0.22, hr * 0.15); // nose bridge
  for (const sx of [-1, 1]) ellip(body, tone(skin, -0.09), sx * hr * 0.08, hy - hr * 0.22, hr * 0.98, hr * 0.06, hr * 0.055, hr * 0.06); // nose alae
  ellip(body, '#9a6352', 0, hy - hr * 0.48, hr * 0.91, hr * 0.16, hr * 0.04, hr * 0.05); // upper lip
  ellip(body, '#a86d5b', 0, hy - hr * 0.54, hr * 0.9, hr * 0.14, hr * 0.042, hr * 0.05); // lower lip
  if (o.glasses) {
    for (const sx of [-1, 1]) {
      const m = add(body, g('fig-ring', () => new THREE.TorusGeometry(1, 0.16, 6, 14)), mat('#3f3f46', { metal: 0.6 }), sx * hr * 0.34, hy + hr * 0.04, hr * 0.98, hr * 0.2, hr * 0.17, hr * 0.17);
      m.castShadow = false;
    }
    box(body, '#3f3f46', 0, hy + hr * 0.07, hr * 0.99, hr * 0.16, hr * 0.03, hr * 0.03);
  }
  hairFor(body, o.hairStyle ?? 'short', hair, hy, hr, u);
  beardFor(body, o.beard ?? 'none', o.beardColor ?? hair, hy, hr, u);
  const topY = hy + hr * 1.2;
  hatFor(body, o.hat ?? 'none', o.hatColor ?? '#1f2937', hy, hr, u, o.hatBadge, o.feathers);

  // anchors to builder space
  body.updateMatrix(); fig.updateMatrix();
  const toWorld = (v: V3): V3 => {
    const w = new THREE.Vector3(...v).applyMatrix4(body.matrix).applyMatrix4(fig.matrix);
    return [w.x, w.y, w.z];
  };
  return {
    group: fig, handL: toWorld(anchors.handL!), handR: toWorld(anchors.handR!), head: toWorld([0, hy, 0]), headR: hr,
    top: toWorld([0, topY, 0]), u,
  };
}

function hairFor(p: THREE.Object3D, s: HairStyle, c: string, hy: number, hr: number, u: number): void {
  if (s === 'bald') { ellip(p, c, 0, hy - hr * 0.1, -hr * 0.3, hr * 1.02, hr * 0.6, hr * 0.8); return; }
  if (s === 'queue') {
    // Qing 辫子: front shaved, hair on the crown and back gathered into a long braid
    ellip(p, c, 0, hy + hr * 0.3, -hr * 0.32, hr * 1.0, hr * 0.84, hr * 0.8);
    tube(p, [[0, hy - hr * 0.2, -hr * 1.0], [0, hy - hr * 2.2, -hr * 1.5], [0, hy - hr * 5, -hr * 1.6], [0, hy - hr * 7, -hr * 1.5]], hr * 0.2, hr * 0.08, c, { radial: 7, sub: 3 });
    return;
  }
  // skull cap shared by most styles (pushed back so the face stays visible)
  ellip(p, c, 0, hy + hr * 0.22, -hr * 0.1, hr * 1.06, hr * 0.98, hr * 1.04);
  ellip(p, tone(c, 0.08), 0, hy + hr * 0.62, hr * 0.38, hr * 0.78, hr * 0.32, hr * 0.5); // fringe line
  switch (s) {
    case 'long':
      ellip(p, c, 0, hy - hr * 0.7, -hr * 0.55, hr * 1.0, hr * 1.5, hr * 0.5);
      for (const sx of [-1, 1]) ellip(p, c, sx * hr * 0.92, hy - hr * 0.5, -hr * 0.05, hr * 0.26, hr * 1.1, hr * 0.5);
      break;
    case 'bob':
      ellip(p, c, 0, hy - hr * 0.2, -hr * 0.2, hr * 1.14, hr * 0.95, hr * 1.0);
      break;
    case 'bun':
      ellip(p, c, 0, hy + hr * 0.5, -hr * 1.05, hr * 0.42, hr * 0.42, hr * 0.38);
      break;
    case 'highbun': // Tang court lady: tall double bun with hairpins and a flower
      ellip(p, c, 0, hy + hr * 1.35, -hr * 0.2, hr * 0.6, hr * 0.62, hr * 0.5);
      for (const sx of [-1, 1]) ellip(p, c, sx * hr * 0.42, hy + hr * 1.75, -hr * 0.3, hr * 0.32, hr * 0.42, hr * 0.3, 0, 0, sx * -0.4);
      ellip(p, '#dc2626', hr * 0.55, hy + hr * 1.2, hr * 0.15, hr * 0.2);
      for (const sx of [-1, 1]) box(p, '#d6b25e', sx * hr * 0.5, hy + hr * 1.3, -hr * 0.1, hr * 0.9, hr * 0.05, hr * 0.05, 0, 0, sx * 0.5);
      break;
    case 'topknot':
      ellip(p, c, 0, hy + hr * 1.18, -hr * 0.1, hr * 0.32, hr * 0.32, hr * 0.32);
      box(p, '#d6b25e', 0, hy + hr * 1.2, -hr * 0.1, hr * 1.0, hr * 0.06, hr * 0.06);
      break;
    case 'braid':
      ellip(p, c, 0, hy - hr * 0.1, -hr * 0.7, hr * 0.5, hr * 0.7, hr * 0.4);
      tube(p, [[0, hy - hr * 0.4, -hr * 0.95], [0, hy - hr * 1.6, -hr * 1.15], [0, hy - hr * 2.8, -hr * 1.05]], hr * 0.18, hr * 0.12, c, { radial: 8, sub: 3 });
      break;
    case 'curly':
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2, rr = hr * 0.98;
        ellip(p, tone(c, (i % 3) * 0.05), Math.cos(a) * rr * 0.9, hy + hr * 0.35 + Math.sin(i * 2.1) * hr * 0.15, Math.sin(a) * rr * 0.75 - hr * 0.15, hr * 0.3);
      }
      break;
    case 'wig':
      // 18th-century powdered wig: side rolls + ribbon-tied tail
      for (const sx of [-1, 1]) for (let k = 0; k < 2; k++)
        add(p, g('fig-roll', () => new THREE.CylinderGeometry(1, 1, 1, 12)), mat(c), sx * hr * 0.98, hy - hr * (0.05 + k * 0.32), -hr * 0.1, hr * 0.17, hr * 0.5, hr * 0.17, 0, Math.PI / 2, 0);
      ellip(p, c, 0, hy - hr * 0.5, -hr * 0.95, hr * 0.3, hr * 0.5, hr * 0.3);
      box(p, '#1f2937', 0, hy - hr * 0.2, -hr * 1.08, hr * 0.5, hr * 0.14, hr * 0.12);
      break;
    case 'wild':
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        ellip(p, tone(c, (i % 4) * 0.04), Math.cos(a) * hr * 1.05, hy + hr * 0.25 + Math.sin(i * 1.7) * hr * 0.25, Math.sin(a) * hr * 0.85 - hr * 0.2, hr * 0.34, hr * 0.28, hr * 0.3);
      }
      break;
    default:
      for (const sx of [-1, 1]) ellip(p, c, sx * hr * 0.88, hy + hr * 0.05, -hr * 0.1, hr * 0.22, hr * 0.5, hr * 0.6);
  }
}

function beardFor(p: THREE.Object3D, s: Beard, c: string, hy: number, hr: number, u: number): void {
  if (s === 'none') return;
  if (s === 'moustache' || s === 'goatee' || s === 'full' || s === 'long')
    for (const sx of [-1, 1]) ellip(p, c, sx * hr * 0.2, hy - hr * 0.3, hr * 0.95, hr * 0.26, hr * 0.08, hr * 0.1, 0, 0, sx * -0.3);
  if (s === 'goatee') ellip(p, c, 0, hy - hr * 0.72, hr * 0.62, hr * 0.2, hr * 0.28, hr * 0.18);
  if (s === 'short' || s === 'full') ellip(p, c, 0, hy - hr * 0.5, hr * 0.38, hr * 0.82, hr * 0.62, hr * 0.62);
  if (s === 'full') ellip(p, c, 0, hy - hr * 0.95, hr * 0.42, hr * 0.55, hr * 0.5, hr * 0.42);
  if (s === 'long') {
    ellip(p, c, 0, hy - hr * 0.55, hr * 0.42, hr * 0.78, hr * 0.55, hr * 0.55);
    tube(p, [[0, hy - hr * 0.7, hr * 0.7], [0, hy - hr * 1.4, hr * 0.85], [0, hy - hr * 2.1, hr * 0.78]], hr * 0.4, hr * 0.08, c, { radial: 10, sub: 4 });
  }
  void u;
}

/** Period headwear and beard for a head of radius `hr` centred at the origin of `p` (dresses `human()` riders). */
export function headwear(p: THREE.Object3D, hat: Hat, c: string, hr: number, o: { badge?: string; beard?: Beard; beardColor?: string; feathers?: number | boolean } = {}): void {
  hatFor(p, hat, c, 0, hr, hr / 0.106, o.badge, o.feathers);
  if (o.beard) beardFor(p, o.beard, o.beardColor ?? '#2a2420', 0, hr, hr / 0.106);
}

function hatFor(p: THREE.Object3D, s: Hat, c: string, hy: number, hr: number, u: number, badge?: string, feathers?: number | boolean): void {
  const ty = hy + hr * 0.95;
  switch (s) {
    case 'mianguan': { // 冕冠: cap, flat board (綖板) with red lining & gold trim, 9–12 strings of five-coloured jade beads (五彩玉旒) front & back, 充耳 jade ear-plugs, and gold hairpin
      cyl(p, c, 0, ty + hr * 0.25, -hr * 0.05, hr * 0.65, hr * 0.6, 16);
      box(p, '#991b1b', 0, ty + hr * 0.58, -hr * 0.05, hr * 1.68, hr * 0.05, hr * 2.58, 0, 0.08, 0);
      box(p, c, 0, ty + hr * 0.63, -hr * 0.05, hr * 1.66, hr * 0.06, hr * 2.55, 0, 0.08, 0);
      box(p, '#eab308', 0, ty + hr * 0.61, -hr * 0.05, hr * 1.72, hr * 0.04, hr * 2.6, 0, 0.08, 0);
      box(p, '#eab308', 0, ty + hr * 0.3, -hr * 0.05, hr * 1.75, hr * 0.06, hr * 0.06);
      // 充耳 (jade ear-plugs suspended from gold cords at both sides)
      for (const sx of [-1, 1]) {
        box(p, '#eab308', sx * hr * 0.82, ty + hr * 0.22, hr * 0.05, hr * 0.03, hr * 0.65, hr * 0.03);
        ellip(p, '#e2ece0', sx * hr * 0.82, ty - hr * 0.12, hr * 0.05, hr * 0.09, hr * 0.12, hr * 0.09);
      }
      const beadCols = ['#ef4444', '#f8fafc', '#38bdf8', '#facc15', '#5eead4'];
      for (const zs of [1, -1]) for (let i = 0; i < 9; i++) {
        const x = (i - 4) * hr * 0.185, z = -hr * 0.05 + zs * hr * 1.24, top = ty + hr * 0.6 - zs * hr * 0.09;
        box(p, '#b91c1c', x, top - hr * 0.38, z, hr * 0.02, hr * 0.76, hr * 0.02);
        for (let k = 0; k < 4; k++) ellip(p, beadCols[(i + k) % 5], x, top - hr * (0.14 + k * 0.19), z, hr * 0.046);
      }
      break;
    }
    case 'tongtian': { // 汉魏晋通天冠 / 远游冠: tall upright ridges (梁) curving up from a gold-banded base with a mountain-shaped front plaque (山题)
      cyl(p, c, 0, ty + hr * 0.05, -hr * 0.05, hr * 0.92, hr * 0.34, 18);
      cyl(p, '#eab308', 0, ty - hr * 0.08, -hr * 0.05, hr * 0.95, hr * 0.1, 18);
      box(p, c, 0, ty + hr * 0.72, -hr * 0.12, hr * 0.85, hr * 1.25, hr * 0.42, 0, -0.18, 0);
      for (let i = -2; i <= 2; i++) {
        box(p, '#eab308', i * hr * 0.18, ty + hr * 0.72, hr * 0.1, hr * 0.035, hr * 1.22, hr * 0.05, 0, -0.18, 0);
      }
      // 山题 gold mountain plaque in front + jade hairpin
      box(p, '#eab308', 0, ty + hr * 0.25, hr * 0.82, hr * 0.48, hr * 0.36, hr * 0.06, 0, -0.15, 0);
      box(p, '#e2ece0', 0, ty + hr * 0.18, -hr * 0.05, hr * 1.75, hr * 0.06, hr * 0.06);
      break;
    }
    case 'qinhan_helm': { // 秦汉武弁大冠 / 鹖冠: dark lacquer cap with crimson crest and twin pheasant tail plumes (双鹖尾)
      cyl(p, c, 0, ty + hr * 0.08, -hr * 0.05, hr * 0.96, hr * 0.42, 16);
      box(p, '#991b1b', 0, ty + hr * 0.38, -hr * 0.08, hr * 0.8, hr * 0.5, hr * 0.75);
      cyl(p, '#eab308', 0, ty - hr * 0.08, -hr * 0.05, hr * 0.98, hr * 0.08, 16);
      // cheek straps (缨) and twin curving pheasant feathers
      for (const sx of [-1, 1]) {
        tube(p, [
          [sx * hr * 0.22, ty + hr * 0.55, -hr * 0.15],
          [sx * hr * 0.65, ty + hr * 1.25, -hr * 0.55],
          [sx * hr * 1.05, ty + hr * 1.65, -hr * 1.15],
        ], hr * 0.08, hr * 0.03, badge ?? '#b91c1c', { radial: 6, sub: 3 });
      }
      break;
    }
    case 'jinxian': // 进贤冠: black band and a slanted three-beam front plate (三梁冠)
      cyl(p, c, 0, ty + hr * 0.1, -hr * 0.05, hr * 0.85, hr * 0.3, 16);
      box(p, c, 0, ty + hr * 0.55, -hr * 0.25, hr * 0.76, hr * 0.95, hr * 0.12, 0, -0.5, 0);
      for (const i of [-1, 0, 1]) box(p, '#eab308', i * hr * 0.2, ty + hr * 0.55, -hr * 0.19, hr * 0.03, hr * 0.9, hr * 0.03, 0, -0.5, 0);
      box(p, '#d6b25e', 0, ty + hr * 0.2, -hr * 0.05, hr * 1.6, hr * 0.05, hr * 0.05);
      break;
    case 'ruanjiao': // Tang 软脚幞头: a high rounded crown, two soft ribbons hanging behind
      ellip(p, c, 0, ty + hr * 0.1, -hr * 0.1, hr * 1.0, hr * 0.6, hr * 1.0);
      ellip(p, c, 0, ty + hr * 0.55, -hr * 0.25, hr * 0.55, hr * 0.55, hr * 0.5);
      for (const sx of [-1, 1]) tube(p, [[sx * hr * 0.25, ty, -hr * 0.95], [sx * hr * 0.35, ty - hr * 0.8, -hr * 1.15], [sx * hr * 0.4, ty - hr * 1.8, -hr * 1.05]], hr * 0.09, hr * 0.07, c, { radial: 5, sub: 2 });
      break;
    case 'zhanjiao': // Song 展脚幞头: a square cap with long straight wings
      box(p, c, 0, ty + hr * 0.2, -hr * 0.05, hr * 1.9, hr * 0.75, hr * 1.85);
      box(p, c, 0, ty + hr * 0.55, -hr * 0.35, hr * 1.5, hr * 0.6, hr * 1.0);
      // broad flat straps rather than hairlines, so on the map they read as the hat and not a stray line
      for (const sx of [-1, 1]) box(p, c, sx * hr * 2.1, ty + hr * 0.35, -hr * 0.6, hr * 2.4, hr * 0.26, hr * 0.06);
      break;
    case 'wusha': // Ming 乌纱帽: low front, raised back, two oval wings
    case 'yishan': // Ming emperor 翼善冠:乌纱折上巾 or 金丝翼善冠 with two upright wings and twin dragons playing with a pearl
      ellip(p, c, 0, ty + hr * 0.05, -hr * 0.05, hr * 1.05, hr * 0.55, hr * 1.05);
      ellip(p, c, 0, ty + hr * 0.4, -hr * 0.45, hr * 0.85, hr * 0.6, hr * 0.6);
      for (const sx of [-1, 1]) {
        if (s === 'wusha') ellip(p, c, sx * hr * 1.35, ty + hr * 0.45, -hr * 0.85, hr * 0.6, hr * 0.3, hr * 0.04, sx * 0.15);
        else ellip(p, c, sx * hr * 0.5, ty + hr * 1.0, -hr * 0.75, hr * 0.36, hr * 0.52, hr * 0.06, 0, 0, sx * -0.35);
      }
      if (s === 'yishan') {
        cyl(p, '#eab308', 0, ty - hr * 0.12, -hr * 0.05, hr * 1.06, hr * 0.08, 18);
        for (const sx of [-1, 1]) ellip(p, '#eab308', sx * hr * 0.35, ty + hr * 0.48, -hr * 0.98, hr * 0.22, hr * 0.16, hr * 0.07);
        ellip(p, '#ef4444', 0, ty + hr * 0.62, hr * 0.52, hr * 0.12); // red jewel on forehead
      }
      break;
    case 'fangjin': { // Ming scholar 四方平定巾: a tall soft square cap
      const m = lathe(p, [[0, 0], [hr * 0.95, 0], [hr * 1.25, hr * 1.3], [0, hr * 1.3]], c, 0, ty - hr * 0.35, -hr * 0.05, 4);
      m.rotation.y = Math.PI / 4;
      break;
    }
    case 'boli': // Yuan 钹笠: a round hat with a wide brim and a jade/gold finial on top
      cyl(p, c, 0, ty, 0, hr * 1.6, hr * 0.06, 20);
      cyl(p, '#eab308', 0, ty + hr * 0.04, 0, hr * 0.98, hr * 0.07, 20);
      ellip(p, c, 0, ty + hr * 0.18, -hr * 0.03, hr * 0.95, hr * 0.65, hr * 0.95);
      ellip(p, badge ?? '#eab308', 0, ty + hr * 0.88, 0, hr * 0.16, hr * 0.22, hr * 0.16);
      break;
    case 'gugu': // Yuan noblewoman 罟罟冠: a tall flaring red birch-bark headdress with pearls & peacock feathers
      ellip(p, c, 0, ty - hr * 0.05, -hr * 0.05, hr * 1.05, hr * 0.5, hr * 1.05);
      lathe(p, [[0, 0], [hr * 0.45, 0], [hr * 0.3, hr * 1.4], [hr * 0.55, hr * 2.4], [0, hr * 2.4]], c, 0, ty, -hr * 0.1, 12);
      cyl(p, '#eab308', 0, ty + hr * 1.2, -hr * 0.1, hr * 0.34, hr * 0.12, 12);
      ellip(p, '#eab308', 0, ty + hr * 2.45, -hr * 0.1, hr * 0.22);
      break;
    case 'qingguan': // Qing winter court hat (暖帽): upturned dark sable brim, crimson silk floss (红纬), tall gold-filigree finial (东北珠/红宝石顶珠) + optional peacock feather (花翎)
      lathe(p, [[0, 0], [hr * 1.25, 0], [hr * 1.34, hr * 0.4], [hr * 1.18, hr * 0.44], [hr * 0.9, hr * 0.1], [0, hr * 0.1]], c, 0, ty - hr * 0.25, 0, 18);
      cone(p, '#dc2626', 0, ty + hr * 0.4, 0, hr * 0.96, hr * 0.64, 16);
      cyl(p, '#eab308', 0, ty + hr * 0.72, 0, hr * 0.14, hr * 0.18, 10);
      ellip(p, badge ?? '#eab308', 0, ty + hr * 0.9, 0, hr * 0.15, hr * 0.19, hr * 0.15);
      if (feathers) {
        // 翡翠翎管 (jadeite tube) + 孔雀花翎 (peacock plume trailing backward)
        tube(p, [[0, ty + hr * 0.62, -hr * 0.12], [0, ty + hr * 0.78, -hr * 0.36]], hr * 0.05, hr * 0.05, '#10b981', { radial: 6, sub: 1 });
        tube(p, [
          [0, ty + hr * 0.72, -hr * 0.15],
          [0, ty + hr * 0.85, -hr * 0.85],
          [0, ty + hr * 0.55, -hr * 1.55],
        ], hr * 0.09, hr * 0.15, '#14532d', { radial: 6, sub: 3 });
        ellip(p, '#eab308', 0, ty + hr * 0.58, -hr * 1.5, hr * 0.12, hr * 0.08, hr * 0.14);
      }
      break;
    case 'guapi': // 瓜皮帽: six-panelled satin skullcap with a red coral knot
      ellip(p, c, 0, ty - hr * 0.05, -hr * 0.05, hr * 1.08, hr * 0.6, hr * 1.08);
      cyl(p, '#eab308', 0, ty - hr * 0.35, -hr * 0.05, hr * 1.09, hr * 0.1, 18);
      ellip(p, badge ?? '#dc2626', 0, ty + hr * 0.55, -hr * 0.05, hr * 0.13);
      break;
    case 'liangba': // Qing lady 两把头 / 大拉翅: wide black satin board crowned with peonies, jadeite pins, and red silk tassel (流苏)
      box(p, c, 0, ty + hr * 0.2, -hr * 0.2, hr * 0.7, hr * 0.7, hr * 0.6);
      box(p, c, 0, ty + hr * 0.72, -hr * 0.2, hr * 2.85, hr * 0.8, hr * 0.35);
      box(p, '#eab308', 0, ty + hr * 0.72, -hr * 0.02, hr * 2.4, hr * 0.12, hr * 0.06);
      for (let i = 0; i < 5; i++) ellip(p, i === 2 ? '#dc2626' : i % 2 ? '#f472b6' : '#38bdf8', (i - 2) * hr * 0.48, ty + hr * 0.78, hr * 0.04, hr * 0.18);
      for (const sx of [-1, 1]) tube(p, [[sx * hr * 1.35, ty + hr * 0.45, -hr * 0.1], [sx * hr * 1.45, ty - hr * 0.65, -hr * 0.08]], hr * 0.07, hr * 0.05, '#dc2626', { radial: 5, sub: 2 });
      break;
    case 'plume': // Tang/Song 凤翅兜鍪: gilt-trimmed bowl, curved phoenix-wing ear guards, lamellar neck guard, red horsehair plume on a gold finial
      ellip(p, c, 0, ty - hr * 0.15, -hr * 0.05, hr * 1.12, hr * 0.85, hr * 1.12);
      box(p, '#eab308', 0, ty - hr * 0.22, hr * 0.98, hr * 0.9, hr * 0.16, hr * 0.16);
      for (const sx of [-1, 1]) {
        ellip(p, c, sx * hr * 1.0, hy - hr * 0.05, -hr * 0.15, hr * 0.22, hr * 0.62, hr * 0.6);
        ellip(p, '#eab308', sx * hr * 1.18, ty + hr * 0.25, -hr * 0.1, hr * 0.35, hr * 0.18, hr * 0.06, 0, 0, sx * -0.45);
      }
      ellip(p, c, 0, hy - hr * 0.1, -hr * 0.85, hr * 0.95, hr * 0.55, hr * 0.35);
      cyl(p, '#eab308', 0, ty + hr * 0.75, -hr * 0.05, hr * 0.07, hr * 0.32, 8);
      ellip(p, badge ?? '#dc2626', 0, ty + hr * 1.08, -hr * 0.12, hr * 0.26, hr * 0.38, hr * 0.26);
      break;
    case 'doumou': // Ming/Qing 避雷针式兜鍪: iron/gilt bowl with brow peak, studded brigandine neck curtain (顿项), tall gold spear-finial with red yak-hair plume
      ellip(p, c, 0, ty - hr * 0.15, -hr * 0.05, hr * 1.12, hr * 0.85, hr * 1.12);
      cyl(p, '#eab308', 0, ty - hr * 0.48, 0, hr * 1.2, hr * 0.08, 18);
      ellip(p, tone(c, -0.1), 0, hy - hr * 0.12, -hr * 0.6, hr * 1.12, hr * 0.72, hr * 0.62);
      cyl(p, '#eab308', 0, ty + hr * 1.0, -hr * 0.05, hr * 0.045, hr * 0.85, 8);
      ellip(p, badge ?? '#dc2626', 0, ty + hr * 0.88, -hr * 0.05, hr * 0.28, hr * 0.24, hr * 0.28);
      break;
    case 'peaked': // military peaked cap with a cap badge
      cyl(p, c, 0, ty + hr * 0.05, -hr * 0.02, hr * 1.12, hr * 0.42, 18);
      cyl(p, tone(c, -0.25), 0, ty - hr * 0.18, 0, hr * 1.06, hr * 0.14, 18);
      box(p, '#1c1917', 0, ty - hr * 0.26, hr * 1.05, hr * 1.1, hr * 0.05, hr * 0.6, 0, 0.25, 0);
      if (badge) ellip(p, badge, 0, ty - hr * 0.05, hr * 1.13, hr * 0.13, hr * 0.13, hr * 0.04);
      break;
    case 'scholar': // small square cap with a hairpin (ancient Chinese scholar)
      box(p, c, 0, ty + hr * 0.25, -hr * 0.05, hr * 0.7, hr * 0.5, hr * 0.8);
      box(p, '#d6b25e', 0, ty + hr * 0.25, -hr * 0.05, hr * 1.5, hr * 0.06, hr * 0.06);
      break;
    case 'futou': // Tang/Song soft hat with two side wings
      ellip(p, c, 0, ty + hr * 0.15, -hr * 0.12, hr * 0.9, hr * 0.6, hr * 0.9);
      ellip(p, c, 0, ty + hr * 0.5, -hr * 0.3, hr * 0.5, hr * 0.45, hr * 0.5);
      for (const sx of [-1, 1]) box(p, c, sx * hr * 1.6, ty + hr * 0.05, -hr * 0.4, hr * 1.4, hr * 0.12, hr * 0.03);
      break;
    case 'tophat':
      cyl(p, c, 0, ty - hr * 0.05, 0, hr * 1.35, hr * 0.06, 20);
      cyl(p, c, 0, ty + hr * 0.6, 0, hr * 0.82, hr * 1.3, 20);
      cyl(p, '#7f1d1d', 0, ty + hr * 0.12, 0, hr * 0.84, hr * 0.18, 20);
      break;
    case 'beret':
      ellip(p, c, hr * 0.15, ty + hr * 0.05, 0, hr * 1.12, hr * 0.32, hr * 1.05, 0, 0, -0.15);
      break;
    case 'cap':
      ellip(p, c, 0, ty - hr * 0.05, -hr * 0.05, hr * 1.04, hr * 0.6, hr * 1.04);
      box(p, tone(c, -0.15), 0, ty - hr * 0.25, hr * 0.95, hr * 1.1, hr * 0.06, hr * 0.6);
      break;
    case 'crown':
      cyl(p, '#e0b23c', 0, ty + hr * 0.1, 0, hr * 0.9, hr * 0.4, 16);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ellip(p, i % 2 ? '#dc2626' : '#e0b23c', Math.cos(a) * hr * 0.9, ty + hr * 0.42, Math.sin(a) * hr * 0.9, hr * 0.12);
      }
      break;
    case 'turban':
      ellip(p, c, 0, ty - hr * 0.05, -hr * 0.05, hr * 1.12, hr * 0.62, hr * 1.1);
      ellip(p, tone(c, 0.1), 0, ty + hr * 0.25, -hr * 0.1, hr * 0.85, hr * 0.42, hr * 0.85);
      ellip(p, '#e0b23c', 0, ty + hr * 0.05, hr * 1.0, hr * 0.14);
      break;
    case 'helmet':
      ellip(p, c, 0, ty - hr * 0.15, -hr * 0.05, hr * 1.12, hr * 0.85, hr * 1.12);
      cyl(p, tone(c, -0.15), 0, ty - hr * 0.55, 0, hr * 1.2, hr * 0.08, 20);
      break;
    case 'bicorne':
      ellip(p, c, 0, ty + hr * 0.2, -hr * 0.05, hr * 1.7, hr * 0.62, hr * 0.42);
      ellip(p, '#dc2626', hr * 0.4, ty + hr * 0.45, hr * 0.25, hr * 0.16);
      break;
    case 'wreath':
      for (let i = 0; i < 14; i++) {
        const a = Math.PI * 0.15 + (i / 13) * Math.PI * 0.7 + Math.PI;
        ellip(p, i % 2 ? '#65a30d' : '#4d7c0f', Math.cos(a) * hr * 1.0, ty - hr * 0.25, Math.sin(-a) * hr * -1.0, hr * 0.2, hr * 0.1, hr * 0.12, a);
      }
      break;
    case 'douli': { // 斗笠: wide conical woven-bamboo rain hat with bamboo rim rings
      lathe(p, [[0, hr * 0.95], [hr * 0.35, hr * 0.85], [hr * 1.15, hr * 0.38], [hr * 2.05, -hr * 0.08], [hr * 2.1, -hr * 0.12], [0, hr * 0.88]], c, 0, ty - hr * 0.12, 0, 20);
      cyl(p, tone(c, -0.22), 0, ty + hr * 0.22, 0, hr * 1.18, hr * 0.04, 18);
      break;
    }
    case 'guanjin': { // 纶巾 (诸葛巾): tall pleated silk crown with white jade forehead ornament
      cyl(p, c, 0, ty - hr * 0.05, -hr * 0.04, hr * 0.96, hr * 0.26, 18);
      lathe(p, [[0, 0], [hr * 0.86, 0], [hr * 0.94, hr * 0.65], [hr * 0.78, hr * 1.28], [0, hr * 1.32]], c, 0, ty + hr * 0.12, -hr * 0.06, 16);
      for (const i of [-1, 0, 1]) box(p, tone(c, 0.18), i * hr * 0.24, ty + hr * 0.72, hr * 0.74, hr * 0.04, hr * 0.95, hr * 0.05, 0, -0.08, 0);
      ellip(p, badge ?? '#e2ece0', 0, ty + hr * 0.14, hr * 0.92, hr * 0.14, hr * 0.18, hr * 0.06);
      break;
    }
    case 'dongpo': { // 东坡巾: tall square double-walled Song literati hat with notched front fold
      const m1 = lathe(p, [[0, 0], [hr * 1.04, 0], [hr * 1.08, hr * 0.55], [0, hr * 0.55]], tone(c, -0.08), 0, ty - hr * 0.1, -hr * 0.04, 4);
      m1.rotation.y = Math.PI / 4;
      const m2 = lathe(p, [[0, 0], [hr * 0.84, 0], [hr * 0.9, hr * 1.25], [0, hr * 1.25]], c, 0, ty + hr * 0.15, -hr * 0.06, 4);
      m2.rotation.y = Math.PI / 4;
      break;
    }
    case 'fujin': { // 幅巾 / 葛巾: soft folded cloth headscarf with headband and two cloth tails behind
      ellip(p, c, 0, ty + hr * 0.08, -hr * 0.06, hr * 1.06, hr * 0.55, hr * 1.06);
      ellip(p, tone(c, 0.08), 0, ty + hr * 0.46, -hr * 0.22, hr * 0.64, hr * 0.42, hr * 0.68);
      cyl(p, tone(c, -0.15), 0, ty - hr * 0.12, -hr * 0.04, hr * 1.02, hr * 0.12, 16);
      for (const sx of [-1, 1]) tube(p, [[sx * hr * 0.22, ty - hr * 0.1, -hr * 0.95], [sx * hr * 0.3, ty - hr * 0.75, -hr * 1.08]], hr * 0.08, hr * 0.05, c, { radial: 5, sub: 2 });
      break;
    }
    case 'pheasant': { // 束发金冠双雉尾 (吕布 / 项羽): ornate golden coronet with twin long curving pheasant plumes
      cyl(p, '#eab308', 0, ty + hr * 0.08, -hr * 0.04, hr * 0.92, hr * 0.34, 16);
      cyl(p, '#991b1b', 0, ty + hr * 0.36, -hr * 0.06, hr * 0.52, hr * 0.38, 12);
      ellip(p, '#dc2626', 0, ty + hr * 0.16, hr * 0.9, hr * 0.15, hr * 0.18, hr * 0.07);
      for (const sx of [-1, 1]) {
        tube(p, [
          [sx * hr * 0.2, ty + hr * 0.5, -hr * 0.1],
          [sx * hr * 0.85, ty + hr * 1.55, -hr * 0.55],
          [sx * hr * 1.45, ty + hr * 2.15, -hr * 1.35],
          [sx * hr * 1.75, ty + hr * 1.9, -hr * 2.05],
        ], hr * 0.085, hr * 0.025, badge ?? '#d97706', { radial: 6, sub: 4 });
      }
      break;
    }
    case 'straw': { // 草帽 (袁隆平): wide-brimmed woven golden straw sun hat with dark band
      cyl(p, c, 0, ty - hr * 0.06, 0, hr * 1.85, hr * 0.05, 22);
      lathe(p, [[0, 0], [hr * 0.98, 0], [hr * 0.88, hr * 0.68], [0, hr * 0.72]], c, 0, ty - hr * 0.04, 0, 18);
      cyl(p, '#292524', 0, ty + hr * 0.02, 0, hr * 0.99, hr * 0.1, 18);
      break;
    }
    case 'khitan': { // 契丹金冠 / 西夏白高冠: tall flaring steppe gold/felt crown with front plaque and ear flaps
      lathe(p, [[0, 0], [hr * 0.96, 0], [hr * 0.88, hr * 1.15], [hr * 0.65, hr * 1.45], [0, hr * 1.48]], c, 0, ty - hr * 0.08, -hr * 0.04, 16);
      cyl(p, '#eab308', 0, ty - hr * 0.12, -hr * 0.04, hr * 1.0, hr * 0.12, 16);
      box(p, '#eab308', 0, ty + hr * 0.55, hr * 0.82, hr * 0.55, hr * 0.85, hr * 0.06, 0, -0.1, 0);
      ellip(p, badge ?? '#dc2626', 0, ty + hr * 0.55, hr * 0.86, hr * 0.14, hr * 0.2, hr * 0.06);
      for (const sx of [-1, 1]) ellip(p, '#52341e', sx * hr * 0.98, hy - hr * 0.02, -hr * 0.1, hr * 0.18, hr * 0.55, hr * 0.45);
      break;
    }
    case 'taiping': { // 太平天国金龙黄冠: yellow silk wrap with golden dragon frontlet and red jewel
      ellip(p, '#eab308', 0, ty + hr * 0.05, -hr * 0.05, hr * 1.14, hr * 0.62, hr * 1.12);
      box(p, '#facc15', 0, ty + hr * 0.45, hr * 0.78, hr * 0.95, hr * 0.58, hr * 0.08, 0, -0.12, 0);
      ellip(p, '#dc2626', 0, ty + hr * 0.42, hr * 0.85, hr * 0.16, hr * 0.18, hr * 0.06);
      for (const sx of [-1, 1]) tube(p, [[sx * hr * 0.85, ty - hr * 0.1, -hr * 0.6], [sx * hr * 0.95, ty - hr * 0.95, -hr * 0.8]], hr * 0.09, hr * 0.06, '#eab308', { radial: 5, sub: 2 });
      break;
    }
    default:
  }
  void u;
}

/** Round collectible base: bevelled disc with carved stone/brass rim and radial paving joints. Returns the top height. */
export function figureBase(p: THREE.Object3D, top = '#d8cbb3', side = '#8b7355', R = 0.46): number {
  paintLathe(p, [[0, 0], [R, 0], [R + 0.012, 0.012], [R + 0.012, 0.05], [R, 0.062], [0, 0.062]], side, 40, 1, (x, y, z) => {
    const th = Math.atan2(z, x);
    if (y > 0.044 && y < 0.054) return '#c8a458';
    const fret = Math.sin(th * 24) * Math.sin(y * 160);
    return shade(side, 0.94 + fret * 0.08);
  });
  paintLathe(p, [[0, 0.06], [R - 0.012, 0.06], [R - 0.012, 0.07], [0, 0.07]], top, 40, 1, (x, _y, z) => {
    const r = Math.hypot(x, z), th = Math.atan2(z, x);
    if (Math.abs(r - (R - 0.045)) < 0.008) return shade(side, 0.92);
    const ring = Math.abs(Math.sin((r / R) * Math.PI * 3)) < 0.06;
    const spoke = r > 0.08 && Math.abs(Math.sin(th * 6)) < 0.04;
    if (ring || spoke) return shade(top, 0.86);
    return shade(top, 0.98 + Math.sin(x * 18 + z * 18) * 0.04);
  });
  return 0.07;
}
