# Actions y cambios necesarios (Frontend)

Este documento resume las acciones reales del backend y los cambios necesarios en el frontend para que los dispositivos y las rutinas apliquen configuracion real (no solo on/off local).

## 1) Acciones disponibles por tipo (backend)

Fuente: `GET /devices/devicetypes/{deviceTypeId}`.

- ac (go46xmbqeomjrsjr)
  - turnOn, turnOff
  - setTemperature(integer)
  - setMode(string)
  - setVerticalSwing(string)
  - setHorizontalSwing(string)
  - setFanSpeed(string)

- lamp (eu0v2xgprrhhg41g)
  - turnOn, turnOff
  - setBrightness(integer)
  - setColor(string)

- oven (lsf78ly0eqrjbz91)
  - turnOn, turnOff
  - setTemperature(integer)
  - setHeat(string)
  - setGrill(string)
  - setConvection(string)

- refrigerator (rnizejqr2di0okho)
  - setFreezerTemperature(integer)
  - setMode(string)

- blinds (mxztsyjzsrq7iaqc)
  - up, down
  - setLevel(integer)

- door (c89qmhhzm3bcpoie)
  - open, close, lock, unlock

- faucet (dbrlsh0juhf3dhf0)
  - open, close
  - dispense(integer quantity, string unit)

- speaker (fud5vmuy0fkh6zt9)
  - play, stop, pause, resume, nextSong, previousSong
  - setVolume(integer)
  - setGenre(string)

- vacuum (ofglvd9gqx8yfl3l)
  - start, pause, dock
  - setMode(string)

- alarm (im77xxyulpegfmv8)
  - armStay, armAway, disarm

- timer (rnizejqr2di0o43o)
  - sin acciones

## 2) Estado actual del frontend (problema)

- Los controles de dispositivos principales (AC, oven, fridge, lamp) guardan configuracion en localStorage.
- Solo se lee el estado remoto al montar (`GET /devices/{id}/state`).
- No se ejecutan acciones remotas al cambiar controles, por eso:
  - En otro navegador solo se refleja on/off.
  - Parametros como temperatura, modo, etc. quedan locales.

Componentes actuales:
- AC: [src/modules/devices/components/controls/AcControls.vue](src/modules/devices/components/controls/AcControls.vue) (solo localStorage)
- Oven: [src/modules/devices/components/controls/OvenControls.vue](src/modules/devices/components/controls/OvenControls.vue) (solo localStorage)
- Fridge: [src/modules/devices/components/controls/FridgeControls.vue](src/modules/devices/components/controls/FridgeControls.vue) (solo localStorage)
- Lamp: [src/modules/devices/components/controls/LampControls.vue](src/modules/devices/components/controls/LampControls.vue) (solo localStorage)
- Alarm: [src/modules/devices/components/controls/AlarmControls.vue](src/modules/devices/components/controls/AlarmControls.vue) (usa PATCH real)
- Blinds: [src/modules/devices/components/controls/BlindControls.vue](src/modules/devices/components/controls/BlindControls.vue) (usa PATCH real)
- Door: [src/modules/devices/components/controls/DoorControls.vue](src/modules/devices/components/controls/DoorControls.vue) (usa PATCH real)
- Tap: [src/modules/devices/components/controls/TapControls.vue](src/modules/devices/components/controls/TapControls.vue) (usa PATCH real)

## 3) Cambios necesarios (dispositivos)

Objetivo: cuando el usuario cambia un control, ejecutar la accion real en backend usando:

PATCH /devices/{deviceId}/{actionName}
Body: { "params": [ ... ] }

Acciones a mapear por componente:

- AC
  - toggle power -> turnOn / turnOff
  - temperature -> setTemperature([number])
  - mode -> setMode([string])
  - verticalSwing -> setVerticalSwing([string])
  - horizontalSwing -> setHorizontalSwing([string])
  - fanSpeed -> setFanSpeed([string])

- Oven
  - toggle power -> turnOn / turnOff
  - temperature -> setTemperature([number])
  - heatSource -> setHeat([string])
  - grill -> setGrill([string])
  - convection -> setConvection([string])

- Fridge
  - mode -> setMode([string])
  - freezerTemp -> setFreezerTemperature([number])
  - (si existe fridgeTemp en UI, definir si se usa otra accion; backend no lista setFridgeTemperature)

- Lamp
  - toggle power -> turnOn / turnOff
  - brightness -> setBrightness([number])
  - color -> setColor([string])

- Alarm (ya usa acciones reales)
  - disarmed -> disarm([])
  - armedStay -> armStay([])
  - armedAway -> armAway([])
  - changeSecurityCode no figura en acciones (confirmar si es un endpoint extra valido)

- Blinds (usa setLevel, no usa up/down)
  - posicion -> setLevel([number])
  - abrir/cerrar se mapea a setLevel(100/0)

- Door (ya usa acciones reales)
  - open, close, lock, unlock

- Tap/Faucet (ya usa acciones reales)
  - open, close
  - dispense([quantity, unit])

Notas:
- Si se mantiene cache local, deberia sincronizarse con la respuesta del backend.
- Ideal: remover localStorage o usarlo solo como fallback offline.
- Params pueden enviarse como objeto, pero el backend ignora los nombres; usa Object.values() y el orden importa.
- Speaker, vacuum, timer no tienen UI en devices/controls hoy.

## 4) Cambios necesarios (rutinas)

Objetivo: que ejecutar una rutina aplique configuracion, no solo on/off.

Actualmente:
- En [src/modules/routines/components/RoutineFormModal.vue](src/modules/routines/components/RoutineFormModal.vue)
  se envia solo turnOn/turnOff con params: []

Propuesta:
- Cuando se crea una rutina, generar acciones por dispositivo en este orden:
  1) Acciones de configuracion (setTemperature, setMode, etc.) con params.
  2) Accion de encendido/apagado (turnOn/turnOff).

Ejemplo AC:
- setMode(["cool"])
- setTemperature([24])
- setFanSpeed(["auto"])
- turnOn([])

Ejemplo Lamp:
- setBrightness([80])
- setColor(["white"])
- turnOn([])

Notas:
- La rutina debe respetar el orden de acciones en el array.
- Parametros siempre por posicion, array simple.

## 5) Referencias API

- GET /devices/{deviceId} -> trae type.id y estado
- GET /devices/devicetypes/{deviceTypeId} -> trae acciones con params
- PATCH /devices/{deviceId}/{actionName} -> ejecuta accion
- POST /routines -> crea rutina con acciones
- PATCH /routines/{id}/execute -> ejecuta acciones en orden

## 6) Validaciones y dudas a resolver

- Confirmar si fridge necesita setFridgeTemperature (no aparece en acciones).
- Confirmar si oven usa setHeat/setGrill/setConvection (estado usa heat/grill/convection).
- Definir si acciones invalidas deben ser omitidas o generan error en UI.
- Confirmar si changeSecurityCode esta soportado para alarm.
