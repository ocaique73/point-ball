# Point Ball 3D — demo em Godot 4.
# Tudo é criado por código aqui (mapa, luz, câmera, personagens, bots, tiros e HUD),
# para ser fácil de ler e comparar com a demo em Three.js.
# Medidas: 1 metro = 40 unidades do jogo 2D (o mapa de 1600 x 1000 vira 40 x 25 m).
extends Node3D

const MapsData = preload("res://maps_data.gd")

const U := 40.0                       # unidades do 2D por metro
const W := 1600.0 / U                 # largura do mapa (m)
const H := 1000.0 / U                 # altura do mapa (m)
const T := 24.0 / U                   # grossura do muro
const WALL_H := 1.4
const PLAYER_R := 25.0 / U
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
const GUN_Y := 0.55

const TEAM_COLOR := { "A": Color("#3b82f6"), "B": Color("#ef4444") }
const TEAM_LIGHT := { "A": Color("#93c5fd"), "B": Color("#fca5a5") }
const MAP_IDS := ["deserto", "neve", "floresta"]
const BOT_NAMES := ["Tonhão", "Pipoca", "Faísca", "Marreta", "Coxinha", "Paçoca"]

var map_index := 0
var map_root: Node3D
var fighters: Array = []
var bullets: Array = []
var me: Fighter
var camera: Camera3D
var cam_mode := 0
var hud_label: Label
var feed_label: Label
var feed_until := 0.0
var aim_plane := Plane(Vector3.UP, GUN_Y)
var time := 0.0


# ---------------- personagem ----------------
class Fighter extends CharacterBody3D:
	var team := "A"
	var nick := ""
	var is_bot := false
	var lives := LIVES
	var alive := true
	var aim := Vector3(1, 0, 0)
	var fire_ready := 0.0
	var ammo := MAG
	var mags := MAGS
	var reload_until := 0.0
	var invuln_until := 0.0
	var respawn_at := 0.0
	var jump_ready_at := JUMP_CD
	var jump_t0 := -1.0
	var jump_dir := Vector3.ZERO
	var kills := 0
	var deaths := 0
	var model: Node3D
	var body_mat: StandardMaterial3D
	var label: Label3D
	# bot
	var think_t := 0.0
	var move_dir := Vector3.ZERO
	var aim_err := 0.0

	func radius() -> float:
		return PLAYER_R * (1.0 if lives >= LIVES else SHRINK)


# ---------------- bala ----------------
class Bullet extends MeshInstance3D:
	var vel := Vector3.ZERO
	var team := "A"
	var shooter: Fighter
	var bounces := 0
	var born := 0.0


# ---------------- início ----------------
func _ready() -> void:
	_setup_world()
	camera = Camera3D.new()
	camera.fov = 45.0
	add_child(camera)
	_setup_hud()
	_load_map(0)


func _setup_world() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#0b0f17")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.75, 0.8, 0.9)
	env.ambient_light_energy = 0.35
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.ssao_enabled = true
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.light_energy = 1.05
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 60.0
	sun.rotation_degrees = Vector3(-55, -35, 0)
	add_child(sun)


func _mat(color: Color, rough := 0.85, metal := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = rough
	m.metallic = metal
	return m


# deixa a malha "facetada" (visual low-poly)
func _flat(mesh: Mesh) -> Mesh:
	var st := SurfaceTool.new()
	st.create_from(mesh, 0)
	st.deindex()
	st.generate_normals()
	return st.commit()


# ---------------- mapa ----------------
func _load_map(i: int) -> void:
	map_index = i
	for f in fighters:
		f.queue_free()
	fighters.clear()
	for b in bullets:
		b.queue_free()
	bullets.clear()
	if map_root:
		map_root.queue_free()
	map_root = Node3D.new()
	add_child(map_root)
	var data: Dictionary = MapsData.MAPS[MAP_IDS[i]]
	var th: Dictionary = data["theme"]
	# chão
	var ground := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(W, H)
	ground.mesh = pm
	ground.material_override = _mat(Color(th["ground"]), 0.95)
	ground.position = Vector3(W / 2, 0, H / 2)
	map_root.add_child(ground)
	# bordas
	_wall(Rect2(0, 0, W, T), Color(th["border"]), 1.8)
	_wall(Rect2(0, H - T, W, T), Color(th["border"]), 1.8)
	_wall(Rect2(0, 0, T, H), Color(th["border"]), 1.8)
	_wall(Rect2(W - T, 0, T, H), Color(th["border"]), 1.8)
	# muros (mesmos segmentos do 2D)
	for s in data["walls"]:
		var x1: float = s[0] * W
		var y1: float = s[1] * H
		var x2: float = s[2] * W
		var y2: float = s[3] * H
		_wall(Rect2(min(x1, x2) - T / 2, min(y1, y2) - T / 2, abs(x2 - x1) + T, abs(y2 - y1) + T), Color(th["wall"]), WALL_H)
	# decoração low-poly
	var rng := RandomNumberGenerator.new()
	rng.seed = i * 97 + 5
	for n in 34:
		var p := Vector3(rng.randf_range(1.5, W - 1.5), 0, rng.randf_range(1.5, H - 1.5))
		var rock := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radial_segments = 5
		sm.rings = 3
		var k := rng.randf_range(0.15, 0.4)
		sm.radius = k
		sm.height = k * 1.2
		rock.mesh = _flat(sm)
		var deco_color := Color(th["wallEdge"]).lightened(0.25) if th["deco"] != "snow" else Color.WHITE
		if th["deco"] == "tree":
			deco_color = Color("#3f7d3a")
		rock.material_override = _mat(deco_color)
		rock.position = p
		rock.rotation = Vector3(rng.randf() * 3, rng.randf() * 3, 0)
		map_root.add_child(rock)
	# jogadores: você no time azul, 2 bots no vermelho
	me = _spawn_fighter("A", "Você", false)
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


# ---------------- personagens ----------------
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
	cyl.height = 1.2
	shape.shape = cyl
	shape.position.y = 0.6
	f.add_child(shape)
	# visual low-poly
	f.model = Node3D.new()
	f.add_child(f.model)
	f.body_mat = _mat(TEAM_COLOR[team])
	var body := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = PLAYER_R * 0.8
	cm.bottom_radius = PLAYER_R * 0.95
	cm.height = PLAYER_R * 1.25
	cm.radial_segments = 8
	body.mesh = _flat(cm)
	body.material_override = f.body_mat
	body.position.y = PLAYER_R * 0.62
	f.model.add_child(body)
	var head := MeshInstance3D.new()
	var hm := SphereMesh.new()
	hm.radius = PLAYER_R * 0.55
	hm.height = PLAYER_R * 1.1
	hm.radial_segments = 6
	hm.rings = 3
	head.mesh = _flat(hm)
	head.material_override = _mat(TEAM_LIGHT[team])
	head.position.y = PLAYER_R * 1.6
	f.model.add_child(head)
	for side in [-1, 1]:
		var eye := MeshInstance3D.new()
		var em := BoxMesh.new()
		em.size = Vector3(0.05, 0.07, 0.03)
		eye.mesh = em
		eye.material_override = _mat(Color.BLACK)
		eye.position = Vector3(PLAYER_R * 0.5, PLAYER_R * 1.65, side * PLAYER_R * 0.2)
		f.model.add_child(eye)
	var gun := MeshInstance3D.new()
	var gm := BoxMesh.new()
	gm.size = Vector3(PLAYER_R * 1.1, PLAYER_R * 0.26, PLAYER_R * 0.26)
	gun.mesh = gm
	gun.material_override = _mat(Color("#1f2937"), 0.4, 0.6)
	gun.position = Vector3(PLAYER_R * 0.95, GUN_Y, PLAYER_R * 0.35)
	f.model.add_child(gun)
	# anel do time no chão
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = PLAYER_R * 1.05
	tm.outer_radius = PLAYER_R * 1.3
	ring.mesh = tm
	var rm := _mat(TEAM_COLOR[team])
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring.material_override = rm
	ring.scale = Vector3(1, 0.05, 1)
	ring.position.y = 0.02
	f.add_child(ring)
	# nome
	f.label = Label3D.new()
	f.label.text = nick
	f.label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	f.label.no_depth_test = true
	f.label.font_size = 42
	f.label.outline_size = 10
	f.label.modulate = Color("#ffcc33") if not bot else Color.WHITE
	f.label.position.y = 2.0
	f.add_child(f.label)
	map_root.add_child(f)
	fighters.append(f)
	_respawn(f)
	return f


func _respawn(f: Fighter) -> void:
	var x := randf_range(1.5, 4.0) if f.team == "A" else randf_range(W - 4.0, W - 1.5)
	f.position = Vector3(x, 0, randf_range(3.0, H - 3.0))
	f.reset_physics_interpolation()
	f.lives = LIVES
	f.alive = true
	f.visible = true
	f.ammo = MAG
	f.mags = MAGS
	f.reload_until = 0.0
	f.invuln_until = time + 1.0
	f.model.scale = Vector3.ONE
	f.aim = Vector3(1 if f.team == "A" else -1, 0, 0)


func _hit(f: Fighter, by: Fighter) -> void:
	if not f.alive or time < f.invuln_until or f.jump_t0 >= 0:
		return
	f.lives -= 1
	f.invuln_until = time + INVULN
	if f.lives <= 0:
		f.alive = false
		f.visible = false
		f.deaths += 1
		f.respawn_at = time + RESPAWN
		if by:
			by.kills += 1
		feed_label.text = "%s  acertou  %s" % [by.nick if by else "?", f.nick]
		feed_until = time + 2.5
	else:
		f.model.scale = Vector3.ONE * SHRINK


# ---------------- entrada ----------------
func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo:
		match e.physical_keycode:
			KEY_SPACE: _try_jump(me)
			KEY_R: _reload(me)
			KEY_C: cam_mode = (cam_mode + 1) % 3
			KEY_M: _load_map((map_index + 1) % MAP_IDS.size())
			KEY_V:
				var vs := DisplayServer.window_get_vsync_mode()
				DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED if vs != DisplayServer.VSYNC_DISABLED else DisplayServer.VSYNC_ENABLED)
			KEY_F11:
				var full := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
				DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if full else DisplayServer.WINDOW_MODE_FULLSCREEN)


func _mouse_aim() -> void:
	if not me or not me.alive:
		return
	var mp := get_viewport().get_mouse_position()
	var from := camera.project_ray_origin(mp)
	var dir := camera.project_ray_normal(mp)
	var hit = aim_plane.intersects_ray(from, dir)
	if hit != null:
		var d: Vector3 = hit - me.global_position
		d.y = 0
		if d.length() > 0.1:
			me.aim = d.normalized()


# ---------------- ações ----------------
func _try_fire(f: Fighter) -> void:
	if not f.alive or time < f.fire_ready or f.reload_until > 0 or f.jump_t0 >= 0:
		return
	if f.ammo <= 0:
		_reload(f)
		return
	f.ammo -= 1
	f.fire_ready = time + FIRE_CD
	var b := Bullet.new()
	var sm := SphereMesh.new()
	sm.radius = 0.12
	sm.height = 0.24
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
	b.position = f.global_position + f.aim * (f.radius() + 0.2) + Vector3(0, GUN_Y, 0)
	map_root.add_child(b)
	bullets.append(b)
	if f.ammo <= 0:
		_reload(f)


func _reload(f: Fighter) -> void:
	if f.reload_until > 0 or f.mags <= 0 or f.ammo >= MAG:
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


# ---------------- simulação (60 vezes por segundo; a imagem é interpolada) ----------------
func _physics_process(dt: float) -> void:
	time += dt
	_mouse_aim()
	for f in fighters:
		_update_fighter(f, dt)
	_update_bullets(dt)


func _update_fighter(f: Fighter, dt: float) -> void:
	if f.reload_until > 0 and time >= f.reload_until:
		f.reload_until = 0.0
		f.ammo = MAG
		f.mags -= 1
	if not f.alive:
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
		if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP): dir.z -= 1
		if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN): dir.z += 1
		if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT): dir.x -= 1
		if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT): dir.x += 1
		fire = Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT)
	dir = dir.normalized()
	var air := 0.0
	if f.jump_t0 >= 0:
		# super pulo: vai rápido na direção escolhida, em arco
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
	f.model.rotation.y = -atan2(f.aim.z, f.aim.x)
	f.model.visible = not (time < f.invuln_until and f.lives == LIVES and fmod(time, 0.2) < 0.1)
	if fire:
		_try_fire(f)


# bot simples: anda, procura você, mira com um pouco de erro e atira quando te vê
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
		var q := PhysicsRayQueryParameters3D.create(f.global_position + Vector3(0, GUN_Y, 0), target.global_position + Vector3(0, GUN_Y, 0), 1)
		sees = get_world_3d().direct_space_state.intersect_ray(q).is_empty()
	f.think_t -= dt
	if f.think_t <= 0:
		f.think_t = randf_range(0.5, 1.3)
		f.aim_err = randf_range(-0.25, 0.25)
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
	if randf() < dt * 0.05:
		_try_jump(f)
	return [f.move_dir, target != null and sees]


func _update_bullets(dt: float) -> void:
	var space := get_world_3d().direct_space_state
	for b in bullets.duplicate():
		var dead := false
		var from: Vector3 = b.position
		var to: Vector3 = from + b.vel * dt
		# balas batem nos muros (camada 1) e nos personagens (camada 2)
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
				exclude.append(col.get_rid()) # amigo: passa por ele
				continue
			# muro: ricocheteia (fica sempre na mesma altura)
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


# ---------------- câmera e HUD (a cada quadro do monitor) ----------------
func _process(dt: float) -> void:
	if me:
		var p := me.get_global_transform_interpolated().origin # posição suave entre os passos da física
		var off: Vector3 = [Vector3(0, 17.5, 11.8), Vector3(0, 25.0, 0.05), Vector3(0, 9.0, 11.8)][cam_mode]
		var want: Vector3 = p + off
		camera.position = camera.position.lerp(want, clamp(dt * 8.0, 0.0, 1.0)) if camera.position != Vector3.ZERO else want
		camera.look_at(p + Vector3(0, 0, 0.8 if cam_mode != 2 else -1.5), Vector3.UP)
	_update_hud()


func _setup_hud() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	var panel := PanelContainer.new()
	panel.position = Vector2(12, 12)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.04, 0.055, 0.086, 0.85)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(12)
	panel.add_theme_stylebox_override("panel", sb)
	layer.add_child(panel)
	hud_label = Label.new()
	hud_label.add_theme_font_size_override("font_size", 16)
	panel.add_child(hud_label)
	feed_label = Label.new()
	feed_label.add_theme_font_size_override("font_size", 20)
	feed_label.anchor_left = 0.5
	feed_label.anchor_right = 0.5
	feed_label.position = Vector2(-150, 16)
	feed_label.size = Vector2(300, 30)
	feed_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	layer.add_child(feed_label)
	var hp := PanelContainer.new()
	hp.add_theme_stylebox_override("panel", sb)
	hp.anchor_top = 1.0
	hp.anchor_bottom = 1.0
	hp.position = Vector2(12, -56)
	var help := Label.new()
	help.text = "WASD andar · Mouse mirar · Clique atirar · Espaço pulo · R recarregar · C câmera · M trocar mapa · V liga/desliga V-Sync · F11 tela cheia"
	help.modulate = Color(0.7, 0.75, 0.85)
	hp.add_child(help)
	layer.add_child(hp)


func _update_hud() -> void:
	if not me:
		return
	var vs := "ligado (segue o Hz do monitor)" if DisplayServer.window_get_vsync_mode() != DisplayServer.VSYNC_DISABLED else "desligado (sem limite)"
	var ammo := "recarregando..." if me.reload_until > 0 else "%d/%d  · pentes %d" % [me.ammo, MAG, me.mags]
	var jump := "PRONTO (Espaço)" if time >= me.jump_ready_at else "em %ds" % ceil(me.jump_ready_at - time)
	hud_label.text = "POINT BALL · DEMO 3D (GODOT %s)\nVidas: %s\nMunição: %s\nPulo: %s\nAbates %d · Mortes %d\nMapa: %s\nFPS: %d  ·  V-Sync %s" % [
		Engine.get_version_info()["string"].split(".stable")[0], "♥ ".repeat(max(me.lives, 0)) if me.alive else "renascendo...", ammo, jump,
		me.kills, me.deaths, MAP_IDS[map_index], Engine.get_frames_per_second(), vs]
	feed_label.visible = time < feed_until
