# Point Ball 3D — demo FPS em Godot 4.7 (mesmas regras da demo Three.js).
# Tudo é criado por código: mapa, luz, câmera, bonecos KayKit animados, bots, armas de borracha,
# granada, fumaça, lápide, mira editável, menu (Esc) e placar (Tab).
# Medidas: 1 metro = 40 unidades do jogo 2D (o mapa de 1600 x 1000 vira 40 x 25 m).
extends Node3D

const MapsData = preload("res://maps_data.gd")
const MODEL := { "A": preload("res://models/Rogue_Hooded.glb"), "B": preload("res://models/Rogue.glb") }

const U := 40.0
const W := 1600.0 / U
const H := 1000.0 / U
const T := 24.0 / U
const WALL_H := 3.0
const BORDER_H := 3.75
const R0 := 25.0 / U          # raio do boneco
const CHAR_H := 1.6
const EYE := 1.4
const CHEST := 1.0
const SPEED := 260.0 / U
const AIR_CONTROL := 0.35
const GRAVITY := 1400.0 / U
const JUMP_V := 330.0 / U
const DJUMP_V := 540.0 / U
const DJUMP_CD := 15.0
const LIVES := 2
const SHRINK := 0.65
const INVULN := 0.4
const RESPAWN := 2.0
const PROTECT := 1.0
const TOMB_TIME := 8.0
const KNIFE_RANGE := 50.0 / U
const KNIFE_CD := 0.4
const NADE_R := 7.0 / U
const NADE_SPEED := 620.0 / U
const NADE_UP := 160.0 / U
const NADE_FUSE := 1.8
const NADE_RADIUS := 105.0 / U
const SMOKE_FUSE := 1.3
const SMOKE_R := 200.0 / U
const SMOKE_T := 6.0

# armas de borracha (todas ricocheteiam no muro e no chão)
const WEAPONS := {
	"lancador": {"name": "Lançador de borracha", "speed": 22.5, "grav": 0.0, "r": 0.125, "bounces": 3, "cd": 0.9, "mag": 20, "mags": 4, "reload": 1.5, "rest": 1.0, "hand": "1H_Crossbow", "aim": "aim1", "shoot": "shoot1", "reload_anim": "reload1", "desc": "Rápido e reto, sem cair. 3 ricochetes. Um tiro por segundo."},
	"estilingue": {"name": "Estilingue", "speed": 19.5, "grav": 13.0, "r": 0.15, "bounces": 4, "cd": 0.65, "mag": 12, "mags": 5, "reload": 1.2, "rest": 0.9, "hand": "1H_Crossbow", "aim": "aim1", "shoot": "shoot1", "reload_anim": "reload1", "desc": "Bolinha que cai um pouco com a distância. 4 ricochetes. Atira mais rápido."},
	"mao": {"name": "Bolinha na mão", "speed": 14.0, "grav": 22.5, "r": 0.2, "bounces": 5, "cd": 0.45, "mag": 6, "mags": 8, "reload": 0.9, "rest": 0.85, "hand": "Throwable", "aim": "", "shoot": "throw", "reload_anim": "pickup", "desc": "Você joga a bolinha: faz curva para baixo, quica muito (5 ricochetes) e dá para jogar rápido."},
	"arco": {"name": "Arco (flecha de borracha)", "speed": 37.5, "min_speed": 16.25, "grav": 9.5, "r": 0.125, "bounces": 2, "cd": 0.25, "mag": 10, "mags": 4, "reload": 1.6, "rest": 0.8, "hand": "2H_Crossbow", "aim": "aim2", "shoot": "shoot2", "reload_anim": "reload2", "charge": 0.8, "desc": "Segure o clique para puxar e solte. Quanto mais puxa, mais rápida e reta a flecha. 2 ricochetes."},
	"disco": {"name": "Disco de borracha", "speed": 15.5, "grav": 0.0, "r": 0.275, "bounces": 7, "cd": 1.1, "mag": 8, "mags": 4, "reload": 1.8, "rest": 1.0, "hand": "Throwable", "aim": "", "shoot": "throw", "reload_anim": "pickup", "desc": "Disco que voa reto e quica até 7 vezes nas paredes. Ótimo para acertar pela tabela."}
}
const WEAPON_IDS := ["lancador", "estilingue", "mao", "arco", "disco"]
const BOT_LEVELS := {
	"iniciante": {"err": 0.12, "react": 0.6, "fire": 0.4, "idle": 0.3, "nade": 0.01, "jump": 0.05},
	"amador": {"err": 0.05, "react": 0.25, "fire": 0.75, "idle": 0.1, "nade": 0.04, "jump": 0.12},
	"pro": {"err": 0.016, "react": 0.08, "fire": 1.0, "idle": 0.0, "nade": 0.08, "jump": 0.2}
}
const TEAM_COLOR := { "A": Color("#3b82f6"), "B": Color("#ef4444") }
const TEAM_LIGHT := { "A": Color("#93c5fd"), "B": Color("#fca5a5") }
const MAP_IDS := ["deserto", "neve", "floresta", "nave", "portal", "vulcao", "escuro", "cidade"]
const MAP_NAMES := ["Deserto", "Neve", "Floresta", "Nave espacial", "Portais", "Vulcão", "Sala escura", "Cidade à noite"]
const BOT_NAMES := ["Tonhão", "Pipoca", "Faísca", "Marreta", "Coxinha", "Paçoca", "Jacaré", "Canela", "Pitomba", "Quindim"]
const UPPER := ["spine", "chest", "head", "upperarm.l", "upperarm.r", "lowerarm.l", "lowerarm.r", "wrist.l", "wrist.r", "hand.l", "hand.r", "handslot.l", "handslot.r", "elbowIK.l", "elbowIK.r", "handIK.l", "handIK.r"]
const LOCO := ["Idle", "Running_A", "Walking_Backwards", "Running_Strafe_Left", "Running_Strafe_Right", "Jump_Start", "Jump_Idle", "Jump_Land", "Jump_Full_Short"]
const ARMS := { "aim1": "1H_Ranged_Aiming", "aim2": "2H_Ranged_Aiming", "reload1": "1H_Ranged_Reload", "reload2": "2H_Ranged_Reload", "pickup": "PickUp" }
const ACTS := { "shoot1": "1H_Ranged_Shoot", "shoot2": "2H_Ranged_Shoot", "throw": "Throw", "stab": "1H_Melee_Attack_Stab", "hit": "Hit_A" }
const LOOPS := ["Idle", "Running_A", "Walking_Backwards", "Running_Strafe_Left", "Running_Strafe_Right", "Jump_Idle", "1H_Ranged_Aiming", "2H_Ranged_Aiming", "1H_Ranged_Reload", "2H_Ranged_Reload", "PickUp"]

const DEFAULTS := {
	"cam": 1, "map": 0, "bots": 2, "level": "amador", "shadow": true, "fov": 80.0, "weapon": "lancador", "sens": 1.6, "invert": false,
	"x": {"color": "#ffffff", "outline": true, "len": 7.0, "thick": 2.0, "gap": 4.0, "dot": true, "dotsize": 2.0, "ring": true, "ringr": 22.0, "ringw": 2.0, "hit": true, "hitlen": 10.0, "hitw": 1.0}
}
var S: Dictionary = {}

var map_root: Node3D
var fighters: Array = []
var bullets: Array = []
var nades: Array = []
var smokes: Array = []
var tombs: Array = []
var me: Fighter
var camera: Camera3D
var sun: DirectionalLight3D
var world_env: Environment
var player_torch: OmniLight3D
var cur_map_id := "deserto"
var hazard_light_on := true
var hazard_next := 0.0
var lava_pools: Array = []
var lava_meshes: Array = []
var lava_active := false
var view_models := {}
var time := 0.0
var kick := 0.0
var swing := 0.0
var model_scale := {}
var menu_open := true
var menu: Control
var cross: Crosshair
var preview: Crosshair
var hud_main: Label
var hud_top: Label
var slots_box: HBoxContainer
var feed_box: VBoxContainer
var dead_label: Label
var board: PanelContainer
var board_grid: GridContainer
var board_t := 0.0
var loading_label: Label
var hit_kind := ""
var hit_t := -10.0
var wheel_t := 0.0
var smoke_tex: Texture2D


# ---------------- personagem ----------------
class Fighter extends CharacterBody3D:
	var team := "A"
	var nick := ""
	var is_bot := false
	var level := "amador"
	var primary := "lancador"
	var yaw := 0.0
	var pitch := 0.0
	var lives := LIVES
	var alive := true
	var weapon := "primary"
	var last_weapon := "primary"
	var ammo := {}
	var mags := {}
	var reload_until := 0.0
	var fire_ready := 0.0
	var charge0 := 0.0
	var nades := 1
	var smokes := 1
	var invuln_until := 0.0
	var protect_until := 0.0
	var respawn_at := 0.0
	var dj_ready_at := 0.0
	var dj_used := false
	var was_floor := true
	var k := 0
	var d := 0
	var a := 0
	var last_hit_by := {}
	var dead_at := 0.0
	var in_fwd := 0.0
	var in_side := 0.0
	var in_fire := false
	var cam_pos = null
	# visual
	var model: Node3D
	var tree: AnimationTree
	var ap: AnimationPlayer
	var items := {}
	var ring: MeshInstance3D
	var label: Label3D
	var scale0 := 1.0
	var act_until := 0.0
	var lower_once_until := 0.0
	var loco_now := ""
	var arms_now := ""
	var lava_tick := 0.0
	# bot
	var ai := {}

	func radius() -> float:
		return R0 * (1.0 if lives >= LIVES else SHRINK)

	func aim_dir() -> Vector3:
		return Vector3(cos(yaw) * cos(pitch), sin(pitch), sin(yaw) * cos(pitch))


class Bullet extends MeshInstance3D:
	var vel := Vector3.ZERO
	var team := "A"
	var shooter: Fighter
	var r := 0.125
	var grav := 0.0
	var rest := 1.0
	var bounces := 0
	var max_b := 3
	var born := 0.0
	var kind := "lancador"


class Nade extends RigidBody3D:
	var smoke := false
	var team := "A"
	var shooter: Fighter
	var t0 := 0.0
	var led: MeshInstance3D


class Smoke extends Node3D:
	var t0 := 0.0
	var until := 0.0
	var parts: Array = []


class Tomb extends Node3D:
	var t0 := 0.0
	var until := 0.0
	var base_y := 0.0


# ---------------- mira ----------------
class Crosshair extends Control:
	var cfg: Dictionary = {}
	var prog := 1.0
	var hit_kind := ""
	var hit_a := 0.0

	func _line(a: Vector2, b: Vector2, col: Color, w: float) -> void:
		if cfg.get("outline", true):
			draw_line(a, b, Color(0, 0, 0, 0.8), w + 2.0, true)
		draw_line(a, b, col, w, true)

	func _draw() -> void:
		if cfg.is_empty():
			return
		var c := size / 2.0
		var col := Color(str(cfg["color"]))
		if cfg["ring"]:
			var rr: float = cfg["ringr"]
			var rw: float = cfg["ringw"]
			draw_arc(c, rr, 0, TAU, 48, Color(0, 0, 0, 0.35), rw, true)
			var pc := Color(col, 0.55) if prog >= 1.0 else Color(1, 0.8, 0.2, 0.9)
			draw_arc(c, rr, -PI / 2, -PI / 2 + TAU * maxf(0.001, prog), 48, pc, rw, true)
		var L: float = cfg["len"]
		var g: float = cfg["gap"]
		var t: float = cfg["thick"]
		if L > 0:
			for d in [Vector2(0, -1), Vector2(0, 1), Vector2(-1, 0), Vector2(1, 0)]:
				_line(c + d * g, c + d * (g + L), col, t)
		if cfg["dot"]:
			var ds: float = cfg["dotsize"]
			if cfg["outline"]:
				draw_circle(c, ds + 1.0, Color(0, 0, 0, 0.8))
			draw_circle(c, ds, col)
		if hit_a > 0 and cfg["hit"]:
			var hc := Color("#ef4444") if hit_kind == "kill" else Color("#facc15")
			hc.a = hit_a
			var s0: float = g + 6.0
			var e0: float = s0 + float(cfg["hitlen"])
			for d in [Vector2(1, 1), Vector2(1, -1), Vector2(-1, 1), Vector2(-1, -1)]:
				_line(c + d * s0 * 0.7, c + d * e0 * 0.7, hc, float(cfg["hitw"]))


# ---------------- início ----------------
func _ready() -> void:
	_load_settings()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#9cc7ee")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.8, 0.85, 0.95)
	env.ambient_light_energy = 0.45
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.ssao_enabled = true
	env.fog_enabled = true
	env.fog_light_color = Color("#9cc7ee")
	env.fog_density = 0.004
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sun = DirectionalLight3D.new()
	sun.light_energy = 1.2
	sun.shadow_enabled = S["shadow"]
	sun.directional_shadow_max_distance = 60.0
	sun.rotation_degrees = Vector3(-50, -35, 0)
	add_child(sun)
	world_env = env
	camera = Camera3D.new()
	camera.near = 0.05
	camera.fov = S["fov"]
	add_child(camera)
	player_torch = OmniLight3D.new()
	player_torch.light_energy = 2.2
	player_torch.omni_range = 13.0
	player_torch.light_color = Color("#fff3d6")
	player_torch.visible = false
	camera.add_child(player_torch)
	smoke_tex = _make_smoke_texture()
	_build_view_models()
	_build_ui()
	_new_game()
	_show_menu(true)


func _load_settings() -> void:
	S = DEFAULTS.duplicate(true)
	var cf := ConfigFile.new()
	if cf.load("user://pb3d.cfg") == OK:
		var saved = cf.get_value("s", "data", {})
		if saved is Dictionary:
			for k in saved:
				if k == "x" and saved[k] is Dictionary:
					for kk in saved[k]:
						S["x"][kk] = saved[k][kk]
				elif S.has(k):
					S[k] = saved[k]


func _save_settings() -> void:
	var cf := ConfigFile.new()
	cf.set_value("s", "data", S)
	cf.save("user://pb3d.cfg")


func _mat(color: Color, rough := 0.85, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	return m


func _flat(mesh: Mesh) -> Mesh:
	var st := SurfaceTool.new()
	st.create_from(mesh, 0)
	st.deindex()
	st.generate_normals()
	return st.commit()


func _mesh(mesh: Mesh, m: Material, pos := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = m
	mi.position = pos
	return mi


# ---------------- mapa ----------------
func _new_game() -> void:
	for arr in [fighters, bullets, nades, smokes, tombs]:
		for n in arr:
			n.queue_free()
		arr.clear()
	if map_root:
		map_root.queue_free()
	map_root = Node3D.new()
	add_child(map_root)
	cur_map_id = MAP_IDS[int(S["map"])]
	hazard_light_on = true
	hazard_next = time + 6.0
	sun.light_energy = 1.2
	if world_env:
		world_env.ambient_light_energy = 0.45
	player_torch.visible = cur_map_id == "escuro"
	lava_active = false
	lava_meshes.clear()
	if cur_map_id == "vulcao":
		lava_pools = [
			{"x": 0.20 * W, "z": 0.30 * H, "r": 1.8}, {"x": 0.20 * W, "z": 0.70 * H, "r": 1.8},
			{"x": 0.80 * W, "z": 0.30 * H, "r": 1.8}, {"x": 0.80 * W, "z": 0.70 * H, "r": 1.8}
		]
	else:
		lava_pools = []
	var data: Dictionary = MapsData.MAPS[cur_map_id]
	var th: Dictionary = data["theme"]
	# chão (também é colisão)
	var floor_body := StaticBody3D.new()
	floor_body.collision_layer = 1
	var fs := CollisionShape3D.new()
	var fb := BoxShape3D.new()
	fb.size = Vector3(W, 1, H)
	fs.shape = fb
	fs.position = Vector3(W / 2, -0.5, H / 2)
	floor_body.add_child(fs)
	var pm := PlaneMesh.new()
	pm.size = Vector2(W, H)
	floor_body.add_child(_mesh(pm, _mat(Color(th["ground"]), 0.95), Vector3(W / 2, 0, H / 2)))
	map_root.add_child(floor_body)
	var border := Color(th["border"])
	_wall(Rect2(0, 0, W, T), border, BORDER_H)
	_wall(Rect2(0, H - T, W, T), border, BORDER_H)
	_wall(Rect2(0, 0, T, H), border, BORDER_H)
	_wall(Rect2(W - T, 0, T, H), border, BORDER_H)
	for s in data["walls"]:
		var x1: float = s[0] * W
		var y1: float = s[1] * H
		var x2: float = s[2] * W
		var y2: float = s[3] * H
		_wall(Rect2(minf(x1, x2) - T / 2, minf(y1, y2) - T / 2, absf(x2 - x1) + T, absf(y2 - y1) + T), Color(th["wall"]), WALL_H)
	for pool in lava_pools:
		var lm := CylinderMesh.new()
		lm.top_radius = pool["r"]; lm.bottom_radius = pool["r"]; lm.height = 0.05
		var lmat := _mat(Color("#4b1a10"), 0.6, 0.0)
		var lava_mi := _mesh(lm, lmat, Vector3(pool["x"], 0.04, pool["z"]))
		map_root.add_child(lava_mi)
		lava_meshes.append(lava_mi)
	var rng := RandomNumberGenerator.new()
	rng.seed = int(S["map"]) * 97 + 5
	for n in 34:
		var sm := SphereMesh.new()
		sm.radial_segments = 5
		sm.rings = 3
		var k := rng.randf_range(0.15, 0.4)
		sm.radius = k
		sm.height = k * 1.2
		var deco := Color(th["wallEdge"]).lightened(0.25)
		if th["deco"] == "snow":
			deco = Color.WHITE
		elif th["deco"] == "tree":
			deco = Color("#3f7d3a")
		elif th["deco"] == "panels":
			deco = Color("#9fb3d6")
		elif th["deco"] == "tiles":
			deco = Color(th["wall"]).lightened(0.35)
		elif th["deco"] == "ash":
			deco = Color("#6b5a52")
		elif th["deco"] == "city":
			deco = Color("#f2cf6e")
		var rock := _mesh(_flat(sm), _mat(deco), Vector3(rng.randf_range(1.5, W - 1.5), 0, rng.randf_range(1.5, H - 1.5)))
		rock.rotation = Vector3(rng.randf() * 3, rng.randf() * 3, 0)
		map_root.add_child(rock)
	me = _spawn_fighter("A", "Você", false)
	me.primary = S["weapon"]
	var names := BOT_NAMES.duplicate()
	names.shuffle()
	for b in int(S["bots"]):
		_spawn_fighter("B", names[b % names.size()], true)


func _wall(r: Rect2, color: Color, h: float) -> void:
	var body := StaticBody3D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(r.size.x, h, r.size.y)
	shape.shape = box
	body.add_child(shape)
	var bm := BoxMesh.new()
	bm.size = box.size
	body.add_child(_mesh(bm, _mat(color)))
	body.position = Vector3(r.position.x + r.size.x / 2, h / 2, r.position.y + r.size.y / 2)
	map_root.add_child(body)


# ---------------- bonecos ----------------
func _spawn_fighter(team: String, nick: String, bot: bool) -> Fighter:
	var f := Fighter.new()
	f.team = team
	f.nick = nick
	f.is_bot = bot
	f.level = S["level"]
	f.collision_layer = 2
	f.collision_mask = 1 # só bate no cenário (um passa pelo outro, como no 2D)
	f.floor_snap_length = 0.1
	var shape := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = R0
	cap.height = CHAR_H
	shape.shape = cap
	shape.position.y = CHAR_H / 2
	f.add_child(shape)
	f.model = MODEL[team].instantiate()
	f.add_child(f.model)
	f.scale0 = _model_scale(team, f.model)
	f.model.scale = Vector3.ONE * f.scale0
	var tint: Color = TEAM_COLOR[team]
	for mi in f.model.find_children("*", "MeshInstance3D", true, false):
		var m: Material = mi.get_active_material(0)
		if m is BaseMaterial3D:
			var mm: BaseMaterial3D = m.duplicate()
			mm.albedo_color = Color.WHITE.lerp(tint, 0.6)
			mi.material_override = mm
	for item in ["1H_Crossbow", "2H_Crossbow", "Knife", "Throwable", "Knife_Offhand"]:
		var n: Node3D = f.model.find_child(item, true, false)
		if n:
			f.items[item] = n
			n.visible = false
	_setup_anim(f)
	f.ring = MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = R0 * 0.85
	tm.outer_radius = R0
	f.ring.mesh = tm
	var rm := _mat(TEAM_COLOR[team])
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	f.ring.material_override = rm
	f.ring.scale = Vector3(1, 0.05, 1)
	f.ring.position.y = 0.02
	f.add_child(f.ring)
	if bot:
		f.label = _label3d(nick, TEAM_LIGHT[team])
		f.label.position.y = CHAR_H + 0.45
		f.add_child(f.label)
	map_root.add_child(f)
	fighters.append(f)
	_respawn(f)
	return f


func _label3d(text: String, col: Color) -> Label3D:
	var l := Label3D.new()
	l.text = text
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.fixed_size = true
	l.pixel_size = 0.0012
	l.font_size = 32
	l.outline_size = 8
	l.modulate = col
	return l


func _model_scale(team: String, model: Node3D) -> float:
	if model_scale.has(team):
		return model_scale[team]
	var top := 0.0
	var bottom := 1e9
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var bb: AABB = mi.get_aabb()
		top = maxf(top, bb.end.y)
		bottom = minf(bottom, bb.position.y)
	var hh := top - bottom
	var sc := CHAR_H / hh if hh > 0.1 else 1.0
	model_scale[team] = sc
	return sc


# árvore de animação: pernas + braços por cima (filtro nos ossos de cima) + ações rápidas (OneShot)
func _setup_anim(f: Fighter) -> void:
	f.ap = f.model.find_child("AnimationPlayer", true, false)
	for n in LOOPS:
		f.ap.get_animation(n).loop_mode = Animation.LOOP_LINEAR
	var bt := AnimationNodeBlendTree.new()
	var loco := AnimationNodeTransition.new()
	loco.xfade_time = 0.15
	bt.add_node("loco", loco)
	for i in LOCO.size():
		loco.add_input(LOCO[i])
		var an := AnimationNodeAnimation.new()
		an.animation = LOCO[i]
		bt.add_node("L_" + LOCO[i], an)
		bt.connect_node("loco", i, "L_" + LOCO[i])
	var loco_speed := AnimationNodeTimeScale.new()
	bt.add_node("loco_speed", loco_speed)
	bt.connect_node("loco_speed", 0, "loco")
	var arms := AnimationNodeTransition.new()
	arms.xfade_time = 0.15
	bt.add_node("arms", arms)
	var k := 0
	for key in ARMS:
		arms.add_input(key)
		var an2 := AnimationNodeAnimation.new()
		an2.animation = ARMS[key]
		bt.add_node("A_" + key, an2)
		bt.connect_node("arms", k, "A_" + key)
		k += 1
	var arms_speed := AnimationNodeTimeScale.new()
	bt.add_node("arms_speed", arms_speed)
	bt.connect_node("arms_speed", 0, "arms")
	var act := AnimationNodeTransition.new()
	act.xfade_time = 0.0
	bt.add_node("act", act)
	k = 0
	for key in ACTS:
		act.add_input(key)
		var an3 := AnimationNodeAnimation.new()
		an3.animation = ACTS[key]
		bt.add_node("X_" + key, an3)
		bt.connect_node("act", k, "X_" + key)
		k += 1
	var ts := AnimationNodeTimeScale.new()
	bt.add_node("act_speed", ts)
	bt.connect_node("act_speed", 0, "act")
	var os := AnimationNodeOneShot.new()
	os.fadein_time = 0.05
	os.fadeout_time = 0.12
	bt.add_node("os", os)
	bt.connect_node("os", 0, "arms_speed")
	bt.connect_node("os", 1, "act_speed")
	var mix := AnimationNodeBlend2.new()
	mix.filter_enabled = true
	var seen := {}
	for anim_name in LOCO + ARMS.values() + ACTS.values():
		var an4: Animation = f.ap.get_animation(anim_name)
		for t in an4.get_track_count():
			var path: NodePath = an4.track_get_path(t)
			var s := str(path)
			if seen.has(s):
				continue
			seen[s] = true
			if s.get_slice(":", 1) in UPPER:
				mix.set_filter_path(path, true)
	bt.add_node("mix", mix)
	bt.connect_node("mix", 0, "loco_speed")
	bt.connect_node("mix", 1, "os")
	bt.connect_node("output", 0, "mix")
	f.tree = AnimationTree.new()
	f.model.add_child(f.tree)
	f.tree.anim_player = f.tree.get_path_to(f.ap)
	f.tree.tree_root = bt
	f.tree.active = true
	f.tree.set("parameters/mix/blend_amount", 1.0)


func _set_loco(f: Fighter, name: String, speed := 1.0) -> void:
	f.tree.set("parameters/loco_speed/scale", speed)
	if f.loco_now != name:
		f.loco_now = name
		f.tree.set("parameters/loco/transition_request", name)


func _set_arms(f: Fighter, key: String, speed := 1.0) -> void:
	f.tree.set("parameters/arms_speed/scale", speed)
	if f.arms_now != key:
		f.arms_now = key
		f.tree.set("parameters/arms/transition_request", key)


func _action(f: Fighter, key: String, speed := 1.6) -> void:
	if not f.alive:
		return
	f.tree.set("parameters/act/transition_request", key)
	f.tree.set("parameters/act_speed/scale", speed)
	f.tree.set("parameters/os/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	f.act_until = time + f.ap.get_animation(ACTS[key]).length / speed


func _legs_once(f: Fighter, name: String, speed := 1.6) -> void:
	_set_loco(f, name, speed)
	f.lower_once_until = time + f.ap.get_animation(name).length / speed


func _animate(f: Fighter) -> void:
	var wkey := f.primary if f.weapon == "primary" else f.weapon
	var hand := "Knife"
	if f.weapon == "primary":
		hand = WEAPONS[f.primary]["hand"]
	elif f.weapon == "nade" or f.weapon == "smoke":
		hand = "Throwable"
	for n in f.items:
		f.items[n].visible = n == hand
	# pernas
	var v := Vector3(f.velocity.x, 0, f.velocity.z)
	var sp := v.length()
	if time >= f.lower_once_until:
		if not f.is_on_floor():
			_set_loco(f, "Jump_Start" if f.velocity.y > 3.0 else "Jump_Idle")
		elif sp > 0.6:
			var fwd_v := Vector3(cos(f.yaw), 0, sin(f.yaw))
			var fwd := v.dot(fwd_v) / sp
			var side := v.dot(Vector3(-fwd_v.z, 0, fwd_v.x)) / sp
			var kk := sp / SPEED
			if fwd > 0.5:
				_set_loco(f, "Running_A", 1.1 * kk)
			elif fwd < -0.5:
				_set_loco(f, "Walking_Backwards", 1.5 * kk)
			else:
				_set_loco(f, "Running_Strafe_Right" if side > 0 else "Running_Strafe_Left", 1.1 * kk)
		else:
			_set_loco(f, "Idle")
	# braços: mira/recarga por cima das pernas; sem arma de mirar os braços acompanham o corpo
	var w: Dictionary = WEAPONS[f.primary]
	var upper := false
	if f.weapon == "primary" and f.reload_until > 0:
		var ra: String = w["reload_anim"]
		_set_arms(f, ra, f.ap.get_animation(ARMS[ra]).length / float(w["reload"]))
		upper = true
	elif f.weapon == "primary" and w["aim"] != "":
		_set_arms(f, w["aim"])
		upper = true
	f.tree.set("parameters/mix/blend_amount", 1.0 if upper or time < f.act_until else 0.0)
	f.model.rotation.y = atan2(cos(f.yaw), sin(f.yaw))
	var _unused := wkey


func _respawn(f: Fighter) -> void:
	var space := get_world_3d().direct_space_state
	for i in 60:
		var x := randf_range(1.5, 5.5) if f.team == "A" else randf_range(W - 5.5, W - 1.5)
		var z := randf_range(2.0, H - 2.0)
		var q := PhysicsShapeQueryParameters3D.new()
		var sph := SphereShape3D.new()
		sph.radius = R0 + 0.15
		q.shape = sph
		q.transform = Transform3D(Basis(), Vector3(x, 0.8, z))
		q.collision_mask = 1
		if space.intersect_shape(q, 1).is_empty():
			f.position = Vector3(x, 0.02, z)
			break
	f.velocity = Vector3.ZERO
	f.reset_physics_interpolation()
	f.lives = LIVES
	f.alive = true
	f.visible = true
	f.collision_layer = 2
	f.weapon = "primary"
	for wid in WEAPON_IDS:
		f.ammo[wid] = WEAPONS[wid]["mag"]
		f.mags[wid] = WEAPONS[wid]["mags"]
	f.nades = 1
	f.smokes = 1
	f.reload_until = 0.0
	f.charge0 = 0.0
	f.protect_until = time + PROTECT
	f.invuln_until = 0.0
	f.last_hit_by = {}
	f.model.scale = Vector3.ONE * f.scale0
	f.yaw = 0.0 if f.team == "A" else PI
	f.pitch = 0.0
	f.loco_now = ""
	f.arms_now = ""


func _damage(v: Fighter, by: Fighter, weapon: String) -> void:
	if not v.alive or time < v.invuln_until or time < v.protect_until:
		return
	v.lives -= 1
	v.invuln_until = time + INVULN
	if by:
		v.last_hit_by[by] = time
	if v.lives <= 0:
		v.alive = false
		v.d += 1
		v.respawn_at = time + RESPAWN
		v.dead_at = time
		v.reload_until = 0.0
		v.charge0 = 0.0
		v.visible = false
		v.collision_layer = 0
		if by:
			by.k += 1
		for h in v.last_hit_by:
			if h != by and time - float(v.last_hit_by[h]) < 10.0:
				h.a += 1
		_make_tomb(v)
		if by == me:
			hit_kind = "kill"
			hit_t = time
		var icon: String = {"knife": "faca", "nade": "granada", "lava": "lava"}.get(weapon, WEAPONS.get(weapon, {}).get("name", "tiro"))
		_feed("[color=%s]%s[/color]  [%s]  [color=%s]%s[/color]" % [TEAM_LIGHT[by.team].to_html(false) if by else "#ffffff", by.nick if by else "?", icon, TEAM_LIGHT[v.team].to_html(false), v.nick])
	else:
		v.model.scale = Vector3.ONE * v.scale0 * SHRINK
		_action(v, "hit", 1.5)
		if by == me:
			hit_kind = "hit"
			hit_t = time


# ---------------- lápide ----------------
func _make_tomb(v: Fighter) -> void:
	var t := Tomb.new()
	t.t0 = time
	t.until = time + TOMB_TIME
	var stone := _mat(Color("#8b939e"))
	var dark := _mat(Color("#5b6370"))
	var b1 := BoxMesh.new()
	b1.size = Vector3(0.85, 0.15, 0.45)
	t.add_child(_mesh(b1, dark, Vector3(0, 0.075, 0)))
	var b2 := BoxMesh.new()
	b2.size = Vector3(0.65, 0.75, 0.2)
	t.add_child(_mesh(b2, stone, Vector3(0, 0.5, 0)))
	var top := CylinderMesh.new()
	top.top_radius = 0.325
	top.bottom_radius = 0.325
	top.height = 0.2
	var tm := _mesh(top, stone, Vector3(0, 0.875, 0))
	tm.rotation.x = PI / 2
	t.add_child(tm)
	var c1 := BoxMesh.new()
	c1.size = Vector3(0.07, 0.35, 0.03)
	t.add_child(_mesh(c1, dark, Vector3(0, 0.6, 0.11)))
	var c2 := BoxMesh.new()
	c2.size = Vector3(0.22, 0.07, 0.03)
	t.add_child(_mesh(c2, dark, Vector3(0, 0.68, 0.11)))
	var l := _label3d(v.nick, TEAM_LIGHT[v.team])
	l.position.y = 1.45
	t.add_child(l)
	t.base_y = v.global_position.y
	t.position = v.global_position
	t.rotation.y = randf_range(-0.3, 0.3)
	map_root.add_child(t)
	tombs.append(t)


# ---------------- entrada ----------------
func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.physical_keycode == KEY_TAB:
		board.visible = e.pressed
		if e.pressed:
			_render_board()
		return
	if menu_open:
		return
	if e is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var s: float = float(S["sens"]) * 0.0012
		me.yaw += e.relative.x * s
		me.pitch = clampf(me.pitch - e.relative.y * s * (-1.0 if S["invert"] else 1.0), -1.35, 1.35)
	elif e is InputEventMouseButton:
		if e.button_index == MOUSE_BUTTON_LEFT:
			me.in_fire = e.pressed
		elif e.pressed and (e.button_index == MOUSE_BUTTON_WHEEL_UP or e.button_index == MOUSE_BUTTON_WHEEL_DOWN):
			if time - wheel_t > 0.11:
				wheel_t = time
				_cycle_weapon(me, 1 if e.button_index == MOUSE_BUTTON_WHEEL_DOWN else -1)
	elif e is InputEventKey and e.pressed and not e.echo:
		match e.physical_keycode:
			KEY_ESCAPE: _show_menu(true)
			KEY_SPACE: _jump(me)
			KEY_R: _reload(me)
			KEY_1, KEY_2: _set_weapon(me, "primary")
			KEY_3: _set_weapon(me, "knife")
			KEY_4: _set_weapon(me, "nade")
			KEY_5: _set_weapon(me, "smoke")
			KEY_V:
				S["cam"] = 3 if int(S["cam"]) == 1 else 1
				_save_settings()
			KEY_F2:
				var vs := DisplayServer.window_get_vsync_mode()
				DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED if vs != DisplayServer.VSYNC_DISABLED else DisplayServer.VSYNC_ENABLED)
			KEY_F11:
				var full := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
				DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN)


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT and not menu_open and is_inside_tree() and menu:
		_show_menu(true)


# ---------------- ações ----------------
func _set_weapon(f: Fighter, w: String) -> void:
	if not f.alive:
		return
	if w == "nade" and f.nades < 1:
		return
	if w == "smoke" and f.smokes < 1:
		return
	if f.weapon != w:
		if f.weapon == "primary" or f.weapon == "knife":
			f.last_weapon = f.weapon
		f.weapon = w
		f.reload_until = 0.0
		f.charge0 = 0.0


func _cycle_weapon(f: Fighter, dir: int) -> void:
	var list := ["primary", "knife"]
	if f.nades > 0:
		list.append("nade")
	if f.smokes > 0:
		list.append("smoke")
	var i := list.find(f.weapon)
	_set_weapon(f, list[(i + dir + list.size()) % list.size()])


func _reload(f: Fighter) -> void:
	if not f.alive or f.weapon != "primary" or f.reload_until > 0:
		return
	var w: Dictionary = WEAPONS[f.primary]
	if int(f.ammo[f.primary]) >= int(w["mag"]) or int(f.mags[f.primary]) <= 0:
		return
	f.reload_until = time + float(w["reload"])


func _jump(f: Fighter) -> void:
	if not f.alive:
		return
	if f.is_on_floor():
		f.velocity.y = JUMP_V # pulo normal: sem limite, vai para onde está andando
		_legs_once(f, "Jump_Start", 1.6)
	elif not f.dj_used and time >= f.dj_ready_at: # pulo duplo carregado: passa por cima dos muros
		f.velocity.y = DJUMP_V
		f.dj_used = true
		f.dj_ready_at = time + DJUMP_CD
		if Vector2(f.velocity.x, f.velocity.z).length() < 1.5:
			f.velocity.x += cos(f.yaw) * 3.0
			f.velocity.z += sin(f.yaw) * 3.0
		_legs_once(f, "Jump_Full_Short", 1.6)


func _use_weapon(f: Fighter, released: bool) -> void:
	if not f.alive or time < f.protect_until or time < f.fire_ready:
		return
	if f.weapon == "knife":
		_knife(f)
		return
	if f.weapon == "nade" or f.weapon == "smoke":
		_throw_nade(f, f.weapon == "smoke")
		return
	var w: Dictionary = WEAPONS[f.primary]
	if f.reload_until > 0:
		return
	if int(f.ammo[f.primary]) <= 0:
		_reload(f)
		return
	if w.has("charge"): # arco: segura para puxar, solta para atirar
		if not released:
			if f.charge0 == 0.0:
				f.charge0 = time
			return
		var kk := clampf((time - f.charge0) / float(w["charge"]), 0.15, 1.0)
		f.charge0 = 0.0
		_shoot(f, w, float(w["min_speed"]) + (float(w["speed"]) - float(w["min_speed"])) * kk)
		return
	if released:
		return
	_shoot(f, w, float(w["speed"]))


# o tiro sai da mão e vai para o ponto que a mira mostra
func _shoot(f: Fighter, w: Dictionary, speed: float) -> void:
	f.ammo[f.primary] = int(f.ammo[f.primary]) - 1
	f.fire_ready = time + float(w["cd"])
	var dir := f.aim_dir()
	var eye: Vector3 = f.cam_pos if f.cam_pos != null else f.global_position + Vector3(0, EYE, 0)
	var target := eye + dir * 100.0
	var ex: Array[RID] = [f.get_rid()]
	var q := PhysicsRayQueryParameters3D.create(eye, target, 1 | 2, ex)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if not hit.is_empty():
		target = hit["position"]
	var right := Vector3(-sin(f.yaw), 0, cos(f.yaw))
	var origin := f.global_position + Vector3(cos(f.yaw), 0, sin(f.yaw)) * (f.radius() + 0.1) + right * 0.2 + Vector3(0, CHEST + 0.1, 0)
	var d := (target - origin)
	var dist := d.length()
	d = d.normalized()
	var grav: float = w["grav"]
	if grav > 0:
		d.y += grav * (dist / speed) / speed * 0.5 # compensa a queda para cair perto da mira
		d = d.normalized()
	var b := Bullet.new()
	b.r = w["r"]
	b.grav = grav
	b.rest = w["rest"]
	b.max_b = w["bounces"]
	b.kind = f.primary
	b.vel = d * speed
	b.team = f.team
	b.shooter = f
	b.born = time
	b.position = origin
	var m := StandardMaterial3D.new()
	m.albedo_color = TEAM_LIGHT[f.team]
	m.emission_enabled = true
	m.emission = TEAM_COLOR[f.team]
	m.emission_energy_multiplier = 2.5
	if f.primary == "arco":
		var cm := CylinderMesh.new()
		cm.top_radius = 0.03
		cm.bottom_radius = 0.03
		cm.height = 0.95
		b.mesh = cm
		b.material_override = _mat(Color("#e5d3a1"))
		var tip := SphereMesh.new()
		tip.radius = 0.1
		tip.height = 0.2
		b.add_child(_mesh(tip, m, Vector3(0, 0.5, 0)))
	elif f.primary == "disco":
		var dm := CylinderMesh.new()
		dm.top_radius = b.r
		dm.bottom_radius = b.r
		dm.height = 0.07
		b.mesh = dm
		b.material_override = m
	else:
		var sm := SphereMesh.new()
		sm.radius = b.r * 1.15
		sm.height = b.r * 2.3
		sm.radial_segments = 10
		sm.rings = 6
		b.mesh = sm
		b.material_override = m
	map_root.add_child(b)
	bullets.append(b)
	var sa: String = w["shoot"]
	_action(f, sa, 2.2 if sa == "throw" else 1.7)
	if f == me:
		kick = 1.0
		if sa == "throw":
			swing = 1.0
	if int(f.ammo[f.primary]) <= 0:
		_reload(f)


func _knife(f: Fighter) -> void:
	f.fire_ready = time + KNIFE_CD
	_action(f, "stab", 1.9)
	if f == me:
		swing = 1.0
	for o in fighters:
		if not o.alive or o.team == f.team:
			continue
		var d: Vector3 = o.global_position - f.global_position
		if absf(d.y) > 1.25:
			continue
		d.y = 0
		if d.length() > f.radius() + KNIFE_RANGE + o.radius():
			continue
		var da := wrapf(atan2(d.z, d.x) - f.yaw, -PI, PI)
		if absf(da) < deg_to_rad(55):
			_damage(o, f, "knife")
			break


# granada / fumaça: vai para onde a mira aponta e quica no muro e no chão
func _throw_nade(f: Fighter, smoke: bool) -> void:
	if (f.smokes if smoke else f.nades) < 1:
		f.weapon = f.last_weapon
		return
	if smoke:
		f.smokes -= 1
	else:
		f.nades -= 1
	f.fire_ready = time + 0.6
	var dir := f.aim_dir()
	var g := Nade.new()
	g.smoke = smoke
	g.team = f.team
	g.shooter = f
	g.t0 = time
	g.collision_layer = 4
	g.collision_mask = 1
	g.continuous_cd = true
	g.mass = 0.3
	var pmat := PhysicsMaterial.new()
	pmat.bounce = 0.45
	pmat.friction = 0.8
	g.physics_material_override = pmat
	g.angular_damp = 1.0
	var cs := CollisionShape3D.new()
	var sph := SphereShape3D.new()
	sph.radius = NADE_R
	cs.shape = sph
	g.add_child(cs)
	if smoke:
		var cm := CylinderMesh.new()
		cm.top_radius = 0.13
		cm.bottom_radius = 0.13
		cm.height = 0.35
		g.add_child(_mesh(cm, _mat(Color("#94a3b8"), 0.4, 0.4)))
	else:
		var sm := SphereMesh.new()
		sm.radius = NADE_R
		sm.height = NADE_R * 2
		sm.radial_segments = 8
		sm.rings = 5
		g.add_child(_mesh(_flat(sm), _mat(Color("#3f5f3a"))))
		var led := SphereMesh.new()
		led.radius = 0.05
		led.height = 0.1
		var lm := _mat(Color("#ff3b30"))
		lm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		g.led = _mesh(led, lm, Vector3(0, NADE_R, 0))
		g.add_child(g.led)
	map_root.add_child(g)
	g.global_position = f.global_position + Vector3(0, EYE, 0) + Vector3(dir.x, 0, dir.z) * 0.5
	g.linear_velocity = dir * NADE_SPEED + Vector3(0, NADE_UP, 0) + Vector3(f.velocity.x, f.velocity.y * 0.3, f.velocity.z) * 0.5
	nades.append(g)
	_action(f, "throw", 1.7)
	if f == me:
		swing = 1.0
	f.weapon = f.last_weapon


# ---------------- simulação (60 vezes por segundo; a imagem é interpolada) ----------------
func _physics_process(dt: float) -> void:
	time += dt
	_update_hazard()
	for f in fighters:
		_update_fighter(f, dt)
	_update_bullets(dt)
	_update_nades()
	for s in smokes.duplicate():
		_update_smoke(s, dt)
	for t in tombs.duplicate():
		var rise := clampf((time - t.t0) / 0.35, 0, 1)
		var sink := clampf((t.until - time) / 0.8, 0, 1)
		t.position.y = t.base_y - 1.0 * (1.0 - minf(rise, sink))
		if time >= t.until:
			tombs.erase(t)
			t.queue_free()


func _update_hazard() -> void:
	if cur_map_id == "escuro":
		if time < hazard_next:
			return
		hazard_light_on = not hazard_light_on
		hazard_next = time + (randf_range(3.0, 6.0) if hazard_light_on else randf_range(2.0, 4.0))
		sun.light_energy = 1.2 if hazard_light_on else 0.05
		if world_env:
			world_env.ambient_light_energy = 0.45 if hazard_light_on else 0.05
		_feed("💡 A luz voltou" if hazard_light_on else "🕯️ A luz apagou...")
	elif cur_map_id == "vulcao":
		if time >= hazard_next:
			lava_active = not lava_active
			hazard_next = time + (randf_range(4.0, 6.0) if lava_active else randf_range(5.0, 8.0))
			var col := Color("#ff5a1f") if lava_active else Color("#4b1a10")
			for mi in lava_meshes:
				(mi.material_override as StandardMaterial3D).albedo_color = col
				(mi.material_override as StandardMaterial3D).emission_enabled = lava_active
				(mi.material_override as StandardMaterial3D).emission = Color("#ff8a3d")
				(mi.material_override as StandardMaterial3D).emission_energy_multiplier = 1.6 if lava_active else 0.0
			_feed("🌋 A lava subiu!" if lava_active else "🌋 A lava baixou")
		if lava_active:
			for f in fighters:
				if not f.alive or time < f.lava_tick:
					continue
				for pool in lava_pools:
					var dx: float = f.position.x - pool["x"]
					var dz: float = f.position.z - pool["z"]
					if dx * dx + dz * dz < pool["r"] * pool["r"]:
						f.lava_tick = time + 0.6
						_damage(f, null, "lava")
						break


func _update_fighter(f: Fighter, dt: float) -> void:
	if f.reload_until > 0 and time >= f.reload_until:
		f.reload_until = 0.0
		f.ammo[f.primary] = WEAPONS[f.primary]["mag"]
		f.mags[f.primary] = int(f.mags[f.primary]) - 1
	if not f.alive:
		if time >= f.respawn_at:
			_respawn(f)
		return
	if f.is_bot:
		_bot_think(f, dt)
	elif menu_open or Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
		f.in_fwd = 0.0
		f.in_side = 0.0
		f.in_fire = false
	else:
		f.in_fwd = (1.0 if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP) else 0.0) - (1.0 if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN) else 0.0)
		f.in_side = (1.0 if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT) else 0.0) - (1.0 if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT) else 0.0)
	var fwd_v := Vector3(cos(f.yaw), 0, sin(f.yaw))
	var right := Vector3(-fwd_v.z, 0, fwd_v.x)
	var wish := fwd_v * f.in_fwd + right * f.in_side
	if wish.length() > 1:
		wish = wish.normalized()
	wish *= SPEED
	if f.is_on_floor():
		f.velocity.x = wish.x
		f.velocity.z = wish.z
	elif wish.length() > 0.01: # no ar: mantém o impulso, com um pouco de controle
		var kk := minf(1.0, AIR_CONTROL * dt * 6.0)
		f.velocity.x += (wish.x - f.velocity.x) * kk
		f.velocity.z += (wish.z - f.velocity.z) * kk
	f.velocity.y -= GRAVITY * dt
	f.move_and_slide()
	var on_floor := f.is_on_floor()
	if on_floor and not f.was_floor:
		f.dj_used = false
		if time > f.lower_once_until:
			_legs_once(f, "Jump_Land", 1.8)
	f.was_floor = on_floor
	var blink := time < f.protect_until and fmod(time, 0.2) < 0.1
	f.visible = f.alive and not blink and not (f == me and int(S["cam"]) == 1)
	_animate(f)
	if f.in_fire:
		_use_weapon(f, false)
	elif f.charge0 > 0:
		_use_weapon(f, true)


# bot: procura o inimigo mais perto, mira com erro, pula quando trava no muro
func _bot_think(f: Fighter, dt: float) -> void:
	var L: Dictionary = BOT_LEVELS.get(f.level, BOT_LEVELS["amador"])
	var ai := f.ai
	ai["t"] = float(ai.get("t", 0.0)) - dt
	ai["aim_t"] = float(ai.get("aim_t", 0.0)) - dt
	var target: Fighter = null
	var best := 1e9
	var sees := false
	for o in fighters:
		if not o.alive or o.team == f.team:
			continue
		var dd := Vector2(o.global_position.x - f.global_position.x, o.global_position.z - f.global_position.z).length()
		var vis := _can_see(f, o)
		var score := dd + (0.0 if vis else 17.5)
		if score < best:
			best = score
			target = o
			sees = vis
	ai["see_t"] = float(ai.get("see_t", 0.0)) + dt if sees else 0.0
	var dist := 0.0
	if target:
		dist = Vector2(target.global_position.x - f.global_position.x, target.global_position.z - f.global_position.z).length()
	if float(ai["t"]) <= 0:
		ai["t"] = randf_range(0.5, 1.4)
		var fwd := 1.0
		var side := 0.0
		if randf() < float(L["idle"]):
			fwd = 0.0
		elif target and sees:
			fwd = 0.6 if dist > 8.75 else (-0.4 if dist < 3.75 else 0.0)
			side = 1.0 if randf() < 0.5 else -1.0
		elif target:
			ai["wander"] = atan2(target.global_position.z - f.global_position.z, target.global_position.x - f.global_position.x) + randf_range(-0.6, 0.6)
			side = randf_range(-0.4, 0.4)
		else:
			ai["wander"] = randf() * TAU
		ai["fwd"] = fwd
		ai["side"] = side
		if randf() < float(L["jump"]):
			_jump(f)
	var lp: Vector3 = ai.get("lp", f.global_position)
	var moved := Vector2(f.global_position.x - lp.x, f.global_position.z - lp.z).length()
	ai["lp"] = f.global_position
	var wants_move := absf(float(ai.get("fwd", 0.0))) + absf(float(ai.get("side", 0.0))) > 0.1
	ai["stuck"] = float(ai.get("stuck", 0.0)) + dt if moved < 0.02 and wants_move else 0.0
	if float(ai["stuck"]) > 0.3:
		_jump(f)
		if not f.is_on_floor() and f.velocity.y < 1.0:
			_jump(f)
		ai["wander"] = randf() * TAU
		ai["t"] = 0.5
		ai["stuck"] = 0.0
	if target and sees:
		if float(ai["aim_t"]) <= 0:
			ai["aim_t"] = L["react"]
			var tt := dist / 22.5
			var tp := target.global_position + Vector3(target.velocity.x, 0, target.velocity.z) * tt + Vector3(0, CHEST, 0)
			var eye := f.global_position + Vector3(0, EYE, 0)
			ai["yaw"] = atan2(tp.z - eye.z, tp.x - eye.x) + randf_range(-1, 1) * float(L["err"])
			ai["pitch"] = atan2(tp.y - eye.y, Vector2(tp.x - eye.x, tp.z - eye.z).length()) + randf_range(-0.5, 0.5) * float(L["err"])
		f.yaw += wrapf(float(ai["yaw"]) - f.yaw, -PI, PI) * minf(1.0, dt * 14.0)
		f.pitch += (float(ai["pitch"]) - f.pitch) * minf(1.0, dt * 14.0)
		f.in_fire = float(ai["see_t"]) > float(L["react"]) and randf() < float(L["fire"])
		if f.nades > 0 and dist > 5.5 and dist < 15.0 and randf() < dt * float(L["nade"]):
			f.pitch = 0.35
			_throw_nade(f, false)
	else:
		f.in_fire = false
		if ai.has("wander"):
			f.yaw += wrapf(float(ai["wander"]) - f.yaw, -PI, PI) * minf(1.0, dt * 4.0)
		f.pitch *= 0.9
	f.in_fwd = ai.get("fwd", 0.0)
	f.in_side = ai.get("side", 0.0)
	if f.weapon != "primary":
		f.weapon = "primary"


func _can_see(f: Fighter, o: Fighter) -> bool:
	var a := f.global_position + Vector3(0, EYE, 0)
	var b := o.global_position + Vector3(0, CHEST, 0)
	var q := PhysicsRayQueryParameters3D.create(a, b, 1)
	if not get_world_3d().direct_space_state.intersect_ray(q).is_empty():
		return false
	return not _smoke_blocks(a, b)


func _smoke_blocks(a: Vector3, b: Vector3) -> bool:
	for s in smokes:
		var kk := _smoke_k(s)
		if kk < 0.6:
			continue
		var c: Vector3 = s.position
		var ab := Vector2(b.x - a.x, b.z - a.z)
		var u := clampf(Vector2(c.x - a.x, c.z - a.z).dot(ab) / maxf(ab.length_squared(), 0.0001), 0.0, 1.0)
		var p := Vector2(a.x, a.z) + ab * u
		var py := a.y + (b.y - a.y) * u
		if p.distance_to(Vector2(c.x, c.z)) < SMOKE_R * 0.55 * kk and py < SMOKE_R * 0.9:
			return true
	return false


func _smoke_k(s: Smoke) -> float:
	return clampf(minf((time - s.t0) / 0.5, (s.until - time) / 1.0), 0.0, 1.0)


func _update_bullets(dt: float) -> void:
	var space := get_world_3d().direct_space_state
	for b in bullets.duplicate():
		var dead := false
		var n := maxi(1, ceili(b.vel.length() * dt / (b.r * 0.9)))
		var sub := dt / n
		for i in n:
			if dead:
				break
			b.vel.y -= b.grav * sub
			var from: Vector3 = b.position
			var to: Vector3 = from + b.vel * sub
			var q := PhysicsRayQueryParameters3D.create(from, to + b.vel.normalized() * b.r, 1)
			var hit := space.intersect_ray(q)
			if hit.is_empty():
				b.position = to
			else: # ricocheteia no muro ou no chão
				var nrm: Vector3 = hit["normal"]
				b.vel = b.vel.bounce(nrm) * b.rest
				b.position = hit["position"] + nrm * (b.r + 0.01)
				b.bounces += 1
				if b.bounces > b.max_b or (nrm.y > 0.7 and absf(b.vel.y) < 1.5 and b.grav > 0):
					dead = true
			for o in fighters:
				if not o.alive or o.team == b.team or time < o.protect_until:
					continue
				var r: float = o.radius()
				var hh: float = CHAR_H * (1.0 if o.lives >= LIVES else SHRINK)
				var cy := clampf(b.position.y, o.global_position.y + r * 0.5, o.global_position.y + hh - r * 0.4)
				var cpos := Vector3(o.global_position.x, cy, o.global_position.z)
				if b.position.distance_to(cpos) < r + b.r:
					_damage(o, b.shooter, b.kind)
					dead = true
					break
		if b.kind == "arco" and b.vel.length() > 0.1:
			b.look_at(b.position + b.vel, Vector3.UP if absf(b.vel.normalized().y) < 0.99 else Vector3.RIGHT)
			b.rotate_object_local(Vector3.RIGHT, -PI / 2)
		elif b.kind == "disco":
			b.rotation.y += dt * 20.0
		if dead or time - b.born > 8.0:
			bullets.erase(b)
			b.queue_free()


func _update_nades() -> void:
	for g in nades.duplicate():
		var age: float = time - g.t0
		if g.led:
			g.led.visible = fmod(time, 0.14 if age > NADE_FUSE - 0.6 else 0.4) < (0.07 if age > NADE_FUSE - 0.6 else 0.2)
		if g.smoke and age >= SMOKE_FUSE:
			_make_smoke(g.global_position)
			nades.erase(g)
			g.queue_free()
		elif not g.smoke and age >= NADE_FUSE:
			_explode(g)
			nades.erase(g)
			g.queue_free()


func _explode(g: Nade) -> void:
	var at := g.global_position
	var sm := SphereMesh.new()
	sm.radius = NADE_RADIUS
	sm.height = NADE_RADIUS * 2
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(1, 0.6, 0.2, 0.8)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var fx := _mesh(sm, m, at)
	map_root.add_child(fx)
	var light := OmniLight3D.new()
	light.light_color = Color("#ffa640")
	light.light_energy = 6.0
	light.omni_range = 12.0
	light.position = at + Vector3(0, 0.5, 0)
	map_root.add_child(light)
	var tw := create_tween()
	tw.tween_property(fx, "scale", Vector3.ONE * 1.3, 0.45).from(Vector3.ONE * 0.4)
	tw.parallel().tween_property(m, "albedo_color:a", 0.0, 0.45)
	tw.parallel().tween_property(light, "light_energy", 0.0, 0.45)
	tw.tween_callback(fx.queue_free)
	tw.tween_callback(light.queue_free)
	var space := get_world_3d().direct_space_state
	for o in fighters:
		if not o.alive or o.team == g.team:
			continue
		var cy := clampf(at.y, o.global_position.y, o.global_position.y + CHAR_H)
		if Vector3(o.global_position.x, cy, o.global_position.z).distance_to(at) > NADE_RADIUS + o.radius():
			continue
		var q := PhysicsRayQueryParameters3D.create(at + Vector3(0, 0.05, 0), o.global_position + Vector3(0, CHEST, 0), 1)
		if space.intersect_ray(q).is_empty():
			_damage(o, g.shooter, "nade")


# ---------------- fumaça: muitas nuvenzinhas macias ----------------
func _make_smoke_texture() -> Texture2D:
	# nuvem macia: some suave até a borda, com um pouco de "ruído" para não ficar uma bola lisa
	var img := Image.create(128, 128, false, Image.FORMAT_RGBA8)
	var noise := FastNoiseLite.new()
	noise.seed = 77
	noise.frequency = 0.045
	for y in 128:
		for x in 128:
			var d := Vector2(x - 63.5, y - 63.5).length() / 64.0
			var n := 0.75 + 0.25 * noise.get_noise_2d(x, y)
			var a := clampf(pow(maxf(0.0, 1.0 - d), 1.1) * n * 1.7, 0.0, 1.0)
			img.set_pixel(x, y, Color(1, 1, 1, a))
	return ImageTexture.create_from_image(img)


func _make_smoke(at: Vector3) -> void:
	var s := Smoke.new()
	s.t0 = time
	s.until = time + SMOKE_T
	s.position = Vector3(at.x, 0, at.z)
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	var quad := QuadMesh.new()
	quad.size = Vector2.ONE
	for i in 162:
		var core := i >= 150 # as últimas são nuvens grandes no miolo
		var m := StandardMaterial3D.new()
		m.albedo_texture = smoke_tex
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.no_depth_test = false
		m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
		var shade := rng.randf_range(0.72, 0.88) if not core else 0.82
		m.albedo_color = Color(shade, shade + 0.01, shade + 0.03, 0.0)
		var p := _mesh(quad, m)
		var ang := rng.randf() * TAU
		var dist := (rng.randf() * SMOKE_R * 0.3) if core else sqrt(rng.randf()) * SMOKE_R * 0.85
		var hgt := (rng.randf_range(0.9, 2.6)) if core else pow(rng.randf(), 1.6) * SMOKE_R * 0.85 + 0.4
		var size := rng.randf_range(5.75, 8.0) if core else rng.randf_range(1.75, 4.0)
		p.set_meta("u", {"a": ang, "d": dist, "h": hgt, "size": size, "drift": rng.randf_range(0.01, 0.025), "dens": 1.2 if core else 1.0 - dist / SMOKE_R})
		s.add_child(p)
		s.parts.append(p)
	map_root.add_child(s)
	smokes.append(s)


func _update_smoke(s: Smoke, dt: float) -> void:
	if time >= s.until:
		smokes.erase(s)
		s.queue_free()
		return
	var kk := _smoke_k(s)
	var grow := minf(1.0, (time - s.t0) / 0.6)
	for p in s.parts:
		var u: Dictionary = p.get_meta("u")
		var d: float = float(u["d"]) * (0.35 + 0.65 * grow) + (time - s.t0) * float(u["drift"]) * 3.0
		p.position = Vector3(cos(u["a"]) * d, float(u["h"]) * (0.4 + 0.6 * grow), sin(u["a"]) * d)
		var sz: float = float(u["size"]) * (0.6 + 0.4 * grow)
		p.scale = Vector3(sz, sz, sz)
		var m: StandardMaterial3D = p.material_override
		m.albedo_color.a = kk * minf(1.0, 0.6 + 0.8 * float(u["dens"]))
	var _unused := dt


# ---------------- arma na tela (1ª pessoa) ----------------
func _build_view_models() -> void:
	var gun := _mat(Color("#374151"), 0.4, 0.5)
	var dark := _mat(Color("#111827"), 0.3, 0.7)
	var skin := _mat(Color("#e0b08a"))
	var wood := _mat(Color("#8b5a2b"))
	var ball := _mat(Color("#93c5fd"))
	var glow := _mat(Color("#60a5fa"), 0.3)
	glow.emission_enabled = true
	glow.emission = Color("#1d4ed8")
	var box := func(sx: float, sy: float, sz: float) -> BoxMesh:
		var bm := BoxMesh.new()
		bm.size = Vector3(sx, sy, sz)
		return bm
	var sphere := func(r: float) -> SphereMesh:
		var sm := SphereMesh.new()
		sm.radius = r
		sm.height = r * 2
		return sm
	var cyl := func(r: float, h: float) -> CylinderMesh:
		var cm := CylinderMesh.new()
		cm.top_radius = r
		cm.bottom_radius = r
		cm.height = h
		return cm
	var add := func(name: String, parts: Array) -> Node3D:
		var g := Node3D.new()
		for p in parts:
			g.add_child(p)
		g.visible = false
		camera.add_child(g)
		view_models[name] = g
		return g
	var barrel := _mesh(cyl.call(0.022, 0.18), dark, Vector3(0, 0.015, -0.26))
	barrel.rotation.x = PI / 2
	add.call("lancador", [_mesh(box.call(0.07, 0.07, 0.38), gun), barrel, _mesh(sphere.call(0.055), glow, Vector3(0, 0.065, 0.02)), _mesh(box.call(0.055, 0.12, 0.07), dark, Vector3(0, -0.08, 0.09))])
	var f1 := _mesh(box.call(0.028, 0.16, 0.028), wood, Vector3(-0.04, 0.09, -0.04))
	f1.rotation.z = 0.35
	var f2 := _mesh(box.call(0.028, 0.16, 0.028), wood, Vector3(0.04, 0.09, -0.04))
	f2.rotation.z = -0.35
	add.call("estilingue", [_mesh(box.call(0.04, 0.18, 0.04), wood, Vector3(0, -0.07, 0)), f1, f2, _mesh(box.call(0.13, 0.014, 0.014), _mat(Color("#ef4444")), Vector3(0, 0.16, -0.04)), _mesh(sphere.call(0.04), ball, Vector3(0, 0.15, 0.03))])
	add.call("mao", [_mesh(box.call(0.12, 0.09, 0.17), skin, Vector3(0, -0.05, 0.04)), _mesh(sphere.call(0.08), ball, Vector3(0, 0.045, -0.05))])
	var arc := MeshInstance3D.new()
	var tor := TorusMesh.new()
	tor.inner_radius = 0.23
	tor.outer_radius = 0.26
	arc.mesh = tor
	arc.material_override = wood
	arc.rotation = Vector3(0, 0, PI / 2)
	arc.scale = Vector3(1, 0.1, 1)
	var string := _mesh(box.call(0.006, 0.48, 0.006), _mat(Color("#f1f5f9")))
	string.set_meta("string", true)
	var arrow := _mesh(cyl.call(0.01, 0.5), _mat(Color("#e5d3a1")), Vector3(0, 0, -0.14))
	arrow.rotation.x = PI / 2
	arrow.set_meta("arrow", true)
	var bow: Node3D = add.call("arco", [arc, string, arrow])
	bow.rotation.z = 0.25
	add.call("disco", [_mesh(cyl.call(0.12, 0.03), ball, Vector3(0, 0, -0.03)), _mesh(box.call(0.1, 0.07, 0.14), skin, Vector3(0, -0.05, 0.07))])
	add.call("knife", [_mesh(box.call(0.018, 0.045, 0.28), _mat(Color("#d1d5db"), 0.25, 0.8), Vector3(0, 0, -0.14)), _mesh(box.call(0.04, 0.05, 0.1), dark, Vector3(0, 0, 0.04))])
	add.call("nade", [_mesh(_flat(sphere.call(0.08)), _mat(Color("#3f5f3a")), Vector3(0, 0, -0.03)), _mesh(box.call(0.1, 0.07, 0.14), skin, Vector3(0, -0.07, 0.05))])
	add.call("smoke", [_mesh(cyl.call(0.06, 0.18), _mat(Color("#94a3b8"), 0.4, 0.4), Vector3(0, 0, -0.03)), _mesh(box.call(0.1, 0.07, 0.14), skin, Vector3(0, -0.09, 0.05))])


# ---------------- câmera + HUD (a cada quadro do monitor) ----------------
func _process(dt: float) -> void:
	if not me:
		return
	var p := me.get_global_transform_interpolated().origin
	var dir := me.aim_dir()
	camera.fov = S["fov"]
	var first := int(S["cam"]) == 1
	if not me.alive: # morto: olha a própria lápide de cima
		camera.global_position = p - Vector3(dir.x, 0, dir.z) * 4.0 + Vector3(0, 4.25, 0)
		camera.look_at(p + Vector3(0, 0.5, 0), Vector3.UP)
		me.cam_pos = null
	elif first:
		var moving := me.is_on_floor() and Vector2(me.velocity.x, me.velocity.z).length() > 0.75
		var eye := EYE * (1.0 if me.lives >= LIVES else 0.8)
		camera.global_position = p + Vector3(0, eye + (sin(time * 11.0) * 0.035 if moving else 0.0), 0)
		camera.look_at(camera.global_position + dir, Vector3.UP)
		me.cam_pos = null
	else: # 3ª pessoa: atrás do ombro, sem atravessar muro
		var right := Vector3(-sin(me.yaw), 0, cos(me.yaw))
		var head := p + Vector3(0, 1.5, 0) + right * 0.75
		var back := Vector3(-dir.x, -dir.y * 0.9 + 0.18, -dir.z).normalized()
		var want := 3.75
		var q := PhysicsRayQueryParameters3D.create(head, head + back * want, 1)
		var hit := get_world_3d().direct_space_state.intersect_ray(q)
		var dd := want
		if not hit.is_empty():
			dd = maxf(0.5, head.distance_to(hit["position"]) - 0.3)
		camera.global_position = head + back * dd
		camera.global_position.y = maxf(camera.global_position.y, 0.25)
		camera.look_at(camera.global_position + dir, Vector3.UP)
		me.cam_pos = camera.global_position
	# arma na tela
	var wkey := me.primary if me.weapon == "primary" else me.weapon
	for k in view_models:
		view_models[k].visible = first and me.alive and k == wkey
	var vg: Node3D = view_models.get(wkey)
	if vg:
		var w: Dictionary = WEAPONS[me.primary]
		var reloading := me.weapon == "primary" and me.reload_until > 0
		var charge := clampf((time - me.charge0) / float(w.get("charge", 1.0)), 0, 1) if me.charge0 > 0 else 0.0
		var base := Vector3(0.15, -0.15, -0.6) if wkey == "arco" else Vector3(0.2, -0.2, -0.55)
		vg.position = base + Vector3(0, (-0.17 if reloading else 0.0) + swing * 0.12, kick * 0.07 - swing * 0.15)
		vg.rotation.x = kick * 0.25 + (0.7 if reloading else 0.0) - swing * 0.6
		for c in vg.get_children():
			if c.has_meta("string"):
				c.position.z = charge * 0.17
			if c.has_meta("arrow"):
				c.position.z = -0.14 + charge * 0.17
				c.visible = int(me.ammo[me.primary]) > 0 and not reloading
	kick = maxf(0.0, kick - dt * 7.0)
	swing = maxf(0.0, swing - dt * 4.0)
	_update_hud()


# ---------------- interface ----------------
func _panel_style(alpha := 0.8) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.04, 0.055, 0.086, alpha)
	sb.border_color = Color("#243044")
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(12)
	return sb


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	cross = Crosshair.new()
	cross.cfg = S["x"]
	cross.set_anchors_preset(Control.PRESET_FULL_RECT)
	cross.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(cross)
	var top := PanelContainer.new()
	top.add_theme_stylebox_override("panel", _panel_style())
	top.position = Vector2(12, 12)
	hud_top = Label.new()
	hud_top.add_theme_font_size_override("font_size", 13)
	top.add_child(hud_top)
	layer.add_child(top)
	var hp := PanelContainer.new()
	hp.add_theme_stylebox_override("panel", _panel_style())
	hp.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	hp.grow_vertical = Control.GROW_DIRECTION_BEGIN
	hp.position = Vector2(12, -12)
	hud_main = Label.new()
	hud_main.add_theme_font_size_override("font_size", 16)
	hp.add_child(hud_main)
	layer.add_child(hp)
	slots_box = HBoxContainer.new()
	slots_box.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	slots_box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	slots_box.grow_vertical = Control.GROW_DIRECTION_BEGIN
	slots_box.position.y = -12
	slots_box.add_theme_constant_override("separation", 6)
	layer.add_child(slots_box)
	feed_box = VBoxContainer.new()
	feed_box.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	feed_box.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	feed_box.position = Vector2(-12, 12)
	layer.add_child(feed_box)
	dead_label = Label.new()
	dead_label.set_anchors_preset(Control.PRESET_CENTER)
	dead_label.grow_horizontal = Control.GROW_DIRECTION_BOTH
	dead_label.position.y = -120
	dead_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	dead_label.add_theme_font_size_override("font_size", 26)
	dead_label.add_theme_constant_override("outline_size", 8)
	dead_label.add_theme_color_override("font_outline_color", Color.BLACK)
	layer.add_child(dead_label)
	# placar (Tab)
	board = PanelContainer.new()
	board.add_theme_stylebox_override("panel", _panel_style(0.93))
	board.set_anchors_preset(Control.PRESET_CENTER)
	board.grow_horizontal = Control.GROW_DIRECTION_BOTH
	board.grow_vertical = Control.GROW_DIRECTION_BOTH
	board.custom_minimum_size = Vector2(620, 0)
	board_grid = GridContainer.new()
	board_grid.columns = 5
	board_grid.add_theme_constant_override("h_separation", 28)
	board.add_child(board_grid)
	board.visible = false
	layer.add_child(board)
	_build_menu(layer)


func _feed(bb: String) -> void:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.autowrap_mode = TextServer.AUTOWRAP_OFF
	r.custom_minimum_size = Vector2(320, 0)
	r.text = "[right][b]" + bb + "[/b][/right]"
	feed_box.add_child(r)
	feed_box.move_child(r, 0)
	while feed_box.get_child_count() > 5:
		feed_box.get_child(feed_box.get_child_count() - 1).queue_free()
	get_tree().create_timer(4.5).timeout.connect(_free_if_valid.bind(r))


func _render_board() -> void:
	for c in board_grid.get_children():
		c.queue_free()
	for tm in ["A", "B"]:
		var list := fighters.filter(func(f): return f.team == tm)
		list.sort_custom(func(x, y): return x.k > y.k or (x.k == y.k and x.d < y.d))
		var total := 0
		for f in list:
			total += f.k
		var head := ["Time Azul — %d abates" % total if tm == "A" else "Time Vermelho — %d abates" % total, "Abates", "Mortes", "Assist.", "K/D"]
		for i in 5:
			var l := Label.new()
			l.text = head[i]
			l.add_theme_color_override("font_color", TEAM_LIGHT[tm] if i == 0 else Color("#94a3b8"))
			board_grid.add_child(l)
		for f in list:
			var vals := [f.nick + ("" if f.alive else "  (morto)"), str(f.k), str(f.d), str(f.a), "%.2f" % (float(f.k) / maxf(1.0, float(f.d)))]
			for i in 5:
				var l2 := Label.new()
				l2.text = vals[i]
				if f == me:
					l2.add_theme_color_override("font_color", Color("#ffcc33"))
				elif not f.alive:
					l2.modulate = Color(1, 1, 1, 0.5)
				if i > 0:
					l2.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
				board_grid.add_child(l2)
		if tm == "A":
			for i in 5:
				board_grid.add_child(Control.new())


func _update_hud() -> void:
	var w: Dictionary = WEAPONS[me.primary]
	var vs := "ligado" if DisplayServer.window_get_vsync_mode() != DisplayServer.VSYNC_DISABLED else "desligado"
	hud_top.text = "POINT BALL 3D · GODOT %s · FPS %d · V-Sync %s (F2)" % [Engine.get_version_info()["string"].split(".stable")[0], Engine.get_frames_per_second(), vs]
	var arma := ""
	if me.weapon == "primary":
		arma = "recarregando..." if me.reload_until > 0 else "%d/%d · pentes %d" % [int(me.ammo[me.primary]), int(w["mag"]), int(me.mags[me.primary])]
		arma += "\n" + str(w["name"])
	elif me.weapon == "knife":
		arma = "FACA"
	else:
		arma = ("GRANADA" if me.weapon == "nade" else "FUMAÇA") + " · clique para jogar"
	var pulo := "Pulo duplo PRONTO (Espaço 2x)" if time >= me.dj_ready_at else "Pulo duplo em %ds" % ceili(me.dj_ready_at - time)
	hud_main.text = "%s\n%s\n%s" % ["♥ ".repeat(maxi(me.lives, 0)) if me.alive else "♡ ♡", arma, pulo]
	# slots
	var want := [["primary", "1  " + str(w["name"]).split(" ")[0], false], ["knife", "3  Faca", false], ["nade", "4  Granada ×%d" % me.nades, me.nades == 0], ["smoke", "5  Fumaça ×%d" % me.smokes, me.smokes == 0]]
	if slots_box.get_child_count() != 4:
		for c in slots_box.get_children():
			c.queue_free()
		for i in 4:
			var pc := PanelContainer.new()
			var l := Label.new()
			l.add_theme_font_size_override("font_size", 13)
			pc.add_child(l)
			slots_box.add_child(pc)
	for i in 4:
		var pc: PanelContainer = slots_box.get_child(i)
		var on: bool = me.weapon == want[i][0]
		var sb := _panel_style()
		sb.set_content_margin_all(7)
		if on:
			sb.border_color = Color("#ffcc33")
		pc.add_theme_stylebox_override("panel", sb)
		var l: Label = pc.get_child(0)
		l.text = want[i][1]
		l.add_theme_color_override("font_color", Color("#ffcc33") if on else Color("#94a3b8"))
		pc.modulate.a = 0.4 if want[i][2] else 1.0
	# morto
	if not me.alive:
		var killer = null
		for f in me.last_hit_by:
			if absf(float(me.last_hit_by[f]) - me.dead_at) < 0.05:
				killer = f
		dead_label.text = "Você foi eliminado%s\nrenascendo em %ds" % [(" por " + killer.nick) if killer else "", maxi(0, ceili(me.respawn_at - time))]
		dead_label.visible = true
	else:
		dead_label.visible = false
	# mira
	var prog := 1.0
	if me.weapon == "primary" and me.reload_until > 0:
		prog = 1.0 - (me.reload_until - time) / float(w["reload"])
	elif me.fire_ready > time:
		var cd := float(w["cd"]) if me.weapon == "primary" else (KNIFE_CD if me.weapon == "knife" else 0.6)
		prog = 1.0 - (me.fire_ready - time) / cd
	if me.charge0 > 0:
		prog = clampf((time - me.charge0) / float(w.get("charge", 1.0)), 0, 1)
	cross.prog = clampf(prog, 0, 1)
	cross.hit_kind = hit_kind
	cross.hit_a = maxf(0.0, 1.0 - (time - hit_t) / 0.28)
	cross.visible = me.alive and not menu_open
	cross.queue_redraw()
	if board.visible:
		board_t += get_process_delta_time()
		if board_t > 0.25:
			board_t = 0.0
			_render_board()


# ---------------- menu (Esc) ----------------
func _show_menu(v: bool) -> void:
	menu_open = v
	menu.visible = v
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE if v else Input.MOUSE_MODE_CAPTURED
	if me:
		me.in_fire = false
	if preview:
		preview.queue_redraw()


func _build_menu(layer: CanvasLayer) -> void:
	menu = Control.new()
	menu.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(menu)
	var dim := ColorRect.new()
	dim.color = Color(0.02, 0.03, 0.06, 0.7)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	menu.add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	menu.add_child(center)
	var card := PanelContainer.new()
	var sb := _panel_style(0.97)
	sb.set_content_margin_all(18)
	card.add_theme_stylebox_override("panel", sb)
	card.custom_minimum_size = Vector2(720, 0)
	center.add_child(card)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	card.add_child(col)
	var title := Label.new()
	title.text = "Point Ball 3D"
	title.add_theme_font_size_override("font_size", 22)
	title.add_theme_color_override("font_color", Color("#ffcc33"))
	col.add_child(title)
	var tabs := TabContainer.new()
	tabs.custom_minimum_size = Vector2(0, 470)
	col.add_child(tabs)
	# --- Jogo
	var g1 := _grid(tabs, "Jogo")
	_opt(g1, "Câmera", [[1, "1ª pessoa"], [3, "3ª pessoa (por trás)"]], "cam", S, Callable())
	var map_opts := []
	for i in MAP_IDS.size():
		map_opts.append([i, MAP_NAMES[i]])
	_opt(g1, "Mapa", map_opts, "map", S, _new_game)
	_opt(g1, "Bots inimigos", [[0, "0"], [1, "1"], [2, "2"], [3, "3"], [5, "5"]], "bots", S, _new_game)
	_opt(g1, "Nível dos bots", [["iniciante", "Iniciante"], ["amador", "Amador"], ["pro", "Profissional"]], "level", S, _apply_level)
	_opt(g1, "Sombras", [[true, "Ligadas"], [false, "Desligadas"]], "shadow", S, func(): sun.shadow_enabled = S["shadow"])
	_slider(g1, "Campo de visão (FOV)", 60, 110, 1, "fov", S, Callable())
	# --- Arma
	var g2 := _grid(tabs, "Arma")
	var desc := Label.new()
	desc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	desc.custom_minimum_size = Vector2(620, 0)
	desc.modulate = Color("#94a3b8")
	var items := []
	for wid in WEAPON_IDS:
		items.append([wid, WEAPONS[wid]["name"]])
	_opt(g2, "Arma principal (1)", items, "weapon", S, func():
		me.primary = S["weapon"]
		me.reload_until = 0.0
		me.charge0 = 0.0
		desc.text = str(WEAPONS[S["weapon"]]["desc"]) + "\n\nTodas as armas atiram coisas de borracha que ricocheteiam no muro e no chão.")
	desc.text = str(WEAPONS[S["weapon"]]["desc"]) + "\n\nTodas as armas atiram coisas de borracha que ricocheteiam no muro e no chão."
	g2.get_parent().add_child(desc)
	# --- Mira
	var scroll := ScrollContainer.new()
	scroll.name = "Mira"
	tabs.add_child(scroll)
	var mv := VBoxContainer.new()
	mv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(mv)
	preview = Crosshair.new()
	preview.cfg = S["x"]
	preview.custom_minimum_size = Vector2(220, 130)
	preview.prog = 0.65
	preview.hit_a = 1.0
	preview.hit_kind = "hit"
	mv.add_child(preview)
	var g3 := GridContainer.new()
	g3.columns = 3
	g3.add_theme_constant_override("h_separation", 12)
	mv.add_child(g3)
	var X: Dictionary = S["x"]
	var redraw := func(): preview.queue_redraw()
	var cl := Label.new()
	cl.text = "Cor"
	g3.add_child(cl)
	var cp := ColorPickerButton.new()
	cp.color = Color(str(X["color"]))
	cp.custom_minimum_size = Vector2(60, 28)
	cp.color_changed.connect(func(c): X["color"] = "#" + c.to_html(false); _save_settings(); preview.queue_redraw())
	g3.add_child(cp)
	g3.add_child(Control.new())
	_opt(g3, "Contorno preto", [[true, "Sim"], [false, "Não"]], "outline", X, redraw)
	_slider(g3, "Tamanho da cruz", 0, 20, 1, "len", X, redraw)
	_slider(g3, "Espessura", 1, 6, 0.5, "thick", X, redraw)
	_slider(g3, "Espaço no meio", 0, 16, 1, "gap", X, redraw)
	_opt(g3, "Ponto no meio", [[true, "Sim"], [false, "Não"]], "dot", X, redraw)
	_slider(g3, "Tamanho do ponto", 1, 8, 0.5, "dotsize", X, redraw)
	_opt(g3, "Círculo de recarga do tiro", [[true, "Sim"], [false, "Não"]], "ring", X, redraw)
	_slider(g3, "Tamanho do círculo", 10, 60, 1, "ringr", X, redraw)
	_slider(g3, "Espessura do círculo", 1, 6, 0.5, "ringw", X, redraw)
	_opt(g3, "Marcador de acerto (X)", [[true, "Sim"], [false, "Não"]], "hit", X, redraw)
	_slider(g3, "Tamanho do X", 4, 24, 1, "hitlen", X, redraw)
	_slider(g3, "Espessura do X", 0.5, 4, 0.5, "hitw", X, redraw)
	var note := Label.new()
	note.text = "O X pisca amarelo quando acerta e vermelho quando elimina."
	note.modulate = Color("#94a3b8")
	mv.add_child(note)
	# --- Controles
	var g4 := _grid(tabs, "Controles")
	_slider(g4, "Sensibilidade do mouse", 0.2, 6, 0.05, "sens", S, Callable())
	_opt(g4, "Inverter mouse (Y)", [[false, "Não"], [true, "Sim"]], "invert", S, Callable())
	var keys := Label.new()
	keys.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	keys.custom_minimum_size = Vector2(620, 0)
	keys.modulate = Color("#94a3b8")
	keys.text = "WASD andar · Mouse olhar e mirar · Clique atirar/usar\nEspaço pular (sem limite) · Espaço de novo no ar = pulo duplo (carrega a cada 15 s, passa por cima dos muros)\n1 arma principal · 3 faca · 4 granada · 5 fumaça · Rodinha troca de arma\nGranada e fumaça: aperte 4 ou 5 para pegar e clique para jogar (vai para onde a mira aponta)\nArco: segure o clique para puxar e solte para atirar\nR recarregar · V 1ª/3ª pessoa · Tab (segurar) placar · Esc este menu · F2 V-Sync · F11 tela cheia"
	g4.get_parent().add_child(keys)
	# rodapé
	var foot := HBoxContainer.new()
	var credit := Label.new()
	credit.text = "Bonecos: KayKit Adventurers por Kay Lousberg (CC0)"
	credit.modulate = Color("#94a3b8")
	credit.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	foot.add_child(credit)
	var play := Button.new()
	play.text = "   Jogar   "
	play.pressed.connect(func(): _show_menu(false))
	foot.add_child(play)
	col.add_child(foot)


func _apply_level() -> void:
	for f in fighters:
		f.level = S["level"]


func _free_if_valid(n: Node) -> void:
	if is_instance_valid(n):
		n.queue_free()


func _grid(tabs: TabContainer, tab_name: String) -> GridContainer:
	var v := VBoxContainer.new()
	v.name = tab_name
	v.add_theme_constant_override("separation", 12)
	tabs.add_child(v)
	var g := GridContainer.new()
	g.columns = 3
	g.add_theme_constant_override("h_separation", 12)
	g.add_theme_constant_override("v_separation", 8)
	v.add_child(g)
	return g


func _opt(g: GridContainer, text: String, items: Array, key: String, obj: Dictionary, on_change: Callable) -> void:
	var l := Label.new()
	l.text = text
	l.custom_minimum_size = Vector2(210, 0)
	g.add_child(l)
	var o := OptionButton.new()
	o.custom_minimum_size = Vector2(300, 0)
	for i in items.size():
		o.add_item(str(items[i][1]), i)
		if str(items[i][0]) == str(obj[key]) or (typeof(obj[key]) == TYPE_FLOAT and str(int(obj[key])) == str(items[i][0])):
			o.select(i)
	o.item_selected.connect(func(idx):
		obj[key] = items[idx][0]
		_save_settings()
		if on_change.is_valid():
			on_change.call())
	g.add_child(o)
	g.add_child(Control.new())


func _slider(g: GridContainer, text: String, mn: float, mx: float, step: float, key: String, obj: Dictionary, on_change: Callable) -> void:
	var l := Label.new()
	l.text = text
	l.custom_minimum_size = Vector2(210, 0)
	g.add_child(l)
	var s := HSlider.new()
	s.min_value = mn
	s.max_value = mx
	s.step = step
	s.value = float(obj[key])
	s.custom_minimum_size = Vector2(300, 0)
	s.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	g.add_child(s)
	var v := Label.new()
	v.text = str(obj[key])
	v.custom_minimum_size = Vector2(46, 0)
	g.add_child(v)
	s.value_changed.connect(func(val):
		obj[key] = val
		v.text = str(val)
		_save_settings()
		if on_change.is_valid():
			on_change.call())
