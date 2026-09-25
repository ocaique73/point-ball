# Point Ball 3D — demo FPS em Godot 4.7.
# Tudo é criado por código aqui (mapa, luz, câmera, bonecos, bots, tiros, bomba, fumaça e HUD).
# Bonecos: KayKit Adventurers (Kay Lousberg, CC0) com animações em 2 camadas:
#   pernas = parado / correndo / andando de lado / de costas / pulando / morrendo
#   braços = mirando / atirando / recarregando / facada / jogando bomba e fumaça / levando tiro
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
const PLAYER_R := 25.0 / U
const CHAR_H := 1.6
const EYE := 1.4
const SHOT_Y := 1.0
const SPEED := 260.0 / U
const BULLET_SPEED := 660.0 / U
const MAX_BOUNCES := 3
const FIRE_CD := 1.0
const MAG := 20
const MAGS := 4
const RELOAD := 1.5
const LIVES := 2
const SHRINK := 0.65
const INVULN := 0.4
const JUMP_CD := 15.0
const JUMP_DIST := 170.0 / U
const JUMP_DUR := 0.55
const RESPAWN := 2.0
const KNIFE_CD := 0.4
const KNIFE_RANGE := 50.0 / U
const BOMB_RANGE := 380.0 / U
const BOMB_FLIGHT := 0.6
const BOMB_FUSE := 0.6
const BOMB_R := 105.0 / U
const SMOKE_R := 200.0 / U
const SMOKE_T := 6.0

const TEAM_COLOR := { "A": Color("#3b82f6"), "B": Color("#ef4444") }
const TEAM_LIGHT := { "A": Color("#93c5fd"), "B": Color("#fca5a5") }
const MAP_IDS := ["deserto", "neve", "floresta"]
const BOT_NAMES := ["Tonhão", "Pipoca", "Faísca", "Marreta", "Coxinha", "Paçoca"]
const UPPER := ["spine", "chest", "head", "upperarm.l", "upperarm.r", "lowerarm.l", "lowerarm.r", "wrist.l", "wrist.r", "hand.l", "hand.r", "handslot.l", "handslot.r", "elbowIK.l", "elbowIK.r", "handIK.l", "handIK.r"]
const LOCO := ["Idle", "Running_A", "Walking_Backwards", "Running_Strafe_Left", "Running_Strafe_Right", "Jump_Idle", "Death_A"]
const ARMS := { "aim": "1H_Ranged_Aiming", "reload": "1H_Ranged_Reload" }
const ACTS := { "shoot": "1H_Ranged_Shoot", "stab": "1H_Melee_Attack_Stab", "throw": "Throw", "hit": "Hit_A" }
const LOOPS := ["Idle", "Running_A", "Walking_Backwards", "Running_Strafe_Left", "Running_Strafe_Right", "Jump_Idle", "1H_Ranged_Aiming", "1H_Ranged_Reload"]

var map_index := 0
var map_root: Node3D
var fighters: Array = []
var bullets: Array = []
var bombs: Array = []
var smokes: Array = []
var me: Fighter
var camera: Camera3D
var view_gun: Node3D
var third_person := false
var yaw := 0.0
var pitch := -0.05
var sens := 0.0025
var hud_label: Label
var feed_label: Label
var feed_until := 0.0
var cross: Crosshair
var time := 0.0
var recoil := 0.0
var model_scale := {}


# ---------------- personagem ----------------
class Fighter extends CharacterBody3D:
	var team := "A"
	var nick := ""
	var is_bot := false
	var lives := LIVES
	var alive := true
	var aim := Vector3(1, 0, 0)
	var weapon := "gun"
	var fire_ready := 0.0
	var ammo := MAG
	var mags := MAGS
	var reload_until := 0.0
	var invuln_until := 0.0
	var respawn_at := 0.0
	var jump_ready_at := JUMP_CD
	var jump_t0 := -1.0
	var jump_dir := Vector3.ZERO
	var bombs := 1
	var smokes := 1
	var kills := 0
	var deaths := 0
	var model: Node3D
	var tree: AnimationTree
	var crossbow: Node3D
	var knife: Node3D
	var throwable: Node3D
	var ring: MeshInstance3D
	var label: Label3D
	var act_until := 0.0
	var loco_now := ""
	var arms_now := ""
	var scale0 := 1.0
	# bot
	var think_t := 0.0
	var move_dir := Vector3.ZERO
	var aim_err := 0.0

	func radius() -> float:
		return PLAYER_R * (1.0 if lives >= LIVES else SHRINK)


# ---------------- bala / bomba / fumaça ----------------
class Bullet extends MeshInstance3D:
	var vel := Vector3.ZERO
	var team := "A"
	var shooter: Fighter
	var bounces := 0
	var born := 0.0

class Bomb extends MeshInstance3D:
	var from := Vector3.ZERO
	var to := Vector3.ZERO
	var t0 := 0.0
	var flight := 0.6
	var smoke := false
	var team := "A"
	var shooter: Fighter

class Smoke extends Node3D:
	var t0 := 0.0


# ---------------- mira no meio da tela ----------------
class Crosshair extends Control:
	var hit := 0.0
	var charge := 1.0
	func _draw() -> void:
		var c := size / 2
		var col := Color(1, 0.3, 0.4) if hit > 0 else Color.WHITE
		for d in [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
			draw_line(c + d * 5, c + d * 14, Color(0, 0, 0, 0.7), 4)
			draw_line(c + d * 5, c + d * 14, col, 2)
		draw_circle(c, 2.5, Color("#ffcc33"))
		draw_arc(c, 20, -PI / 2, -PI / 2 + TAU * charge, 32, Color(1, 0.8, 0.2, 0.25 + 0.5 * charge) if charge < 1 else Color(1, 1, 1, 0.3), 3)


# ---------------- início ----------------
func _ready() -> void:
	_setup_world()
	camera = Camera3D.new()
	camera.fov = 75.0
	camera.near = 0.05
	add_child(camera)
	_setup_view_gun()
	_setup_hud()
	_load_map(0)


func _setup_world() -> void:
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
	var sun := DirectionalLight3D.new()
	sun.light_energy = 1.2
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 60.0
	sun.rotation_degrees = Vector3(-50, -35, 0)
	add_child(sun)


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


# ---------------- mapa ----------------
func _load_map(i: int) -> void:
	map_index = i
	for arr in [fighters, bullets, bombs, smokes]:
		for n in arr:
			n.queue_free()
		arr.clear()
	if map_root:
		map_root.queue_free()
	map_root = Node3D.new()
	add_child(map_root)
	var data: Dictionary = MapsData.MAPS[MAP_IDS[i]]
	var th: Dictionary = data["theme"]
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(W, H)
	ground.mesh = pm
	ground.material_override = _mat(Color(th["ground"]), 0.95)
	ground.position = Vector3(W / 2, 0, H / 2)
	map_root.add_child(ground)
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
		_wall(Rect2(min(x1, x2) - T / 2, min(y1, y2) - T / 2, abs(x2 - x1) + T, abs(y2 - y1) + T), Color(th["wall"]), WALL_H)
	var rng := RandomNumberGenerator.new()
	rng.seed = i * 97 + 5
	for n in 34:
		var rock := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radial_segments = 5
		sm.rings = 3
		var k := rng.randf_range(0.15, 0.4)
		sm.radius = k
		sm.height = k * 1.2
		rock.mesh = _flat(sm)
		var deco := Color(th["wallEdge"]).lightened(0.25)
		if th["deco"] == "snow":
			deco = Color.WHITE
		elif th["deco"] == "tree":
			deco = Color("#3f7d3a")
		rock.material_override = _mat(deco)
		rock.position = Vector3(rng.randf_range(1.5, W - 1.5), 0, rng.randf_range(1.5, H - 1.5))
		rock.rotation = Vector3(rng.randf() * 3, rng.randf() * 3, 0)
		map_root.add_child(rock)
	me = _spawn_fighter("A", "Você", false)
	yaw = 0.0
	for b in 2:
		_spawn_fighter("B", BOT_NAMES[(b + i * 2) % BOT_NAMES.size()], true)


func _wall(r: Rect2, color: Color, h: float) -> void:
	var body := StaticBody3D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(r.size.x, h, r.size.y)
	shape.shape = box
	body.add_child(shape)
	var mesh := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = box.size
	mesh.mesh = bm
	mesh.material_override = _mat(color)
	body.add_child(mesh)
	body.position = Vector3(r.position.x + r.size.x / 2, h / 2, r.position.y + r.size.y / 2)
	map_root.add_child(body)


# ---------------- bonecos ----------------
func _spawn_fighter(team: String, nick: String, bot: bool) -> Fighter:
	var f := Fighter.new()
	f.team = team
	f.nick = nick
	f.is_bot = bot
	f.collision_layer = 2
	f.collision_mask = 1 # só bate nos muros (como no 2D: um passa pelo outro)
	f.motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	var shape := CollisionShape3D.new()
	var cyl := CylinderShape3D.new()
	cyl.radius = PLAYER_R
	cyl.height = CHAR_H
	shape.shape = cyl
	shape.position.y = CHAR_H / 2
	f.add_child(shape)
	# modelo KayKit
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
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	f.crossbow = f.model.find_child("1H_Crossbow", true, false)
	f.knife = f.model.find_child("Knife", true, false)
	f.throwable = f.model.find_child("Throwable", true, false)
	for extra in ["2H_Crossbow", "Knife_Offhand"]:
		var n: Node3D = f.model.find_child(extra, true, false)
		if n:
			n.visible = false
	_setup_anim(f)
	# anel do time no chão + nome
	f.ring = MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = PLAYER_R * 0.85
	tm.outer_radius = PLAYER_R * 1.0
	f.ring.mesh = tm
	var rm := _mat(TEAM_COLOR[team])
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	f.ring.material_override = rm
	f.ring.scale = Vector3(1, 0.05, 1)
	f.ring.position.y = 0.02
	f.add_child(f.ring)
	if bot:
		f.label = Label3D.new()
		f.label.text = nick
		f.label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		f.label.fixed_size = true
		f.label.pixel_size = 0.0012
		f.label.font_size = 32
		f.label.outline_size = 8
		f.label.modulate = TEAM_LIGHT[team]
		f.label.position.y = CHAR_H + 0.4
		f.add_child(f.label)
	map_root.add_child(f)
	fighters.append(f)
	_respawn(f)
	return f


# deixa o boneco com CHAR_H de altura
func _model_scale(team: String, model: Node3D) -> float:
	if model_scale.has(team):
		return model_scale[team]
	var top := 0.0
	var bottom := 1e9
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var a: AABB = mi.get_aabb()
		top = max(top, a.end.y)
		bottom = min(bottom, a.position.y)
	var h := top - bottom
	var sc := CHAR_H / h if h > 0.1 else 1.0
	model_scale[team] = sc
	return sc


# árvore de animação: pernas (Transition) + braços por cima (Blend2 com filtro nos ossos de cima) + ações rápidas (OneShot)
func _setup_anim(f: Fighter) -> void:
	var ap: AnimationPlayer = f.model.find_child("AnimationPlayer", true, false)
	for n in LOOPS:
		ap.get_animation(n).loop_mode = Animation.LOOP_LINEAR
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
	bt.connect_node("os", 0, "arms")
	bt.connect_node("os", 1, "act_speed")
	var mix := AnimationNodeBlend2.new()
	mix.filter_enabled = true
	var seen := {}
	for anim_name in LOCO + ARMS.values() + ACTS.values():
		var a: Animation = ap.get_animation(anim_name)
		for t in a.get_track_count():
			var path: NodePath = a.track_get_path(t)
			var s := str(path)
			if seen.has(s):
				continue
			seen[s] = true
			var bone := s.get_slice(":", 1)
			if bone in UPPER:
				mix.set_filter_path(path, true)
	bt.add_node("mix", mix)
	bt.connect_node("mix", 0, "loco")
	bt.connect_node("mix", 1, "os")
	bt.connect_node("output", 0, "mix")
	f.tree = AnimationTree.new()
	f.model.add_child(f.tree)
	f.tree.anim_player = f.tree.get_path_to(ap)
	f.tree.tree_root = bt
	f.tree.active = true
	f.tree.set("parameters/mix/blend_amount", 1.0)
	f.tree.set("parameters/act_speed/scale", 1.6)


func _set_loco(f: Fighter, name: String) -> void:
	if f.loco_now != name:
		f.loco_now = name
		f.tree.set("parameters/loco/transition_request", name)


func _set_arms(f: Fighter, key: String) -> void:
	if f.arms_now != key:
		f.arms_now = key
		f.tree.set("parameters/arms/transition_request", key)


func _action(f: Fighter, key: String, speed := 1.6) -> void:
	if not f.alive:
		return
	f.tree.set("parameters/act/transition_request", key)
	f.tree.set("parameters/act_speed/scale", speed)
	f.tree.set("parameters/os/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	var ap: AnimationPlayer = f.model.find_child("AnimationPlayer", true, false)
	f.act_until = time + ap.get_animation(ACTS[key]).length / speed


func _animate(f: Fighter) -> void:
	var gun := f.weapon == "gun"
	if f.crossbow: f.crossbow.visible = gun
	if f.knife: f.knife.visible = not gun
	if f.throwable: f.throwable.visible = time < f.act_until and f.tree.get("parameters/act/current_state") == "throw"
	if not f.alive:
		_set_loco(f, "Death_A")
		f.tree.set("parameters/mix/blend_amount", 0.0)
		return
	var v := f.velocity
	v.y = 0
	var sp := v.length()
	if f.jump_t0 >= 0:
		_set_loco(f, "Jump_Idle")
	elif sp > 0.6:
		var fwd := v.dot(f.aim) / sp
		var side := v.dot(Vector3(-f.aim.z, 0, f.aim.x)) / sp
		if fwd > 0.5:
			_set_loco(f, "Running_A")
		elif fwd < -0.5:
			_set_loco(f, "Walking_Backwards")
		else:
			_set_loco(f, "Running_Strafe_Right" if side > 0 else "Running_Strafe_Left")
	else:
		_set_loco(f, "Idle")
	# braços: com arma mira/recarrega por cima das pernas; com faca acompanham o corpo (menos na facada)
	_set_arms(f, "reload" if f.reload_until > 0 else "aim")
	f.tree.set("parameters/mix/blend_amount", 1.0 if gun or time < f.act_until else 0.0)


func _respawn(f: Fighter) -> void:
	var x := randf_range(1.5, 4.0) if f.team == "A" else randf_range(W - 4.0, W - 1.5)
	f.position = Vector3(x, 0, randf_range(3.0, H - 3.0))
	f.reset_physics_interpolation()
	f.lives = LIVES
	f.alive = true
	f.ammo = MAG
	f.mags = MAGS
	f.bombs = 1
	f.smokes = 1
	f.reload_until = 0.0
	f.invuln_until = time + 1.0
	f.model.scale = Vector3.ONE * f.scale0
	f.ring.visible = true
	if f.label: f.label.visible = true
	f.aim = Vector3(1 if f.team == "A" else -1, 0, 0)
	f.loco_now = ""
	if f == me:
		yaw = 0.0 if f.team == "A" else PI


func _hit(f: Fighter, by: Fighter, how := "tiro") -> void:
	if not f.alive or time < f.invuln_until or f.jump_t0 >= 0:
		return
	f.lives -= 1
	f.invuln_until = time + INVULN
	if by == me and cross:
		cross.hit = 0.25
	if f.lives <= 0:
		f.alive = false
		f.deaths += 1
		f.respawn_at = time + RESPAWN
		f.ring.visible = false
		if f.label: f.label.visible = false
		if by:
			by.kills += 1
		feed_label.text = "%s  [%s]  %s" % [by.nick if by else "?", how, f.nick]
		feed_until = time + 2.5
	else:
		f.model.scale = Vector3.ONE * f.scale0 * SHRINK
		_action(f, "hit", 1.4)


# ---------------- entrada ----------------
func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		yaw += e.relative.x * sens
		pitch = clampf(pitch - e.relative.y * sens, -1.2, 1.2)
	elif e is InputEventMouseButton and e.pressed:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
			return
		match e.button_index:
			MOUSE_BUTTON_RIGHT: _throw(me, false, _throw_target())
			MOUSE_BUTTON_WHEEL_UP, MOUSE_BUTTON_WHEEL_DOWN: _throw(me, true, _throw_target())
	elif e is InputEventKey and e.pressed and not e.echo:
		match e.physical_keycode:
			KEY_ESCAPE: Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
			KEY_SPACE: _try_jump(me)
			KEY_R: _reload(me)
			KEY_1: me.weapon = "gun"
			KEY_2: me.weapon = "knife"
			KEY_V, KEY_C: third_person = not third_person
			KEY_M: _load_map((map_index + 1) % MAP_IDS.size())
			KEY_F2:
				var vs := DisplayServer.window_get_vsync_mode()
				DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED if vs != DisplayServer.VSYNC_DISABLED else DisplayServer.VSYNC_ENABLED)
			KEY_F11:
				var full := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
				DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN)


# onde a bomba/fumaça cai: onde a mira encosta no chão (limitado ao alcance)
func _throw_target() -> Vector3:
	var d := BOMB_RANGE
	if pitch < -0.02:
		d = minf(BOMB_RANGE, EYE / tan(-pitch))
	return me.global_position + Vector3(cos(yaw), 0, sin(yaw)) * d


# ---------------- ações ----------------
func _try_fire(f: Fighter) -> void:
	if not f.alive or f.jump_t0 >= 0 or time < f.invuln_until - INVULN and f.lives == LIVES:
		return
	if f.weapon == "knife":
		_try_knife(f)
		return
	if time < f.fire_ready or f.reload_until > 0:
		return
	if f.ammo <= 0:
		_reload(f)
		return
	f.ammo -= 1
	f.fire_ready = time + FIRE_CD
	var b := Bullet.new()
	var sm := SphereMesh.new()
	sm.radius = 0.13
	sm.height = 0.26
	sm.radial_segments = 8
	sm.rings = 4
	b.mesh = sm
	var m := StandardMaterial3D.new()
	m.albedo_color = TEAM_LIGHT[f.team]
	m.emission_enabled = true
	m.emission = TEAM_COLOR[f.team]
	m.emission_energy_multiplier = 3.0
	b.material_override = m
	b.vel = f.aim * BULLET_SPEED
	b.team = f.team
	b.shooter = f
	b.born = time
	b.position = f.global_position + f.aim * (f.radius() + 0.2) + Vector3(0, SHOT_Y, 0)
	map_root.add_child(b)
	bullets.append(b)
	_action(f, "shoot", 1.8)
	if f == me:
		recoil = 1.0
	if f.ammo <= 0:
		_reload(f)


func _try_knife(f: Fighter) -> void:
	if time < f.fire_ready:
		return
	f.fire_ready = time + KNIFE_CD
	_action(f, "stab", 1.8)
	if f == me:
		recoil = 1.0
	for o in fighters:
		if o.team == f.team or not o.alive:
			continue
		var d: Vector3 = o.global_position - f.global_position
		d.y = 0
		if d.length() < f.radius() + KNIFE_RANGE + o.radius() and f.aim.angle_to(d.normalized()) < deg_to_rad(55):
			_hit(o, f, "faca")


func _reload(f: Fighter) -> void:
	if f.reload_until > 0 or f.mags <= 0 or f.ammo >= MAG or f.weapon != "gun":
		return
	f.reload_until = time + RELOAD


func _try_jump(f: Fighter) -> void:
	if not f.alive or f.jump_t0 >= 0 or time < f.jump_ready_at:
		return
	var dir := f.velocity
	dir.y = 0
	f.jump_dir = dir.normalized() if dir.length() > 0.1 else f.aim
	f.jump_t0 = time
	f.jump_ready_at = time + JUMP_CD


func _throw(f: Fighter, smoke: bool, target: Vector3) -> void:
	if not f.alive or f.jump_t0 >= 0 or (f.smokes if smoke else f.bombs) < 1:
		return
	if smoke:
		f.smokes -= 1
	else:
		f.bombs -= 1
	var d := target - f.global_position
	d.y = 0
	if d.length() > BOMB_RANGE:
		d = d.normalized() * BOMB_RANGE
	var b := Bomb.new()
	var sm := SphereMesh.new()
	sm.radius = 0.2
	sm.height = 0.4
	sm.radial_segments = 8
	sm.rings = 4
	b.mesh = _flat(sm)
	b.material_override = _mat(Color("#94a3b8") if smoke else Color("#1f2937"))
	b.from = f.global_position + Vector3(0, 1.3, 0)
	b.to = f.global_position + d
	b.to.x = clampf(b.to.x, T + 0.2, W - T - 0.2)
	b.to.z = clampf(b.to.z, T + 0.2, H - T - 0.2)
	b.t0 = time
	b.flight = BOMB_FLIGHT * (0.5 + 0.5 * d.length() / BOMB_RANGE)
	b.smoke = smoke
	b.team = f.team
	b.shooter = f
	b.position = b.from
	map_root.add_child(b)
	bombs.append(b)
	_action(f, "throw", 1.6)


# ---------------- simulação (60 vezes por segundo; a imagem é interpolada) ----------------
func _physics_process(dt: float) -> void:
	time += dt
	if me and me.alive:
		me.aim = Vector3(cos(yaw), 0, sin(yaw))
	for f in fighters:
		_update_fighter(f, dt)
	_update_bullets(dt)
	_update_bombs()


func _update_fighter(f: Fighter, dt: float) -> void:
	if f.reload_until > 0 and time >= f.reload_until:
		f.reload_until = 0.0
		f.ammo = MAG
		f.mags -= 1
	if not f.alive:
		f.velocity = Vector3.ZERO
		_animate(f)
		if time >= f.respawn_at:
			_respawn(f)
		return
	var dir := Vector3.ZERO
	var fire := false
	if f.is_bot:
		var r := _bot_think(f, dt)
		dir = r[0]
		fire = r[1]
	else:
		var fwd := 0.0
		var side := 0.0
		if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP): fwd += 1
		if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN): fwd -= 1
		if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT): side += 1
		if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT): side -= 1
		var right := Vector3(-f.aim.z, 0, f.aim.x)
		dir = f.aim * fwd + right * side
		fire = Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT) and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
	dir = dir.normalized()
	var air := 0.0
	if f.jump_t0 >= 0:
		var t := (time - f.jump_t0) / JUMP_DUR
		if t >= 1.0:
			f.jump_t0 = -1.0
		else:
			f.velocity = f.jump_dir * (JUMP_DIST / JUMP_DUR)
			air = sin(PI * t) * 2.6
	if f.jump_t0 < 0:
		f.velocity = dir * SPEED
	f.move_and_slide()
	f.position.y = 0
	f.model.position.y = air
	f.model.rotation.y = atan2(f.aim.x, f.aim.z)
	f.model.visible = not (f == me and not third_person) and not (time < f.invuln_until and f.lives == LIVES and fmod(time, 0.2) < 0.1)
	_animate(f)
	if fire:
		_try_fire(f)


# bot simples: anda, procura você, mira com um pouco de erro e atira/joga bomba quando te vê
func _bot_think(f: Fighter, dt: float) -> Array:
	var target: Fighter = null
	var best := 1e9
	for o in fighters:
		if o.team != f.team and o.alive:
			var d := f.global_position.distance_to(o.global_position)
			if d < best:
				best = d
				target = o
	var sees := false
	if target:
		var q := PhysicsRayQueryParameters3D.create(f.global_position + Vector3(0, SHOT_Y, 0), target.global_position + Vector3(0, SHOT_Y, 0), 1)
		sees = get_world_3d().direct_space_state.intersect_ray(q).is_empty() and not _smoke_blocks(f.global_position, target.global_position)
	f.think_t -= dt
	if f.think_t <= 0:
		f.think_t = randf_range(0.5, 1.3)
		f.aim_err = randf_range(-0.2, 0.2)
		if target and not sees:
			f.move_dir = (target.global_position - f.global_position).normalized().rotated(Vector3.UP, randf_range(-0.8, 0.8))
		elif target and sees:
			var to := (target.global_position - f.global_position).normalized()
			f.move_dir = to.rotated(Vector3.UP, PI / 2 * (1 if randf() < 0.5 else -1)) * 0.8
		else:
			f.move_dir = Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized()
	if f.get_slide_collision_count() > 0 and randf() < 0.1:
		f.move_dir = Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)).normalized()
	if target and sees:
		var to2 := target.global_position - f.global_position
		to2.y = 0
		f.aim = to2.normalized().rotated(Vector3.UP, f.aim_err)
		if best < BOMB_RANGE and best > BOMB_R * 1.2 and randf() < dt * 0.06:
			_throw(f, false, target.global_position)
	elif f.move_dir.length() > 0.1:
		f.aim = f.aim.slerp(Vector3(f.move_dir.x, 0, f.move_dir.z).normalized(), 0.08)
	if randf() < dt * 0.05:
		_try_jump(f)
	return [f.move_dir, target != null and sees]


func _smoke_blocks(a: Vector3, b: Vector3) -> bool:
	for s in smokes:
		var k := clampf((time - s.t0) / 0.35, 0.0, 1.0)
		if k < 0.6:
			continue
		var c: Vector3 = s.position
		var ab := b - a
		ab.y = 0
		var u := clampf((c - a).dot(ab) / maxf(ab.length_squared(), 0.001), 0.0, 1.0)
		var p := a + ab * u
		if Vector2(p.x - c.x, p.z - c.z).length() < SMOKE_R * 0.55:
			return true
	return false


func _update_bullets(dt: float) -> void:
	var space := get_world_3d().direct_space_state
	for b in bullets.duplicate():
		var dead := false
		var from: Vector3 = b.position
		var to: Vector3 = from + b.vel * dt
		var q := PhysicsRayQueryParameters3D.create(from, to, 1 | 2)
		var exclude := []
		for tries in 3:
			q.exclude = exclude
			var hit := space.intersect_ray(q)
			if hit.is_empty():
				b.position = to
				break
			var col = hit["collider"]
			if col is Fighter:
				if col.team != b.team and col.alive and col.jump_t0 < 0:
					_hit(col, b.shooter)
					dead = true
					break
				exclude.append(col.get_rid())
				continue
			var n: Vector3 = hit["normal"]
			n.y = 0
			n = n.normalized()
			b.vel = b.vel.bounce(n)
			b.position = hit["position"] + n * 0.02
			b.bounces += 1
			if b.bounces >= MAX_BOUNCES:
				dead = true
			break
		if dead or time - b.born > 10.0:
			bullets.erase(b)
			b.queue_free()


func _update_bombs() -> void:
	for b in bombs.duplicate():
		var t: float = (time - b.t0) / b.flight
		if t < 1.0:
			b.position = b.from.lerp(b.to, t) + Vector3(0, sin(PI * t) * 3.5, 0)
			b.rotation.x += 0.2
			continue
		b.position = b.to + Vector3(0, 0.2, 0)
		if time < b.t0 + b.flight + BOMB_FUSE:
			continue
		bombs.erase(b)
		b.queue_free()
		if b.smoke:
			_make_smoke(b.to)
		else:
			_explode(b)


func _explode(b: Bomb) -> void:
	var fx := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = BOMB_R
	sm.height = BOMB_R * 2
	fx.mesh = sm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(1, 0.6, 0.2, 0.8)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fx.material_override = m
	fx.position = b.to
	map_root.add_child(fx)
	var tw := create_tween()
	tw.tween_property(fx, "scale", Vector3.ONE * 1.3, 0.4).from(Vector3.ONE * 0.4)
	tw.parallel().tween_property(m, "albedo_color:a", 0.0, 0.4)
	tw.tween_callback(fx.queue_free)
	var space := get_world_3d().direct_space_state
	for o in fighters:
		if o.team == b.team or not o.alive:
			continue
		var d := Vector2(o.global_position.x - b.to.x, o.global_position.z - b.to.z).length()
		if d > BOMB_R + o.radius():
			continue
		var q := PhysicsRayQueryParameters3D.create(b.to + Vector3(0, 0.5, 0), o.global_position + Vector3(0, 0.5, 0), 1)
		if space.intersect_ray(q).is_empty():
			_hit(o, b.shooter, "bomba")


func _make_smoke(at: Vector3) -> void:
	var s := Smoke.new()
	s.t0 = time
	s.position = at
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.8, 0.83, 0.88, 0.94)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	var rng := RandomNumberGenerator.new()
	for i in 18:
		var puff := MeshInstance3D.new()
		var sm := SphereMesh.new()
		var r := SMOKE_R * rng.randf_range(0.35, 0.6)
		sm.radius = r
		sm.height = r * 1.6
		sm.radial_segments = 10
		sm.rings = 6
		puff.mesh = sm
		puff.material_override = m
		var a := rng.randf() * TAU
		var d := rng.randf() * SMOKE_R * 0.65
		puff.position = Vector3(cos(a) * d, SMOKE_R * rng.randf_range(0.15, 0.45), sin(a) * d)
		s.add_child(puff)
	s.scale = Vector3.ONE * 0.3
	map_root.add_child(s)
	smokes.append(s)
	var tw := create_tween()
	tw.tween_property(s, "scale", Vector3.ONE, 0.35)
	tw.tween_interval(SMOKE_T - 1.15)
	tw.tween_property(m, "albedo_color:a", 0.0, 0.8)
	tw.tween_callback(_remove_smoke.bind(s))


func _remove_smoke(s: Smoke) -> void:
	smokes.erase(s)
	s.queue_free()


# ---------------- câmera, arma na tela e HUD (a cada quadro do monitor) ----------------
func _setup_view_gun() -> void:
	view_gun = Node3D.new()
	camera.add_child(view_gun)
	var body := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.07, 0.07, 0.38)
	body.mesh = bm
	body.material_override = _mat(Color("#374151"), 0.4, 0.5)
	var barrel := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.022
	cm.bottom_radius = 0.022
	cm.height = 0.18
	barrel.mesh = cm
	barrel.material_override = _mat(Color("#111827"), 0.3, 0.7)
	barrel.rotation.x = PI / 2
	barrel.position = Vector3(0, 0.015, -0.26)
	var tank := MeshInstance3D.new()
	var tm := SphereMesh.new()
	tm.radius = 0.055
	tm.height = 0.11
	tank.mesh = tm
	var glow := _mat(Color("#60a5fa"), 0.3)
	glow.emission_enabled = true
	glow.emission = Color("#1d4ed8")
	tank.material_override = glow
	tank.position = Vector3(0, 0.065, 0.02)
	view_gun.add_child(body)
	view_gun.add_child(barrel)
	view_gun.add_child(tank)
	view_gun.scale = Vector3.ONE * 0.7
	view_gun.position = Vector3(0.16, -0.16, -0.38)


func _process(dt: float) -> void:
	if not me:
		return
	var p := me.get_global_transform_interpolated().origin # posição suave entre os passos da física
	var air := me.model.position.y
	var look := Vector3(cos(yaw) * cos(pitch), sin(pitch), sin(yaw) * cos(pitch))
	if third_person:
		var right := Vector3(-sin(yaw), 0, cos(yaw))
		var head := p + Vector3(0, 1.7 + air, 0)
		var want := p + Vector3(0, 2.2 + air, 0) - Vector3(cos(yaw), 0, sin(yaw)) * 3.75 * cos(pitch) + right * 0.85 - Vector3(0, sin(pitch) * 3.4, 0)
		want.y = maxf(want.y, 0.3)
		# câmera não atravessa parede: se tiver muro no caminho, chega mais perto
		var q := PhysicsRayQueryParameters3D.create(head, want, 1)
		var hit := get_world_3d().direct_space_state.intersect_ray(q)
		if not hit.is_empty():
			want = hit["position"] + (head - want).normalized() * 0.3
		camera.position = want
		camera.fov = 70
	else:
		var moving := me.velocity.length() > 0.5
		camera.position = p + Vector3(0, EYE + air + (sin(time * 11.0) * 0.04 if moving else 0.0) - (0.8 if not me.alive else 0.0), 0)
		camera.fov = 75
	camera.look_at(camera.position + look, Vector3.UP)
	view_gun.visible = not third_person and me.alive and me.weapon == "gun"
	view_gun.position = Vector3(0.17, -0.15 - (0.1 if me.reload_until > 0 else 0.0), -0.4 + recoil * 0.05)
	view_gun.rotation = Vector3(recoil * 0.25 + (0.6 if me.reload_until > 0 else 0.0), 0, 0)
	recoil = max(0.0, recoil - dt * 7.0)
	_update_hud(dt)


func _setup_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	cross = Crosshair.new()
	cross.set_anchors_preset(Control.PRESET_FULL_RECT)
	cross.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(cross)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.04, 0.055, 0.086, 0.8)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(12)
	var panel := PanelContainer.new()
	panel.position = Vector2(12, 12)
	panel.add_theme_stylebox_override("panel", sb)
	layer.add_child(panel)
	hud_label = Label.new()
	hud_label.add_theme_font_size_override("font_size", 16)
	panel.add_child(hud_label)
	feed_label = Label.new()
	feed_label.add_theme_font_size_override("font_size", 20)
	feed_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	feed_label.position = Vector2(-200, 16)
	feed_label.size = Vector2(400, 30)
	feed_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	layer.add_child(feed_label)
	var hp := PanelContainer.new()
	hp.add_theme_stylebox_override("panel", sb)
	hp.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	hp.position = Vector2(12, -56)
	var help := Label.new()
	help.text = "Clique para prender o mouse (Esc solta) · WASD andar · Mouse olhar · Clique atirar · Botão direito bomba · Rodinha fumaça · Espaço pulo · 1/2 arma/faca · R recarregar · V 1ª/3ª pessoa · M mapa · F2 V-Sync · F11 tela cheia"
	help.modulate = Color(0.7, 0.75, 0.85)
	help.add_theme_font_size_override("font_size", 13)
	hp.add_child(help)
	layer.add_child(hp)


func _update_hud(dt: float) -> void:
	var vs := "ligado (segue o Hz do monitor)" if DisplayServer.window_get_vsync_mode() != DisplayServer.VSYNC_DISABLED else "desligado (sem limite)"
	var arma := "FACA" if me.weapon == "knife" else ("recarregando..." if me.reload_until > 0 else "%d/%d · pentes %d" % [me.ammo, MAG, me.mags])
	var pulo := "PRONTO (Espaço)" if time >= me.jump_ready_at else "em %ds" % ceil(me.jump_ready_at - time)
	hud_label.text = "POINT BALL · DEMO 3D FPS (GODOT %s)\nVidas: %s   Bomba: %d   Fumaça: %d\nArma: %s\nPulo: %s\nAbates %d · Mortes %d · Mapa: %s · Câmera: %s\nFPS: %d · V-Sync %s" % [
		Engine.get_version_info()["string"].split(".stable")[0], ("♥ ".repeat(max(me.lives, 0)) if me.alive else "renascendo..."), me.bombs, me.smokes,
		arma, pulo, me.kills, me.deaths, MAP_IDS[map_index], "3ª pessoa" if third_person else "1ª pessoa", Engine.get_frames_per_second(), vs]
	feed_label.visible = time < feed_until
	cross.hit = max(0.0, cross.hit - dt)
	cross.charge = 1.0 if me.weapon == "knife" or time >= me.fire_ready else 1.0 - (me.fire_ready - time) / FIRE_CD
	cross.queue_redraw()

